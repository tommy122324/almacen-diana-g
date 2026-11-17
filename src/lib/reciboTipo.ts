// Textos del recibo según su tipo (venta, apartado, pedido). Sin "use client": lo usa también la página pública.
import type { Recibo, TipoRecibo } from "./types";

export const tipoRecibo = (r: Recibo): TipoRecibo => r.tipo ?? "venta";
export const TIPO_RECIBO_LABEL: Record<TipoRecibo, string> = { venta: "Venta", apartado: "Apartado", pedido: "Pedido" };
const TITULO: Record<TipoRecibo, string> = { venta: "RECIBO DE COMPRA", apartado: "RECIBO DE APARTADO", pedido: "RECIBO DE PEDIDO" };
const GRACIAS: Record<TipoRecibo, string> = { venta: "¡Gracias por tu compra! 💛", apartado: "¡Gracias por apartar con nosotros! 💛", pedido: "¡Gracias por tu pedido! 💛" };
const DETALLE: Record<TipoRecibo, string> = { venta: "DETALLE DE LA COMPRA", apartado: "PRENDAS APARTADAS", pedido: "LO QUE PEDISTE" };

/** Abonado y saldo (solo apartados y pedidos). */
export function saldoRecibo(r: Recibo) {
  const abonado = r.abonado ?? 0;
  return { abonado, saldo: Math.max(0, r.total - abonado) };
}
export const tituloRecibo = (r: Recibo) => TITULO[tipoRecibo(r)];
export const graciasRecibo = (r: Recibo) => GRACIAS[tipoRecibo(r)];
export const detalleRecibo = (r: Recibo) => DETALLE[tipoRecibo(r)];
