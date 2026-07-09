"use client";
// ─── Respaldo (copia de seguridad) de un negocio ───
// JSON = respaldo completo para restaurar. Excel = para leerlo.

import { exportarDatos, restaurarDatos } from "./db";

const VERSION = 1;

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function hoyTag() {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" }); // YYYY-MM-DD
}
function limpio(nombre: string) {
  return nombre.replace(/[^\w]+/g, "_");
}

/** Descarga un archivo .json con TODOS los datos del negocio (para restaurar). */
export async function descargarRespaldoJSON(negocioId: string, nombreNegocio: string) {
  const datos = await exportarDatos(negocioId);
  const paquete = {
    app: "Almacén Diana G",
    version: VERSION,
    exportadoEn: new Date().toISOString(),
    negocioId,
    nombreNegocio,
    datos,
  };
  const blob = new Blob([JSON.stringify(paquete, null, 2)], { type: "application/json" });
  descargar(blob, `Respaldo_${limpio(nombreNegocio)}_${hoyTag()}.json`);
}

const HOJAS: { tabla: string; titulo: string }[] = [
  { tabla: "ventas", titulo: "Ventas" },
  { tabla: "gastos", titulo: "Gastos" },
  { tabla: "entradas", titulo: "Entradas" },
  { tabla: "apartados", titulo: "Apartados" },
  { tabla: "abonos", titulo: "Abonos" },
  { tabla: "cuadres", titulo: "Cuadres" },
  { tabla: "metas", titulo: "Metas" },
  { tabla: "registros_hora", titulo: "Entradas de hora" },
  { tabla: "tareas", titulo: "Tareas" },
  { tabla: "configuracion", titulo: "Configuración" },
];

/** Descarga un Excel legible con una hoja por tipo de dato. */
export async function descargarRespaldoExcel(negocioId: string, nombreNegocio: string) {
  const datos = await exportarDatos(negocioId);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  for (const { tabla, titulo } of HOJAS) {
    const filas = datos[tabla] ?? [];
    const hoja = wb.addWorksheet(titulo);
    if (filas.length === 0) {
      hoja.addRow(["(sin datos)"]);
      continue;
    }
    const columnas = Object.keys(filas[0]);
    hoja.addRow(columnas);
    hoja.getRow(1).font = { bold: true };
    for (const fila of filas) {
      hoja.addRow(columnas.map((col) => {
        const v = (fila as Record<string, unknown>)[col];
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        // Las firmas (data URL enormes) no se vuelcan al Excel
        if (col === "firma" && typeof v === "string" && v.startsWith("data:")) return "(firma)";
        return v as string | number | boolean;
      }));
    }
    hoja.columns.forEach((c) => (c.width = 18));
  }
  const buf = await wb.xlsx.writeBuffer();
  descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Respaldo_${limpio(nombreNegocio)}_${hoyTag()}.xlsx`);
}

/** Lee un archivo .json de respaldo y restaura los datos en el negocio actual. */
export async function restaurarRespaldoDesdeArchivo(negocioId: string, archivo: File): Promise<{ total: number }> {
  const texto = await archivo.text();
  let paquete: { app?: string; datos?: Record<string, unknown[]> };
  try {
    paquete = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no es un respaldo válido.");
  }
  if (!paquete.datos || typeof paquete.datos !== "object") {
    throw new Error("El archivo no tiene datos de respaldo.");
  }
  const datos = paquete.datos as Record<string, Record<string, unknown>[]>;
  await restaurarDatos(negocioId, datos as never);
  const total = Object.values(datos).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
  return { total };
}
