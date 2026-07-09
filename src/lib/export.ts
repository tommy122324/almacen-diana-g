// ─── Almacén Diana G 🐝 — Exportar reportes a Excel y PDF ───
// Las librerías pesadas (exceljs, jspdf) se cargan SOLO al exportar (import dinámico),
// para que la app inicie más liviana y rápida.
import { METODOS, METODO_LABEL } from "./types";
import type { Venta, Gasto, Entrada, Apartado, RegistroHora } from "./types";
import type { Resumen, Periodo } from "./calc";
import { variacion } from "./calc";
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
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Almacén Diana G";

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
export async function exportarPDF(d: DatosReporte) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
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

function abonadoLocal(a: Apartado): number {
  return a.abonos.reduce((s, ab) => s + ab.monto, 0);
}

/** PDF de nómina de un empleado: entradas/retrasos + pagos del mes. */
export async function exportarNominaPDF(d: {
  negocio: string;
  empleado: string;
  mesLabel: string;
  registros: RegistroHora[];
  pagos: Gasto[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  const M = 14;
  doc.setFontSize(16);
  doc.text(`Nómina — ${d.empleado}`, M, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${d.negocio} · ${d.mesLabel}`, M, 25);
  doc.setTextColor(0);

  const totalDesc = d.registros.reduce((s, r) => s + r.descuento, 0);
  const totalPagos = d.pagos.reduce((s, p) => s + p.monto, 0);

  autoTable(doc, {
    startY: 31,
    head: [["Fecha", "Entrada", "Min. tarde", "Descuento"]],
    body: d.registros.map((r) => [formatFechaCorta(r.fecha), r.hora, r.minutosTarde || "-", r.descuento ? formatCOP(r.descuento) : "-"]),
    foot: [["", "", "Total descuentos", formatCOP(totalDesc)]],
    theme: "striped",
    headStyles: { fillColor: [217, 119, 6] },
    footStyles: { fillColor: [254, 243, 199], textColor: 0, fontStyle: "bold" },
    margin: { left: M, right: M },
  });

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Concepto", "Pagado"]],
    body: d.pagos.map((p) => [formatFechaCorta(p.fecha), p.concepto, formatCOP(p.monto)]),
    foot: [["", "Total pagado", formatCOP(totalPagos)]],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
    footStyles: { fillColor: [209, 250, 229], textColor: 0, fontStyle: "bold" },
    margin: { left: M, right: M },
  });

  doc.save(`Nomina_${d.empleado.replace(/[^\w]+/g, "_")}_${d.mesLabel.replace(/[^\w]+/g, "_")}.pdf`);
}

/** PDF con la lista de pedidos. */
export async function exportarPedidosPDF(negocio: string, pedidos: Apartado[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  const M = 14;
  doc.setFontSize(16);
  doc.text(`Pedidos — ${negocio}`, M, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generado: ${formatFechaCorta(new Date().toISOString().slice(0, 10))} · ${pedidos.length} pedido(s)`, M, 25);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 30,
    head: [["Fecha", "Cliente", "Teléfono", "Pedido", "Valor", "Abonado", "Saldo", "Estado"]],
    body: pedidos
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((p) => {
        const ab = abonadoLocal(p);
        const saldo = Math.max(0, p.valorTotal - ab);
        return [
          formatFechaCorta(p.fecha),
          p.cliente,
          p.telefono || "-",
          p.descripcion || "-",
          p.valorTotal > 0 ? formatCOP(p.valorTotal) : "-",
          formatCOP(ab),
          p.valorTotal > 0 ? formatCOP(saldo) : "-",
          p.entregado ? "Entregado" : p.conseguido ? "Conseguido" : "Por conseguir",
        ];
      }),
    theme: "striped",
    headStyles: { fillColor: [217, 119, 6] },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 3: { cellWidth: 45 } },
    margin: { left: M, right: M },
  });

  doc.save(`Pedidos_${negocio.replace(/[^\w]+/g, "_")}.pdf`);
}

interface DatosComparativo {
  negocio: string;
  tipoLabel: string; // "meses", "semanas", "días"
  labelA: string;
  labelB: string;
  a: Resumen;
  b: Resumen;
}

/** PDF con el comparativo entre dos periodos y su análisis. */
export async function exportarComparativoPDF(d: DatosComparativo) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  const M = 14;
  doc.setFontSize(16);
  doc.text(`Comparativo — ${d.negocio}`, M, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Periodo 1: ${d.labelA}   vs   Periodo 2: ${d.labelB}`, M, 25);
  doc.setTextColor(0);

  const fila = (concepto: string, va: number, vb: number) => {
    const v = variacion(va, vb);
    const dif = v === null ? (vb === 0 && va > 0 ? "nuevo" : "—") : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
    return [concepto, formatCOP(va), formatCOP(vb), dif];
  };

  autoTable(doc, {
    startY: 31,
    head: [["Concepto", "Periodo 1", "Periodo 2", "Variación"]],
    body: [
      fila("Ventas", d.a.totalVentas, d.b.totalVentas),
      fila("Entradas", d.a.totalEntradas, d.b.totalEntradas),
      fila("Apartados (abonos)", d.a.totalAbonos, d.b.totalAbonos),
      fila("Gastos", d.a.totalGastos, d.b.totalGastos),
      fila("Utilidad", d.a.utilidad, d.b.utilidad),
    ],
    theme: "striped",
    headStyles: { fillColor: [217, 119, 6] },
    margin: { left: M, right: M },
  });

  // Ventas por método
  const afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: afterY,
    head: [["Método", "Periodo 1", "Periodo 2"]],
    body: METODOS.map((m) => [METODO_LABEL[m], formatCOP(d.a.porMetodo[m]), formatCOP(d.b.porMetodo[m])]),
    theme: "grid",
    headStyles: { fillColor: [217, 119, 6] },
    margin: { left: M, right: M },
  });

  // Análisis / conclusiones
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.text("Análisis", M, y);
  y += 7;
  doc.setFontSize(10);

  const lineas: string[] = [];
  const ganador =
    d.a.utilidad === d.b.utilidad
      ? "Ambos periodos tuvieron la misma utilidad."
      : d.a.utilidad > d.b.utilidad
        ? `El Periodo 1 ganó más: utilidad de ${formatCOP(d.a.utilidad)} vs ${formatCOP(d.b.utilidad)}.`
        : `El Periodo 2 ganó más: utilidad de ${formatCOP(d.b.utilidad)} vs ${formatCOP(d.a.utilidad)}.`;
  lineas.push(ganador);

  const masVentas =
    d.a.totalVentas === d.b.totalVentas
      ? "Las ventas fueron iguales en ambos periodos."
      : d.a.totalVentas > d.b.totalVentas
        ? `Se vendió más en el Periodo 1 (${formatCOP(d.a.totalVentas)} vs ${formatCOP(d.b.totalVentas)}).`
        : `Se vendió más en el Periodo 2 (${formatCOP(d.b.totalVentas)} vs ${formatCOP(d.a.totalVentas)}).`;
  lineas.push(masVentas);

  const masGastos =
    d.a.totalGastos === d.b.totalGastos
      ? "Los gastos fueron iguales."
      : d.a.totalGastos > d.b.totalGastos
        ? `Se gastó más en el Periodo 1 (${formatCOP(d.a.totalGastos)}).`
        : `Se gastó más en el Periodo 2 (${formatCOP(d.b.totalGastos)}).`;
  lineas.push(masGastos);

  const vv = variacion(d.a.totalVentas, d.b.totalVentas);
  if (vv !== null && vv !== 0) {
    lineas.push(`Las ventas del Periodo 1 fueron ${Math.abs(vv).toFixed(0)}% ${vv > 0 ? "mayores" : "menores"} que el Periodo 2.`);
  }

  doc.setTextColor(40);
  for (const l of lineas) {
    const wrapped = doc.splitTextToSize(`• ${l}`, 180) as string[];
    doc.text(wrapped, M, y);
    y += wrapped.length * 6;
  }

  doc.save(`Comparativo_${d.negocio.replace(/[^\w]+/g, "_")}.pdf`);
}
