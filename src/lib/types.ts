// ─── Contabee 🐝 — Tipos del dominio ───
// Los montos siempre son enteros en COP (pesos, sin decimales).

export type MetodoPago =
  | "efectivo"
  | "nequi"
  | "daviplata"
  | "tarjeta"
  | "credito"
  | "sistecredito"
  | "addi";

export const METODOS: MetodoPago[] = [
  "efectivo",
  "nequi",
  "daviplata",
  "tarjeta",
  "credito",
  "sistecredito",
  "addi",
];

export const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "DaviPlata",
  tarjeta: "Tarjeta",
  credito: "Tarjeta de crédito",
  sistecredito: "Sistecrédito",
  addi: "Addi",
};

export type EstadoApartado = "pendiente" | "completado";

export interface Negocio {
  id: string;
  nombre: string;
  creadoEn: string;
}

export interface Venta {
  id: string;
  negocioId: string;
  fecha: string; // "YYYY-MM-DD"
  metodo: MetodoPago;
  monto: number;
  creadoEn: string;
}

export interface Gasto {
  id: string;
  negocioId: string;
  fecha: string;
  concepto: string;
  monto: number;
  creadoEn: string;
}

export interface Entrada {
  id: string;
  negocioId: string;
  fecha: string;
  concepto: string;
  monto: number;
  creadoEn: string;
}

export interface Abono {
  id: string;
  fecha: string;
  monto: number;
  metodo: MetodoPago;
}

export interface Apartado {
  id: string;
  negocioId: string;
  fecha: string; // fecha en que se hizo el apartado
  cliente: string;
  telefono: string;
  valorTotal: number;
  abonos: Abono[]; // pagos parciales; el primero es el abono inicial
  estado: EstadoApartado;
  creadoEn: string;
}

export interface Meta {
  id: string;
  negocioId: string;
  anio: number;
  mes: number; // 1-12
  montoMeta: number;
}

export interface Cuadre {
  id: string;
  negocioId: string;
  fecha: string;
  efectivoReal: number;
  baseSiguiente: number; // dinero que se deja en caja para el día siguiente
  creadoEn: string;
}
