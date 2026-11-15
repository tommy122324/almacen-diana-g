// ─── Calendario de temporadas comerciales en Colombia (almacén de ropa) ───
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export interface Temporada {
  id: string;
  nombre: string;
  emoji: string;
  inicio: string; // ISO: cuando empieza a moverse la venta
  fin: string; // ISO: día del evento / fin de la temporada
  surtirDias: number; // cuántos días antes de "inicio" conviene surtir
  consejo: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** n-ésimo día de la semana (0=domingo) de un mes (0-11). */
function nEsimo(anio: number, mes: number, diaSemana: number, n: number): Date {
  const primero = new Date(anio, mes, 1);
  const delta = (diaSemana - primero.getDay() + 7) % 7;
  return new Date(anio, mes, 1 + delta + (n - 1) * 7);
}

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function pascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes, dia);
}

export function temporadasDelAnio(anio: number): Temporada[] {
  const madre = nEsimo(anio, 4, 0, 2);
  const padre = nEsimo(anio, 5, 0, 3);
  const amor = nEsimo(anio, 8, 6, 3);
  const black = addDays(nEsimo(anio, 10, 4, 4), 1);
  const ramos = addDays(pascua(anio), -7);
  const ev = (id: string, nombre: string, emoji: string, inicio: Date, fin: Date, surtirDias: number, consejo: string): Temporada => ({
    id: `${id}-${anio}`, nombre, emoji, inicio: iso(inicio), fin: iso(fin), surtirDias, consejo,
  });
  return [
    ev("clases", "Regreso a clases", "🎒", new Date(anio, 0, 10), new Date(anio, 1, 5), 20, "Sudaderas, tenis, medias y ropa para el colegio. Las familias compran la primera quincena de enero."),
    ev("mujer", "Día de la Mujer", "💐", new Date(anio, 2, 1), new Date(anio, 2, 8), 15, "Blusas, vestidos y accesorios para regalar. Arma combos y empaques de regalo."),
    ev("hombre", "Día del Hombre", "👔", new Date(anio, 2, 12), new Date(anio, 2, 19), 10, "Camisas, polos y jeans. Buen momento para mostrar la sección de caballero."),
    ev("santa", "Semana Santa", "🌴", addDays(ramos, -10), pascua(anio), 20, "Viajes y vacaciones: ropa fresca, pantalonetas, vestidos de baño y sandalias."),
    ev("madre", "Día de la Madre", "🌹", addDays(madre, -14), madre, 30, "La fecha más fuerte del primer semestre. Surte blusas, pijamas, conjuntos y tallas grandes con tiempo."),
    ev("prima1", "Prima de mitad de año", "💰", new Date(anio, 5, 15), new Date(anio, 5, 30), 15, "Pagan la prima antes del 30 de junio: la gente tiene plata para estrenar. Ofrece promociones."),
    ev("padre", "Día del Padre", "🎁", addDays(padre, -10), padre, 20, "Camisas, bermudas, gorras y billeteras. Combina con la prima de junio."),
    ev("amor", "Amor y Amistad", "💛", addDays(amor, -10), amor, 20, "Regalos para amigo secreto: pijamas, medias, accesorios y prendas de bajo precio."),
    ev("halloween", "Halloween", "🎃", new Date(anio, 9, 15), new Date(anio, 9, 31), 20, "Disfraces y accesorios para niños. Ropa negra y naranja."),
    ev("black", "Black Friday", "🛍️", addDays(black, -3), black, 15, "Haz descuentos visibles para sacar inventario viejo antes de diciembre."),
    ev("navidad", "Temporada navideña y prima", "🎄", new Date(anio, 11, 1), new Date(anio, 11, 24), 30, "La temporada más fuerte del año: pagan la prima y todos estrenan. Surte desde noviembre, sobre todo tallas niño."),
    ev("findeano", "Estrenar el 31", "🎆", new Date(anio, 11, 26), new Date(anio, 11, 31), 10, "Se estrena para fin de año: ropa amarilla, vestidos y camisas de fiesta."),
  ];
}

export type EstadoTemporada = "en-curso" | "surtir" | "proxima" | "pasada";

export function estadoTemporada(t: Temporada, hoy: string) {
  const h = parseISO(hoy);
  const diasInicio = differenceInCalendarDays(parseISO(t.inicio), h);
  const diasFin = differenceInCalendarDays(parseISO(t.fin), h);
  const surtirDesde = iso(addDays(parseISO(t.inicio), -t.surtirDias));
  let estado: EstadoTemporada = "proxima";
  if (diasFin < 0) estado = "pasada";
  else if (diasInicio <= 0) estado = "en-curso";
  else if (hoy >= surtirDesde) estado = "surtir";
  return { estado, diasInicio, diasFin, surtirDesde };
}

/** Temporadas desde hoy hasta dentro de ~12 meses (incluye las que están en curso). */
export function proximasTemporadas(hoy: string): Temporada[] {
  const anio = Number(hoy.slice(0, 4));
  const limite = iso(addDays(parseISO(hoy), 366));
  return [...temporadasDelAnio(anio), ...temporadasDelAnio(anio + 1)]
    .filter((t) => t.fin >= hoy && t.inicio <= limite)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** La misma temporada del año anterior. */
export function temporadaAnioAnterior(t: Temporada): Temporada | undefined {
  const [base, anio] = [t.id.replace(/-\d+$/, ""), Number(t.id.slice(-4))];
  return temporadasDelAnio(anio - 1).find((x) => x.id === `${base}-${anio - 1}`);
}
