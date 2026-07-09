"use client";
import { useEffect } from "react";

/** Registra el Service Worker (permite abrir la app sin internet). */
export function RegistrarSW() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const registrar = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
  }, []);
  return null;
}
