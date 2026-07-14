"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { reproducirBienvenida, cebarVoz } from "@/lib/voz";

/** Primer nombre de un texto ("Doris Lopez" → "Doris"). */
function primerNombre(t: string): string {
  return t.trim().split(/\s+/)[0] ?? "";
}
/** Saca un nombre del nombre del negocio ("Almacén Diana G y Junior" → "Diana"). */
function nombreDesdeNegocio(n: string): string {
  const palabras = n.trim().split(/\s+/).filter((w) => !/^almac[eé]n$/i.test(w));
  return palabras[0] ?? "";
}

/**
 * Saluda por voz UNA vez cada vez que se entra a la app (por sesión del navegador).
 * En celular el audio necesita un gesto: si el intento inmediato se bloquea,
 * suena en el primer toque. El nombre se toma del usuario (o del negocio como respaldo).
 */
export function SaludoBienvenida() {
  const cargado = useStore((s) => s.cargado);
  const miNombre = useStore((s) => s.miNombre);
  const negocios = useStore((s) => s.negocios);
  const activoId = useStore((s) => s.negocioActivoId);

  useEffect(() => {
    if (!cargado || typeof window === "undefined") return;
    if (sessionStorage.getItem("cb-saludado") === "1") return;

    const nombreNegocio = negocios.find((n) => n.id === activoId)?.nombre ?? "";
    const nombre = primerNombre(miNombre) || nombreDesdeNegocio(nombreNegocio);
    const mensaje = nombre ? `Hola ${nombre}, bienvenida a tu sistema.` : "Hola, bienvenida a tu sistema.";

    let hecho = false;
    const marcar = () => {
      hecho = true;
      try {
        sessionStorage.setItem("cb-saludado", "1");
      } catch {
        /* noop */
      }
      quitar();
    };
    const saludar = () => {
      if (!hecho) reproducirBienvenida(mensaje, marcar);
    };
    const gesto = () => {
      cebarVoz();
      saludar();
    };
    const quitar = () => {
      window.removeEventListener("pointerdown", gesto);
      window.removeEventListener("keydown", gesto);
    };

    window.addEventListener("pointerdown", gesto);
    window.addEventListener("keydown", gesto);
    saludar(); // intento inmediato (escritorio o recién logueado); en celular espera el primer toque

    return quitar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado, miNombre]);

  return null;
}
