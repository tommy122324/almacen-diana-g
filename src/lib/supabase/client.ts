import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para usar en el NAVEGADOR (componentes cliente).
 * Usa la clave pública (anon). La seguridad real la aplica RLS en la base de datos.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
