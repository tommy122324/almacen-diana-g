"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** Sube la cola de cambios pendientes al montar y cada vez que vuelve la conexión. */
export function SincronizadorOffline() {
  const sincronizar = useStore((s) => s.sincronizarPendientes);
  useEffect(() => {
    const run = () => sincronizar();
    run();
    window.addEventListener("online", run);
    // Reintento suave cada 30 s por si la señal es intermitente.
    const t = setInterval(run, 30000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(t);
    };
  }, [sincronizar]);
  return null;
}
