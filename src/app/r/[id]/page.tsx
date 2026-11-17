import type { Metadata } from "next";
import { headers } from "next/headers";
import { obtenerReciboPublico, celularOculto } from "./datos";
import { DescargarRecibo } from "./DescargarRecibo";
import { CalificarRecibo } from "./CalificarRecibo";
import { formatCOP, formatFechaLarga, formatFechaCorta } from "@/lib/format";
import { METODO_LABEL, POLITICA_RECIBO_DEFECTO } from "@/lib/types";
import { tipoRecibo, saldoRecibo, tituloRecibo, graciasRecibo, detalleRecibo } from "@/lib/reciboTipo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = await obtenerReciboPublico(id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? new URL(`${proto}://${host}`) : undefined;
  if (!d) return { title: "Recibo no encontrado", metadataBase: base, robots: { index: false } };
  const n = String(d.recibo.numero).padStart(4, "0");
  const titulo = `Recibo N° ${n} · ${d.negocio}`;
  const desc = `Total ${formatCOP(d.recibo.total)} · ${formatFechaCorta(d.recibo.fecha)}. Toca para ver tu recibo.`;
  return {
    title: titulo,
    description: desc,
    metadataBase: base,
    robots: { index: false, follow: false },
    openGraph: { title: titulo, description: desc, type: "website", siteName: d.negocio },
  };
}

export default async function ReciboPublicoPage({ params }: Props) {
  const { id } = await params;
  const d = await obtenerReciboPublico(id);

  if (!d) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fdf3e4] p-6 text-center">
        <div className="text-5xl">🧾</div>
        <h1 className="text-xl font-bold text-stone-800">Recibo no encontrado</h1>
        <p className="text-sm text-stone-500">El enlace no es válido o el recibo fue eliminado.</p>
      </main>
    );
  }

  const { recibo: r, negocio } = d;
  const numero = String(r.numero).padStart(4, "0");
  const hora = (() => {
    try {
      return new Date(r.creadoEn).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
    } catch {
      return "";
    }
  })();
  const politica = d.politica.trim() || POLITICA_RECIBO_DEFECTO;
  const filas: [string, string][] = [];
  if (r.cliente.trim()) filas.push(["Cliente", r.cliente.trim()]);
  if (r.telefono.trim()) filas.push(["WhatsApp", celularOculto(r.telefono)]);
  filas.push(["Método de pago", METODO_LABEL[r.metodo] ?? r.metodo]);
  if (r.atendio.trim()) filas.push(["Te atendió", r.atendio.trim()]);
  const esVenta = tipoRecibo(r) === "venta";
  const { abonado, saldo } = saldoRecibo(r);

  return (
    <main className="min-h-screen bg-[#fdf3e4] bg-[radial-gradient(ellipse_at_top,_#ffe7c2_0%,_transparent_60%)] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        {!r.calificacion && (
          <a
            href="#calificar"
            className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-white/80 px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm ring-1 ring-orange-100"
          >
            ⭐ ¿Cómo te atendimos? Califica tu compra aquí ↓
          </a>
        )}
        <article className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_-15px_rgba(154,52,18,0.3)]">
          <header className="relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 px-6 pb-8 pt-7 text-center text-white">
            <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
            <span className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/10" />
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-3xl shadow">🐝</div>
            <h1 className="relative mt-3 text-2xl font-extrabold tracking-tight">{negocio}</h1>
            <p className="relative mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">{tituloRecibo(r)}</p>
          </header>

          <div className="px-6 pb-7 pt-6">
            <div className="text-center">
              <span className="inline-block rounded-full border border-orange-200 bg-orange-50 px-5 py-1.5 text-lg font-extrabold text-orange-700">
                N° {numero}
              </span>
              <p className="mt-2 text-sm text-stone-500">
                {formatFechaLarga(r.fecha)}
                {hora ? ` · ${hora}` : ""}
              </p>
            </div>

            <div className="my-5 border-t-2 border-dashed border-stone-200" />

            <dl className="space-y-2.5">
              {filas.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-stone-400">{k}</dt>
                  <dd className="text-right font-semibold text-stone-800">{v}</dd>
                </div>
              ))}
            </dl>

            {r.detalle.trim() && (
              <div className="mt-4 rounded-2xl bg-stone-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{detalleRecibo(r)}</div>
                <p className="mt-1 whitespace-pre-wrap text-stone-700">{r.detalle}</p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-50 to-orange-100 px-5 py-4">
              <span className="text-sm font-bold text-orange-800">{esVenta ? "TOTAL" : "VALOR TOTAL"}</span>
              <span className="text-3xl font-extrabold tabular-nums text-orange-700">{formatCOP(r.total)}</span>
            </div>
            {!esVenta && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-emerald-50 px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase text-emerald-600">Abonado</div>
                  <div className="text-lg font-extrabold text-emerald-700">{formatCOP(abonado)}</div>
                </div>
                <div className={`rounded-2xl px-3 py-2.5 ${saldo > 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
                  <div className={`text-[11px] font-bold uppercase ${saldo > 0 ? "text-rose-500" : "text-emerald-600"}`}>Saldo pendiente</div>
                  <div className={`text-lg font-extrabold ${saldo > 0 ? "text-rose-600" : "text-emerald-700"}`}>{saldo > 0 ? formatCOP(saldo) : "Pagado ✓"}</div>
                </div>
              </div>
            )}

            <div className="my-5 border-t-2 border-dashed border-stone-200" />

            <div>
              <div className="text-sm font-bold text-stone-700">Cambios y garantías</div>
              <p className="mt-1 text-sm text-stone-500">{politica}</p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-lg font-extrabold text-orange-600">{graciasRecibo(r)}</p>
              <p className="mt-1 text-xs text-stone-400">Conserva este recibo para cualquier cambio o reclamo.</p>
            </div>
          </div>
        </article>

        <div id="calificar" className="scroll-mt-4">
          <CalificarRecibo id={r.id} inicial={r.calificacion ?? null} atendio={r.atendio} />
        </div>

        <DescargarRecibo recibo={r} negocio={negocio} politica={d.politica} whatsapp={d.whatsapp} />
      </div>
    </main>
  );
}
