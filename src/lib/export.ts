// ─── Contabee 🐝 — Exportar reportes a Excel y PDF ───
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { METODOS, METODO_LABEL } from "./types";
import type { Venta, Gasto, Entrada } from "./types";
import type { Resumen, Periodo } from "./calc";
import { formatCOP, formatFechaCorta } from "./format";

interface DatosReporte {
  negocio: string;
  periodoLabel: string;
  periodo: Periodo;
  resumen: Resumen;
  ventas: Venta[];
  gastos: Gasto[];
  entradas: Entrada[];
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function nombreArchivo(d: DatosReporte, ext: string): string {
  const base = d.negocio.replace(/[^\w]+/g, "_");
  return `Contabee_${base}_${d.periodo.desde}_a_${d.periodo.hasta}.${ext}`;
}

/** Genera y descarga un archivo Excel con resumen y detalle. */
export async function exportarExcel(d: DatosReporte) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Contabee";

  // --- Hoja Resumen ---
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ width: 28 }, { width: 20 }];
  rs.addRow([`Contabee — ${d.negocio}`]);
  rs.getRow(1).font = { bold: true, size: 14 };
  rs.addRow([`Periodo: ${d.periodoLabel}`]);
  rs.addRow([`(${formatFechaCorta(d.periodo.desde)} a ${formatFechaCorta(d.periodo.hasta)})`]);
  rs.addRow([]);

  rs.addRow(["Ventas por método", "Monto"]).font = { bold: true };
  for (const m of METODOS) {
    rs.addRow([METODO_LABEL[m], d.resumen.porMetodo[m]]);
  }
  rs.addRow([]);
  rs.addRow(["Total ventas", d.resumen.totalVentas]).font = { bold: true };
  rs.addRow(["Total entradas", d.resumen.totalEntradas]);
  rs.addRow(["Apartados (abonos recibidos)", d.resumen.totalAbonos]);
  rs.addRow(["Total gastos", d.resumen.totalGastos]);
  rs.addRow(["Utilidad", d.resumen.utilidad]).font = { bold: true };
  // Formato de moneda en la columna de montos
  rs.getColumn(2).numFmt = '"$"#,##0';

  // --- Hoja Ventas ---
  const hv = wb.addWorksheet("Ventas");
  hv.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Método", key: "metodo", width: 18 },
    { header: "Monto", key: "monto", width: 16 },
  ];
  hv.getRow(1).font = { bold: true };
  d.ventas
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((v) => hv.addRow({ fecha: formatFechaCorta(v.fecha), metodo: METODO_LABEL[v.metodo], monto: v.monto }));
  hv.getColumn("monto").numFmt = '"$"#,##0';

  // --- Hoja Gastos ---
  const hg = wb.addWorksheet("Gastos");
  hg.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Concepto", key: "concepto", width: 30 },
    { header: "Monto", key: "monto", width: 16 },
  ];
  hg.getRow(1).font = { bold: true };
  d.gastos
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((g) => hg.addRow({ fecha: formatFechaCorta(g.fecha), concepto: g.concepto, monto: g.monto }));
  hg.getColumn("monto").numFmt = '"$"#,##0';

  // --- Hoja Entradas ---
  const he = wb.addWorksheet("Entradas");
  he.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Concepto", key: "concepto", width: 30 },
    { header: "Monto", key: "monto", width: 16 },
  ];
  he.getRow(1).font = { bold: true };
  d.entradas
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((e) => he.addRow({ fecha: formatFechaCorta(e.fecha), concepto: e.concepto, monto: e.monto }));
  he.getColumn("monto").numFmt = '"$"#,##0';

  const buf = await wb.xlsx.writeBuffer();
  descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombreArchivo(d, "xlsx"));
}

/** Genera y descarga un PDF con resumen y detalle. */
export function exportarPDF(d: DatosReporte) {
  const doc = new jsPDF();
  const M = 14;
  let y = 18;

  doc.setFontSize(16);
  doc.text(`Contabee  -  ${d.negocio}`, M, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Periodo: ${d.periodoLabel}  (${formatFechaCorta(d.periodo.desde)} a ${formatFechaCorta(d.periodo.hasta)})`, M, y);
  doc.setTextColor(0);
  y += 6;

  // Resumen por método
  autoTable(doc, {
    startY: y,
    head: [["Ventas por método", "Monto"]],
    body: METODOS.map((m) => [METODO_LABEL[m], formatCOP(d.resumen.porMetodo[m])]),
    foot: [
      ["Total ventas", formatCOP(d.resumen.totalVentas)],
      ["Total entradas", formatCOP(d.resumen.totalEntradas)],
      ["Apartados (abonos recibidos)", formatCOP(d.resumen.totalAbonos)],
      ["Total gastos", formatCOP(d.resumen.totalGastos)],
      ["Utilidad", formatCOP(d.resumen.utilidad)],
    ],
    theme: "striped",
    headStyles: { fillColor: [217, 119, 6] },
    footStyles: { fillColor: [254, 243, 199], textColor: 0, fontStyle: "bold" },
    margin: { left: M, right: M },
  });

  // Detalle de gastos
  const afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (d.gastos.length) {
    autoTable(doc, {
      startY: afterY,
      head: [["Fecha", "Gasto", "Monto"]],
      body: d.gastos
        .slice()
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((g) => [formatFechaCorta(g.fecha), g.concepto, formatCOP(g.monto)]),
      theme: "grid",
      headStyles: { fillColor: [217, 119, 6] },
      margin: { left: M, right: M },
    });
  }

  doc.save(nombreArchivo(d, "pdf"));
}
