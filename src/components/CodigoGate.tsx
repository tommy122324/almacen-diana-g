"use client";
import { useState } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { useStore } from "@/lib/store";
import { validarCodigo } from "@/lib/db";

export function CodigoGate({ onOk }: { onOk: () => void }) {
  const negocioId = useStore((s) => s.negocioActivoId);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    setCargando(true);
    setError("");
    try {
      const ok = await validarCodigo(negocioId, codigo);
      if (ok) onOk();
      else {
        setError("Código incorrecto o expirado.");
        setCodigo("");
      }
    } catch {
      setError("No se pudo validar el código.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-100 via-stone-50 to-amber-50 p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
        <div className="text-center">
          <KeyRound className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-2 text-xl font-bold text-stone-800">Código de acceso</h1>
          <p className="text-sm text-stone-500">Pídele el código de hoy al administrador.</p>
        </div>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="000000"
          className="w-full rounded-xl border border-stone-300 bg-white py-3 text-center text-2xl font-bold tracking-widest tabular-nums text-stone-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={cargando || codigo.length < 6}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" /> {cargando ? "Validando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
