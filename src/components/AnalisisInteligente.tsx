"use client";
// ─── Análisis inteligente del Panel (solo admin, solo LECTURA de datos) ───
// "Ventas" = ventas + valor de los apartados creados ese día (igual que el Panel).
import { useEffect, useMemo } from "react";
import { addDays, format, getDaysInMonth, parseISO, startOfWeek, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from "recharts";
import { TrendingUp, TrendingDown, Target, CalendarDays, Lightbulb, Trophy, Minus } from "lucide-react";
import { useStore } from "@/lib/store";
import { METODOS, METODO_LABEL, type MetodoPago } from "@/lib/types";
import { formatCOP, formatNum, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { Card } from "@/components/ui";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIA_SING = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIA_PLURAL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const SEMANAS_HIST = 8;

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const dia = (s: string) => parseISO(s);
const idxSemana = (s: string) => (dia(s).getDay() + 6) % 7; // 0 = lunes
const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

function Variacion({ v, sufijo }: { v: number | null; sufijo: string }) {
  if (v === null) return <span className="text-xs text-stone-400">sin datos para comparar</span>;
  const sube = v >= 0;
  const Icono = Math.abs(v) < 1 ? Minus : sube ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${Math.abs(v) < 1 ? "bg-stone-100 text-stone-600" : sube ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      <Icono className="h-3.5 w-3.5" /> {Math.abs(v).toFixed(0)}% {sufijo}
    </span>
  );
}

export function AnalisisInteligente() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const ventas = useStore((s) => s.ventas);
  const gastos = useStore((s) => s.gastos);
  const entradas = useStore((s) => s.entradas);
  const apartados = useStore((s) => s.apartados);
  const metas = useStore((s) => s.metas);
  const gastosMensuales = useStore((s) => s.gastosMensuales);
  const asegurarRango = useStore((s) => s.asegurarRango);

  const hoy = hoyISO();

  // Cargar historial necesario: últimas 8 semanas completas + mes anterior.
  useEffect(() => {
    const h = dia(hoy);
    const lunes = startOfWeek(h, { weekStartsOn: 1 });
    const a = iso(addDays(lunes, -7 * (SEMANAS_HIST + 1)));
    const b = iso(startOfMonth(subMonths(h, 1)));
    asegurarRango(a < b ? a : b, hoy);
  }, [hoy, asegurarRango]);

  const a = useMemo(() => {
    if (!negocioId) return null;
    // ── Mapas por día ──
    const vDia = new Map<string, number>(); // ventas (+ valor apartados)
    const uDia = new Map<string, number>(); // utilidad diaria (como el Panel: ventas + entradas + abonos − gastos)
    const mDia = new Map<string, Record<MetodoPago, number>>(); // ventas por método
    const suma = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    let primera = "";
    for (const v of ventas) {
      if (v.negocioId !== negocioId) continue;
      suma(vDia, v.fecha, v.monto);
      suma(uDia, v.fecha, v.monto);
      const r = mDia.get(v.fecha) ?? (Object.fromEntries(METODOS.map((x) => [x, 0])) as Record<MetodoPago, number>);
      r[v.metodo] += v.monto;
      mDia.set(v.fecha, r);
      if (!primera || v.fecha < primera) primera = v.fecha;
    }
    for (const ap of apartados) {
      if (ap.negocioId !== negocioId) continue;
      if (ap.tipo === "apartado") suma(vDia, ap.fecha, ap.valorTotal);
      for (const ab of ap.abonos) suma(uDia, ab.fecha, ab.monto);
    }
    for (const e of entradas) if (e.negocioId === negocioId) suma(uDia, e.fecha, e.monto);
    for (const g of gastos) if (g.negocioId === negocioId) suma(uDia, g.fecha, -g.monto);
    const V = (d: string) => vDia.get(d) ?? 0;

    // ── Día de referencia: hoy si ya hay ventas, si no ayer (se registran al final del día) ──
    const ayer = iso(addDays(dia(hoy), -1));
    const ref = V(hoy) > 0 ? hoy : ayer;
    const refLabel = ref === hoy ? "Hoy" : "Ayer";
    const wdRef = idxSemana(ref);
    const refSemPasada = iso(addDays(dia(ref), -7));

    // ── Promedio por día de la semana (últimas 8 semanas completas, desde que hay datos) ──
    const lunesRef = startOfWeek(dia(ref), { weekStartsOn: 1 });
    const sumWd = Array(7).fill(0);
    const cntWd = Array(7).fill(0);
    let mejor8 = { fecha: "", monto: 0 };
    for (let k = 1; k <= SEMANAS_HIST; k++) {
      for (let i = 0; i < 7; i++) {
        const d = iso(addDays(lunesRef, -7 * k + i));
        if (!primera || d < primera) continue;
        sumWd[i] += V(d);
        cntWd[i] += 1;
        if (V(d) > mejor8.monto) mejor8 = { fecha: d, monto: V(d) };
      }
    }
    const promWd = sumWd.map((s, i) => (cntWd[i] ? s / cntWd[i] : 0));
    const hayHistorial = promWd.some((x) => x > 0);

    // ── Semana actual vs pasada (mismos días) ──
    let semActual = 0;
    let semPasada = 0;
    const serieSemana = DIAS.map((label, i) => {
      const d = iso(addDays(lunesRef, i));
      const dp = iso(addDays(lunesRef, i - 7));
      const dentro = i <= wdRef;
      if (dentro) {
        semActual += V(d);
        semPasada += V(dp);
      }
      return { label, estaSemana: dentro ? V(d) : null, semanaPasada: V(dp) };
    });

    // ── Métodos: esta semana vs pasada ──
    const metSem = (desdeOffset: number) => {
      const r = Object.fromEntries(METODOS.map((x) => [x, 0])) as Record<MetodoPago, number>;
      for (let i = 0; i <= wdRef; i++) {
        const m = mDia.get(iso(addDays(lunesRef, i + desdeOffset)));
        if (m) for (const x of METODOS) r[x] += m[x];
      }
      return r;
    };
    const mAct = metSem(0);
    const mPas = metSem(-7);

    // ── Mes: acumulado y proyección ──
    const h = dia(hoy);
    const mesDesde = iso(startOfMonth(h));
    const mesHasta = iso(endOfMonth(h));
    const diasMes = getDaysInMonth(h);
    let acumulado = 0;
    let mejorMes = { fecha: "", monto: 0 };
    for (let d = mesDesde; d <= hoy; d = iso(addDays(dia(d), 1))) {
      acumulado += V(d);
      if (V(d) > mejorMes.monto) mejorMes = { fecha: d, monto: V(d) };
    }
    const cerradoHasta = ref < mesDesde ? iso(addDays(dia(mesDesde), -1)) : ref;
    let diasCerrados = 0;
    let utilAcum = 0;
    for (let d = mesDesde; d <= cerradoHasta; d = iso(addDays(dia(d), 1))) {
      diasCerrados++;
      utilAcum += uDia.get(d) ?? 0;
    }
    const restantes: string[] = [];
    for (let d = iso(addDays(dia(cerradoHasta), 1)); d <= mesHasta; d = iso(addDays(dia(d), 1))) restantes.push(d);
    const promSimple = diasCerrados > 0 ? acumulado / diasCerrados : 0;
    const estimadoResto = restantes.reduce((s, d) => s + (hayHistorial ? promWd[idxSemana(d)] : promSimple), 0);
    const proyeccion = Math.round(acumulado + estimadoResto);
    const gmMes = gastosMensuales.filter((g) => g.negocioId === negocioId && g.fecha >= mesDesde && g.fecha <= mesHasta).reduce((s, g) => s + g.monto, 0);
    const utilProy = diasCerrados >= 3 ? Math.round((utilAcum / diasCerrados) * diasMes - gmMes) : null;

    // Mes anterior
    const pm = subMonths(h, 1);
    let mesAnterior = 0;
    for (let d = iso(startOfMonth(pm)); d <= iso(endOfMonth(pm)); d = iso(addDays(dia(d), 1))) mesAnterior += V(d);
    const nombreMesAnt = MESES[pm.getMonth()];

    // Meta
    const meta = metas.find((m) => m.negocioId === negocioId && m.anio === h.getFullYear() && m.mes === h.getMonth() + 1)?.montoMeta ?? 0;
    const faltante = Math.max(0, meta - acumulado);
    const porDia = restantes.length ? Math.ceil(faltante / restantes.length) : faltante;

    // ── Consejos ──
    const consejos: string[] = [];
    const conProm = promWd.map((p, i) => ({ p, i })).filter((x) => x.p > 0);
    if (conProm.length >= 2) {
      const best = conProm.reduce((x, y) => (y.p > x.p ? y : x));
      const worst = conProm.reduce((x, y) => (y.p < x.p ? y : x));
      const ratio = best.p / worst.p;
      if (ratio >= 1.3) consejos.push(`Los ${DIA_PLURAL[best.i]} vendes ${ratio.toFixed(1).replace(".", ",")} veces más que los ${DIA_PLURAL[worst.i]}.`);
      consejos.push(`El ${DIA_SING[worst.i]} es tu día más flojo: buen día para promociones o para escribirle a tus clientes.`);
    }
    const vSem = pct(semActual, semPasada);
    if (vSem !== null && Math.abs(vSem) >= 5)
      consejos.push(`Esta semana vas ${vSem > 0 ? "arriba" : "abajo"} ${Math.abs(vSem).toFixed(0)}% frente a la semana pasada (mismos días).`);
    let cambioMet: { m: MetodoPago; v: number } | null = null;
    for (const m of METODOS) {
      const v = pct(mAct[m], mPas[m]);
      if (v === null || Math.max(mAct[m], mPas[m]) < 50000 || Math.abs(v) < 20) continue;
      if (!cambioMet || Math.abs(v) > Math.abs(cambioMet.v)) cambioMet = { m, v };
    }
    if (cambioMet) consejos.push(`Esta semana los pagos por ${METODO_LABEL[cambioMet.m]} ${cambioMet.v > 0 ? "subieron" : "bajaron"} ${Math.abs(cambioMet.v).toFixed(0)}%.`);
    if (hayHistorial) {
      let abajo = 0;
      let arriba = 0;
      for (let k = 0; k < 14; k++) {
        const d = iso(addDays(dia(ref), -k));
        const p = promWd[idxSemana(d)];
        if (p <= 0) break;
        if (V(d) < p * 0.85 && arriba === 0) abajo++;
        else if (V(d) > p * 1.15 && abajo === 0) arriba++;
        else break;
      }
      if (abajo >= 2) consejos.push(`Llevas ${abajo} días seguidos por debajo de tu promedio. Puede ser buen momento para una promoción.`);
      if (arriba >= 2) consejos.push(`Llevas ${arriba} días seguidos por encima de tu promedio. ¡Sigue así!`);
    }
    if (mesAnterior > 0 && diasCerrados >= 3) {
      const v = pct(proyeccion, mesAnterior)!;
      consejos.push(
        v >= 0
          ? `A este ritmo superarías ${nombreMesAnt} en ${v.toFixed(0)}%.`
          : `A este ritmo quedarías ${Math.abs(v).toFixed(0)}% por debajo de ${nombreMesAnt}.`,
      );
    }

    return {
      ref,
      refLabel,
      refVentas: V(ref),
      refSemPasada: V(refSemPasada),
      promRef: promWd[wdRef],
      diaRef: DIA_SING[wdRef],
      semActual,
      semPasada,
      serieSemana,
      serieProm: DIAS.map((label, i) => ({ label, promedio: Math.round(promWd[i]) })),
      mejorWd: hayHistorial ? promWd.indexOf(Math.max(...promWd)) : -1,
      hayHistorial,
      acumulado,
      proyeccion,
      utilProy,
      gmMes,
      diasCerrados,
      restantes: restantes.length,
      mesAnterior,
      nombreMes: MESES[h.getMonth()],
      nombreMesAnt,
      meta,
      faltante,
      porDia,
      mejorMes,
      mejor8,
      consejos,
    };
  }, [negocioId, ventas, gastos, entradas, apartados, metas, gastosMensuales, hoy]);

  if (!a) return null;

  const pctMeta = a.meta > 0 ? (a.proyeccion / a.meta) * 100 : 0;
  const estadoMeta = a.meta <= 0 ? null : pctMeta >= 100 ? "verde" : pctMeta >= 90 ? "amarillo" : "rojo";
  const coloresMeta = {
    verde: { barra: "from-emerald-400 to-emerald-500", texto: "text-emerald-700", fondo: "bg-emerald-50", msg: "¡Vas a cumplir la meta! 🎉" },
    amarillo: { barra: "from-amber-400 to-orange-400", texto: "text-amber-700", fondo: "bg-amber-50", msg: "Estás cerca de la meta, ¡un empujón más!" },
    rojo: { barra: "from-rose-400 to-rose-500", texto: "text-rose-700", fondo: "bg-rose-50", msg: "A este ritmo no se alcanza la meta." },
  } as const;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/25">
          <TrendingUp className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-stone-800">Análisis inteligente</h2>
          <p className="text-xs text-stone-500">Basado en tus ventas reales (incluye el valor de los apartados).</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 1. Día y semana */}
        <Card>
          <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <CalendarDays className="h-4 w-4 text-amber-600" /> {a.refLabel} vs. la semana pasada
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {a.refLabel} ({a.diaRef} {formatFechaCorta(a.ref)})
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-stone-800">{formatCOP(a.refVentas)}</span>
            <Variacion v={pct(a.refVentas, a.refSemPasada)} sufijo={`vs. el ${a.diaRef} pasado`} />
          </div>
          <p className="mt-1 text-xs text-stone-500">
            El {a.diaRef} pasado: {formatCOP(a.refSemPasada)}
            {a.promRef > 0 && (
              <>
                {" "}· Promedio de tus {DIA_PLURAL[DIA_SING.indexOf(a.diaRef)]}: {formatCOP(Math.round(a.promRef))} → <b>{((a.refVentas / a.promRef) * 100).toFixed(0)}%</b> de un {a.diaRef} normal
              </>
            )}
          </p>

          <div className="mt-4 rounded-xl bg-[#fffaf2] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-700">Esta semana: {formatCOP(a.semActual)}</span>
              <Variacion v={pct(a.semActual, a.semPasada)} sufijo="vs. semana pasada" />
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={a.serieSemana} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e6d3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => formatNum(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => formatCOP(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="semanaPasada" name="Semana pasada" fill="#e7e5e4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="estaSemana" name="Esta semana" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 2. Proyección */}
        <Card>
          <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <Target className="h-4 w-4 text-amber-600" /> Proyección de {a.nombreMes}
          </div>
          {a.diasCerrados === 0 && a.acumulado === 0 ? (
            <p className="text-sm text-stone-500">Aún no hay ventas este mes para proyectar.</p>
          ) : (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">A este ritmo cierras el mes en</div>
              <div className="text-3xl font-extrabold tabular-nums text-orange-600">~{formatCOP(a.proyeccion)}</div>
              <p className="mt-1 text-xs text-stone-500">
                Llevas {formatCOP(a.acumulado)} · faltan {a.restantes} día(s).{" "}
                {a.hayHistorial ? "Calculado según cómo vendes cada día de la semana." : "Calculado con tu promedio diario del mes."}
              </p>

              {estadoMeta ? (
                <div className={`mt-4 rounded-xl p-3 ${coloresMeta[estadoMeta].fondo}`}>
                  <div className="flex justify-between text-xs font-semibold text-stone-600">
                    <span>Meta: {formatCOP(a.meta)}</span>
                    <span>Proyección: {pctMeta.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white">
                    <div className={`h-full rounded-full bg-gradient-to-r ${coloresMeta[estadoMeta].barra}`} style={{ width: `${Math.min(100, pctMeta)}%` }} />
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${coloresMeta[estadoMeta].texto}`}>{coloresMeta[estadoMeta].msg}</p>
                  {a.faltante > 0 ? (
                    <p className="mt-0.5 text-sm text-stone-600">
                      Te faltan <b>{formatCOP(a.faltante)}</b>
                      {a.restantes > 0 && (
                        <>
                          {" "}en {a.restantes} día(s) = <b>{formatCOP(a.porDia)} diarios</b>
                        </>
                      )}
                      .
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm font-semibold text-emerald-700">¡Meta del mes ya cumplida! 🏆</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                  {a.mesAnterior > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{a.nombreMesAnt[0].toUpperCase() + a.nombreMesAnt.slice(1)}: {formatCOP(a.mesAnterior)}</span>
                      <Variacion v={pct(a.proyeccion, a.mesAnterior)} sufijo={`vs. ${a.nombreMesAnt}`} />
                    </div>
                  ) : (
                    <span>Define una meta del mes para ver cuánto te falta por día.</span>
                  )}
                </div>
              )}

              {a.utilProy !== null && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-100 px-3 py-2.5">
                  <span className="text-sm text-stone-600">
                    Utilidad proyectada
                    {a.gmMes > 0 && <span className="block text-[11px] text-stone-400">ya resta {formatCOP(a.gmMes)} de gastos mensuales</span>}
                  </span>
                  <span className={`text-lg font-extrabold tabular-nums ${a.utilProy >= 0 ? "text-emerald-600" : "text-rose-600"}`}>~{formatCOP(a.utilProy)}</span>
                </div>
              )}
            </>
          )}
        </Card>

        {/* 3. Mejores días */}
        <Card>
          <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <Trophy className="h-4 w-4 text-amber-600" /> Tus mejores días
          </div>
          {a.hayHistorial ? (
            <>
              <p className="text-xs text-stone-500">Promedio de ventas por día (últimas {SEMANAS_HIST} semanas)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={a.serieProm} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e6d3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => formatNum(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v) => formatCOP(Number(v))} />
                  <Bar dataKey="promedio" name="Promedio" radius={[6, 6, 0, 0]}>
                    {a.serieProm.map((_, i) => (
                      <Cell key={i} fill={i === a.mejorWd ? "#f97316" : "#fcd9a8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <p className="text-sm text-stone-500">Aún no hay suficientes semanas registradas para calcular tus mejores días.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#fffaf2] p-3">
              <div className="text-[11px] font-semibold uppercase text-stone-400">Mejor día de {a.nombreMes}</div>
              <div className="font-extrabold tabular-nums text-stone-800">{a.mejorMes.monto > 0 ? formatCOP(a.mejorMes.monto) : "—"}</div>
              {a.mejorMes.fecha && <div className="text-xs text-stone-500">{formatFechaCorta(a.mejorMes.fecha)}</div>}
            </div>
            <div className="rounded-xl bg-[#fffaf2] p-3">
              <div className="text-[11px] font-semibold uppercase text-stone-400">Récord (8 semanas)</div>
              <div className="font-extrabold tabular-nums text-stone-800">{a.mejor8.monto > 0 ? formatCOP(a.mejor8.monto) : "—"}</div>
              {a.mejor8.fecha && <div className="text-xs text-stone-500">{formatFechaCorta(a.mejor8.fecha)}</div>}
            </div>
          </div>
        </Card>

        {/* 4. Consejos */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Consejos para ti
          </div>
          {a.consejos.length === 0 ? (
            <p className="text-sm text-stone-500">Cuando haya más ventas registradas aparecerán consejos aquí.</p>
          ) : (
            <ul className="space-y-2">
              {a.consejos.map((c, i) => (
                <li key={i} className="flex gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-stone-700 ring-1 ring-amber-100">
                  <span className="text-amber-500">💡</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
