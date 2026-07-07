"use client";
// ─── Contabee 🐝 — Autenticación LOCAL (fase local) ───
// Barrera de acceso para el modo local. NO es seguridad de producción:
// eso llega al conectar Supabase Auth. La contraseña no se guarda en texto
// plano; se compara por hash SHA-256 con sal.

const SALT = "contabee-2026";
const USUARIO = "diana";
const HASH = "1862befb52098094bb58429479954731fe56475f9d22d05d544ea6e3bc4768f0";
const KEY = "contabee-auth";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verifica usuario y clave. Si son correctos, guarda la sesión local. */
export async function login(usuario: string, clave: string): Promise<boolean> {
  if (usuario.trim().toLowerCase() !== USUARIO) return false;
  const h = await sha256(SALT + clave);
  if (h === HASH) {
    localStorage.setItem(KEY, JSON.stringify({ u: USUARIO, t: Date.now() }));
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(KEY);
}

/** ¿Hay una sesión local activa? */
export function estaAutenticado(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(KEY);
}
