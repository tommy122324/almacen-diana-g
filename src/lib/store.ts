// ─── Contabee 🐝 — Store reactivo (modo local con localStorage) ───
// Esta es la ÚNICA capa que toca los datos. Cuando conectemos Supabase (fase final),
// se reemplaza la implementación por llamadas a Supabase sin cambiar la interfaz de la UI.

import { create } from "zustand";
import { persist } from "zustand/middleware";
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
export function baseInicialDe(
  cuadres: Cuadre[],
  negocioId: string | null,
  fecha: string,
): number {
  if (!negocioId) return 0;
  const prev = cuadres
    .filter((c) => c.negocioId === negocioId && c.fecha < fecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return prev?.baseSiguiente ?? 0;
}

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ahora(): string {
  return new Date().toISOString();
}

interface State {
  negocios: Negocio[];
  negocioActivoId: string | null;
  ventas: Venta[];
  gastos: Gasto[];
  entradas: Entrada[];
  apartados: Apartado[];
  metas: Meta[];
  cuadres: Cuadre[];

  // Negocios
  crearNegocio: (nombre: string) => string;
  renombrarNegocio: (id: string, nombre: string) => void;
  eliminarNegocio: (id: string) => void;
  setNegocioActivo: (id: string) => void;

  // Ventas
  agregarVenta: (fecha: string, metodo: MetodoPago, monto: number) => void;
  editarVenta: (id: string, metodo: MetodoPago, monto: number) => void;
  eliminarVenta: (id: string) => void;

  // Gastos
  agregarGasto: (fecha: string, concepto: string, monto: number) => void;
  editarGasto: (id: string, concepto: string, monto: number) => void;
  eliminarGasto: (id: string) => void;

  // Entradas
  agregarEntrada: (fecha: string, concepto: string, monto: number) => void;
  editarEntrada: (id: string, concepto: string, monto: number) => void;
  eliminarEntrada: (id: string) => void;

  // Apartados
  agregarApartado: (datos: {
    tipo: TipoApartado;
    descripcion: string;
    fecha: string;
    cliente: string;
    telefono: string;
    valorTotal: number;
    abonoInicial: number;
    metodoInicial: MetodoPago;
  }) => void;
  abonarApartado: (id: string, fecha: string, monto: number, metodo: MetodoPago) => void;
  editarApartado: (
    id: string,
    datos: { cliente: string; telefono: string; fecha: string; valorTotal: number; descripcion: string },
  ) => void;
  marcarConseguido: (id: string, conseguido: boolean) => void;
  marcarEntregado: (id: string, entregado: boolean) => void;
  eliminarAbono: (apartadoId: string, abonoId: string) => void;
  eliminarApartado: (id: string) => void;

  // Metas y cuadre
  setMeta: (anio: number, mes: number, montoMeta: number) => void;
  setCuadre: (fecha: string, patch: { efectivoReal?: number; baseSiguiente?: number }) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      negocios: [],
      negocioActivoId: null,
      ventas: [],
      gastos: [],
      entradas: [],
      apartados: [],
      metas: [],
      cuadres: [],

      crearNegocio: (nombre) => {
        const id = uid();
        const neg: Negocio = { id, nombre: nombre.trim() || "Mi negocio", creadoEn: ahora() };
        set((s) => ({
          negocios: [...s.negocios, neg],
          negocioActivoId: s.negocioActivoId ?? id,
        }));
        return id;
      },
      renombrarNegocio: (id, nombre) =>
        set((s) => ({
          negocios: s.negocios.map((n) => (n.id === id ? { ...n, nombre: nombre.trim() || n.nombre } : n)),
        })),
      eliminarNegocio: (id) =>
        set((s) => {
          const negocios = s.negocios.filter((n) => n.id !== id);
          return {
            negocios,
            negocioActivoId: s.negocioActivoId === id ? (negocios[0]?.id ?? null) : s.negocioActivoId,
            ventas: s.ventas.filter((x) => x.negocioId !== id),
            gastos: s.gastos.filter((x) => x.negocioId !== id),
            entradas: s.entradas.filter((x) => x.negocioId !== id),
            apartados: s.apartados.filter((x) => x.negocioId !== id),
            metas: s.metas.filter((x) => x.negocioId !== id),
            cuadres: s.cuadres.filter((x) => x.negocioId !== id),
          };
        }),
      setNegocioActivo: (id) => set({ negocioActivoId: id }),

      agregarVenta: (fecha, metodo, monto) => {
        const negocioId = get().negocioActivoId;
        if (!negocioId || monto <= 0) return;
        set((s) => ({
          ventas: [...s.ventas, { id: uid(), negocioId, fecha, metodo, monto, creadoEn: ahora() }],
        }));
      },
      editarVenta: (id, metodo, monto) =>
        set((s) => ({
          ventas: s.ventas.map((v) => (v.id === id && monto > 0 ? { ...v, metodo, monto } : v)),
        })),
      eliminarVenta: (id) => set((s) => ({ ventas: s.ventas.filter((x) => x.id !== id) })),

      agregarGasto: (fecha, concepto, monto) => {
        const negocioId = get().negocioActivoId;
        if (!negocioId || monto <= 0) return;
        set((s) => ({
          gastos: [...s.gastos, { id: uid(), negocioId, fecha, concepto: concepto.trim() || "Gasto", monto, creadoEn: ahora() }],
        }));
      },
      editarGasto: (id, concepto, monto) =>
        set((s) => ({
          gastos: s.gastos.map((g) =>
            g.id === id && monto > 0 ? { ...g, concepto: concepto.trim() || g.concepto, monto } : g,
          ),
        })),
      eliminarGasto: (id) => set((s) => ({ gastos: s.gastos.filter((x) => x.id !== id) })),

      agregarEntrada: (fecha, concepto, monto) => {
        const negocioId = get().negocioActivoId;
        if (!negocioId || monto <= 0) return;
        set((s) => ({
          entradas: [...s.entradas, { id: uid(), negocioId, fecha, concepto: concepto.trim() || "Entrada", monto, creadoEn: ahora() }],
        }));
      },
      editarEntrada: (id, concepto, monto) =>
        set((s) => ({
          entradas: s.entradas.map((e) =>
            e.id === id && monto > 0 ? { ...e, concepto: concepto.trim() || e.concepto, monto } : e,
          ),
        })),
      eliminarEntrada: (id) => set((s) => ({ entradas: s.entradas.filter((x) => x.id !== id) })),

      agregarApartado: ({ tipo, descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial }) => {
        const negocioId = get().negocioActivoId;
        if (!negocioId || !cliente.trim()) return;
        const abonos = abonoInicial > 0 ? [{ id: uid(), fecha, monto: abonoInicial, metodo: metodoInicial }] : [];
        const estado = valorTotal > 0 && abonoInicial >= valorTotal ? "completado" : "pendiente";
        set((s) => ({
          apartados: [
            ...s.apartados,
            {
              id: uid(),
              negocioId,
              tipo,
              descripcion: descripcion.trim(),
              fecha,
              cliente: cliente.trim() || "Sin nombre",
              telefono: telefono.trim(),
              valorTotal,
              abonos,
              estado,
              conseguido: false,
              entregado: false,
              creadoEn: ahora(),
            },
          ],
        }));
      },
      abonarApartado: (id, fecha, monto, metodo) => {
        if (monto <= 0) return;
        set((s) => ({
          apartados: s.apartados.map((a) => {
            if (a.id !== id) return a;
            const abonos = [...a.abonos, { id: uid(), fecha, monto, metodo }];
            const total = abonos.reduce((t, ab) => t + ab.monto, 0);
            return { ...a, abonos, estado: a.valorTotal > 0 && total >= a.valorTotal ? "completado" : "pendiente" };
          }),
        }));
      },
      editarApartado: (id, datos) =>
        set((s) => ({
          apartados: s.apartados.map((a) => {
            if (a.id !== id) return a;
            const total = abonadoDe(a);
            return {
              ...a,
              cliente: datos.cliente.trim() || a.cliente,
              telefono: datos.telefono.trim(),
              descripcion: datos.descripcion.trim(),
              fecha: datos.fecha,
              valorTotal: datos.valorTotal,
              estado: datos.valorTotal > 0 && total >= datos.valorTotal ? "completado" : "pendiente",
            };
          }),
        })),
      eliminarAbono: (apartadoId, abonoId) =>
        set((s) => ({
          apartados: s.apartados.map((a) => {
            if (a.id !== apartadoId) return a;
            const abonos = a.abonos.filter((ab) => ab.id !== abonoId);
            const total = abonos.reduce((t, ab) => t + ab.monto, 0);
            return { ...a, abonos, estado: total >= a.valorTotal ? "completado" : "pendiente" };
          }),
        })),
      marcarConseguido: (id, conseguido) =>
        set((s) => ({
          apartados: s.apartados.map((a) => (a.id === id ? { ...a, conseguido } : a)),
        })),
      marcarEntregado: (id, entregado) =>
        set((s) => ({
          // Al entregar, damos por conseguido también.
          apartados: s.apartados.map((a) => (a.id === id ? { ...a, entregado, conseguido: entregado ? true : a.conseguido } : a)),
        })),
      eliminarApartado: (id) => set((s) => ({ apartados: s.apartados.filter((x) => x.id !== id) })),

      setMeta: (anio, mes, montoMeta) => {
        const negocioId = get().negocioActivoId;
        if (!negocioId) return;
        set((s) => {
          const existe = s.metas.find((m) => m.negocioId === negocioId && m.anio === anio && m.mes === mes);
          if (existe) {
            return { metas: s.metas.map((m) => (m === existe ? { ...m, montoMeta } : m)) };
          }
          return { metas: [...s.metas, { id: uid(), negocioId, anio, mes, montoMeta }] };
        });
      },
      setCuadre: (fecha, patch) => {
        const negocioId = get().negocioActivoId;
        if (!negocioId) return;
        set((s) => {
          const existe = s.cuadres.find((c) => c.negocioId === negocioId && c.fecha === fecha);
          if (existe) {
            return { cuadres: s.cuadres.map((c) => (c === existe ? { ...c, ...patch } : c)) };
          }
          return {
            cuadres: [
              ...s.cuadres,
              { id: uid(), negocioId, fecha, efectivoReal: 0, baseSiguiente: 0, ...patch, creadoEn: ahora() },
            ],
          };
        });
      },
    }),
    { name: "contabee-store" },
  ),
);
