"use client";
// ─── Almacén Diana G 🐝 — Autenticación con Supabase (segura, en el servidor) ───
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/** Inicia sesión con correo y contraseña. */
export async function login(correo: string, clave: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await createClient().auth.signInWithPassword({
    email: correo.trim(),
    password: clave,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cierra la sesión. */
export async function logout() {
  await createClient().auth.signOut();
}

/** Usuario actual (o null). */
export async function usuarioActual(): Promise<User | null> {
  const { data } = await createClient().auth.getUser();
  return data.user ?? null;
}
