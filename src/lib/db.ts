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
  Apartado,
  Abono,
  Meta,
  Cuadre,
  Configuracion,
  MetodoPago,
  TipoApartado,
  EstadoApartado,
} from "./types";

function db() {
  return createClient();
}

// ---------- Mapeos fila → modelo ----------
type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => String(v ?? "");

function mVenta(r: Row): Venta {
  return { id: s(r.id), negocioId: s(r.negocio_id), fecha: s(r.fecha), metodo: r.metodo as MetodoPago, monto: n(r.monto), creadoEn: s(r.creado_en) };
}
function mGasto(r: Row): Gasto {
  return { id: s(r.id), negocioId: s(r.negocio_id), fecha: s(r.fecha), concepto: s(r.concepto), monto: n(r.monto), creadoEn: s(r.creado_en) };
}
function mEntrada(r: Row): Entrada {
  return { id: s(r.id), negocioId: s(r.negocio_id), fecha: s(r.fecha), concepto: s(r.concepto), monto: n(r.monto), creadoEn: s(r.creado_en) };
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

// ---------- Carga completa de un negocio ----------
export interface DatosNegocio {
  ventas: Venta[];
  gastos: Gasto[];
  entradas: Entrada[];
  apartados: Apartado[];
  metas: Meta[];
  cuadres: Cuadre[];
}

export async function cargarTodo(negocioId: string): Promise<DatosNegocio> {
  const c = db();
  const [ventas, gastos, entradas, apartados, metas, cuadres] = await Promise.all([
    c.from("ventas").select("*").eq("negocio_id", negocioId),
    c.from("gastos").select("*").eq("negocio_id", negocioId),
    c.from("entradas").select("*").eq("negocio_id", negocioId),
    c.from("apartados").select("*, abonos(*)").eq("negocio_id", negocioId),
    c.from("metas").select("*").eq("negocio_id", negocioId),
    c.from("cuadres").select("*").eq("negocio_id", negocioId),
  ]);
  for (const r of [ventas, gastos, entradas, apartados, metas, cuadres]) {
    if (r.error) throw r.error;
  }
  return {
    ventas: (ventas.data ?? []).map(mVenta),
    gastos: (gastos.data ?? []).map(mGasto),
    entradas: (entradas.data ?? []).map(mEntrada),
    apartados: (apartados.data ?? []).map(mApartado),
    metas: (metas.data ?? []).map(mMeta),
    cuadres: (cuadres.data ?? []).map(mCuadre),
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
  return { whatsapp: s(data?.whatsapp), correoCodigos: s(data?.correo_codigos) };
}

export async function guardarConfig(negocioId: string, patch: Partial<Configuracion>): Promise<Configuracion> {
  const actual = await cargarConfig(negocioId);
  const fila = {
    negocio_id: negocioId,
    whatsapp: patch.whatsapp ?? actual.whatsapp,
    correo_codigos: patch.correoCodigos ?? actual.correoCodigos,
    actualizado_en: new Date().toISOString(),
  };
  const { data, error } = await db().from("configuracion").upsert(fila, { onConflict: "negocio_id" }).select().single();
  if (error) throw error;
  return { whatsapp: s(data.whatsapp), correoCodigos: s(data.correo_codigos) };
}

// ---------- Códigos de acceso (Fase 7b) ----------
export async function generarCodigo(negocioId: string): Promise<{ codigo: string; expiraEn: string }> {
  const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  const expiraEn = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error } = await db().from("codigos").insert({ negocio_id: negocioId, codigo, expira_en: expiraEn });
  if (error) throw error;
  return { codigo, expiraEn };
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
