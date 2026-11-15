// ─── Interpreta lo que se dicta por voz → ventas / gastos / entradas ───
// Ej: "vendí 85 mil en Nequi y 30 mil en efectivo", "gasto de 20 mil en almuerzo",
//     "un millón doscientos mil en tarjeta", "entrada de 100 mil de base".
import type { MetodoPago } from "./types";

export type TipoDictado = "venta" | "gasto" | "entrada";

export interface ItemDictado {
  tipo: TipoDictado;
  monto: number;
  metodo: MetodoPago; // solo ventas
  metodoDicho: boolean; // si se dijo el método (si no, queda efectivo)
  concepto: string; // gastos / entradas
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const NUM: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
  medio: 0.5,
};
const DECENAS = new Set(["treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]);
const MIL = new Set(["mil", "lucas", "luca", "barras", "barra"]);
const MILLON = new Set(["millon", "millones", "palo", "palos"]);

const T_GASTO = new Set(["gasto", "gastos", "gaste", "gastamos", "gasté", "pague", "pagamos", "compre", "compramos", "salida", "salio"]);
const T_ENTRADA = new Set(["entrada", "entradas", "entro", "entraron", "ingreso", "ingresaron", "ingresar", "base"]);
const T_VENTA = new Set(["venta", "ventas", "vendi", "vendimos", "vendio", "vendieron", "vender"]);

const METODO_PALABRAS: [RegExp, MetodoPago][] = [
  [/\b(nequi|neki|nequis|nekis|nekí)\b/, "nequi"],
  [/\b(davi ?plata|david ?plata|daviplata)\b/, "daviplata"],
  [/\b(siste ?credito|sistema ?credito|sistecredito)\b/, "sistecredito"],
  [/\b(addi|adi|hadi|adis)\b/, "addi"],
  [/\b(tarjeta|datafono|debito|credito|tarjetas)\b/, "tarjeta"],
  [/\b(efectivo|cash|billete|billetes)\b/, "efectivo"],
];
// Palabras de método a quitar del concepto
const PAL_METODO = /^(nequi|neki|nequis|nekis|davi|david|plata|daviplata|siste|sistema|credito|sistecredito|addi|adi|hadi|tarjeta|datafono|debito|efectivo|cash)$/;

const CONECTORES = new Set(["de", "del", "en", "por", "para", "el", "la", "los", "las", "un", "una", "al", "pesos", "peso", "que", "y", "con", "a", "se", "hoy", "fue", "fueron", "mas", "otro", "otra"]);

interface Tok {
  o: string; // original
  n: string; // normalizado
}

function tokenizar(texto: string): Tok[] {
  const limpio = texto
    .replace(/\$/g, " ")
    // "85mil" → "85 mil"
    .replace(/(\d)([a-zA-ZáéíóúÁÉÍÓÚ])/g, "$1 $2")
    .replace(/[¡!¿?;:"]/g, " ")
    .replace(/,(?!\d)/g, " , ");
  return limpio
    .split(/\s+/)
    .filter(Boolean)
    .map((o) => ({ o, n: norm(o) }));
}

function valorNumerico(t: string): number | null {
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  if (/^\d+[.,]\d{1,2}$/.test(t)) return Number(t.replace(",", "."));
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

/** Busca el primer monto dentro de los tokens. Devuelve monto e índices usados. */
function extraerMonto(toks: Tok[]): { monto: number; usados: Set<number> } {
  let total = 0;
  let actual = 0;
  let hay = false;
  const usados = new Set<number>();
  for (let i = 0; i < toks.length; i++) {
    const n = toks[i].n;
    const num = valorNumerico(n);
    if (num !== null) {
      actual += num;
      hay = true;
      usados.add(i);
      continue;
    }
    if (n in NUM && !(n === "un" || n === "una") ) {
      actual += NUM[n];
      hay = true;
      usados.add(i);
      continue;
    }
    if ((n === "un" || n === "una") && i + 1 < toks.length && (MIL.has(toks[i + 1].n) || MILLON.has(toks[i + 1].n))) {
      actual += 1;
      hay = true;
      usados.add(i);
      continue;
    }
    if (MIL.has(n)) {
      total += (actual || 1) * 1000;
      actual = 0;
      hay = true;
      usados.add(i);
      continue;
    }
    if (MILLON.has(n) && hay) {
      total = (total + (actual || 1)) * 1_000_000;
      actual = 0;
      usados.add(i);
      continue;
    }
    // "treinta y cinco"
    if (n === "y" && hay && DECENAS.has(toks[i - 1]?.n ?? "") && toks[i + 1] && toks[i + 1].n in NUM) {
      usados.add(i);
      continue;
    }
    if ((n === "pesos" || n === "peso") && hay) {
      usados.add(i);
      continue;
    }
    if (hay) break;
  }
  let monto = Math.round(total + actual);
  // "vendí 85 en nequi" → en Colombia normalmente son 85 mil
  if (monto > 0 && monto < 1000) monto *= 1000;
  return { monto, usados };
}

/** Parte la frase en varios registros: "50 mil en nequi y 30 mil en efectivo". */
function segmentar(toks: Tok[]): Tok[][] {
  const out: Tok[][] = [];
  let seg: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const separador =
      t.n === "," ||
      t.n === "luego" ||
      t.n === "ademas" ||
      t.n === "tambien" ||
      (t.n === "y" && !DECENAS.has(toks[i - 1]?.n ?? ""));
    if (separador && extraerMonto(seg).monto > 0) {
      out.push(seg);
      seg = [];
      continue;
    }
    if (t.n !== ",") seg.push(t);
  }
  if (seg.length) out.push(seg);
  return out;
}

export function interpretarDictado(texto: string): ItemDictado[] {
  const toks = tokenizar(texto);
  const items: ItemDictado[] = [];
  let tipoPrevio: TipoDictado = "venta";
  let metodoPrevio: MetodoPago | null = null;

  for (const seg of segmentar(toks)) {
    const { monto, usados } = extraerMonto(seg);
    if (monto <= 0) continue;
    const textoN = seg.map((t) => t.n).join(" ");

    let tipo: TipoDictado = tipoPrevio;
    if (seg.some((t) => T_GASTO.has(t.n))) tipo = "gasto";
    else if (seg.some((t) => T_ENTRADA.has(t.n))) tipo = "entrada";
    else if (seg.some((t) => T_VENTA.has(t.n))) tipo = "venta";

    let metodo: MetodoPago | null = null;
    for (const [re, m] of METODO_PALABRAS) if (re.test(textoN)) { metodo = m; break; }
    const metodoDicho = metodo !== null;
    if (!metodo && tipo === "venta" && tipo === tipoPrevio && metodoPrevio) metodo = metodoPrevio;

    // Concepto: lo que queda sin palabras clave, monto, método ni conectores sueltos
    const resto = seg
      .filter((t, i) => !usados.has(i) && !T_GASTO.has(t.n) && !(T_ENTRADA.has(t.n) && t.n !== "base") && !T_VENTA.has(t.n) && !PAL_METODO.test(t.n))
      .map((t) => t.o);
    while (resto.length && CONECTORES.has(norm(resto[0]))) resto.shift();
    while (resto.length && CONECTORES.has(norm(resto[resto.length - 1]))) resto.pop();
    let concepto = resto.join(" ").trim();
    if (concepto) concepto = concepto[0].toUpperCase() + concepto.slice(1);

    items.push({ tipo, monto, metodo: metodo ?? "efectivo", metodoDicho: metodoDicho || !!metodo, concepto });
    tipoPrevio = tipo;
    if (tipo === "venta" && metodo) metodoPrevio = metodo;
  }
  return items;
}

// ─── Reconocimiento de voz del navegador ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;
export function crearReconocimiento(): SR | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const C = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!C) return null;
  const r = new C();
  r.lang = "es-CO";
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}
