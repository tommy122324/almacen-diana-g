"use client";
// ─── Sincronía en tiempo real (Supabase Realtime) ───
// Escucha cambios en las tablas del negocio y avisa para refrescar la vista.
// La seguridad (qué filas recibe cada quien) la sigue aplicando RLS.

import { createClient } from "@/lib/supabase/client";

const TABLAS = [
  "ventas",
  "gastos",
  "entradas",
  "apartados",
  "abonos",
  "cuadres",
  "metas",
  "registros_hora",
  "configuracion",
  "tareas",
];

/**
 * Se suscribe a los cambios del negocio. Llama a `onCambio` cada vez que algo
 * cambia (en cualquier dispositivo). Devuelve una función para cancelar.
 */
export function suscribirCambios(negocioId: string, onCambio: () => void): () => void {
  const supabase = createClient();
  const canal = supabase.channel(`negocio-${negocioId}`);
  for (const tabla of TABLAS) {
    canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, onCambio);
  }
  canal.subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
