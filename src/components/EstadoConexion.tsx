"use client";
import { Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { useOnline } from "@/lib/useOnline";
import { useStore } from "@/lib/store";

/** Muestra el estado de conexión y cuántos cambios faltan por subir. */
export function EstadoConexion({ compacto = false }: { compacto?: boolean }) {
  const online = useOnline();
  const pendientes = useStore((s) => s.pendientes.length);
  const sincronizando = useStore((s) => s.sincronizando);
  const sincronizar = useStore((s) => s.sincronizarPendientes);

  const texto = (t: string) => (compacto ? null : <span>{t}</span>);

  // Sin conexión
  if (!online) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-600" title={`Sin conexión${pendientes > 0 ? ` · ${pendientes} por subir` : ""}`}>
        <CloudOff className="h-4 w-4 shrink-0" />
        {texto(`Sin conexión${pendientes > 0 ? ` · ${pendientes} por subir` : ""}`)}
        {compacto && pendientes > 0 && <span className="tabular-nums">{pendientes}</span>}
      </div>
    );
  }

  // En línea pero con cambios pendientes de subir
  if (pendientes > 0) {
    return (
      <button
        onClick={() => sincronizar()}
        className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
        title="Subir cambios pendientes ahora"
      >
        <RefreshCw className={`h-4 w-4 shrink-0 ${sincronizando ? "animate-spin" : ""}`} />
        {texto(sincronizando ? "Subiendo…" : `${pendientes} por subir · reintentar`)}
        {compacto && <span className="tabular-nums">{pendientes}</span>}
      </button>
    );
  }

  // Todo al día
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-600" title="En línea">
      <Cloud className="h-4 w-4 shrink-0" />
      {compacto ? null : <span className="flex items-center gap-1">En línea <Check className="h-3 w-3" /></span>}
    </div>
  );
}
