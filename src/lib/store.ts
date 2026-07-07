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
  MetodoPago,
  TipoApartado,
} from "./types";

/** Suma de abonos de un apartado. */
export function abonadoDe(a: Apartado): number {
  return a.abonos.reduce((s, ab) => s + ab.monto, 0);
}
/** Saldo pendiente de un apartado (valor total − abonado). */
export function saldoDe(a: Apartado): number {
  return Math.max(0, a.valorTotal - abonadoDe(a));
}
/** Base inicial de un día = la base que se dejó el día anterior más reciente con cuadre. */
export function baseInicialDe(cuadres: Cuadre[], negocioId: string | null, fecha: string): number {
  if (!negocioId) return 0;
  const prev = cuadres
    .filter((c) => c.negocioId === negocioId && c.fecha < fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return prev?.baseSiguiente ?? 0;
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
  setCuadre: (fecha: string, patch: { efectivoReal?: number; baseSiguiente?: number }) => Promise<void>;
}

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
      const datos = await db.cargarTodo(activo);
      set({ negocios, negocioActivoId: activo, ...datos, cargando: false, cargado: true });
    } catch (e) {
      console.error(e);
      avisarError("No se pudieron cargar los datos");
      set({ cargando: false });
    }
  },

  limpiar: () =>
    set({ cargado: false, negocios: [], negocioActivoId: null, ventas: [], gastos: [], entradas: [], apartados: [], metas: [], cuadres: [] }),

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
      const datos = await db.cargarTodo(id);
      set({ ...datos, cargando: false });
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
      const nuevoEstado = estadoDe(ap.valorTotal, abonos.reduce((t, x) => t + x.monto, 0));
      if (nuevoEstado !== ap.estado) await db.updateApartado(id, { estado: nuevoEstado });
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
      const nuevoEstado = estadoDe(ap.valorTotal, abonos.reduce((t, x) => t + x.monto, 0));
      if (nuevoEstado !== ap.estado) await db.updateApartado(apartadoId, { estado: nuevoEstado });
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
