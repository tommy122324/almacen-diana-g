"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Star, Trophy, Loader2, MessageCircle, Radio } from "lucide-react";
import { useStore } from "@/lib/store";
import * as db from "@/lib/db";
import type { Recibo } from "@/lib/types";
import { suscribirRecibos } from "@/lib/realtime";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { numeroRecibo } from "@/lib/recibo";
import { recordatorio } from "@/lib/alerta";
import { Card, Boton } from "@/components/ui";

const TEXTOS = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];

function Estrellas({ n, size = "h-4 w-4" }: { n: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= n ? "fill-amber-400 text-amber-400" : "text-stone-200"}`} />
      ))}
    </span>
  );
}

function hora(isoTs: string | null) {
  if (!isoTs) return "";
  try {
    return new Date(isoTs).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
  } catch {
    return "";
  }
}

export default function Calificaciones() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const [lista, setLista] = useState<Recibo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState(0); // 0 = todas
  const [enVivo, setEnVivo] = useState(false);
  const conocidos = useRef<Set<string> | null>(null);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    try {
      const r = await db.listarCalificaciones(negocioId);
      // Aviso cuando llega una calificación nueva mientras la página está abierta
      if (conocidos.current) {
        const nueva = r.find((x) => !conocidos.current!.has(x.id));
        if (nueva) recordatorio(`⭐ Nueva calificación: ${nueva.calificacion} de 5`, `${nueva.cliente || "Un cliente"}${nueva.comentario ? `: “${nueva.comentario}”` : ""}`);
      }
      conocidos.current = new Set(r.map((x) => x.id));
      setLista(r);
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [negocioId]);

  useEffect(() => {
    conocidos.current = null;
    setCargando(true);
    cargar();
  }, [cargar]);

  // Tiempo real + respaldo: refresca al volver a la pestaña y cada minuto
  useEffect(() => {
    if (!negocioId || !esAdmin) return;
    const quitar = suscribirRecibos(negocioId, () => cargar());
    setEnVivo(true);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    const t = setInterval(cargar, 60000);
    return () => {
      quitar();
      setEnVivo(false);
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(t);
    };
  }, [negocioId, esAdmin, cargar]);

  const promedio = lista.length ? lista.reduce((s, r) => s + (r.calificacion ?? 0), 0) / lista.length : 0;
  const conteo = [5, 4, 3, 2, 1].map((n) => ({ n, c: lista.filter((r) => r.calificacion === n).length }));
  const ranking = useMemo(() => {
    const m = new Map<string, { suma: number; n: number }>();
    for (const r of lista) {
      const k = r.atendio.trim() || "Sin nombre";
      const x = m.get(k) ?? { suma: 0, n: 0 };
      x.suma += r.calificacion ?? 0;
      x.n++;
      m.set(k, x);
    }
    return [...m.entries()].map(([nombre, x]) => ({ nombre, prom: x.suma / x.n, n: x.n })).sort((a, b) => b.prom - a.prom || b.n - a.n);
  }, [lista]);
  const visibles = filtro ? lista.filter((r) => r.calificacion === filtro) : lista;

  if (!esAdmin) {
    return (
      <Card>
        <p className="text-sm text-stone-500">Solo el administrador puede ver las calificaciones.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-800">
          <Star className="h-6 w-6 fill-amber-400 text-amber-400" /> Calificación del almacén
        </h1>
        {enVivo && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> En vivo
          </span>
        )}
      </div>

      {cargando ? (
        <div className="flex justify-center py-10 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <Card>
          <p className="text-sm text-rose-600">No se pudieron cargar las calificaciones.</p>
          <Boton variant="outline" className="mt-3" onClick={cargar}>
            Reintentar
          </Boton>
        </Card>
      ) : lista.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-stone-500">Aún no hay calificaciones. Cuando un cliente califique su recibo aparecerá aquí al instante.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card className="flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-white text-center">
              <div className="text-5xl font-extrabold text-amber-600">{promedio.toFixed(1).replace(".", ",")}</div>
              <div className="mt-1">
                <Estrellas n={Math.round(promedio)} size="h-6 w-6" />
              </div>
              <div className="mt-1 text-sm text-stone-500">{lista.length} calificación(es)</div>
            </Card>
            <Card>
              <div className="space-y-1.5">
                {conteo.map(({ n, c }) => (
                  <button key={n} onClick={() => setFiltro(filtro === n ? 0 : n)} className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-sm ${filtro === n ? "bg-amber-50" : ""}`}>
                    <span className="flex w-8 items-center gap-0.5 font-semibold text-stone-600">
                      {n} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    </span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${lista.length ? (c / lista.length) * 100 : 0}%` }} />
                    </span>
                    <span className="w-8 text-right text-xs text-stone-500">{c}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-amber-100 pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <Trophy className="h-4 w-4 text-amber-600" /> Quién atiende mejor
                </div>
                <div className="flex flex-wrap gap-2">
                  {ranking.map((x, i) => (
                    <span key={x.nombre} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white" : "bg-[#fffaf2] text-stone-700 ring-1 ring-amber-100"}`}>
                      {x.nombre} · {x.prom.toFixed(1).replace(".", ",")} ★ ({x.n})
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-700">{filtro ? `Calificaciones de ${filtro} estrella(s)` : "Todas las calificaciones"}</h2>
            {filtro > 0 && (
              <button onClick={() => setFiltro(0)} className="text-sm font-semibold text-amber-700">
                Ver todas
              </button>
            )}
          </div>

          <div className="space-y-3">
            {visibles.map((r) => (
              <Card key={r.id} className={`p-4 ${(r.calificacion ?? 0) <= 2 ? "!border-rose-200" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-lg font-bold text-white">
                    {(r.cliente.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-stone-800">{r.cliente.trim() || "Cliente"}</span>
                      <Estrellas n={r.calificacion ?? 0} />
                      <span className="text-xs font-semibold text-amber-700">{TEXTOS[r.calificacion ?? 0]}</span>
                    </div>
                    <div className="text-xs text-stone-500">
                      {hora(r.calificadoEn ?? null)} · Recibo N° {numeroRecibo(r.numero)} del {formatFechaCorta(r.fecha)} · {formatCOP(r.total)}
                      {r.atendio && ` · Atendió: ${r.atendio}`}
                    </div>
                    {r.comentario ? (
                      <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-stone-700">
                        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <span className="italic">“{r.comentario}”</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-stone-400">Sin comentario</p>
                    )}
                    {r.detalle && <p className="mt-1 text-xs text-stone-400">Compró: {r.detalle}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
