"use client";
// Avisos del Panel (solo admin): pagos a proveedores y próxima temporada.
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { listarCuentasPagar, saldoCuenta } from "@/lib/proveedores";
import { proximasTemporadas, estadoTemporada } from "@/lib/temporadas";
import { formatCOP } from "@/lib/format";
import { hoyISO } from "@/lib/calc";

export function AvisosPanel() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const hoy = hoyISO();
  const [pagos, setPagos] = useState<{ vencidas: number; proximas: number; monto: number } | null>(null);

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    listarCuentasPagar(negocioId)
      .then((cs) => {
        if (!vivo) return;
        const lim = new Date(Date.parse(hoy) + 7 * 86400000).toISOString().slice(0, 10);
        const abiertas = cs.filter((c) => saldoCuenta(c) > 0 && c.vence && c.vence <= lim);
        setPagos({
          vencidas: abiertas.filter((c) => c.vence! < hoy).length,
          proximas: abiertas.filter((c) => c.vence! >= hoy).length,
          monto: abiertas.reduce((t, c) => t + saldoCuenta(c), 0),
        });
      })
      .catch(() => vivo && setPagos(null)); // tabla aún no creada: sin aviso
    return () => {
      vivo = false;
    };
  }, [negocioId, hoy]);

  const temporada = proximasTemporadas(hoy)
    .map((t) => ({ t, ...estadoTemporada(t, hoy) }))
    .find((x) => x.estado === "en-curso" || x.estado === "surtir" || x.diasInicio <= 30);

  const hayPagos = pagos && (pagos.vencidas > 0 || pagos.proximas > 0);
  if (!hayPagos && !temporada) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {hayPagos && (
        <Link href="/proveedores" className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm transition hover:shadow-md">
          <AlertTriangle className="h-6 w-6 shrink-0 text-rose-500" />
          <span className="min-w-0 flex-1 text-sm text-stone-700">
            <b className="block text-stone-800">Pagos a proveedores</b>
            {pagos!.vencidas > 0 && `${pagos!.vencidas} vencida(s)`}
            {pagos!.vencidas > 0 && pagos!.proximas > 0 && " · "}
            {pagos!.proximas > 0 && `${pagos!.proximas} vence(n) esta semana`} · {formatCOP(pagos!.monto)}
          </span>
          <ArrowRight className="h-4 w-4 text-stone-400" />
        </Link>
      )}
      {temporada && (
        <Link href="/temporadas" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm transition hover:shadow-md">
          <span className="text-2xl">{temporada.t.emoji}</span>
          <span className="min-w-0 flex-1 text-sm text-stone-700">
            <b className="block text-stone-800">{temporada.t.nombre}</b>
            {temporada.estado === "en-curso"
              ? `¡En curso! Quedan ${temporada.diasFin} día(s)`
              : temporada.estado === "surtir"
                ? `Empieza en ${temporada.diasInicio} días · es momento de surtir`
                : `Empieza en ${temporada.diasInicio} días`}
          </span>
          <CalendarDays className="h-4 w-4 text-stone-400" />
        </Link>
      )}
    </div>
  );
}
