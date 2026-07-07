"use client";
import { useEffect, useState } from "react";

/**
 * Devuelve true solo después del primer render en el navegador.
 * Evita desajustes de hidratación al leer datos persistidos en localStorage.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
