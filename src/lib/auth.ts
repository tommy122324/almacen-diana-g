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

/** Usuario actual (o null). Tolerante a estar sin conexión: usa la sesión guardada. */
export async function usuarioActual(): Promise<User | null> {
  const c = createClient();
  // Sin conexión: la sesión guardada localmente basta para dejar entrar (RLS protege en el servidor).
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const { data } = await c.auth.getSession();
    return data.session?.user ?? null;
  }
  try {
    const { data } = await c.auth.getUser();
    if (data.user) return data.user;
  } catch {
    /* red caída: caemos a la sesión guardada */
  }
  const { data } = await c.auth.getSession();
  return data.session?.user ?? null;
}
