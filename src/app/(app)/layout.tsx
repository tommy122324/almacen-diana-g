"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { estaAutenticado, logout } from "@/lib/auth";
import { confirmar } from "@/lib/alerta";
import { Nav } from "@/components/Nav";
import { BusinessSelector } from "@/components/BusinessSelector";
import { NotificacionesPedidos } from "@/components/NotificacionesPedidos";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const negocios = useStore((s) => s.negocios);
  const crearNegocio = useStore((s) => s.crearNegocio);

  // Protección: sin sesión local, al login.
  useEffect(() => {
    if (!hydrated) return;
    if (estaAutenticado()) {
      setAutorizado(true);
    } else {
      router.replace("/login");
    }
  }, [hydrated, router]);

  // La primera vez, crea un negocio por defecto para poder empezar de inmediato.
  useEffect(() => {
    if (autorizado && negocios.length === 0) {
      crearNegocio("Almacén Diana G");
    }
  }, [autorizado, negocios.length, crearNegocio]);

  async function salir() {
    if (await confirmar("¿Cerrar sesión?", "Tendrás que volver a ingresar con tu usuario y contraseña.", "Sí, cerrar sesión")) {
      logout();
      router.replace("/login");
    }
  }

  if (!hydrated || !autorizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-4xl">🐝</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-800">
      <NotificacionesPedidos />
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 border-r border-stone-200 bg-white p-4 md:flex">
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className="text-2xl">🐝</span>
          <span className="text-lg font-bold text-stone-800">Almacén Diana G</span>
        </div>
        <BusinessSelector />
        <Nav />
        <div className="mt-auto space-y-2">
          <button
            onClick={salir}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
          <div className="rounded-lg bg-stone-50 px-2 py-1.5 text-xs text-stone-400">
            Modo local · datos en este equipo
          </div>
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
          <button onClick={salir} className="rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Cerrar sesión">
            <LogOut className="h-5 w-5" />
          </button>
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
