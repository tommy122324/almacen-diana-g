"use client";
import { useEffect, useState } from "react";
import { useStore } from "./store";

/** true cuando el store ya se rehidrató desde IndexedDB (datos guardados en el dispositivo). */
export function useStoreHydrated(): boolean {
  const [listo, setListo] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const fin = useStore.persist.onFinishHydration(() => setListo(true));
    if (useStore.persist.hasHydrated()) setListo(true);
    return fin;
  }, []);
  return listo;
}
