// ─── Proveedores y cuentas por pagar (Fase 7l) — solo administrador ───
// Módulo aparte: no toca ventas, gastos ni la cola offline.
import { createClient } from "@/lib/supabase/client";
import type { MetodoPago } from "./types";

export interface PagoProveedor {
  id: string;
  cuentaId: string;
  fecha: string;
  monto: number;
  metodo: MetodoPago;
}
export interface CuentaPagar {
  id: string;
  negocioId: string;
  proveedorId: string;
  fecha: string;
  vence: string | null;
  concepto: string;
  monto: number;
  pagos: PagoProveedor[];
}
export interface Proveedor {
  id: string;
  negocioId: string;
  nombre: string;
  telefono: string;
  notas: string;
}

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => String(v ?? "");
const db = () => createClient();

const mProveedor = (r: Row): Proveedor => ({ id: s(r.id), negocioId: s(r.negocio_id), nombre: s(r.nombre), telefono: s(r.telefono), notas: s(r.notas) });
const mPago = (r: Row): PagoProveedor => ({ id: s(r.id), cuentaId: s(r.cuenta_id), fecha: s(r.fecha), monto: n(r.monto), metodo: (s(r.metodo) || "efectivo") as MetodoPago });
const mCuenta = (r: Row): CuentaPagar => ({
  id: s(r.id),
  negocioId: s(r.negocio_id),
  proveedorId: s(r.proveedor_id),
  fecha: s(r.fecha),
  vence: r.vence ? s(r.vence) : null,
  concepto: s(r.concepto),
  monto: n(r.monto),
  pagos: ((r.pagos_proveedor as Row[]) ?? []).map(mPago).sort((a, b) => a.fecha.localeCompare(b.fecha)),
});

export const pagadoDe = (c: CuentaPagar) => c.pagos.reduce((t, p) => t + p.monto, 0);
export const saldoCuenta = (c: CuentaPagar) => Math.max(0, c.monto - pagadoDe(c));

export async function listarProveedores(negocioId: string): Promise<Proveedor[]> {
  const { data, error } = await db().from("proveedores").select("*").eq("negocio_id", negocioId).order("nombre");
  if (error) throw error;
  return (data ?? []).map(mProveedor);
}
export async function crearProveedor(p: { negocioId: string; nombre: string; telefono: string; notas: string }): Promise<Proveedor> {
  const { data, error } = await db()
    .from("proveedores")
    .insert({ negocio_id: p.negocioId, nombre: p.nombre, telefono: p.telefono, notas: p.notas })
    .select()
    .single();
  if (error) throw error;
  return mProveedor(data as Row);
}
export async function actualizarProveedor(id: string, p: { nombre: string; telefono: string; notas: string }): Promise<void> {
  const { error } = await db().from("proveedores").update(p).eq("id", id);
  if (error) throw error;
}
export async function eliminarProveedor(id: string): Promise<void> {
  const { error } = await db().from("proveedores").delete().eq("id", id);
  if (error) throw error;
}

export async function listarCuentasPagar(negocioId: string): Promise<CuentaPagar[]> {
  const { data, error } = await db().from("cuentas_pagar").select("*, pagos_proveedor(*)").eq("negocio_id", negocioId).order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mCuenta);
}
export async function crearCuentaPagar(c: { negocioId: string; proveedorId: string; fecha: string; vence: string | null; concepto: string; monto: number }): Promise<void> {
  const { error } = await db()
    .from("cuentas_pagar")
    .insert({ negocio_id: c.negocioId, proveedor_id: c.proveedorId, fecha: c.fecha, vence: c.vence, concepto: c.concepto, monto: c.monto });
  if (error) throw error;
}
export async function eliminarCuentaPagar(id: string): Promise<void> {
  const { error } = await db().from("cuentas_pagar").delete().eq("id", id);
  if (error) throw error;
}
export async function registrarPagoProveedor(p: { negocioId: string; cuentaId: string; fecha: string; monto: number; metodo: MetodoPago }): Promise<void> {
  const { error } = await db()
    .from("pagos_proveedor")
    .insert({ negocio_id: p.negocioId, cuenta_id: p.cuentaId, fecha: p.fecha, monto: p.monto, metodo: p.metodo });
  if (error) throw error;
}
export async function eliminarPagoProveedor(id: string): Promise<void> {
  const { error } = await db().from("pagos_proveedor").delete().eq("id", id);
  if (error) throw error;
}

/** Ventas por día (solo fecha y monto), paginado para traer rangos largos. Solo lectura. */
export async function ventasPorDia(negocioId: string, desde: string, hasta: string): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const paso = 1000;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db()
      .from("ventas")
      .select("fecha, monto")
      .eq("negocio_id", negocioId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("id")
      .range(i * paso, i * paso + paso - 1);
    if (error) throw error;
    for (const r of (data ?? []) as Row[]) m.set(s(r.fecha), (m.get(s(r.fecha)) ?? 0) + n(r.monto));
    if (!data || data.length < paso) break;
  }
  return m;
}
