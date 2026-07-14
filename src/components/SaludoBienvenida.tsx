"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { reproducirBienvenida, cebarVoz } from "@/lib/voz";

/** Primer nombre de un texto ("Doris Lopez" → "Doris"). */
function primerNombre(t: string): string {
  return t.trim().split(/\s+/)[0] ?? "";
}

/**
 * Saluda por voz UNA vez cada vez que se entra a la app (por sesión del navegador).
 * En celular el audio necesita un gesto: si el intento inmediato se bloquea,
 * suena en el primer toque. El nombre se toma SOLO del nombre real del usuario
 * (no se adivina del negocio, para no confundir a un usuario con otro).
 */
export function SaludoBienvenida() {
  const saludoListo = useStore((s) => s.saludoListo);
  const miNombre = useStore((s) => s.miNombre);

  useEffect(() => {
    if (!saludoListo || typeof window === "undefined") return;
    if (sessionStorage.getItem("cb-saludado") === "1") return;

    const nombre = primerNombre(miNombre);
    const saludo = nombre ? `Hola ${nombre}, bienvenida a tu sistema.` : "Hola, bienvenida a tu sistema.";
    const mensaje = `${saludo} Espero que tengas un excelente día y vendas mucho.`;

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
  }, [saludoListo, miNombre]);

  return null;
}
