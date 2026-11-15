"use client";
import { useState } from "react";
import { Download, MessageCircle, Loader2 } from "lucide-react";
import type { Recibo } from "@/lib/types";
import { generarImagenRecibo, descargarBlob, nombreArchivoRecibo } from "@/lib/recibo";
import { telefonoWhatsApp } from "@/lib/whatsapp";

/** Botones para el cliente: guardar el recibo como imagen y escribir al almacén. */
export function DescargarRecibo({ recibo, negocio, politica, whatsapp }: { recibo: Recibo; negocio: string; politica: string; whatsapp: string }) {
  const [cargando, setCargando] = useState(false);
  const wa = telefonoWhatsApp(whatsapp);

  async function descargar() {
    setCargando(true);
    try {
      const blob = await generarImagenRecibo(recibo, { negocio, politica, whatsappAlmacen: whatsapp });
      descargarBlob(blob, nombreArchivoRecibo(recibo));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-5 space-y-2">
      <button
        onClick={descargar}
        disabled={cargando}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 font-semibold text-white shadow-md shadow-orange-500/25 transition active:scale-[0.98] disabled:opacity-60"
      >
        {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} Guardar recibo como imagen
      </button>
      {wa.length >= 10 && (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, tengo una consulta sobre mi recibo N° ${String(recibo.numero).padStart(4, "0")}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-50"
        >
          <MessageCircle className="h-5 w-5" /> Escribir al almacén
        </a>
      )}
    </div>
  );
}
