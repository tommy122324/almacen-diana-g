"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { Nav } from "@/components/Nav";
import { BusinessSelector } from "@/components/BusinessSelector";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const negocios = useStore((s) => s.negocios);
  const crearNegocio = useStore((s) => s.crearNegocio);

  // La primera vez, crea un negocio por defecto para poder empezar de inmediato.
  useEffect(() => {
    if (hydrated && negocios.length === 0) {
      crearNegocio("Almacén Diana G");
    }
  }, [hydrated, negocios.length, crearNegocio]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-4xl">🐝</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-800">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 border-r border-stone-200 bg-white p-4 md:flex">
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className="text-2xl">🐝</span>
          <span className="text-lg font-bold text-stone-800">Almacén Diana G</span>
        </div>
        <BusinessSelector />
        <Nav />
        <div className="mt-auto rounded-lg bg-stone-50 px-2 py-1.5 text-xs text-stone-400">
          Modo local · datos en este equipo
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Encabezado (celular) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white p-3 md:hidden">
          <span className="text-2xl">🐝</span>
          <div className="flex-1">
            <BusinessSelector />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>

        {/* Barra inferior (celular) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-2 backdrop-blur md:hidden">
          <Nav />
        </nav>
      </div>
    </div>
  );
}
