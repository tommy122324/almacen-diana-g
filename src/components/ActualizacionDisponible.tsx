"use client";
import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const MI_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

/**
 * Avisa (sin interrumpir) cuando se publicó una versión más nueva que la cargada.
 * Compara la versión de esta pestaña con la que reporta el servidor en /api/version.
 */
export function ActualizacionDisponible() {
  const [hayNueva, setHayNueva] = useState(false);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    if (MI_VERSION === "dev") return; // en desarrollo no molesta

    let activo = true;
    const revisar = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = await r.json();
        if (activo && id && id !== MI_VERSION) setHayNueva(true);
      } catch {
        /* sin conexión: ignorar */
      }
    };

    revisar();
    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };
    window.addEventListener("focus", revisar);
    document.addEventListener("visibilitychange", alVolver);
    const t = setInterval(revisar, 5 * 60 * 1000); // cada 5 min
    return () => {
      activo = false;
      window.removeEventListener("focus", revisar);
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(t);
    };
  }, []);

  if (!hayNueva || descartado) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-4">
      <div className="flex items-center gap-3 rounded-full border border-amber-200 bg-white px-4 py-2.5 shadow-lg">
        <RefreshCw className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-sm text-stone-700">Hay una versión nueva disponible.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white transition hover:bg-amber-600"
        >
          Actualizar
        </button>
        <button onClick={() => setDescartado(true)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
