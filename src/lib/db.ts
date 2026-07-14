"use client";
// ─── Almacén Diana G 🐝 — Capa de datos (Supabase) ───
// Traduce entre el modelo de la app (camelCase) y las tablas (snake_case).
// La seguridad (quién ve qué) la aplica RLS en la base de datos.

import { createClient } from "@/lib/supabase/client";
import type {
  Negocio,
  Venta,
  Gasto,
  Entrada,
  GastoMensual,
  MetodoGasto,
  Apartado,
  Abono,
  Meta,
  Cuadre,
  Configuracion,
  RegistroHora,
  Tarea,
  OpPendiente,
  MetodoPago,
  TipoApartado,
  EstadoApartado,
} from "./types";

function db() {
  return createClient();
}

/**
 * Ejecuta una operación de la cola offline contra Supabase.
 * Los "insert" se hacen como upsert (por id) para que reintentar no duplique.
 */
export async function ejecutarOperacion(op: OpPendiente): Promise<void> {
  const t = db().from(op.tabla);
  if (op.tipo === "delete") {
    const { error } = await t.delete().eq("id", (op.payload as { id: string }).id);
    if (error) throw error;
    return;
  }
  if (op.tipo === "update") {
    const p = op.payload as { id: string; patch: Record<string, unknown> };
    const { error } = await t.update(p.patch).eq("id", p.id);
    if (error) throw error;
    return;
  }
  // insert / upsert → upsert idempotente
  const { error } = await t.upsert(op.payload, op.onConflict ? { onConflict: op.onConflict } : undefined);
  if (error) throw error;
}

// ---------- Mapeos fila → modelo ----------
type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => String(v ?? "");

function mVenta(r: Row): Venta {
  return { id: s(r.id), negocioId: s(r.negocio_id), fecha: s(r.fecha), metodo: r.metodo as MetodoPago, monto: n(r.monto), creadoEn: s(r.creado_en) };
}
function mGasto(r: Row): Gasto {
  return {
    id: s(r.id),
    negocioId: s(r.negocio_id),
    fecha: s(r.fecha),
    concepto: s(r.concepto),
    monto: n(r.monto),
    creadoEn: s(r.creado_en),
    empleadoId: r.empleado_id ? s(r.empleado_id) : undefined,
    firma: r.firma ? s(r.firma) : undefined,
  };
}
function mEntrada(r: Row): Entrada {
  return { id: s(r.id), negocioId: s(r.negocio_id), fecha: s(r.fecha), concepto: s(r.concepto), monto: n(r.monto), creadoEn: s(r.creado_en) };
}
function mGastoMensual(r: Row): GastoMensual {
  return {
    id: s(r.id),
    negocioId: s(r.negocio_id),
    fecha: s(r.fecha),
    concepto: s(r.concepto),
    monto: n(r.monto),
    metodo: (r.metodo as MetodoGasto) ?? "efectivo",
    metodoOtro: r.metodo_otro ? s(r.metodo_otro) : undefined,
    creadoEn: s(r.creado_en),
  };
}
function mAbono(r: Row): Abono {
  return { id: s(r.id), fecha: s(r.fecha), monto: n(r.monto), metodo: (r.metodo as MetodoPago) ?? "efectivo" };
}
function mApartado(r: Row): Apartado {
  const abonos = Array.isArray(r.abonos) ? (r.abonos as Row[]).map(mAbono).sort((a, b) => a.fecha.localeCompare(b.fecha)) : [];
  return {
    id: s(r.id),
    negocioId: s(r.negocio_id),
    tipo: (r.tipo as TipoApartado) ?? "apartado",
    descripcion: s(r.descripcion),
    fecha: s(r.fecha),
    cliente: s(r.cliente),
    telefono: s(r.telefono),
    valorTotal: n(r.valor_total),
    abonos,
    estado: (r.estado as EstadoApartado) ?? "pendiente",
    conseguido: Boolean(r.conseguido),
    entregado: Boolean(r.entregado),
    creadoEn: s(r.creado_en),
  };
}
function mMeta(r: Row): Meta {
  return { id: s(r.id), negocioId: s(r.negocio_id), anio: n(r.anio), mes: n(r.mes), montoMeta: n(r.monto_meta) };
}
function mCuadre(r: Row): Cuadre {
  return {
    id: s(r.id),
    negocioId: s(r.negocio_id),
    fecha: s(r.fecha),
    efectivoReal: n(r.efectivo_real),
    baseSiguiente: n(r.base_siguiente),
    cuadrado: r.cuadrado === null || r.cuadrado === undefined ? null : Boolean(r.cuadrado),
    diferencia: n(r.diferencia),
    creadoEn: s(r.creado_en),
  };
}
function mNegocio(r: Row): Negocio {
  return { id: s(r.id), nombre: s(r.nombre), creadoEn: s(r.creado_en) };
}

// ---------- Negocios ----------
export async function cargarNegocios(): Promise<Negocio[]> {
  const { data, error } = await db().from("negocios").select("*").order("creado_en");
  if (error) throw error;
  return (data ?? []).map(mNegocio);
}

export interface Miembro {
  usuarioId: string;
  rol: string;
  email: string;
  nombre: string;
}

/** Lista de miembros de un negocio (para el panel de admin). */
export async function cargarMiembros(negocioId: string): Promise<Miembro[]> {
  const { data, error } = await db()
    .from("miembros")
    .select("usuario_id, rol, email, nombre, creado_en")
    .eq("negocio_id", negocioId)
    .order("creado_en");
  if (error) throw error;
  return (data ?? []).map((r) => ({ usuarioId: s(r.usuario_id), rol: s(r.rol), email: s(r.email), nombre: s(r.nombre) }));
}

/** Rol del usuario actual en un negocio: "dueño" | "admin" | "empleado" | "". */
export async function miRol(negocioId: string): Promise<string> {
  const c = db();
  const { data: userData } = await c.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return "";
  const { data } = await c.from("miembros").select("rol").eq("negocio_id", negocioId).eq("usuario_id", uid).maybeSingle();
  return (data?.rol as string) ?? "";
}

/** Rol y nombre del usuario actual en un negocio (para el saludo personalizado). */
export async function miInfo(negocioId: string): Promise<{ rol: string; nombre: string; email: string }> {
  const c = db();
  const { data: userData } = await c.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { rol: "", nombre: "", email: "" };
  const { data } = await c.from("miembros").select("rol, nombre, email").eq("negocio_id", negocioId).eq("usuario_id", uid).maybeSingle();
  return { rol: s(data?.rol), nombre: s(data?.nombre), email: s(data?.email) };
}

export async function crearNegocioDB(nombre: string): Promise<Negocio> {
  const c = db();
  const { data: userData } = await c.auth.getUser();
  const uid = userData.user?.id;
  // Insertar SIN devolver el registro (evita el choque con la política de lectura,
  // ya que la membresía se crea por trigger justo después del insert).
  const { error } = await c.from("negocios").insert({ nombre, dueno_id: uid });
  if (error) throw error;
  // Ahora ya somos miembros: leer el negocio recién creado.
  const { data, error: e2 } = await c
    .from("negocios")
    .select("*")
    .eq("dueno_id", uid)
    .order("creado_en", { ascending: false })
    .limit(1)
    .single();
  if (e2) throw e2;
  return mNegocio(data);
}

// ---------- Carga de un negocio (por ventana de fechas) ----------
// "Base": datos de bajo volumen y siempre necesarios (apartados activos, metas, cuadres).
// "Movimientos": ventas/gastos/entradas, que crecen a diario → se cargan por rango de fechas.
export interface Base {
  apartados: Apartado[];
  metas: Meta[];
  cuadres: Cuadre[];
  gastosMensuales: GastoMensual[];
}
export interface Movimientos {
  ventas: Venta[];
  gastos: Gasto[];
  entradas: Entrada[];
}

export async function cargarBase(negocioId: string): Promise<Base> {
  const c = db();
  const [apartados, metas, cuadres] = await Promise.all([
    c.from("apartados").select("*, abonos(*)").eq("negocio_id", negocioId),
    c.from("metas").select("*").eq("negocio_id", negocioId),
    c.from("cuadres").select("*").eq("negocio_id", negocioId),
  ]);
  for (const r of [apartados, metas, cuadres]) {
    if (r.error) throw r.error;
  }
  // Gastos mensuales: tolerante a que la tabla aún no exista (no rompe la carga).
  let gastosMensuales: GastoMensual[] = [];
  try {
    const gm = await c.from("gastos_mensuales").select("*").eq("negocio_id", negocioId);
    if (!gm.error) gastosMensuales = (gm.data ?? []).map(mGastoMensual);
  } catch {
    /* la tabla aún no se ha creado */
  }
  return {
    apartados: (apartados.data ?? []).map(mApartado),
    metas: (metas.data ?? []).map(mMeta),
    cuadres: (cuadres.data ?? []).map(mCuadre),
    gastosMensuales,
  };
}

export async function cargarMovimientos(negocioId: string, desde: string, hasta: string): Promise<Movimientos> {
  const c = db();
  const rango = (t: string) => c.from(t).select("*").eq("negocio_id", negocioId).gte("fecha", desde).lte("fecha", hasta);
  const [ventas, gastos, entradas] = await Promise.all([rango("ventas"), rango("gastos"), rango("entradas")]);
  for (const r of [ventas, gastos, entradas]) {
    if (r.error) throw r.error;
  }
  return {
    ventas: (ventas.data ?? []).map(mVenta),
    gastos: (gastos.data ?? []).map(mGasto),
    entradas: (entradas.data ?? []).map(mEntrada),
  };
}

// ---------- Ventas ----------
export async function insertVenta(v: { negocioId: string; fecha: string; metodo: MetodoPago; monto: number }): Promise<Venta> {
  const { data, error } = await db().from("ventas").insert({ negocio_id: v.negocioId, fecha: v.fecha, metodo: v.metodo, monto: v.monto }).select().single();
  if (error) throw error;
  return mVenta(data);
}
export async function updateVenta(id: string, patch: { metodo: MetodoPago; monto: number }) {
  const { error } = await db().from("ventas").update({ metodo: patch.metodo, monto: patch.monto }).eq("id", id);
  if (error) throw error;
}
export async function deleteVenta(id: string) {
  const { error } = await db().from("ventas").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Gastos ----------
export async function insertGasto(g: { negocioId: string; fecha: string; concepto: string; monto: number }): Promise<Gasto> {
  const { data, error } = await db().from("gastos").insert({ negocio_id: g.negocioId, fecha: g.fecha, concepto: g.concepto, monto: g.monto }).select().single();
  if (error) throw error;
  return mGasto(data);
}
export async function updateGasto(id: string, patch: { concepto: string; monto: number }) {
  const { error } = await db().from("gastos").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteGasto(id: string) {
  const { error } = await db().from("gastos").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Entradas ----------
export async function insertEntrada(e: { negocioId: string; fecha: string; concepto: string; monto: number }): Promise<Entrada> {
  const { data, error } = await db().from("entradas").insert({ negocio_id: e.negocioId, fecha: e.fecha, concepto: e.concepto, monto: e.monto }).select().single();
  if (error) throw error;
  return mEntrada(data);
}
export async function updateEntrada(id: string, patch: { concepto: string; monto: number }) {
  const { error } = await db().from("entradas").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteEntrada(id: string) {
  const { error } = await db().from("entradas").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Apartados ----------
export async function insertApartado(a: {
  negocioId: string;
  tipo: TipoApartado;
  descripcion: string;
  fecha: string;
  cliente: string;
  telefono: string;
  valorTotal: number;
  estado: EstadoApartado;
}): Promise<Apartado> {
  const { data, error } = await db()
    .from("apartados")
    .insert({
      negocio_id: a.negocioId,
      tipo: a.tipo,
      descripcion: a.descripcion,
      fecha: a.fecha,
      cliente: a.cliente,
      telefono: a.telefono,
      valor_total: a.valorTotal,
      estado: a.estado,
    })
    .select("*, abonos(*)")
    .single();
  if (error) throw error;
  return mApartado(data);
}
export async function updateApartado(id: string, patch: Partial<{ cliente: string; telefono: string; fecha: string; valorTotal: number; descripcion: string; estado: EstadoApartado; conseguido: boolean; entregado: boolean }>) {
  const p: Row = {};
  if (patch.cliente !== undefined) p.cliente = patch.cliente;
  if (patch.telefono !== undefined) p.telefono = patch.telefono;
  if (patch.fecha !== undefined) p.fecha = patch.fecha;
  if (patch.valorTotal !== undefined) p.valor_total = patch.valorTotal;
  if (patch.descripcion !== undefined) p.descripcion = patch.descripcion;
  if (patch.estado !== undefined) p.estado = patch.estado;
  if (patch.conseguido !== undefined) p.conseguido = patch.conseguido;
  if (patch.entregado !== undefined) p.entregado = patch.entregado;
  const { error } = await db().from("apartados").update(p).eq("id", id);
  if (error) throw error;
}
export async function deleteApartado(id: string) {
  const { error } = await db().from("apartados").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Abonos ----------
export async function insertAbono(a: { apartadoId: string; fecha: string; monto: number; metodo: MetodoPago }): Promise<Abono> {
  const { data, error } = await db().from("abonos").insert({ apartado_id: a.apartadoId, fecha: a.fecha, monto: a.monto, metodo: a.metodo }).select().single();
  if (error) throw error;
  return mAbono(data);
}
export async function deleteAbono(id: string) {
  const { error } = await db().from("abonos").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Metas ----------
export async function upsertMeta(m: { negocioId: string; anio: number; mes: number; montoMeta: number }): Promise<Meta> {
  const { data, error } = await db()
    .from("metas")
    .upsert({ negocio_id: m.negocioId, anio: m.anio, mes: m.mes, monto_meta: m.montoMeta }, { onConflict: "negocio_id,anio,mes" })
    .select()
    .single();
  if (error) throw error;
  return mMeta(data);
}

// ---------- Configuración ----------
export async function cargarConfig(negocioId: string): Promise<Configuracion> {
  const { data, error } = await db().from("configuracion").select("*").eq("negocio_id", negocioId).maybeSingle();
  if (error) throw error;
  return { whatsapp: s(data?.whatsapp), correoCodigos: s(data?.correo_codigos), salarioMinimo: n(data?.salario_minimo) };
}

export async function guardarConfig(negocioId: string, patch: Partial<Configuracion>): Promise<Configuracion> {
  const actual = await cargarConfig(negocioId);
  const fila = {
    negocio_id: negocioId,
    whatsapp: patch.whatsapp ?? actual.whatsapp,
    correo_codigos: patch.correoCodigos ?? actual.correoCodigos,
    salario_minimo: patch.salarioMinimo ?? actual.salarioMinimo,
    actualizado_en: new Date().toISOString(),
  };
  const { data, error } = await db().from("configuracion").upsert(fila, { onConflict: "negocio_id" }).select().single();
  if (error) throw error;
  return { whatsapp: s(data.whatsapp), correoCodigos: s(data.correo_codigos), salarioMinimo: n(data.salario_minimo) };
}

// ---------- Nómina / Registro de hora (Fase 7c) ----------

/** El empleado registra su entrada (hora del servidor, Bogotá). */
export async function registrarEntrada(negocioId: string): Promise<{ minutosTarde: number; descuento: number; hora: string; error?: string }> {
  const { data, error } = await db().rpc("registrar_entrada", { p_negocio: negocioId });
  if (error) throw error;
  return data as { minutosTarde: number; descuento: number; hora: string; error?: string };
}

function mRegistroHora(r: Row): RegistroHora {
  return {
    id: s(r.id),
    usuarioId: s(r.usuario_id),
    fecha: s(r.fecha),
    hora: new Date(s(r.hora_entrada)).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }),
    minutosTarde: n(r.minutos_tarde),
    descuento: n(r.descuento),
    anulada: Boolean(r.anulada),
  };
}

/** (Admin) Marca una entrada como "llegó a tiempo": quita minutos tarde y descuento. */
export async function marcarEntradaATiempo(id: string): Promise<void> {
  const { error } = await db().from("registros_hora").update({ minutos_tarde: 0, descuento: 0 }).eq("id", id);
  if (error) throw error;
}

/** (Admin) Anula una entrada (por un malentendido). Sigue contando como registrada ese día. */
export async function anularEntrada(id: string, anulada: boolean): Promise<void> {
  const { error } = await db().from("registros_hora").update({ anulada }).eq("id", id);
  if (error) throw error;
}

/** (Admin) Elimina el registro visible de una entrada. El candado del día sigue vigente. */
export async function eliminarEntradaRegistro(id: string): Promise<void> {
  const { error } = await db().from("registros_hora").delete().eq("id", id);
  if (error) throw error;
}

/** ¿El usuario actual ya registró su entrada hoy? (candado inmutable, aunque el admin la borre) */
export async function entradaBloqueadaHoy(negocioId: string): Promise<boolean> {
  const c = db();
  const { data: u } = await c.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return false;
  const hoy = new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" });
  const { data } = await c
    .from("entradas_lock")
    .select("fecha")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", uid)
    .eq("fecha", hoy)
    .maybeSingle();
  return !!data;
}

/** (Admin) Edita un pago de nómina. Se exige firma nueva (constancia legal). */
export async function updatePagoEmpleado(id: string, patch: { concepto: string; monto: number; firma: string }): Promise<void> {
  const { error } = await db().from("gastos").update({ concepto: patch.concepto, monto: patch.monto, firma: patch.firma }).eq("id", id);
  if (error) throw error;
}

/** Registro de hora del usuario actual para hoy (o null). */
export async function miRegistroHoy(negocioId: string): Promise<RegistroHora | null> {
  const c = db();
  const { data: u } = await c.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await c
    .from("registros_hora")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", uid)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const hoy = new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" });
  return s(data.fecha) === hoy ? mRegistroHora(data) : null;
}

/** (Admin) Registros de hora de un empleado en un rango de fechas. */
export async function cargarRegistrosHora(negocioId: string, usuarioId: string, desde: string, hasta: string): Promise<RegistroHora[]> {
  const { data, error } = await db()
    .from("registros_hora")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", usuarioId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha");
  if (error) throw error;
  return (data ?? []).map(mRegistroHora);
}

/** (Admin) Registra un pago/abono a un empleado → se guarda como gasto. */
export async function insertPagoEmpleado(p: { negocioId: string; empleadoId: string; concepto: string; monto: number; fecha: string; firma?: string }): Promise<void> {
  const { error } = await db().from("gastos").insert({
    negocio_id: p.negocioId,
    fecha: p.fecha,
    concepto: p.concepto,
    monto: p.monto,
    empleado_id: p.empleadoId,
    firma: p.firma ?? null,
  });
  if (error) throw error;
}

/** (Admin) Pagos hechos a un empleado (gastos con empleado_id) en un rango. */
export async function cargarPagosEmpleado(negocioId: string, empleadoId: string, desde: string, hasta: string): Promise<Gasto[]> {
  const { data, error } = await db()
    .from("gastos")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("empleado_id", empleadoId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha");
  if (error) throw error;
  return (data ?? []).map(mGasto);
}

// ---------- Tareas / notas para colaboradores (Fase 7e) ----------
function mTarea(r: Row): Tarea {
  return {
    id: s(r.id),
    negocioId: s(r.negocio_id),
    usuarioId: s(r.usuario_id),
    fecha: s(r.fecha),
    descripcion: s(r.descripcion),
    progreso: n(r.progreso),
    completada: Boolean(r.completada),
    creadoEn: s(r.creado_en),
  };
}

/** (Admin) Tareas asignadas a un empleado en una fecha. */
export async function cargarTareas(negocioId: string, usuarioId: string, fecha: string): Promise<Tarea[]> {
  const { data, error } = await db()
    .from("tareas")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", usuarioId)
    .eq("fecha", fecha)
    .order("creado_en");
  if (error) throw error;
  return (data ?? []).map(mTarea);
}

/** (Empleado) Mis tareas de hoy. */
export async function misTareasHoy(negocioId: string): Promise<Tarea[]> {
  const c = db();
  const { data: u } = await c.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return [];
  const hoy = new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" });
  const { data, error } = await c
    .from("tareas")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", uid)
    .eq("fecha", hoy)
    .order("creado_en");
  if (error) throw error;
  return (data ?? []).map(mTarea);
}

/** (Admin) Crea una tarea para un empleado. */
export async function insertTarea(p: { negocioId: string; usuarioId: string; fecha: string; descripcion: string }): Promise<Tarea> {
  const { data, error } = await db()
    .from("tareas")
    .insert({ negocio_id: p.negocioId, usuario_id: p.usuarioId, fecha: p.fecha, descripcion: p.descripcion })
    .select("*")
    .single();
  if (error) throw error;
  return mTarea(data);
}

/** (Admin) Edita el texto de una tarea. */
export async function updateTareaTexto(id: string, descripcion: string): Promise<void> {
  const { error } = await db().from("tareas").update({ descripcion }).eq("id", id);
  if (error) throw error;
}

/** (Empleado o admin) Actualiza el avance / completada de una tarea. */
export async function updateTareaProgreso(id: string, progreso: number, completada: boolean): Promise<void> {
  const { error } = await db().from("tareas").update({ progreso, completada }).eq("id", id);
  if (error) throw error;
}

/** (Admin) Elimina una tarea. */
export async function deleteTarea(id: string): Promise<void> {
  const { error } = await db().from("tareas").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Códigos de acceso (Fase 7b) ----------
// Fin del día siguiente en hora Bogotá (UTC-5), como instante UTC.
function finDeMananaBogota(): string {
  const b = new Date(Date.now() - 5 * 3600 * 1000); // campos UTC = reloj Bogotá
  b.setUTCHours(23, 59, 59, 0);
  b.setUTCDate(b.getUTCDate() + 1); // mañana
  return new Date(b.getTime() + 5 * 3600 * 1000).toISOString(); // volver a UTC real
}

export async function generarCodigo(negocioId: string): Promise<{ codigo: string; expiraEn: string }> {
  await db().from("codigos").delete().eq("negocio_id", negocioId); // solo un código activo
  const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  const expiraEn = finDeMananaBogota();
  const { error } = await db().from("codigos").insert({ negocio_id: negocioId, codigo, expira_en: expiraEn });
  if (error) throw error;
  return { codigo, expiraEn };
}

export async function codigoActivo(negocioId: string): Promise<{ codigo: string; expiraEn: string } | null> {
  const { data } = await db()
    .from("codigos")
    .select("codigo, expira_en")
    .eq("negocio_id", negocioId)
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { codigo: s(data.codigo), expiraEn: s(data.expira_en) } : null;
}

export async function cancelarCodigo(negocioId: string): Promise<void> {
  const { error } = await db().from("codigos").delete().eq("negocio_id", negocioId);
  if (error) throw error;
}

export async function validarCodigo(negocioId: string, codigo: string): Promise<boolean> {
  const { data, error } = await db().rpc("validar_codigo", { p_negocio: negocioId, p_codigo: codigo.trim() });
  if (error) throw error;
  return Boolean(data);
}

// ---------- Cuadres ----------
export async function upsertCuadre(c: {
  negocioId: string;
  fecha: string;
  efectivoReal?: number;
  cuadrado?: boolean | null;
  diferencia?: number;
}): Promise<Cuadre> {
  // Trae el actual para no pisar los otros campos
  const existente = await db().from("cuadres").select("*").eq("negocio_id", c.negocioId).eq("fecha", c.fecha).maybeSingle();
  const base = existente.data ? mCuadre(existente.data) : null;
  const fila = {
    negocio_id: c.negocioId,
    fecha: c.fecha,
    efectivo_real: c.efectivoReal ?? base?.efectivoReal ?? 0,
    cuadrado: c.cuadrado !== undefined ? c.cuadrado : (base?.cuadrado ?? null),
    diferencia: c.diferencia ?? base?.diferencia ?? 0,
  };
  const { data, error } = await db().from("cuadres").upsert(fila, { onConflict: "negocio_id,fecha" }).select().single();
  if (error) throw error;
  return mCuadre(data);
}

// ---------- Respaldo (copia de seguridad) ----------
// Tablas del negocio que tienen columna negocio_id.
const TABLAS_NEGOCIO = ["ventas", "gastos", "entradas", "apartados", "metas", "cuadres", "registros_hora", "tareas", "configuracion"] as const;

/** Descarga TODOS los datos del negocio (filas crudas) para un respaldo. */
export async function exportarDatos(negocioId: string): Promise<Record<string, Row[]>> {
  const c = db();
  const out: Record<string, Row[]> = {};
  for (const t of TABLAS_NEGOCIO) {
    const { data, error } = await c.from(t).select("*").eq("negocio_id", negocioId);
    if (error) throw error;
    out[t] = (data ?? []) as Row[];
  }
  // Abonos: se relacionan por apartado (no tienen negocio_id)
  const apIds = (out.apartados ?? []).map((a) => a.id as string);
  if (apIds.length) {
    const { data, error } = await c.from("abonos").select("*").in("apartado_id", apIds);
    if (error) throw error;
    out.abonos = (data ?? []) as Row[];
  } else {
    out.abonos = [];
  }
  return out;
}

/**
 * Restaura un respaldo en el MISMO negocio: vuelve a insertar los registros por id
 * (los que ya existan se dejan igual). Sirve para recuperar datos borrados por error.
 */
export async function restaurarDatos(negocioId: string, datos: Record<string, Row[]>): Promise<void> {
  const c = db();
  const conNegocio = (rows: Row[] | undefined) => (rows ?? []).map((r) => ({ ...r, negocio_id: negocioId }));
  const upsert = async (tabla: string, rows: Row[]) => {
    if (!rows.length) return;
    const { error } = await c.from(tabla).upsert(rows);
    if (error) throw error;
  };
  // Primero apartados (los abonos dependen de ellos)
  await upsert("apartados", conNegocio(datos.apartados));
  await upsert("abonos", datos.abonos ?? []); // sin negocio_id
  for (const t of ["ventas", "gastos", "entradas", "metas", "cuadres", "registros_hora", "tareas"]) {
    await upsert(t, conNegocio(datos[t]));
  }
  await upsert("configuracion", conNegocio(datos.configuracion));
}
