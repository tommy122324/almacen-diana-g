"use client";
// ─── WhatsApp del almacén por dispositivo ───
// Una página web NO puede saber qué cuenta de WhatsApp está abierta en el equipo.
// Por eso cada dispositivo recuerda con cuál número del almacén trabaja; si no lo sabe,
// lo pregunta, y si no es ninguno de los números del almacén, no deja enviar.
import Swal from "sweetalert2";
import { useStore } from "./store";
import { telefonoWhatsApp } from "./whatsapp";
import type { Configuracion } from "./types";

/** Números del almacén configurados (normalizados, sin repetir). */
export function numerosAlmacen(config: Configuracion): string[] {
  const l = [config.whatsapp, config.whatsapp2 ?? ""].map((t) => telefonoWhatsApp(t)).filter((d) => d.length >= 10);
  return [...new Set(l)];
}

const clave = (negocioId: string) => `cb-wa-dispositivo-${negocioId}`;

/** Número guardado para este dispositivo (solo si sigue siendo un número del almacén). */
export function numeroDeEsteDispositivo(): string {
  const { negocioActivoId, config } = useStore.getState();
  if (!negocioActivoId) return "";
  try {
    const n = localStorage.getItem(clave(negocioActivoId)) ?? "";
    return numerosAlmacen(config).includes(n) ? n : "";
  } catch {
    return "";
  }
}

export function guardarNumeroDispositivo(numero: string) {
  const { negocioActivoId } = useStore.getState();
  if (!negocioActivoId) return;
  try {
    if (numero) localStorage.setItem(clave(negocioActivoId), numero);
    else localStorage.removeItem(clave(negocioActivoId));
  } catch {}
}

export const formatoNumero = (d: string) => (d.startsWith("57") && d.length === 12 ? `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`);

/**
 * Verifica con qué WhatsApp del almacén se va a enviar desde este dispositivo.
 * - Sin números configurados → deja enviar (como antes).
 * - Dispositivo ya identificado → deja enviar.
 * - Si no, pregunta; si responde "ninguno" → avisa que no se puede enviar.
 */
export async function asegurarWhatsAppDispositivo(): Promise<boolean> {
  const numeros = numerosAlmacen(useStore.getState().config);
  if (numeros.length === 0) return true;
  if (numeroDeEsteDispositivo()) return true;

  const opciones: Record<string, string> = {};
  numeros.forEach((n, i) => (opciones[n] = `${i === 0 ? "Principal" : "Número 2"}: ${formatoNumero(n)}`));
  opciones.ninguno = "Ninguno de estos";

  const r = await Swal.fire({
    title: "¿Qué WhatsApp está abierto en este dispositivo?",
    html: '<p style="font-size:14px;color:#57534e">Elige el número del almacén con el que tienes la sesión de WhatsApp iniciada aquí. Solo se pregunta una vez en este dispositivo.</p>',
    input: "radio",
    inputOptions: opciones,
    inputValidator: (v) => (!v ? "Elige una opción" : null),
    showCancelButton: true,
    confirmButtonText: "Continuar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#f59e0b",
    cancelButtonColor: "#a8a29e",
    reverseButtons: true,
  });
  if (!r.isConfirmed) return false;
  if (r.value === "ninguno") {
    await Swal.fire({
      icon: "error",
      title: "No se puede enviar",
      html: `<p style="font-size:14px;color:#57534e">Este dispositivo no tiene abierto ningún WhatsApp del almacén. Inicia sesión con ${numeros.map(formatoNumero).join(" o ")} e inténtalo de nuevo.</p>`,
      confirmButtonColor: "#f59e0b",
    });
    return false;
  }
  guardarNumeroDispositivo(String(r.value));
  return true;
}
