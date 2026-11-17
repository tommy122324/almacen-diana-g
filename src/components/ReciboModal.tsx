"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Send, Download, Share2, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Recibo } from "@/lib/types";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { asegurarWhatsAppDispositivo, numeroDeEsteDispositivo, formatoNumero } from "@/lib/whatsappDispositivo";
import { avisar, avisarError, recordatorio } from "@/lib/alerta";
import {
  generarImagenRecibo,
  nombreArchivoRecibo,
  mensajeRecibo,
  numeroRecibo,
  puedeCompartirArchivo,
  copiarImagen,
  descargarBlob,
} from "@/lib/recibo";
import { Boton } from "@/components/ui";

/** Vista previa del recibo + enviar por WhatsApp / descargar. */
export function ReciboModal({ recibo, onCerrar }: { recibo: Recibo; onCerrar: () => void }) {
  const negocios = useStore((s) => s.negocios);
  const config = useStore((s) => s.config);
  const negocio = negocios.find((n) => n.id === recibo.negocioId)?.nombre ?? "Almacén Diana G";
  const [blob, setBlob] = useState<Blob | null>(null);
  const [numDispositivo, setNumDispositivo] = useState("");
  useEffect(() => setNumDispositivo(numeroDeEsteDispositivo()), [config.whatsapp, config.whatsapp2]);
  // El recibo muestra el WhatsApp con el que trabaja este dispositivo (o el principal)
  const waRecibo = numDispositivo || config.whatsapp;
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  useEffect(() => {
    let vivo = true;
    generarImagenRecibo(recibo, { negocio, politica: config.politicaRecibo, whatsappAlmacen: waRecibo })
      .then((b) => vivo && setBlob(b))
      .catch(() => avisarError("No se pudo crear la imagen del recibo"));
    return () => {
      vivo = false;
    };
  }, [recibo, negocio, config.politicaRecibo, waRecibo]);

  const archivo = useMemo(() => (blob ? new File([blob], nombreArchivoRecibo(recibo), { type: "image/png" }) : null), [blob, recibo]);
  const esCelular = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const compartible = !!archivo && puedeCompartirArchivo(archivo);
  const texto = mensajeRecibo(recibo, negocio, false);
  const tieneCel = recibo.telefono.replace(/\D/g, "").length >= 7;

  /** Abre el chat del cliente con el mensaje + link del recibo: solo toca Enviar. */
  async function enviarLink() {
    if (!(await asegurarWhatsAppDispositivo())) return;
    setNumDispositivo(numeroDeEsteDispositivo());
    abrirWhatsApp(recibo.telefono, mensajeRecibo(recibo, negocio, true));
  }

  async function compartir() {
    if (!archivo) return;
    if (!(await asegurarWhatsAppDispositivo())) return;
    setNumDispositivo(numeroDeEsteDispositivo());
    try {
      await navigator.share({ files: [archivo], text: texto });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") avisarError("No se pudo compartir");
    }
  }

  async function enviarPC() {
    if (!blob) return;
    if (!(await asegurarWhatsAppDispositivo())) return;
    setNumDispositivo(numeroDeEsteDispositivo());
    // Copiar y abrir el chat dentro del mismo clic (así el navegador no bloquea nada)
    const copia = copiarImagen(blob);
    if (recibo.telefono.trim()) abrirWhatsApp(recibo.telefono, texto);
    const copiado = await copia;
    if (copiado) {
      recordatorio(
        "📋 Recibo copiado",
        "Se abrió el chat del cliente en WhatsApp. Pega la imagen con <b>Ctrl + V</b> y envíala.",
      );
    } else {
      descargarBlob(blob, nombreArchivoRecibo(recibo));
      recordatorio("⬇️ Recibo descargado", "Adjunta la imagen descargada en el chat de WhatsApp del cliente.");
    }
  }

  return (
    <div className="cb-fondo fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" onClick={onCerrar}>
      <div className="cb-modal flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-amber-100 px-5 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Recibo</div>
            <div className="text-lg font-extrabold text-stone-800">N° {numeroRecibo(recibo.numero)}</div>
          </div>
          <button onClick={onCerrar} className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-500" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fdf3e4] p-4">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Recibo N° ${numeroRecibo(recibo.numero)}`} className="mx-auto w-full rounded-2xl shadow-lg" />
          ) : (
            <div className="flex h-64 items-center justify-center text-stone-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-amber-100 p-4">
          {tieneCel && (
            <Boton onClick={enviarLink} className="w-full !bg-none !bg-emerald-500 !py-3 !text-base hover:!bg-emerald-600 !shadow-emerald-500/25">
              <Send className="h-5 w-5" /> Enviar a {recibo.cliente.trim().split(/\s+/)[0] || "el cliente"} por WhatsApp
            </Boton>
          )}
          {tieneCel && <p className="text-center text-xs text-stone-500">Se abre el chat del cliente con el recibo listo. Solo toca <b>Enviar</b>.</p>}
          <div className="flex gap-2">
            {esCelular && compartible ? (
              <Boton variant="outline" onClick={compartir} disabled={!blob} className="flex-1">
                <Share2 className="h-4 w-4" /> Como imagen
              </Boton>
            ) : (
              <Boton variant="outline" onClick={enviarPC} disabled={!blob} className="flex-1">
                <Share2 className="h-4 w-4" /> Como imagen
              </Boton>
            )}
            <Boton
              variant="outline"
              onClick={() => {
                if (!blob) return;
                descargarBlob(blob, nombreArchivoRecibo(recibo));
                avisar("Recibo descargado");
              }}
              disabled={!blob}
              className="flex-1"
            >
              <Download className="h-4 w-4" /> Descargar
            </Boton>
          </div>
          {numDispositivo && (
            <p className="text-center text-xs text-stone-500">
              Se envía desde el WhatsApp del almacén <b>{formatoNumero(numDispositivo)}</b>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
