// ─── Contabee 🐝 — Tipos del dominio ───
// Los montos siempre son enteros en COP (pesos, sin decimales).

export type MetodoPago =
  | "efectivo"
  | "nequi"
  | "daviplata"
  | "tarjeta"
  | "sistecredito"
  | "addi";

export const METODOS: MetodoPago[] = [
  "efectivo",
  "nequi",
  "daviplata",
  "tarjeta",
  "sistecredito",
  "addi",
];

export const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "DaviPlata",
  tarjeta: "Tarjeta",
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
  empleadoId?: string; // si es un pago de nómina
  firma?: string; // firma del empleado (data URL) cuando es pago de nómina
}

export interface Entrada {
  id: string;
  negocioId: string;
  fecha: string;
  concepto: string;
  monto: number;
  creadoEn: string;
}

/** Gasto mensual / fijo (arriendo, servicios, etc.). Solo admin. Resta a la utilidad del mes. */
export interface GastoMensual {
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

export interface Configuracion {
  whatsapp: string; // número de WhatsApp del almacén
  correoCodigos: string; // correo a donde llegan los códigos (Fase 7)
  salarioMinimo: number; // salario mínimo mensual (para calcular descuentos por retraso)
}

export interface RegistroHora {
  id: string;
  usuarioId: string;
  fecha: string;
  hora: string; // "HH:MM"
  minutosTarde: number;
  descuento: number;
  anulada?: boolean; // el admin la anuló (sigue bloqueando el reintento del día)
}

/** Operación pendiente de subir a la nube (cola offline). */
export interface OpPendiente {
  opId: string;
  tabla: string;
  tipo: "insert" | "update" | "delete" | "upsert";
  payload: Record<string, unknown>; // fila (insert/upsert) o { id, patch } (update) o { id } (delete)
  onConflict?: string;
  creadoEn: number;
}

export interface Tarea {
  id: string;
  negocioId: string;
  usuarioId: string; // empleado asignado
  fecha: string;
  descripcion: string;
  progreso: number; // 0-100
  completada: boolean;
  creadoEn: string;
}

export interface Cuadre {
  id: string;
  negocioId: string;
  fecha: string;
  efectivoReal: number; // efectivo contado hoy en la caja (caja de hoy)
  baseSiguiente: number; // sin uso (compatibilidad)
  cuadrado: boolean | null; // true = cuadró (verde), false = no cuadró (rojo), null = sin decidir
  diferencia: number; // diferencia cuando NO cuadró (±)
  creadoEn: string;
}
