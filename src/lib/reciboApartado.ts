"use client";
// Recibo de un apartado o pedido: si ya tiene uno, lo actualiza con los abonos de hoy; si no, lo crea.
import * as db from "./db";
import { abonadoDe, uuid } from "./store";
import type { Apartado, Recibo } from "./types";

export async function reciboParaApartado(a: Apartado, atendio: string): Promise<Recibo> {
  const abonado = abonadoDe(a);
  const total = a.valorTotal > 0 ? a.valorTotal : abonado;
  const metodo = a.abonos[a.abonos.length - 1]?.metodo ?? "efectivo";
  const datos = { cliente: a.cliente.trim(), telefono: a.telefono.trim(), detalle: a.descripcion.trim(), total, abonado, metodo };
  const existente = await db.reciboDeApartado(a.id);
  if (existente) {
    await db.sincronizarReciboApartado(existente.id, datos);
    return { ...existente, ...datos };
  }
  return db.crearRecibo({
    id: uuid(),
    negocioId: a.negocioId,
    ventaId: null,
    fecha: a.fecha,
    cliente: datos.cliente,
    telefono: datos.telefono,
    detalle: datos.detalle,
    metodo,
    total,
    atendio: atendio.trim(),
    tipo: a.tipo === "pedido" ? "pedido" : "apartado",
    apartadoId: a.id,
    abonado,
  });
}

/** Mensaje de error entendible (p. ej. si falta ejecutar el SQL). */
export function errorRecibo(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "";
  if (/apartado_id|abonado|column|schema cache/i.test(m)) return "Falta ejecutar el SQL de recibos de apartados (fase7n) en Supabase.";
  return "No se pudo crear el recibo. Revisa tu conexión a internet.";
}
