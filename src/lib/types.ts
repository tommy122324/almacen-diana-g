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

// "apartado": prenda que el cliente deja separada y va pagando.
// "pedido": el cliente encarga algo específico; el abono no es obligatorio.
export type TipoApartado = "apartado" | "pedido";

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
  tipo: TipoApartado;
  descripcion: string; // qué prenda(s) deja o qué pide el cliente
  fecha: string; // fecha en que se hizo el apartado/pedido
  cliente: string;
  telefono: string;
  valorTotal: number;
  abonos: Abono[]; // pagos parciales; el primero es el abono inicial
  estado: EstadoApartado;
  conseguido: boolean; // solo pedidos: si ya se consiguió/trajo a la tienda
  entregado: boolean; // solo pedidos: si ya se entregó al cliente
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
