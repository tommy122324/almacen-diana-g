"use client";
import { useEffect, useState } from "react";

/** true si hay conexión a internet. Se actualiza al conectarse/desconectarse. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true); // asumimos en línea hasta saber lo contrario
  useEffect(() => {
    const actualizar = () => setOnline(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);
  return online;
}
