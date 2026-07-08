"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, ClipboardList, Target, TrendingUp, Sparkles, ArrowRight, FileText } from "lucide-react";
import { useStore, saldoDe } from "@/lib/store";
import { StatCard, Card, Boton, Input } from "@/components/ui";
import { VentasBarChart, MetodosPieChart, ComparativoChart } from "@/components/Charts";
import { MoneyInput } from "@/components/MoneyInput";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { METODO_LABEL, type MetodoPago } from "@/lib/types";
import { avisar } from "@/lib/alerta";
import { exportarComparativoPDF } from "@/lib/export";
import {
  periodoDe,
  periodoAnterior,
  filtrar,
  resumen,
  serieDiaria,
  distribucionMetodos,
  variacion,
  abonosEnPeriodo,
  abonosPorDia,
  resumenEfectivo,
  hoyISO,
  LABEL_PERIODO,
  type Periodo,
  type TipoPeriodo,
} from "@/lib/calc";

const OPCIONES: { tipo: TipoPeriodo; label: string }[] = [
  { tipo: "dia", label: "Hoy" },
  { tipo: "semana", label: "Semana" },
  { tipo: "mes", label: "Mes" },
  { tipo: "rango", label: "Fechas" },
];

export default function Panel() {
  const [tipo, setTipo] = useState<TipoPeriodo>("mes");
  const [rangoDesde, setRangoDesde] = useState(hoyISO());
  const [rangoHasta, setRangoHasta] = useState(hoyISO());
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTmp, setMetaTmp] = useState(0);

  const negocioId = useStore((s) => s.negocioActivoId);
  const ventas = useStore((s) => s.ventas);
  const gastos = useStore((s) => s.gastos);
  const entradas = useStore((s) => s.entradas);
  const apartados = useStore((s) => s.apartados);
  const cuadres = useStore((s) => s.cuadres);
  const metas = useStore((s) => s.metas);
  const setMeta = useStore((s) => s.setMeta);

  const periodo = useMemo<Periodo>(
    () => (tipo === "rango" ? { desde: rangoDesde, hasta: rangoHasta } : periodoDe(tipo)),
    [tipo, rangoDesde, rangoHasta],
  );
  const periodoPrev = useMemo(() => periodoAnterior(tipo), [tipo]);

  const datos = useMemo(() => {
    const v = filtrar(ventas, negocioId, periodo);
    const g = filtrar(gastos, negocioId, periodo);
    const e = filtrar(entradas, negocioId, periodo);
    const ab = abonosEnPeriodo(apartados, negocioId, periodo);
    const r = resumen(v, g, e, ab);
    // Periodo anterior (para comparativos)
    const rp = resumen(
      filtrar(ventas, negocioId, periodoPrev),
      filtrar(gastos, negocioId, periodoPrev),
      filtrar(entradas, negocioId, periodoPrev),
      abonosEnPeriodo(apartados, negocioId, periodoPrev),
    );
    const serie = serieDiaria(v, g, e, periodo, abonosPorDia(apartados, negocioId, periodo));
    const efectivo = resumenEfectivo(ventas, gastos, entradas, apartados, cuadres, negocioId, periodo);
    return { v, g, e, r, rp, serie, efectivo };
  }, [ventas, gastos, entradas, apartados, cuadres, negocioId, periodo, periodoPrev]);

  // Meta del mes actual
  const hoy = new Date();
  const meta = metas.find((m) => m.negocioId === negocioId && m.anio === hoy.getFullYear() && m.mes === hoy.getMonth() + 1);
  const ventasMes = useMemo(() => {
    return filtrar(ventas, negocioId, periodoDe("mes")).reduce((s, x) => s + x.monto, 0);
  }, [ventas, negocioId]);
  const progresoMeta = meta && meta.montoMeta > 0 ? Math.min(100, (ventasMes / meta.montoMeta) * 100) : 0;

  // Apartados y pedidos (separados)
  const apartadosNeg = apartados.filter((a) => a.negocioId === negocioId);
  const soloApartados = apartadosNeg.filter((a) => a.tipo === "apartado");
  const soloPedidos = apartadosNeg.filter((a) => a.tipo === "pedido");
  const porCobrar = soloApartados.filter((a) => a.estado === "pendiente").reduce((s, a) => s + saldoDe(a), 0);
  const apartadosPendientes = soloApartados.filter((a) => a.estado === "pendiente").length;
  const pedidosPendientes = soloPedidos.filter((a) => !a.conseguido).length; // por conseguir
  const pedidosPorCobrar = soloPedidos.filter((a) => a.estado === "pendiente").reduce((s, a) => s + saldoDe(a), 0);

  const varVentas = variacion(datos.r.totalVentas, datos.rp.totalVentas);
  const labelP = LABEL_PERIODO[tipo];

  // Avance automático (insights)
  const insights = useMemo(() => {
    const out: { emoji: string; texto: string }[] = [];
    if (varVentas !== null && datos.rp.totalVentas > 0) {
      const signo = varVentas >= 0 ? "más" : "menos";
      out.push({
        emoji: varVentas >= 0 ? "📈" : "📉",
        texto: `Vendiste ${Math.abs(varVentas).toFixed(0)}% ${signo} que el ${labelP} anterior (${formatCOP(datos.rp.totalVentas)}).`,
      });
    }
    // Mejor día
    if (tipo !== "dia" && datos.serie.length > 0) {
      const mejor = datos.serie.reduce((a, b) => (b.ventas > a.ventas ? b : a));
      if (mejor.ventas > 0) out.push({ emoji: "⭐", texto: `Tu mejor día fue el ${mejor.etiqueta} con ${formatCOP(mejor.ventas)} en ventas.` });
    }
    // Método top
    const metodos = Object.entries(datos.r.porMetodo) as [MetodoPago, number][];
    const top = metodos.sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) {
      const pct = datos.r.totalVentas > 0 ? (top[1] / datos.r.totalVentas) * 100 : 0;
      out.push({ emoji: "💳", texto: `Tu método más usado fue ${METODO_LABEL[top[0]]} (${pct.toFixed(0)}% de las ventas).` });
    }
    // Utilidad
    out.push({
      emoji: datos.r.utilidad >= 0 ? "✅" : "⚠️",
      texto: `Tu utilidad en este ${labelP} es de ${formatCOP(datos.r.utilidad)}.`,
    });
    // Apartados
    if (porCobrar > 0) out.push({ emoji: "📦", texto: `Tienes ${formatCOP(porCobrar)} por cobrar en apartados pendientes.` });
    // Meta
    if (meta && meta.montoMeta > 0) out.push({ emoji: "🎯", texto: `Vas al ${progresoMeta.toFixed(0)}% de tu meta del mes.` });
    return out;
  }, [datos, varVentas, labelP, tipo, porCobrar, meta, progresoMeta]);

  function pctHint(actual: number, anterior: number): string | undefined {
    const v = variacion(actual, anterior);
    if (v === null) return anterior === 0 && actual > 0 ? "nuevo" : undefined;
    if (v === 0) return "igual que antes";
    return `${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(0)}% vs ${labelP} anterior`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-800">Panel</h1>
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          {OPCIONES.map((o) => (
            <button
              key={o.tipo}
              onClick={() => setTipo(o.tipo)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${tipo === o.tipo ? "bg-amber-500 text-white shadow-sm" : "text-stone-500 hover:bg-stone-100"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rango de fechas personalizado */}
      {tipo === "rango" && (
        <Card className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-stone-600">
            <span className="mb-1 block text-xs font-medium text-stone-500">Desde</span>
            <Input type="date" value={rangoDesde} onChange={(e) => setRangoDesde(e.target.value)} className="w-auto" />
          </label>
          <label className="text-sm text-stone-600">
            <span className="mb-1 block text-xs font-medium text-stone-500">Hasta</span>
            <Input type="date" value={rangoHasta} onChange={(e) => setRangoHasta(e.target.value)} className="w-auto" />
          </label>
          <span className="text-xs text-stone-400">{formatFechaCorta(periodo.desde)} a {formatFechaCorta(periodo.hasta)}</span>
        </Card>
      )}

      {/* Tarjetas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Ventas" value={datos.r.totalVentas} tone="green" hint={pctHint(datos.r.totalVentas, datos.rp.totalVentas)} />
        <StatCard label="Gastos" value={datos.r.totalGastos} tone="red" hint={pctHint(datos.r.totalGastos, datos.rp.totalGastos)} />
        <StatCard label="Entradas" value={datos.r.totalEntradas} tone="default" />
        <StatCard
          label="Utilidad total"
          value={datos.r.utilidad}
          tone={datos.r.utilidad >= 0 ? "amber" : "red"}
          hint={pctHint(datos.r.utilidad, datos.rp.utilidad)}
        />
        <StatCard
          label="Efectivo neto total"
          value={datos.efectivo.efectivoNeto}
          tone={datos.efectivo.efectivoNeto >= 0 ? "green" : "red"}
          hint={`(esperado en efectivo: ${formatCOP(datos.efectivo.esperadoEfectivo)})`}
        />
        <StatCard label="Abonos de apartados" value={datos.r.totalAbonos} tone="default" />
      </div>

      {/* Avance automático */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <div className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
          <Sparkles className="h-4 w-4 text-amber-500" /> Tu avance
        </div>
        <ul className="space-y-1.5">
          {insights.map((i, k) => (
            <li key={k} className="flex gap-2 text-sm text-stone-700">
              <span>{i.emoji}</span>
              <span>{i.texto}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Meta y apartados */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-stone-800">
              <Target className="h-4 w-4 text-amber-600" /> Meta del mes
            </div>
            <Boton variant="ghost" onClick={() => { setMetaTmp(meta?.montoMeta ?? 0); setEditandoMeta((v) => !v); }}>
              {meta ? "Editar" : "Definir"}
            </Boton>
          </div>
          {editandoMeta ? (
            <div className="flex gap-2">
              <MoneyInput value={metaTmp} onChange={setMetaTmp} className="flex-1" />
              <Boton onClick={() => { setMeta(hoy.getFullYear(), hoy.getMonth() + 1, metaTmp); setEditandoMeta(false); avisar("Meta guardada"); }}>
                Guardar
              </Boton>
            </div>
          ) : meta && meta.montoMeta > 0 ? (
            <>
              <div className="mb-1 flex justify-between text-sm">
                <span className="tabular-nums text-stone-600">{formatCOP(ventasMes)}</span>
                <span className="tabular-nums text-stone-400">meta {formatCOP(meta.montoMeta)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progresoMeta}%` }} />
              </div>
              <div className="mt-1 text-xs text-stone-500">{progresoMeta.toFixed(0)}% de la meta</div>
            </>
          ) : (
            <p className="text-sm text-stone-400">Aún no has definido una meta para este mes.</p>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-stone-800">Apartados y pedidos</span>
            <Link href="/apartados" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">
              Ver todo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                <Package className="h-3.5 w-3.5 text-amber-600" /> Apartados
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-rose-600">{formatCOP(porCobrar)}</div>
              <div className="text-xs text-stone-400">{apartadosPendientes} por cobrar</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                <ClipboardList className="h-3.5 w-3.5 text-amber-600" /> Pedidos
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-amber-600">{pedidosPendientes}</div>
              <div className="text-xs text-stone-400">
                por conseguir{pedidosPorCobrar > 0 ? ` · ${formatCOP(pedidosPorCobrar)} por cobrar` : ""}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficas */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-stone-800">Ventas y gastos por día</h2>
          <VentasBarChart data={datos.serie} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-stone-800">Ventas por método de pago</h2>
          <MetodosPieChart data={distribucionMetodos(datos.r)} />
        </Card>
      </div>

      {/* Comparativo interactivo */}
      <ComparativoCard />
    </div>
  );
}

function parseFecha(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const OPCIONES_COMP: { tipo: TipoPeriodo; label: string }[] = [
  { tipo: "dia", label: "Días" },
  { tipo: "semana", label: "Semanas" },
  { tipo: "mes", label: "Meses" },
];

/** Comparativo donde el usuario elige el tipo y los dos periodos a comparar. */
function ComparativoCard() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const ventas = useStore((s) => s.ventas);
  const gastos = useStore((s) => s.gastos);
  const entradas = useStore((s) => s.entradas);
  const apartados = useStore((s) => s.apartados);

  const [tipo, setTipo] = useState<TipoPeriodo>("mes");
  const [refA, setRefA] = useState(hoyISO());
  const [refB, setRefB] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("sv");
  });

  const negocio = useStore((s) => s.negocios.find((n) => n.id === s.negocioActivoId)?.nombre ?? "Almacén Diana G");

  const { datos, pa, pb, rA, rB } = useMemo(() => {
    const pa: Periodo = periodoDe(tipo, parseFecha(refA));
    const pb: Periodo = periodoDe(tipo, parseFecha(refB));
    const resu = (p: Periodo) =>
      resumen(
        filtrar(ventas, negocioId, p),
        filtrar(gastos, negocioId, p),
        filtrar(entradas, negocioId, p),
        abonosEnPeriodo(apartados, negocioId, p),
      );
    const rA = resu(pa);
    const rB = resu(pb);
    const datos = [
      { periodo: "Periodo 1", ventas: rA.totalVentas, gastos: rA.totalGastos, utilidad: rA.utilidad },
      { periodo: "Periodo 2", ventas: rB.totalVentas, gastos: rB.totalGastos, utilidad: rB.utilidad },
    ];
    return { datos, pa, pb, rA, rB };
  }, [tipo, refA, refB, ventas, gastos, entradas, apartados, negocioId]);

  const labelA = `${formatFechaCorta(pa.desde)} a ${formatFechaCorta(pa.hasta)}`;
  const labelB = `${formatFechaCorta(pb.desde)} a ${formatFechaCorta(pb.hasta)}`;
  const ganador = rA.utilidad === rB.utilidad ? "empate" : rA.utilidad > rB.utilidad ? "Periodo 1" : "Periodo 2";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-stone-800">
          <TrendingUp className="h-4 w-4 text-amber-600" /> Comparar periodos
        </div>
        <Boton
          variant="outline"
          onClick={() =>
            exportarComparativoPDF({ negocio, tipoLabel: LABEL_PERIODO[tipo], labelA, labelB, a: rA, b: rB })
          }
        >
          <FileText className="h-4 w-4" /> PDF del comparativo
        </Boton>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
          {OPCIONES_COMP.map((o) => (
            <button
              key={o.tipo}
              onClick={() => setTipo(o.tipo)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tipo === o.tipo ? "bg-amber-500 text-white" : "text-stone-500 hover:bg-stone-100"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="text-sm text-stone-600">
          <span className="mb-1 block text-xs font-medium text-amber-700">Periodo 1</span>
          <Input type="date" value={refA} onChange={(e) => setRefA(e.target.value)} className="w-auto" />
        </label>
        <label className="text-sm text-stone-600">
          <span className="mb-1 block text-xs font-medium text-stone-500">Periodo 2</span>
          <Input type="date" value={refB} onChange={(e) => setRefB(e.target.value)} className="w-auto" />
        </label>
      </div>

      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        <span><b className="text-amber-700">Periodo 1:</b> {labelA}</span>
        <span><b>Periodo 2:</b> {labelB}</span>
      </div>

      <ComparativoChart data={datos} />

      {ganador !== "empate" && (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🏆 <b>{ganador}</b> tuvo más utilidad ({formatCOP(ganador === "Periodo 1" ? rA.utilidad : rB.utilidad)}).
        </div>
      )}
    </Card>
  );
}
