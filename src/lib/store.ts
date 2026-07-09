// ─── Almacén Diana G 🐝 — Store (respaldado en Supabase) ───
// Mantiene el estado en memoria para que la interfaz siga siendo instantánea,
// pero cada cambio se guarda en Supabase (la nube). Los datos se cargan por negocio.

import { create } from "zustand";
import * as db from "./db";
import { avisarError } from "./alerta";
import type {
  Negocio,
  Venta,
  Gasto,
  Entrada,
  Apartado,
  Meta,
  Cuadre,
  Configuracion,
  MetodoPago,
  TipoApartado,
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
  config: Configuracion;
  setConfig: (patch: Partial<Configuracion>) => Promise<void>;

  // Rol del usuario actual en el negocio activo
  miRol: string; // "dueño" | "admin" | "empleado" | ""
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
}

// Cola para que las peticiones de rango no compitan entre sí (Panel, comparativo, etc.).
let colaRango: Promise<void> = Promise.resolve();

async function conError(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    avisarError("No se pudo guardar el cambio");
  }
}

export const useStore = create<State>()((set, get) => ({
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
  config: { whatsapp: "", correoCodigos: "", salarioMinimo: 0 },
  miRol: "",
  esAdmin: false,
  revision: 0,
  movDesde: periodoDe("mes").desde,
  movHasta: periodoDe("mes").hasta,
  cargandoRango: false,
  refrescarRemoto: async () => {
    const { negocioActivoId, movDesde, movHasta } = get();
    if (!negocioActivoId) return;
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
      const [base, mov, config, rol] = await Promise.all([
        db.cargarBase(activo),
        db.cargarMovimientos(activo, p.desde, p.hasta),
        db.cargarConfig(activo),
        db.miRol(activo),
      ]);
      set({ negocios, negocioActivoId: activo, ...base, ...mov, movDesde: p.desde, movHasta: p.hasta, config, miRol: rol, esAdmin: rol === "dueño" || rol === "admin", cargando: false, cargado: true });
    } catch (e) {
      console.error(e);
      avisarError("No se pudieron cargar los datos");
      set({ cargando: false });
    }
  },

  limpiar: () =>
    set({ cargado: false, negocios: [], negocioActivoId: null, ventas: [], gastos: [], entradas: [], apartados: [], metas: [], cuadres: [], config: { whatsapp: "", correoCodigos: "", salarioMinimo: 0 }, miRol: "", esAdmin: false, movDesde: periodoDe("mes").desde, movHasta: periodoDe("mes").hasta }),

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
      const [base, mov, config, rol] = await Promise.all([
        db.cargarBase(id),
        db.cargarMovimientos(id, p.desde, p.hasta),
        db.cargarConfig(id),
        db.miRol(id),
      ]);
      set({ ...base, ...mov, movDesde: p.desde, movHasta: p.hasta, config, miRol: rol, esAdmin: rol === "dueño" || rol === "admin", cargando: false });
    } catch (e) {
      console.error(e);
      set({ cargando: false });
    }
  },

  // ---------- Ventas ----------
  agregarVenta: (fecha, metodo, monto) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId || monto <= 0) return;
      const v = await db.insertVenta({ negocioId, fecha, metodo, monto });
      set((s) => ({ ventas: [...s.ventas, v] }));
    }),
  editarVenta: (id, metodo, monto) =>
    conError(async () => {
      if (monto <= 0) return;
      await db.updateVenta(id, { metodo, monto });
      set((s) => ({ ventas: s.ventas.map((v) => (v.id === id ? { ...v, metodo, monto } : v)) }));
    }),
  eliminarVenta: (id) =>
    conError(async () => {
      await db.deleteVenta(id);
      set((s) => ({ ventas: s.ventas.filter((v) => v.id !== id) }));
    }),

  // ---------- Gastos ----------
  agregarGasto: (fecha, concepto, monto) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId || monto <= 0) return;
      const g = await db.insertGasto({ negocioId, fecha, concepto: concepto.trim() || "Gasto", monto });
      set((s) => ({ gastos: [...s.gastos, g] }));
    }),
  editarGasto: (id, concepto, monto) =>
    conError(async () => {
      if (monto <= 0) return;
      const c = concepto.trim() || "Gasto";
      await db.updateGasto(id, { concepto: c, monto });
      set((s) => ({ gastos: s.gastos.map((g) => (g.id === id ? { ...g, concepto: c, monto } : g)) }));
    }),
  eliminarGasto: (id) =>
    conError(async () => {
      await db.deleteGasto(id);
      set((s) => ({ gastos: s.gastos.filter((g) => g.id !== id) }));
    }),

  // ---------- Entradas ----------
  agregarEntrada: (fecha, concepto, monto) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId || monto <= 0) return;
      const e = await db.insertEntrada({ negocioId, fecha, concepto: concepto.trim() || "Entrada", monto });
      set((s) => ({ entradas: [...s.entradas, e] }));
    }),
  editarEntrada: (id, concepto, monto) =>
    conError(async () => {
      if (monto <= 0) return;
      const c = concepto.trim() || "Entrada";
      await db.updateEntrada(id, { concepto: c, monto });
      set((s) => ({ entradas: s.entradas.map((e) => (e.id === id ? { ...e, concepto: c, monto } : e)) }));
    }),
  eliminarEntrada: (id) =>
    conError(async () => {
      await db.deleteEntrada(id);
      set((s) => ({ entradas: s.entradas.filter((e) => e.id !== id) }));
    }),

  // ---------- Apartados ----------
  agregarApartado: ({ tipo, descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial }) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId || !cliente.trim()) return;
      const estado = estadoDe(valorTotal, abonoInicial);
      const ap = await db.insertApartado({ negocioId, tipo, descripcion: descripcion.trim(), fecha, cliente: cliente.trim(), telefono: telefono.trim(), valorTotal, estado });
      if (abonoInicial > 0) {
        const ab = await db.insertAbono({ apartadoId: ap.id, fecha, monto: abonoInicial, metodo: metodoInicial });
        ap.abonos = [ab];
      }
      set((s) => ({ apartados: [...s.apartados, ap] }));
    }),
  abonarApartado: (id, fecha, monto, metodo) =>
    conError(async () => {
      if (monto <= 0) return;
      const ap = get().apartados.find((a) => a.id === id);
      if (!ap) return;
      const ab = await db.insertAbono({ apartadoId: id, fecha, monto, metodo });
      const abonos = [...ap.abonos, ab];
      // El estado en la BD lo recalcula un trigger; aquí solo actualizamos la vista.
      const nuevoEstado = estadoDe(ap.valorTotal, abonos.reduce((t, x) => t + x.monto, 0));
      set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, abonos, estado: nuevoEstado } : a)) }));
    }),
  editarApartado: (id, datos) =>
    conError(async () => {
      const ap = get().apartados.find((a) => a.id === id);
      if (!ap) return;
      const estado = estadoDe(datos.valorTotal, abonadoDe(ap));
      await db.updateApartado(id, { cliente: datos.cliente.trim(), telefono: datos.telefono.trim(), fecha: datos.fecha, valorTotal: datos.valorTotal, descripcion: datos.descripcion.trim(), estado });
      set((s) => ({
        apartados: s.apartados.map((a) =>
          a.id === id ? { ...a, cliente: datos.cliente.trim() || a.cliente, telefono: datos.telefono.trim(), fecha: datos.fecha, valorTotal: datos.valorTotal, descripcion: datos.descripcion.trim(), estado } : a,
        ),
      }));
    }),
  marcarConseguido: (id, conseguido) =>
    conError(async () => {
      await db.updateApartado(id, { conseguido });
      set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, conseguido } : a)) }));
    }),
  marcarEntregado: (id, entregado) =>
    conError(async () => {
      await db.updateApartado(id, { entregado, ...(entregado ? { conseguido: true } : {}) });
      set((s) => ({ apartados: s.apartados.map((a) => (a.id === id ? { ...a, entregado, conseguido: entregado ? true : a.conseguido } : a)) }));
    }),
  eliminarAbono: (apartadoId, abonoId) =>
    conError(async () => {
      await db.deleteAbono(abonoId);
      const ap = get().apartados.find((a) => a.id === apartadoId);
      if (!ap) return;
      const abonos = ap.abonos.filter((x) => x.id !== abonoId);
      // El estado en la BD lo recalcula un trigger; aquí solo actualizamos la vista.
      const nuevoEstado = estadoDe(ap.valorTotal, abonos.reduce((t, x) => t + x.monto, 0));
      set((s) => ({ apartados: s.apartados.map((a) => (a.id === apartadoId ? { ...a, abonos, estado: nuevoEstado } : a)) }));
    }),
  eliminarApartado: (id) =>
    conError(async () => {
      await db.deleteApartado(id);
      set((s) => ({ apartados: s.apartados.filter((a) => a.id !== id) }));
    }),

  // ---------- Metas y cuadre ----------
  setMeta: (anio, mes, montoMeta) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId) return;
      const meta = await db.upsertMeta({ negocioId, anio, mes, montoMeta });
      set((s) => {
        const otras = s.metas.filter((m) => !(m.negocioId === negocioId && m.anio === anio && m.mes === mes));
        return { metas: [...otras, meta] };
      });
    }),
  setCuadre: (fecha, patch) =>
    conError(async () => {
      const negocioId = get().negocioActivoId;
      if (!negocioId) return;
      const cuadre = await db.upsertCuadre({ negocioId, fecha, ...patch });
      set((s) => {
        const otros = s.cuadres.filter((c) => !(c.negocioId === negocioId && c.fecha === fecha));
        return { cuadres: [...otros, cuadre] };
      });
    }),
}));
