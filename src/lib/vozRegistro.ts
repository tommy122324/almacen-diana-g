// ─── Interpreta lo que se dicta (o escribe) → ventas / gastos / entradas ───
// Ej: "vendí una blusa negra en 85 mil por Nequi a la señora María 3001234567"
//     "vendí 50 mil en nequi y 30 mil en efectivo", "gasto de 20 mil en almuerzo",
//     "un millón doscientos mil en tarjeta", "dos blusas a 40 mil en addi".
import type { MetodoPago } from "./types";

export type TipoDictado = "venta" | "gasto" | "entrada";

export interface ItemDictado {
  tipo: TipoDictado;
  monto: number;
  metodo: MetodoPago; // solo ventas
  metodoDicho: boolean; // si se dijo el método (si no, queda efectivo)
  concepto: string; // gasto/entrada: concepto · venta: descripción de lo vendido
  telefono: string; // venta: WhatsApp del cliente (para el recibo)
  cliente: string; // venta: nombre del cliente (para el recibo)
  recibo: boolean; // venta: se pidió recibo o se dio el celular
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
const MIL = new Set(["mil", "lucas", "luca", "barras", "barra", "k"]);
const MILLON = new Set(["millon", "millones", "palo", "palos"]);

const T_GASTO = new Set(["gasto", "gastos", "gaste", "gastamos", "pague", "pagamos", "pago", "compre", "compramos", "salida", "salio", "sale"]);
const T_ENTRADA = new Set(["entrada", "entradas", "entro", "entraron", "ingreso", "ingresaron", "ingresar", "base"]);
const T_VENTA = new Set(["venta", "ventas", "vendi", "vendimos", "vendio", "vendieron", "vender", "vendido", "vendida"]);

// Incluye cómo suele escuchar mal el celular cada método.
const METODO_PALABRAS: [RegExp, MetodoPago][] = [
  [/\b(nequi|neki|nequis|nekis|nequi|nekki|nequie|en equi|nec qui|nek i|equi)\b/, "nequi"],
  [/\b(davi ?plata|david ?plata|dabi ?plata|davy ?plata|davivienda)\b/, "daviplata"],
  [/\b(siste ?credito|sistema ?credito|sistecredito|sixte ?credito|siste)\b/, "sistecredito"],
  [/\b(addi|adi|hadi|adis|addy|adi?ii|a di)\b/, "addi"],
  [/\b(tarjeta|datafono|debito|credito|tarjetas|visa|mastercard)\b/, "tarjeta"],
  [/\b(efectivo|cash|billete|billetes|contado)\b/, "efectivo"],
];
// Palabras de método a quitar de la descripción
const PAL_METODO = /^(nequi|neki|nequis|nekis|nequi|nekki|nequie|equi|davi|david|dabi|davy|plata|daviplata|davivienda|siste|sixte|sistema|credito|sistecredito|addi|adi|hadi|addy|tarjeta|tarjetas|datafono|debito|visa|mastercard|efectivo|cash|contado)$/;

const CONECTORES = new Set([
  "de", "del", "en", "por", "para", "el", "la", "los", "las", "un", "una", "al", "pesos", "peso", "que", "y", "con",
  "a", "se", "hoy", "fue", "fueron", "mas", "otro", "otra", "le", "les", "me", "nos", "cada", "valor", "total", "pago", "pagado", "pagada",
]);
const PAL_RECIBO = new Set(["recibo", "factura", "comprobante"]);
const PAL_CLIENTE_ANTES = new Set(["cliente", "senora", "senor", "senorita", "nombre", "dona", "don"]);

interface Tok {
  o: string; // original
  n: string; // normalizado
}

function tokenizar(texto: string): Tok[] {
  const limpio = texto
    .replace(/\$/g, " ")
    .replace(/(\d)\s*k\b/gi, "$1 mil")
    // "85mil" → "85 mil"
    .replace(/(\d)([a-zA-ZáéíóúÁÉÍÓÚñÑ])/g, "$1 $2")
    .replace(/[¡!¿?;:"()]/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/,(?!\d{3})/g, " , ");
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

interface Span {
  valor: number; // ya escalado (85 → 85.000 si era "débil")
  fuerte: boolean; // tenía "mil"/"millón"/"pesos" o era ≥ 1000
  idx: number[];
}

/** Encuentra TODOS los números de la frase (para elegir el que es el monto). */
function spansNumericos(toks: Tok[]): Span[] {
  const out: Span[] = [];
  let i = 0;
  while (i < toks.length) {
    let total = 0;
    let actual = 0;
    let hay = false;
    let fuerte = false;
    const idx: number[] = [];
    let j = i;
    for (; j < toks.length; j++) {
      const n = toks[j].n;
      const num = valorNumerico(n);
      if (num !== null) {
        actual += num;
        hay = true;
        idx.push(j);
        continue;
      }
      if (n in NUM && n !== "un" && n !== "una") {
        actual += NUM[n];
        hay = true;
        idx.push(j);
        continue;
      }
      if ((n === "un" || n === "una") && j + 1 < toks.length && (MIL.has(toks[j + 1].n) || MILLON.has(toks[j + 1].n))) {
        actual += 1;
        hay = true;
        idx.push(j);
        continue;
      }
      if (MIL.has(n) && (hay || n === "mil")) {
        total += (actual || 1) * 1000;
        actual = 0;
        hay = true;
        fuerte = true;
        idx.push(j);
        continue;
      }
      if (MILLON.has(n) && hay) {
        total = (total + (actual || 1)) * 1_000_000;
        actual = 0;
        fuerte = true;
        idx.push(j);
        continue;
      }
      if (n === "y" && hay && DECENAS.has(toks[j - 1]?.n ?? "") && toks[j + 1] && toks[j + 1].n in NUM) {
        idx.push(j);
        continue;
      }
      if ((n === "pesos" || n === "peso") && hay) {
        fuerte = true;
        idx.push(j);
        continue;
      }
      break;
    }
    if (hay) {
      let valor = Math.round(total + actual);
      if (valor >= 1000) fuerte = true;
      // "vendí 85 en nequi" → en Colombia normalmente son 85 mil
      if (valor > 0 && valor < 1000) valor *= 1000;
      if (valor > 0) out.push({ valor, fuerte, idx });
      i = j;
    } else i++;
  }
  return out;
}

/** El monto es el número "fuerte" más grande; si no hay, el débil más grande. */
function elegirMonto(toks: Tok[]): Span | null {
  const s = spansNumericos(toks);
  if (!s.length) return null;
  const fuertes = s.filter((x) => x.fuerte);
  const pool = fuertes.length ? fuertes : s;
  return pool.reduce((a, b) => (b.valor > a.valor ? b : a));
}

const tieneMetodo = (toks: Tok[]) => {
  const t = toks.map((x) => x.n).join(" ");
  return METODO_PALABRAS.some(([re]) => re.test(t));
};

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
      t.n === "otra" && toks[i + 1]?.n === "venta" ||
      (t.n === "y" && !DECENAS.has(toks[i - 1]?.n ?? ""));
    if (separador) {
      const m = elegirMonto(seg);
      // Solo se parte si lo anterior ya es un registro completo (monto claro, o monto + método)
      if (m && (m.fuerte || tieneMetodo(seg))) {
        out.push(seg);
        seg = [];
        continue;
      }
    }
    if (t.n !== ",") seg.push(t);
  }
  if (seg.length) out.push(seg);
  return out;
}

/** Celular colombiano (10 dígitos que empiezan por 3), aunque venga partido: "300 123 4567". */
function extraerTelefono(toks: Tok[]): { tel: string; idx: Set<number> } {
  for (let i = 0; i < toks.length; i++) {
    if (!/^\d+$/.test(toks[i].n.replace(/[.,-]/g, ""))) continue;
    let dig = "";
    const idx: number[] = [];
    for (let j = i; j < toks.length && dig.length < 10; j++) {
      const d = toks[j].n.replace(/[.,-]/g, "");
      if (!/^\d+$/.test(d)) break;
      dig += d;
      idx.push(j);
    }
    if (dig.length === 10 && dig.startsWith("3")) return { tel: dig, idx: new Set(idx) };
    if (dig.length === 12 && dig.startsWith("573")) return { tel: dig.slice(2), idx: new Set(idx) };
  }
  return { tel: "", idx: new Set() };
}

/** Nombre después de "cliente", "señora", "a nombre de"… (máx. 2 palabras). */
function extraerCliente(toks: Tok[], hayTel: boolean): { nombre: string; idx: Set<number> } {
  for (let i = 0; i < toks.length; i++) {
    const n = toks[i].n;
    const disparador = PAL_CLIENTE_ANTES.has(n) || (hayTel && (n === "para" || n === "a") && i + 1 < toks.length);
    if (!disparador) continue;
    const idx: number[] = [i];
    let k = i + 1;
    if (n === "nombre" && toks[k]?.n === "de") idx.push(k++);
    const palabras: string[] = [];
    while (k < toks.length && palabras.length < 2) {
      const t = toks[k];
      if (!/^[a-zñ]+$/.test(t.n) || CONECTORES.has(t.n) || PAL_METODO.test(t.n) || t.n in NUM || MIL.has(t.n) || T_VENTA.has(t.n) || PAL_RECIBO.has(t.n) || PAL_CLIENTE_ANTES.has(t.n))
        break;
      palabras.push(t.o[0].toUpperCase() + t.o.slice(1).toLowerCase());
      idx.push(k++);
    }
    if (palabras.length) return { nombre: palabras.join(" "), idx: new Set(idx) };
  }
  return { nombre: "", idx: new Set() };
}

export function interpretarDictado(texto: string): ItemDictado[] {
  let toks = tokenizar(texto);

  // Datos del cliente (para el recibo): se sacan antes de buscar montos.
  const { tel, idx: idxTel } = extraerTelefono(toks);
  toks = toks.filter((_, i) => !idxTel.has(i));
  const pideRecibo = toks.some((t) => PAL_RECIBO.has(t.n));
  const { nombre, idx: idxCli } = extraerCliente(toks, !!tel || pideRecibo);
  toks = toks.filter((_, i) => !idxCli.has(i) && !PAL_RECIBO.has(toks[i].n));

  const items: ItemDictado[] = [];
  let tipoPrevio: TipoDictado = "venta";
  let metodoPrevio: MetodoPago | null = null;

  for (const seg of segmentar(toks)) {
    const m = elegirMonto(seg);
    if (!m) continue;
    const usados = new Set(m.idx);
    const textoN = seg.map((t) => t.n).join(" ");

    let tipo: TipoDictado = tipoPrevio;
    if (seg.some((t) => T_GASTO.has(t.n))) tipo = "gasto";
    else if (seg.some((t) => T_ENTRADA.has(t.n))) tipo = "entrada";
    else if (seg.some((t) => T_VENTA.has(t.n))) tipo = "venta";

    let metodo: MetodoPago | null = null;
    for (const [re, mp] of METODO_PALABRAS) if (re.test(textoN)) { metodo = mp; break; }
    const metodoDicho = metodo !== null;
    if (!metodo && tipo === "venta" && tipo === tipoPrevio && metodoPrevio) metodo = metodoPrevio;

    // Descripción / concepto: lo que queda sin palabras clave, monto, método ni conectores sueltos
    const resto = seg
      .filter((t, i) => !usados.has(i) && !T_GASTO.has(t.n) && !(T_ENTRADA.has(t.n) && t.n !== "base") && !T_VENTA.has(t.n) && !PAL_METODO.test(t.n))
      .map((t) => t.o);
    while (resto.length && CONECTORES.has(norm(resto[0]))) resto.shift();
    while (resto.length && CONECTORES.has(norm(resto[resto.length - 1]))) resto.pop();
    let concepto = resto.join(" ").replace(/\s+/g, " ").trim();
    if (concepto) concepto = concepto[0].toUpperCase() + concepto.slice(1);

    items.push({
      tipo,
      monto: m.valor,
      metodo: metodo ?? "efectivo",
      metodoDicho: metodoDicho || !!metodo,
      concepto,
      telefono: "",
      cliente: "",
      recibo: false,
    });
    tipoPrevio = tipo;
    if (tipo === "venta" && metodo) metodoPrevio = metodo;
  }

  // El cliente/celular/recibo dichos van a la primera venta.
  const venta = items.find((x) => x.tipo === "venta");
  if (venta) {
    venta.telefono = tel;
    venta.cliente = nombre;
    venta.recibo = !!tel || pideRecibo;
  }
  return items;
}

/** Entre varias versiones de lo que escuchó el celular, elige la que mejor se entiende. */
export function mejorInterpretacion(alternativas: string[]): { texto: string; items: ItemDictado[] } {
  let mejor = { texto: alternativas[0] ?? "", items: [] as ItemDictado[], puntos: -1 };
  for (const a of alternativas) {
    const items = interpretarDictado(a);
    const puntos = items.length * 10 + items.filter((x) => x.metodoDicho).length * 3 + items.filter((x) => x.concepto).length;
    if (puntos > mejor.puntos) mejor = { texto: a, items, puntos };
  }
  return { texto: mejor.texto, items: mejor.items };
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
  r.continuous = true; // no se corta en las pausas cortas
  r.maxAlternatives = 3; // varias versiones → se elige la que mejor se entiende
  return r;
}
