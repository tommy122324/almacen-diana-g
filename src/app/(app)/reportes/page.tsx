"use client";
import { useMemo, useState, useEffect } from "react";
import { FileSpreadsheet, FileText, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { METODOS, METODO_LABEL, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { periodoDe, filtrar, resumen, serieDiaria, abonosEnPeriodo, type Periodo } from "@/lib/calc";
import { exportarExcel, exportarPDF } from "@/lib/export";
import { Card, Boton, Input } from "@/components/ui";
import { VentasBarChart } from "@/components/Charts";

export default function Reportes() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const ventas = useStore((s) => s.ventas);
  const gastos = useStore((s) => s.gastos);
  const entradas = useStore((s) => s.entradas);
  const apartados = useStore((s) => s.apartados);
  const gastosMensuales = useStore((s) => s.gastosMensuales);

  const [periodo, setPeriodo] = useState<Periodo>(periodoDe("mes"));
  const [etiqueta, setEtiqueta] = useState("Mes actual");
  const [metodosSel, setMetodosSel] = useState<Set<MetodoPago>>(new Set(METODOS));
  const [incluirGastos, setIncluirGastos] = useState(true);
  const [incluirEntradas, setIncluirEntradas] = useState(true);
  const [incluirAbonos, setIncluirAbonos] = useState(true);

  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";
  const asegurarRango = useStore((s) => s.asegurarRango);
  const cargandoRango = useStore((s) => s.cargandoRango);

  // Cargar el periodo del reporte si aún no está en memoria
  useEffect(() => {
    asegurarRango(periodo.desde, periodo.hasta);
  }, [periodo.desde, periodo.hasta, asegurarRango]);

  const datos = useMemo(() => {
    const v = filtrar(ventas, negocioId, periodo).filter((x) => metodosSel.has(x.metodo));
    const gDiarios = incluirGastos ? filtrar(gastos, negocioId, periodo) : [];
    // Los gastos mensuales del periodo también cuentan (para que cuadre con el panel).
    const gMensuales = incluirGastos
      ? filtrar(gastosMensuales, negocioId, periodo).map((x) => ({ id: x.id, negocioId: x.negocioId, fecha: x.fecha, concepto: x.concepto, monto: x.monto, creadoEn: x.creadoEn }))
      : [];
    const g = [...gDiarios, ...gMensuales];
    const e = incluirEntradas ? filtrar(entradas, negocioId, periodo) : [];
    const ab = incluirAbonos ? abonosEnPeriodo(apartados, negocioId, periodo) : 0;
    return { v, g, e, r: resumen(v, g, e, ab), serie: serieDiaria(v, g, e, periodo) };
  }, [ventas, gastos, gastosMensuales, entradas, apartados, negocioId, periodo, metodosSel, incluirGastos, incluirEntradas, incluirAbonos]);

  function elegir(tipo: "mes" | "semana" | "dia", label: string) {
    setPeriodo(periodoDe(tipo));
    setEtiqueta(label);
  }
  function toggleMetodo(m: MetodoPago) {
    setMetodosSel((prev) => {
      const n = new Set(prev);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });
  }

  const metodosVisibles = METODOS.filter((m) => metodosSel.has(m));

  const datosReporte = {
    negocio,
    periodoLabel: etiqueta,
    periodo,
    resumen: datos.r,
    ventas: datos.v,
    gastos: datos.g,
    entradas: datos.e,
  };

  if (!esAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center text-stone-500">
        Esta sección es solo para el administrador.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-800">Reportes</h1>

      {/* Selector de periodo */}
      <Card>
        <div className="mb-1 text-xs font-medium text-stone-500">Periodo</div>
        <div className="flex flex-wrap items-center gap-2">
          <Boton variant={etiqueta === "Hoy" ? "primary" : "outline"} onClick={() => elegir("dia", "Hoy")}>Hoy</Boton>
          <Boton variant={etiqueta === "Semana actual" ? "primary" : "outline"} onClick={() => elegir("semana", "Semana actual")}>Semana</Boton>
          <Boton variant={etiqueta === "Mes actual" ? "primary" : "outline"} onClick={() => elegir("mes", "Mes actual")}>Mes</Boton>
          <div className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Desde
            <Input
              type="date"
              value={periodo.desde}
              onChange={(e) => { setPeriodo((p) => ({ ...p, desde: e.target.value })); setEtiqueta("Personalizado"); }}
              className="w-auto"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Hasta
            <Input
              type="date"
              value={periodo.hasta}
              onChange={(e) => { setPeriodo((p) => ({ ...p, hasta: e.target.value })); setEtiqueta("Personalizado"); }}
              className="w-auto"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {etiqueta} · {formatFechaCorta(periodo.desde)} a {formatFechaCorta(periodo.hasta)}
          {cargandoRango && <span className="ml-2 text-stone-400">· Cargando…</span>}
        </p>
      </Card>

      {/* Qué incluir */}
      <Card>
        <div className="mb-2 text-xs font-medium text-stone-500">¿Qué quieres incluir en el reporte?</div>
        <div className="flex flex-wrap gap-2">
          {METODOS.map((m) => {
            const on = metodosSel.has(m);
            return (
              <button
                key={m}
                onClick={() => toggleMetodo(m)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-200 bg-white text-stone-400"}`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full ${on ? "bg-amber-500" : "bg-stone-200"}`}>
                  {on && <Check className="h-3 w-3 text-white" />}
                </span>
                {METODO_LABEL[m]}
              </button>
            );
          })}
          <div className="mx-1 h-8 w-px bg-stone-200" />
          <Toggle label="Gastos" on={incluirGastos} onClick={() => setIncluirGastos((v) => !v)} />
          <Toggle label="Entradas" on={incluirEntradas} onClick={() => setIncluirEntradas((v) => !v)} />
          <Toggle label="Apartados" on={incluirAbonos} onClick={() => setIncluirAbonos((v) => !v)} />
        </div>
      </Card>

      {/* Botones de exportación */}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => exportarExcel(datosReporte)}>
          <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
        </Boton>
        <Boton variant="outline" onClick={() => exportarPDF(datosReporte)}>
          <FileText className="h-4 w-4" /> Exportar PDF
        </Boton>
      </div>

      {/* Resumen */}
      <Card>
        <h2 className="mb-3 font-semibold text-stone-800">Resumen del periodo</h2>
        <table className="w-full text-sm">
          <tbody>
            {metodosVisibles.map((m) => (
              <tr key={m} className="border-b border-stone-100">
                <td className="py-1.5 text-stone-600">{METODO_LABEL[m]}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCOP(datos.r.porMetodo[m])}</td>
              </tr>
            ))}
            <tr className="border-b border-stone-200 font-semibold">
              <td className="py-1.5">Total ventas</td>
              <td className="py-1.5 text-right tabular-nums text-emerald-600">{formatCOP(datos.r.totalVentas)}</td>
            </tr>
            {incluirEntradas && (
              <tr>
                <td className="py-1.5 text-stone-600">Total entradas</td>
                <td className="py-1.5 text-right tabular-nums">{formatCOP(datos.r.totalEntradas)}</td>
              </tr>
            )}
            {incluirAbonos && (
              <tr>
                <td className="py-1.5 text-stone-600">Apartados (abonos recibidos)</td>
                <td className="py-1.5 text-right tabular-nums">{formatCOP(datos.r.totalAbonos)}</td>
              </tr>
            )}
            {incluirGastos && (
              <tr className="border-b border-stone-200">
                <td className="py-1.5 text-stone-600">Total gastos</td>
                <td className="py-1.5 text-right tabular-nums text-rose-600">{formatCOP(datos.r.totalGastos)}</td>
              </tr>
            )}
            <tr className="text-base font-bold">
              <td className="py-2">Utilidad</td>
              <td className={`py-2 text-right tabular-nums ${datos.r.utilidad >= 0 ? "text-amber-600" : "text-rose-600"}`}>
                {formatCOP(datos.r.utilidad)}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-stone-800">Ventas y gastos por día</h2>
        <VentasBarChart data={datos.serie} />
      </Card>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-200 bg-white text-stone-400"}`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${on ? "bg-amber-500" : "bg-stone-200"}`}>
        {on && <Check className="h-3 w-3 text-white" />}
      </span>
      {label}
    </button>
  );
}
