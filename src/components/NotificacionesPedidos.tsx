"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { recordatorio } from "@/lib/alerta";

const DOCE_HORAS = 12 * 60 * 60 * 1000; // ~2 veces al día
const REVISION = 30 * 60 * 1000; // revisa cada 30 min mientras la app esté abierta
const KEY = "contabee-notif-pedidos";

function ultimaNotif(negocioId: string): number {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || "{}");
    return m[negocioId] || 0;
  } catch {
    return 0;
  }
}
function marcarNotif(negocioId: string) {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || "{}");
    m[negocioId] = Date.now();
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* noop */
  }
}

/**
 * Recuerda los pedidos por conseguir. Aparece como modal que el usuario debe
 * cerrar (para que lo note), como máximo ~2 veces al día. Los pedidos ya
 * "conseguidos" no cuentan, así que el recordatorio desaparece al marcarlos.
 * Nota: en modo local solo suena con la app abierta; el recordatorio de fondo
 * (cada 2 días con la app cerrada) llega con las notificaciones push en producción.
 */
export function NotificacionesPedidos() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const apartados = useStore((s) => s.apartados);

  const datosRef = useRef({ negocioId, apartados });
  datosRef.current = { negocioId, apartados };

  useEffect(() => {
    function revisar() {
      const { negocioId, apartados } = datosRef.current;
      if (!negocioId) return;
      const porConseguir = apartados.filter(
        (a) => a.negocioId === negocioId && a.tipo === "pedido" && !a.conseguido,
      );
      if (porConseguir.length === 0) return;
      if (Date.now() - ultimaNotif(negocioId) < DOCE_HORAS) return;

      const lista = porConseguir
        .slice(0, 8)
        .map((p) => `<li style="margin:2px 0"><b>${p.cliente}</b>: ${p.descripcion || "—"}</li>`)
        .join("");
      const n = porConseguir.length;
      recordatorio(
        `📋 Tienes ${n} pedido${n > 1 ? "s" : ""} por conseguir`,
        `<ul style="text-align:left;padding-left:18px;font-size:14px">${lista}</ul>`,
      );
      marcarNotif(negocioId);
    }

    const primero = setTimeout(revisar, 3500);
    const intervalo = setInterval(revisar, REVISION);
    return () => {
      clearTimeout(primero);
      clearInterval(intervalo);
    };
  }, []);

  return null;
}
