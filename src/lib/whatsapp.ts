"use client";
// ─── Almacén Diana G 🐝 — WhatsApp (enlaces wa.me, gratis) ───

/** Normaliza el teléfono para WhatsApp (Colombia: antepone 57 si son 10 dígitos). */
export function telefonoWhatsApp(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length === 10) return "57" + d; // celular colombiano sin indicativo
  return d;
}

/** Abre WhatsApp con el mensaje listo para enviar (un toque). */
export function abrirWhatsApp(tel: string, mensaje: string) {
  const num = telefonoWhatsApp(tel);
  if (!num) return;
  const url = `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}

/** Mensaje cuando un pedido llegó a la tienda. */
export function mensajePedidoLlego(descripcion: string): string {
  const prod = descripcion.trim() || "tu pedido";
  return `Hola, te escribimos de Almacén Diana 🐝. Encargaste: ${prod}. ¡Te confirmamos que ya llegó a la tienda! Te esperamos con mucha emoción. 💛`;
}
