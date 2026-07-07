// ─── Contabee 🐝 — Cálculos y periodos ───
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
  eachDayOfInterval,
  parseISO,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import type { Venta, Gasto, Entrada, MetodoPago, Apartado } from "./types";
import { METODOS, METODO_LABEL } from "./types";

export type TipoPeriodo = "dia" | "semana" | "mes" | "rango";

export interface Periodo {
  desde: string; // "YYYY-MM-DD" inclusive
  hasta: string; // "YYYY-MM-DD" inclusive
}

/** Fecha local de hoy como "YYYY-MM-DD" */
export function hoyISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Construye el periodo según el tipo elegido, tomando "ref" como referencia. */
export function periodoDe(tipo: TipoPeriodo, ref: Date = new Date()): Periodo {
  switch (tipo) {
    case "dia":
      return { desde: format(startOfDay(ref), "yyyy-MM-dd"), hasta: format(endOfDay(ref), "yyyy-MM-dd") };
    case "semana":
      return {
        desde: format(startOfWeek(ref, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        hasta: format(endOfWeek(ref, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "mes":
      return {
        desde: format(startOfMonth(ref), "yyyy-MM-dd"),
        hasta: format(endOfMonth(ref), "yyyy-MM-dd"),
      };
    default:
      return { desde: format(ref, "yyyy-MM-dd"), hasta: format(ref, "yyyy-MM-dd") };
  }
}

/** Periodo inmediatamente anterior del mismo tipo (mes pasado, semana pasada, etc.). */
export function periodoAnterior(tipo: TipoPeriodo, ref: Date = new Date()): Periodo {
  const prev =
    tipo === "mes" ? subMonths(ref, 1) : tipo === "semana" ? subWeeks(ref, 1) : subDays(ref, 1);
  return periodoDe(tipo === "rango" ? "dia" : tipo, prev);
}

/** Etiqueta legible del tipo de periodo. */
export const LABEL_PERIODO: Record<TipoPeriodo, string> = {
  dia: "día",
  semana: "semana",
  mes: "mes",
  rango: "periodo",
};

/** Variación porcentual entre dos valores (null si no se puede calcular). */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return ((actual - anterior) / anterior) * 100;
}

/** ¿La fecha ISO está dentro del periodo (inclusive)? */
export function enPeriodo(fecha: string, p: Periodo): boolean {
  return fecha >= p.desde && fecha <= p.hasta;
}

/** Filtra cualquier lista con campo "fecha" por periodo y negocio. */
export function filtrar<T extends { fecha: string; negocioId: string }>(
  items: T[],
  negocioId: string | null,
  p: Periodo,
): T[] {
  if (!negocioId) return [];
  return items.filter((i) => i.negocioId === negocioId && enPeriodo(i.fecha, p));
}

/** Suma de abonos de apartados cuyo pago cae dentro del periodo. */
export function abonosEnPeriodo(
  apartados: Apartado[],
  negocioId: string | null,
  p: Periodo,
): number {
  if (!negocioId) return 0;
  let total = 0;
  for (const a of apartados) {
    if (a.negocioId !== negocioId) continue;
    for (const ab of a.abonos) {
      if (enPeriodo(ab.fecha, p)) total += ab.monto;
    }
  }
  return total;
}

/** Abonos por método de pago dentro del periodo. */
export function abonosPorMetodoEnPeriodo(
  apartados: Apartado[],
  negocioId: string | null,
  p: Periodo,
): Record<MetodoPago, number> {
  const out = Object.fromEntries(METODOS.map((m) => [m, 0])) as Record<MetodoPago, number>;
  if (!negocioId) return out;
  for (const a of apartados) {
    if (a.negocioId !== negocioId) continue;
    for (const ab of a.abonos) {
      if (enPeriodo(ab.fecha, p)) out[ab.metodo ?? "efectivo"] += ab.monto;
    }
  }
  return out;
}

/** Mapa fecha → suma de abonos de ese día. */
export function abonosPorDia(
  apartados: Apartado[],
  negocioId: string | null,
  p: Periodo,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!negocioId) return out;
  for (const a of apartados) {
    if (a.negocioId !== negocioId) continue;
    for (const ab of a.abonos) {
      if (enPeriodo(ab.fecha, p)) out[ab.fecha] = (out[ab.fecha] ?? 0) + ab.monto;
    }
  }
  return out;
}

export interface Resumen {
  porMetodo: Record<MetodoPago, number>;
  totalVentas: number;
  totalGastos: number;
  totalEntradas: number;
  totalAbonos: number; // abonos de apartados (ganancia realizada)
  ingresos: number; // ventas + entradas + abonos
  utilidad: number; // ingresos - gastos
}

/** Calcula totales a partir de listas ya filtradas. `abonos` es la suma de abonos del periodo. */
export function resumen(
  ventas: Venta[],
  gastos: Gasto[],
  entradas: Entrada[],
  abonos = 0,
): Resumen {
  const porMetodo = Object.fromEntries(
    METODOS.map((m) => [m, 0]),
  ) as Record<MetodoPago, number>;

  let totalVentas = 0;
  for (const v of ventas) {
    porMetodo[v.metodo] += v.monto;
    totalVentas += v.monto;
  }
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const totalEntradas = entradas.reduce((s, e) => s + e.monto, 0);
  const ingresos = totalVentas + totalEntradas + abonos;

  return {
    porMetodo,
    totalVentas,
    totalGastos,
    totalEntradas,
    totalAbonos: abonos,
    ingresos,
    utilidad: ingresos - totalGastos,
  };
}

export interface PuntoDia {
  fecha: string; // "YYYY-MM-DD"
  etiqueta: string; // "06/07"
  ventas: number;
  gastos: number;
  utilidad: number;
}

/** Serie diaria (para la gráfica) dentro de un periodo. `abonosMap` opcional: fecha → abonos. */
export function serieDiaria(
  ventas: Venta[],
  gastos: Gasto[],
  entradas: Entrada[],
  p: Periodo,
  abonosMap: Record<string, number> = {},
): PuntoDia[] {
  const dias = eachDayOfInterval({
    start: parseISO(p.desde),
    end: parseISO(p.hasta),
  });
  return dias.map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    const v = ventas.filter((x) => x.fecha === iso).reduce((s, x) => s + x.monto, 0);
    const g = gastos.filter((x) => x.fecha === iso).reduce((s, x) => s + x.monto, 0);
    const e = entradas.filter((x) => x.fecha === iso).reduce((s, x) => s + x.monto, 0);
    const ab = abonosMap[iso] ?? 0;
    return {
      fecha: iso,
      etiqueta: format(d, "dd/MM"),
      ventas: v,
      gastos: g,
      utilidad: v + e + ab - g,
    };
  });
}

/** Datos para la gráfica de torta por método de pago. */
export function distribucionMetodos(r: Resumen) {
  return METODOS.map((m) => ({
    metodo: m,
    nombre: METODO_LABEL[m],
    valor: r.porMetodo[m],
  })).filter((x) => x.valor > 0);
}
