"use client";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarDays, Loader2, PackageSearch, TrendingUp, Wallet, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { ventasPorDia } from "@/lib/proveedores";
import { proximasTemporadas, estadoTemporada, temporadaAnioAnterior, temporadasDelAnio, type Temporada } from "@/lib/temporadas";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { Card, Chip } from "@/components/ui";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function sumaRango(m: Map<string, number>, desde: string, hasta: string) {
  let total = 0, dias = 0;
  for (let d = parseISO(desde); iso(d) <= hasta; d = addDays(d, 1)) {
    const v = m.get(iso(d)) ?? 0;
    total += v;
    if (v > 0) dias++;
  }
  return { total, dias, promedio: dias ? total / dias : 0 };
}

export default function Temporadas() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const apartados = useStore((s) => s.apartados);
  const hoy = hoyISO();
  const [ventas, setVentas] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState(false);
  const [verPasadas, setVerPasadas] = useState(false);

  const desde = iso(addDays(parseISO(hoy), -420));
  useEffect(() => {
    if (!negocioId || !esAdmin) return;
    let vivo = true;
    setVentas(null);
    ventasPorDia(negocioId, desde, hoy)
      .then((m) => vivo && (setVentas(m), setError(false)))
      .catch((e) => {
        console.error(e);
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [negocioId, esAdmin, desde, hoy]);

  // Ventas + valor de apartados/pedidos creados ese día (igual que el Panel)
  const porDia = useMemo(() => {
    if (!ventas) return null;
    const m = new Map(ventas);
    for (const a of apartados) {
      if (a.negocioId !== negocioId || a.fecha < desde) continue;
      m.set(a.fecha, (m.get(a.fecha) ?? 0) + a.valorTotal);
    }
    return m;
  }, [ventas, apartados, negocioId, desde]);

  const proximas = useMemo(() => proximasTemporadas(hoy), [hoy]);
  const pasadas = useMemo(() => temporadasDelAnio(Number(hoy.slice(0, 4))).filter((t) => t.fin < hoy).reverse(), [hoy]);

  // Quincenas: días de pago (15-17 y 30-2) vs días normales, últimos 90 días
  const quincena = useMemo(() => {
    if (!porDia) return null;
    let sq = 0, nq = 0, so = 0, no = 0;
    for (let d = addDays(parseISO(hoy), -90); iso(d) < hoy; d = addDays(d, 1)) {
      const v = porDia.get(iso(d)) ?? 0;
      if (!v) continue;
      const dia = d.getDate();
      if ([15, 16, 17, 30, 31, 1, 2].includes(dia)) {
        sq += v;
        nq++;
      } else {
        so += v;
        no++;
      }
    }
    if (nq < 3 || no < 5) return null;
    const pq = sq / nq, po = so / no;
    return { pq, po, pct: po ? Math.round(((pq - po) / po) * 100) : 0 };
  }, [porDia, hoy]);

  if (!esAdmin) {
    return (
      <Card>
        <p className="text-sm text-stone-500">Solo el administrador puede ver el calendario de temporadas.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-800">
          <CalendarDays className="h-6 w-6 text-amber-600" /> Temporadas
        </h1>
        <p className="text-sm text-stone-500">Fechas que mueven las ventas de ropa en Colombia, cuándo surtir y cómo te fue el año pasado.</p>
      </div>

      {error && <Card><p className="text-sm text-rose-600">No se pudo cargar el historial de ventas. Las fechas igual se muestran.</p></Card>}

      {quincena && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-stone-700">
              <div className="font-semibold text-stone-800">Efecto quincena</div>
              {quincena.pct > 0 ? (
                <>En días de pago (15–17 y 30–2) vendes en promedio <b>{formatCOP(quincena.pq)}</b>, un <b>{quincena.pct}% más</b> que un día normal ({formatCOP(quincena.po)}). Ten la mercancía nueva lista para esos días.</>
              ) : (
                <>En días de pago vendes en promedio {formatCOP(quincena.pq)} y en días normales {formatCOP(quincena.po)}. Tus ventas no dependen mucho de la quincena.</>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {proximas.map((t) => (
          <TarjetaTemporada key={t.id} t={t} hoy={hoy} porDia={porDia} />
        ))}
      </div>

      {pasadas.length > 0 && (
        <div>
          <button onClick={() => setVerPasadas((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-stone-500">
            {verPasadas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Cómo te fue este año ({pasadas.length})
          </button>
          {verPasadas && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {pasadas.map((t) => (
                <TarjetaTemporada key={t.id} t={t} hoy={hoy} porDia={porDia} pasada />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaTemporada({ t, hoy, porDia, pasada = false }: { t: Temporada; hoy: string; porDia: Map<string, number> | null; pasada?: boolean }) {
  const { estado, diasInicio, diasFin, surtirDesde } = estadoTemporada(t, hoy);
  const ref = pasada ? t : temporadaAnioAnterior(t);
  const comparacion = useMemo(() => {
    if (!porDia || !ref) return null;
    const v = sumaRango(porDia, ref.inicio, ref.fin);
    if (!v.total) return null;
    const antes = sumaRango(porDia, iso(addDays(parseISO(ref.inicio), -30)), iso(addDays(parseISO(ref.inicio), -1)));
    const pct = antes.promedio ? Math.round(((v.promedio - antes.promedio) / antes.promedio) * 100) : null;
    return { ...v, pct };
  }, [porDia, ref]);

  const estilo = {
    "en-curso": "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white",
    surtir: "border-orange-300 bg-gradient-to-br from-orange-50 to-white",
    proxima: "",
    pasada: "opacity-90",
  }[estado];

  return (
    <Card className={estilo}>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl ring-1 ring-amber-100">{t.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-stone-800">{t.nombre}</h2>
            {estado === "en-curso" && <Chip tone="green">¡En curso! · quedan {diasFin} día(s)</Chip>}
            {estado === "surtir" && <Chip tone="red">Es momento de surtir</Chip>}
            {estado === "proxima" && <Chip tone="stone">Faltan {diasInicio} días</Chip>}
          </div>
          <p className="text-xs text-stone-500">
            {t.inicio === t.fin ? formatFechaCorta(t.fin) : `${formatFechaCorta(t.inicio)} al ${formatFechaCorta(t.fin)}`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-stone-600">{t.consejo}</p>

      {!pasada && estado !== "en-curso" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-orange-700">
          <PackageSearch className="h-4 w-4" /> {estado === "surtir" ? "Surte ya: " : "Empieza a surtir desde el "}
          {formatFechaCorta(surtirDesde)}
        </p>
      )}

      <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
        {!porDia ? (
          <span className="flex items-center gap-1.5 text-stone-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando ventas…
          </span>
        ) : comparacion ? (
          <span className="flex flex-wrap items-center gap-x-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            {pasada ? "Vendiste" : `El año pasado vendiste`} <b className="text-stone-800">{formatCOP(comparacion.total)}</b> en esta temporada
            {comparacion.pct !== null && comparacion.pct !== 0 && (
              <span className={comparacion.pct > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>
                ({comparacion.pct > 0 ? "+" : ""}
                {comparacion.pct}% por día vs el mes anterior)
              </span>
            )}
          </span>
        ) : (
          <span className="text-stone-400">{pasada ? "Sin ventas registradas en esas fechas." : "Aún no hay ventas del año pasado para comparar."}</span>
        )}
      </div>
    </Card>
  );
}
