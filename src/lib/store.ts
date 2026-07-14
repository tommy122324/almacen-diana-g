// ─── Almacén Diana G 🐝 — Store (respaldado en Supabase) ───
// Mantiene el estado en memoria para que la interfaz siga siendo instantánea,
// pero cada cambio se guarda en Supabase (la nube). Los datos se cargan por negocio.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as db from "./db";
import { idbStorage } from "./idbStorage";
import { avisarError } from "./alerta";
import type {
  Negocio,
  Venta,
  Gasto,
  Entrada,
  GastoMensual,
  Apartado,
  Abono,
  Meta,
  Cuadre,
  Configuracion,
  MetodoPago,
  MetodoGasto,
  TipoApartado,
  OpPendiente,
} from "./types";
import { periodoDe, type TipoPeriodo } from "./calc";

/** Suma de abonos de un apartado. */
export function abonadoDe(a: Apartado): number {
  return a.abonos.reduce((s, ab) => s + ab.monto, 0);
}
/** Saldo pendiente de un apartado (valor total − abonado). */
export function saldoDe(a: Apartado): number {
  return Math.max(0, a.valorTotal - abonadoDe(a));
}
/** Caja de ayer = el efectivo contado en el día anterior más reciente con cuadre. */
export function cajaAyerDe(cuadres: Cuadre[], negocioId: string | null, fecha: string): number {
  if (!negocioId) return 0;
  const prev = cuadres
    .filter((c) => c.negocioId === negocioId && c.fecha < fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return prev?.efectivoReal ?? 0;
}

function estadoDe(valorTotal: number, abonado: number): "pendiente" | "completado" {
  return valorTotal > 0 && abonado >= valorTotal ? "completado" : "pendiente";
}

interface State {
  cargando: boolean;
  cargado: boolean;
  negocios: Negocio[];
  negocioActivoId: string | null;
  ventas: Venta[];
  gastos: Gasto[];
  entradas: Entrada[];
  apartados: Apartado[];
  metas: Meta[];
  cuadres: Cuadre[];
  gastosMensuales: GastoMensual[];
  config: Configuracion;
  setConfig: (patch: Partial<Configuracion>) => Promise<void>;

  // Rol del usuario actual en el negocio activo
  miRol: string; // "dueño" | "admin" | "empleado" | ""
  miNombre: string; // nombre del usuario actual (para el saludo)
  esAdmin: boolean;

  // Preferencia del panel (persiste al cambiar de pestaña)
  panelTipo: TipoPeriodo;
  panelDesde: string;
  panelHasta: string;
  setPanelPeriodo: (p: { tipo?: TipoPeriodo; desde?: string; hasta?: string }) => void;

  // Sincronía en tiempo real: se incrementa cuando llega un cambio remoto,
  // para que las pantallas que cargan sus propios datos (nómina) se refresquen.
  revision: number;
  refrescarRemoto: () => Promise<void>;

  // Ventana de fechas cargada para ventas/gastos/entradas (para no traer TODO).
  movDesde: string;
  movHasta: string;
  cargandoRango: boolean;
  asegurarRango: (desde: string, hasta: string) => Promise<void>;

  // Cola offline: operaciones pendientes de subir a la nube.
  pendientes: OpPendiente[];
  sincronizando: boolean;
  encolar: (op: Omit<OpPendiente, "opId" | "creadoEn">) => void;
  sincronizarPendientes: () => Promise<void>;

  cargarDesdeSupabase: () => Promise<void>;
  limpiar: () => void;

  crearNegocio: (nombre: string) => Promise<string | null>;
  setNegocioActivo: (id: string) => Promise<void>;

  agregarVenta: (fecha: string, metodo: MetodoPago, monto: number) => Promise<void>;
  editarVenta: (id: string, metodo: MetodoPago, monto: number) => Promise<void>;
  eliminarVenta: (id: string) => Promise<void>;

  agregarGasto: (fecha: string, concepto: string, monto: number) => Promise<void>;
  editarGasto: (id: string, concepto: string, monto: number) => Promise<void>;
  eliminarGasto: (id: string) => Promise<void>;

  agregarEntrada: (fecha: string, concepto: string, monto: number) => Promise<void>;
  editarEntrada: (id: string, concepto: string, monto: number) => Promise<void>;
  eliminarEntrada: (id: string) => Promise<void>;

  agregarApartado: (datos: {
    tipo: TipoApartado;
    descripcion: string;
    fecha: string;
    cliente: string;
    telefono: string;
    valorTotal: number;
    abonoInicial: number;
    metodoInicial: MetodoPago;
  }) => Promise<void>;
  abonarApartado: (id: string, fecha: string, monto: number, metodo: MetodoPago) => Promise<void>;
  editarApartado: (id: string, datos: { cliente: string; telefono: string; fecha: string; valorTotal: number; descripcion: string }) => Promise<void>;
  marcarConseguido: (id: string, conseguido: boolean) => Promise<void>;
  marcarEntregado: (id: string, entregado: boolean) => Promise<void>;
  eliminarAbono: (apartadoId: string, abonoId: string) => Promise<void>;
  eliminarApartado: (id: string) => Promise<void>;

  setMeta: (anio: number, mes: number, montoMeta: number) => Promise<void>;
  setCuadre: (fecha: string, patch: { efectivoReal?: number; cuadrado?: boolean | null; diferencia?: number }) => Promise<void>;

  agregarGastoMensual: (fecha: string, concepto: string, monto: number, metodo: MetodoGasto, metodoOtro: string) => Promise<void>;
  editarGastoMensual: (id: string, fecha: string, concepto: string, monto: number, metodo: MetodoGasto, metodoOtro: string) => Promise<void>;
  eliminarGastoMensual: (id: string) => Promise<void>;
}

// Cola para que las peticiones de rango no compitan entre sí (Panel, comparativo, etc.).
let colaRango: Promise<void> = Promise.resolve();

/** Genera un id único en el dispositivo (para que la nube nunca duplique un registro). */
function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function estaEnLinea(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

async function conError(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    avisarError("No se pudo guardar el cambio");
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
  cargando: false,
  cargado: false,
  negocios: [],
  negocioActivoId: null,
  ventas: [],
  gastos: [],
  entradas: [],
  apartados: [],
  metas: [],
  cuadres: [],
  gastosMensuales: [],
  config: { whatsapp: "", correoCodigos: "", salarioMinimo: 0 },
  miRol: "",
  miNombre: "",
  esAdmin: false,
  revision: 0,
  movDesde: periodoDe("mes").desde,
  movHasta: periodoDe("mes").hasta,
  cargandoRango: false,
  pendientes: [],
  sincronizando: false,
  encolar: (op) => {
    const completa: OpPendiente = { ...op, opId: uuid(), creadoEn: Date.now() };
    set((s) => ({ pendientes: [...s.pendientes, completa] }));
    if (estaEnLinea()) get().sincronizarPendientes();
  },
  sincronizarPendientes: async () => {
    if (get().sincronizando || !estaEnLinea()) return;
    if (get().pendientes.length === 0) return;
    set({ sincronizando: true });
    try {
      // Procesa en orden; si una falla (red), se detiene y se reintenta luego.
      while (get().pendientes.length > 0) {
        const op = get().pendientes[0];
        try {
          await db.ejecutarOperacion(op);
        } catch (e) {
          console.error("Operación pendiente falló, se reintentará luego", e);
          break;
        }
        set((s) => ({ pendientes: s.pendientes.filter((p) => p.opId !== op.opId) }));
      }
    } finally {
      set({ sincronizando: false });
    }
    // Al terminar de subir, refresca desde la nube para quedar en sincronía.
    if (get().pendientes.length === 0) get().refrescarRemoto();
  },
  refrescarRemoto: async () => {
    const { negocioActivoId, movDesde, movHasta } = get();
    if (!negocioActivoId) return;
    // No pisar cambios locales que aún no se han subido.
    if (get().pendientes.length > 0) return;
    try {
      const [base, mov, config] = await Promise.all([
        db.cargarBase(negocioActivoId),
        db.cargarMovimientos(negocioActivoId, movDesde, movHasta),
        db.cargarConfig(negocioActivoId),
      ]);
      set((s) => ({ ...base, ...mov, config, revision: s.revision + 1 }));
    } catch (e) {
      console.error(e);
    }
  },
  asegurarRango: (desde, hasta) => {
    // Encolar: cada petición se ejecuta después de la anterior, viendo la ventana ya ampliada.
    colaRango = colaRango.then(async () => {
      const { negocioActivoId, movDesde, movHasta } = get();
      if (!negocioActivoId || !desde || !hasta) return;
      if (desde >= movDesde && hasta <= movHasta) return; // ya cargado
      const nd = desde < movDesde ? desde : movDesde;
      const nh = hasta > movHasta ? hasta : movHasta;
      set({ cargandoRango: true });
      try {
        const mov = await db.cargarMovimientos(negocioActivoId, nd, nh);
        set({ ...mov, movDesde: nd, movHasta: nh, cargandoRango: false });
      } catch (e) {
        console.error(e);
        set({ cargandoRango: false });
      }
    });
    return colaRango;
  },
  setConfig: (patch) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId) return;
      const config = await db.guardarConfig(negocioId, patch);
      set({ config });
    }),

  panelTipo: "mes",
  panelDesde: new Date().toLocaleDateString("sv"),
  panelHasta: new Date().toLocaleDateString("sv"),
  setPanelPeriodo: (p) =>
    set((s) => ({
      panelTipo: p.tipo ?? s.panelTipo,
      panelDesde: p.desde ?? s.panelDesde,
      panelHasta: p.hasta ?? s.panelHasta,
    })),

  cargarDesdeSupabase: async () => {
    // Sin conexión: usamos lo que quedó guardado en el dispositivo (no intentamos la red).
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      set({ cargando: false, cargado: true });
      return;
    }
    set({ cargando: true });
    try {
      let negocios = await db.cargarNegocios();
      if (negocios.length === 0) {
        const neg = await db.crearNegocioDB("Almacén Diana G");
        negocios = [neg];
      }
      const prev = get().negocioActivoId;
      const activo = prev && negocios.some((x) => x.id === prev) ? prev : negocios[0].id;
      const p = periodoDe("mes"); // arranca con el mes actual
      const [base, mov, config, info] = await Promise.all([
        db.cargarBase(activo),
        db.cargarMovimientos(activo, p.desde, p.hasta),
        db.cargarConfig(activo),
        db.miInfo(activo),
      ]);
      set({ negocios, negocioActivoId: activo, ...base, ...mov, movDesde: p.desde, movHasta: p.hasta, config, miRol: info.rol, miNombre: info.nombre, esAdmin: info.rol === "dueño" || info.rol === "admin", cargando: false, cargado: true });
    } catch (e) {
      console.error(e);
      // Si hay datos guardados en el dispositivo, seguimos con esos (modo sin conexión).
      const hayCache = get().negocios.length > 0;
      if (!hayCache) avisarError("No se pudieron cargar los datos");
      set({ cargando: false, cargado: true });
    }
  },

  limpiar: () =>
    set({ cargado: false, negocios: [], negocioActivoId: null, ventas: [], gastos: [], entradas: [], apartados: [], metas: [], cuadres: [], gastosMensuales: [], config: { whatsapp: "", correoCodigos: "", salarioMinimo: 0 }, miRol: "", miNombre: "", esAdmin: false, movDesde: periodoDe("mes").desde, movHasta: periodoDe("mes").hasta }),

  crearNegocio: async (nombre) => {
    try {
      const neg = await db.crearNegocioDB(nombre.trim() || "Mi negocio");
      set((s) => ({ negocios: [...s.negocios, neg], negocioActivoId: s.negocioActivoId ?? neg.id }));
      return neg.id;
    } catch (e) {
      console.error(e);
      avisarError("No se pudo crear el negocio");
      return null;
    }
  },

  setNegocioActivo: async (id) => {
    set({ negocioActivoId: id, cargando: true });
    try {
      const p = periodoDe("mes");
      const [base, mov, config, info] = await Promise.all([
        db.cargarBase(id),
        db.cargarMovimientos(id, p.desde, p.hasta),
        db.cargarConfig(id),
        db.miInfo(id),
      ]);
      set({ ...base, ...mov, movDesde: p.desde, movHasta: p.hasta, config, miRol: info.rol, miNombre: info.nombre, esAdmin: info.rol === "dueño" || info.rol === "admin", cargando: false });
    } catch (e) {
      console.error(e);
      set({ cargando: false });
    }
  },

  // ---------- Ventas (optimista + cola offline) ----------
  agregarVenta: async (fecha, metodo, monto) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId || monto <= 0) return;
    const id = uuid();
    const v: Venta = { id, negocioId, fecha, metodo, monto, creadoEn: new Date().toISOString() };
    set((s) => ({ ventas: [...s.ventas, v] }));
    get().encolar({ tabla: "ventas", tipo: "insert", payload: { id, negocio_id: negocioId, fecha, metodo, monto } });
  },
  editarVenta: async (id, metodo, monto) => {
    if (monto <= 0) return;
    set((s) => ({ ventas: s.ventas.map((v) => (v.id === id ? { ...v, metodo, monto } : v)) }));
    get().encolar({ tabla: "ventas", tipo: "update", payload: { id, patch: { metodo, monto } } });
  },
  eliminarVenta: async (id) => {
    set((s) => ({ ventas: s.ventas.filter((v) => v.id !== id) }));
    get().encolar({ tabla: "ventas", tipo: "delete", payload: { id } });
  },

  // ---------- Gastos ----------
  agregarGasto: async (fecha, concepto, monto) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId || monto <= 0) return;
    const c = concepto.trim() || "Gasto";
    const id = uuid();
    const g: Gasto = { id, negocioId, fecha, concepto: c, monto, creadoEn: new Date().toISOString() };
    set((s) => ({ gastos: [...s.gastos, g] }));
    get().encolar({ tabla: "gastos", tipo: "insert", payload: { id, negocio_id: negocioId, fecha, concepto: c, monto } });
  },
  editarGasto: async (id, concepto, monto) => {
    if (monto <= 0) return;
    const c = concepto.trim() || "Gasto";
    set((s) => ({ gastos: s.gastos.map((g) => (g.id === id ? { ...g, concepto: c, monto } : g)) }));
    get().encolar({ tabla: "gastos", tipo: "update", payload: { id, patch: { concepto: c, monto } } });
  },
  eliminarGasto: async (id) => {
    set((s) => ({ gastos: s.gastos.filter((g) => g.id !== id) }));
    get().encolar({ tabla: "gastos", tipo: "delete", payload: { id } });
  },

  // ---------- Entradas ----------
  agregarEntrada: async (fecha, concepto, monto) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId || monto <= 0) return;
    const c = concepto.trim() || "Entrada";
    const id = uuid();
    const e: Entrada = { id, negocioId, fecha, concepto: c, monto, creadoEn: new Date().toISOString() };
    set((s) => ({ entradas: [...s.entradas, e] }));
    get().encolar({ tabla: "entradas", tipo: "insert", payload: { id, negocio_id: negocioId, fecha, concepto: c, monto } });
  },
  editarEntrada: async (id, concepto, monto) => {
    if (monto <= 0) return;
    const c = concepto.trim() || "Entrada";
    set((s) => ({ entradas: s.entradas.map((e) => (e.id === id ? { ...e, concepto: c, monto } : e)) }));
    get().encolar({ tabla: "entradas", tipo: "update", payload: { id, patch: { concepto: c, monto } } });
  },
  eliminarEntrada: async (id) => {
    set((s) => ({ entradas: s.entradas.filter((e) => e.id !== id) }));
    get().encolar({ tabla: "entradas", tipo: "delete", payload: { id } });
  },

  // ---------- Apartados ----------
  agregarApartado: async ({ tipo, descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial }) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId || !cliente.trim()) return;
    const id = uuid();
    const desc = descripcion.trim();
    const cli = cliente.trim();
    const tel = telefono.trim();
    const estado = estadoDe(valorTotal, abonoInicial);
    const abonos: Abono[] = [];
    if (abonoInicial > 0) abonos.push({ id: uuid(), fecha, monto: abonoInicial, metodo: metodoInicial });
    const ap: Apartado = { id, negocioId, tipo, descripcion: desc, fecha, cliente: cli, telefono: tel, valorTotal, abonos, estado, conseguido: false, entregado: false, creadoEn: new Date().toISOString() };
    set((s) => ({ apartados: [...s.apartados, ap] }));
    get().encolar({ tabla: "apartados", tipo: "insert", payload: { id, negocio_id: negocioId, tipo, descripcion: desc, fecha, cliente: cli, telefono: tel, valor_total: valorTotal, estado } });
    if (abonos.length) get().encolar({ tabla: "abonos", tipo: "insert", payload: { id: abonos[0].id, apartado_id: id, fecha, monto: abonoInicial, metodo: metodoInicial } });
  },
  abonarApartado: async (id, fecha, monto, metodo) => {
    if (monto <= 0) return;
    const ap = get().apartados.find((a) => a.id === id);
    if (!ap) return;
    const abId = uuid();
    const abonos = [...ap.abonos, { id: abId, fecha, monto, metodo }];
    const nuevoEstado = estadoDe(ap.valorTotal, abonos.reduce((t, x) => t + x.monto, 0));
    set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, abonos, estado: nuevoEstado } : a)) }));
    get().encolar({ tabla: "abonos", tipo: "insert", payload: { id: abId, apartado_id: id, fecha, monto, metodo } });
  },
  editarApartado: async (id, datos) => {
    const ap = get().apartados.find((a) => a.id === id);
    if (!ap) return;
    const cli = datos.cliente.trim() || ap.cliente;
    const tel = datos.telefono.trim();
    const desc = datos.descripcion.trim();
    const estado = estadoDe(datos.valorTotal, abonadoDe(ap));
    set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, cliente: cli, telefono: tel, fecha: datos.fecha, valorTotal: datos.valorTotal, descripcion: desc, estado } : a)) }));
    get().encolar({ tabla: "apartados", tipo: "update", payload: { id, patch: { cliente: cli, telefono: tel, fecha: datos.fecha, valor_total: datos.valorTotal, descripcion: desc, estado } } });
  },
  marcarConseguido: async (id, conseguido) => {
    set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, conseguido } : a)) }));
    get().encolar({ tabla: "apartados", tipo: "update", payload: { id, patch: { conseguido } } });
  },
  marcarEntregado: async (id, entregado) => {
    set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, entregado, conseguido: entregado ? true : a.conseguido } : a)) }));
    get().encolar({ tabla: "apartados", tipo: "update", payload: { id, patch: entregado ? { entregado: true, conseguido: true } : { entregado: false } } });
  },
  eliminarAbono: async (apartadoId, abonoId) => {
    const ap = get().apartados.find((a) => a.id === apartadoId);
    if (!ap) return;
    const abonos = ap.abonos.filter((x) => x.id !== abonoId);
    const nuevoEstado = estadoDe(ap.valorTotal, abonos.reduce((t, x) => t + x.monto, 0));
    set((s) => ({ apartados: s.apartados.map((a) => (a.id === apartadoId ? { ...a, abonos, estado: nuevoEstado } : a)) }));
    get().encolar({ tabla: "abonos", tipo: "delete", payload: { id: abonoId } });
  },
  eliminarApartado: async (id) => {
    set((s) => ({ apartados: s.apartados.filter((a) => a.id !== id) }));
    get().encolar({ tabla: "apartados", tipo: "delete", payload: { id } });
  },

  // ---------- Metas y cuadre ----------
  setMeta: async (anio, mes, montoMeta) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId) return;
    set((s) => {
      const existente = s.metas.find((m) => m.negocioId === negocioId && m.anio === anio && m.mes === mes);
      const otras = s.metas.filter((m) => !(m.negocioId === negocioId && m.anio === anio && m.mes === mes));
      const meta: Meta = { id: existente?.id ?? uuid(), negocioId, anio, mes, montoMeta };
      return { metas: [...otras, meta] };
    });
    get().encolar({ tabla: "metas", tipo: "upsert", onConflict: "negocio_id,anio,mes", payload: { negocio_id: negocioId, anio, mes, monto_meta: montoMeta } });
  },
  setCuadre: async (fecha, patch) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId) return;
    const base = get().cuadres.find((c) => c.negocioId === negocioId && c.fecha === fecha) ?? null;
    const cuadre: Cuadre = {
      id: base?.id ?? uuid(),
      negocioId,
      fecha,
      efectivoReal: patch.efectivoReal ?? base?.efectivoReal ?? 0,
      baseSiguiente: base?.baseSiguiente ?? 0,
      cuadrado: patch.cuadrado !== undefined ? patch.cuadrado : (base?.cuadrado ?? null),
      diferencia: patch.diferencia ?? base?.diferencia ?? 0,
      creadoEn: base?.creadoEn ?? new Date().toISOString(),
    };
    set((s) => ({ cuadres: [...s.cuadres.filter((c) => !(c.negocioId === negocioId && c.fecha === fecha)), cuadre] }));
    get().encolar({ tabla: "cuadres", tipo: "upsert", onConflict: "negocio_id,fecha", payload: { negocio_id: negocioId, fecha, efectivo_real: cuadre.efectivoReal, cuadrado: cuadre.cuadrado, diferencia: cuadre.diferencia } });
  },

  // ---------- Gastos mensuales (solo admin) ----------
  agregarGastoMensual: async (fecha, concepto, monto, metodo, metodoOtro) => {
    const negocioId = get().negocioActivoId;
    if (!negocioId || monto <= 0) return;
    const c = concepto.trim() || "Gasto mensual";
    const otro = metodo === "otros" ? metodoOtro.trim() : "";
    const id = uuid();
    const gm: GastoMensual = { id, negocioId, fecha, concepto: c, monto, metodo, metodoOtro: otro || undefined, creadoEn: new Date().toISOString() };
    set((s) => ({ gastosMensuales: [...s.gastosMensuales, gm] }));
    get().encolar({ tabla: "gastos_mensuales", tipo: "insert", payload: { id, negocio_id: negocioId, fecha, concepto: c, monto, metodo, metodo_otro: otro || null } });
  },
  editarGastoMensual: async (id, fecha, concepto, monto, metodo, metodoOtro) => {
    if (monto <= 0) return;
    const c = concepto.trim() || "Gasto mensual";
    const otro = metodo === "otros" ? metodoOtro.trim() : "";
    set((s) => ({ gastosMensuales: s.gastosMensuales.map((g) => (g.id === id ? { ...g, fecha, concepto: c, monto, metodo, metodoOtro: otro || undefined } : g)) }));
    get().encolar({ tabla: "gastos_mensuales", tipo: "update", payload: { id, patch: { fecha, concepto: c, monto, metodo, metodo_otro: otro || null } } });
  },
  eliminarGastoMensual: async (id) => {
    set((s) => ({ gastosMensuales: s.gastosMensuales.filter((g) => g.id !== id) }));
    get().encolar({ tabla: "gastos_mensuales", tipo: "delete", payload: { id } });
  },
    }),
    {
      name: "almacen-store",
      storage: createJSONStorage(() => idbStorage),
      // Guardamos solo los datos (no los estados temporales de carga en curso).
      partialize: (s) => ({
        negocios: s.negocios,
        negocioActivoId: s.negocioActivoId,
        ventas: s.ventas,
        gastos: s.gastos,
        entradas: s.entradas,
        apartados: s.apartados,
        metas: s.metas,
        cuadres: s.cuadres,
        gastosMensuales: s.gastosMensuales,
        config: s.config,
        miRol: s.miRol,
        miNombre: s.miNombre,
        esAdmin: s.esAdmin,
        movDesde: s.movDesde,
        movHasta: s.movHasta,
        revision: s.revision,
        cargado: s.cargado,
        pendientes: s.pendientes,
        panelTipo: s.panelTipo,
        panelDesde: s.panelDesde,
        panelHasta: s.panelHasta,
      }),
    },
  ),
);
