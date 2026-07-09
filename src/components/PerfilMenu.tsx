"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, FileBarChart, Settings } from "lucide-react";
import { useStore } from "@/lib/store";

/** Botón de perfil (celular): abre Reportes, Ajustes y Cerrar sesión. */
export function PerfilMenu({ onSalir }: { onSalir: () => void }) {
  const esAdmin = useStore((s) => s.esAdmin);
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const item = "flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-stone-100";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 transition hover:bg-amber-200"
        aria-label="Perfil"
      >
        <User className="h-5 w-5" />
      </button>
      {abierto && (
        <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {esAdmin && (
            <>
              <Link href="/reportes" onClick={() => setAbierto(false)} className={`${item} ${path === "/reportes" ? "text-amber-700" : "text-stone-600"}`}>
                <FileBarChart className="h-4 w-4" /> Reportes
              </Link>
              <Link href="/ajustes" onClick={() => setAbierto(false)} className={`${item} ${path === "/ajustes" ? "text-amber-700" : "text-stone-600"}`}>
                <Settings className="h-4 w-4" /> Ajustes
              </Link>
              <div className="my-1 border-t border-stone-100" />
            </>
          )}
          <button onClick={() => { setAbierto(false); onSalir(); }} className={`${item} w-full text-rose-600 hover:bg-rose-50`}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
