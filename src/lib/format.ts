// ─── Contabee 🐝 — Formato de moneda y fechas (Colombia) ───

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Formatea un número como pesos colombianos: 12345 → "$12.345" */
export function formatCOP(n: number): string {
  return cop.format(Math.round(n || 0));
}

const numFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** Solo separador de miles, sin símbolo: 12345 → "12.345" */
export function formatNum(n: number): string {
  return numFmt.format(Math.round(n || 0));
}

/** Convierte un texto con puntos/comas a número entero: "12.345" → 12345 */
export function parseMonto(texto: string): number {
  const limpio = (texto || "").replace(/[^\d]/g, "");
  const n = parseInt(limpio, 10);
  return Number.isFinite(n) ? n : 0;
}

const fechaLarga = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "2026-07-06" → "lunes, 6 de julio de 2026" */
export function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fechaLarga.format(new Date(y, m - 1, d));
}

const fechaCorta = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "2026-07-06" → "06/07/2026" */
export function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fechaCorta.format(new Date(y, m - 1, d));
}
