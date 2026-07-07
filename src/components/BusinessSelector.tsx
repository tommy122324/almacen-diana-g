"use client";
import { useState } from "react";
import { ChevronDown, Plus, Check, Store } from "lucide-react";
import { useStore } from "@/lib/store";

export function BusinessSelector() {
  const negocios = useStore((s) => s.negocios);
  const activoId = useStore((s) => s.negocioActivoId);
  const setActivo = useStore((s) => s.setNegocioActivo);
  const crear = useStore((s) => s.crearNegocio);
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");

  const activo = negocios.find((n) => n.id === activoId);

  async function confirmarCrear() {
    if (nombre.trim()) {
      const id = await crear(nombre.trim());
      if (id) await setActivo(id);
    }
    setNombre("");
    setCreando(false);
    setAbierto(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-left text-sm hover:border-amber-400 hover:bg-amber-50"
      >
        <Store className="h-4 w-4 text-amber-600" />
        <span className="flex-1 truncate font-semibold text-stone-800">{activo?.nombre ?? "Sin negocio"}</span>
        <ChevronDown className="h-4 w-4 text-stone-400" />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
            {negocios.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setActivo(n.id);
                  setAbierto(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-amber-50"
              >
                <span className="flex-1 truncate">{n.nombre}</span>
                {n.id === activoId && <Check className="h-4 w-4 text-amber-600" />}
              </button>
            ))}

            {creando ? (
              <div className="flex gap-1 p-1">
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmarCrear()}
                  placeholder="Nombre del negocio"
                  className="w-full rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-500"
                />
                <button onClick={confirmarCrear} className="rounded-lg bg-amber-500 px-2 text-white">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreando(true)}
                className="flex w-full items-center gap-2 rounded-lg border-t border-stone-100 px-2 py-1.5 text-left text-sm text-amber-700 hover:bg-amber-50"
              >
                <Plus className="h-4 w-4" /> Nuevo negocio
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
