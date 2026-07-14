"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, LogIn } from "lucide-react";
import { login, usuarioActual } from "@/lib/auth";
import { cebarVoz } from "@/lib/voz";

export default function LoginPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Si ya hay sesión, entrar directo.
  useEffect(() => {
    usuarioActual().then((u) => {
      if (u) router.replace("/");
    });
  }, [router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    cebarVoz(); // desbloquea la voz DENTRO del gesto (clave para el celular)
    setError("");
    setCargando(true);
    const { ok } = await login(correo, clave);
    setCargando(false);
    if (ok) {
      // El saludo por voz lo hace el layout de la app (con el nombre correcto del negocio).
      router.replace("/");
    } else {
      setError("Correo o contraseña incorrectos.");
      setClave("");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-100 via-stone-50 to-amber-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-5xl">🐝</div>
          <h1 className="mt-2 text-2xl font-bold text-stone-800">Almacén Diana G</h1>
          <p className="text-sm text-stone-500">Ingresa para administrar tu negocio</p>
        </div>

        <form onSubmit={entrar} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Correo</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoFocus
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Contraseña</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type={verClave ? "text" : "password"}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-9 pr-10 text-sm text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-stone-600"
                aria-label={verClave ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" /> {cargando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-400">🔒 Acceso protegido · Almacén Diana G</p>
      </div>
    </main>
  );
}
