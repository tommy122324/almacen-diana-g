"use client";
// Almacenamiento en IndexedDB para guardar el estado de la app en el dispositivo.
// Sirve para que los datos que ya cargaste se vean aunque no haya internet.
import type { StateStorage } from "zustand/middleware";

const DB_NAME = "almacen-diana-g";
const STORE = "kv";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function leer(key: string): Promise<string | null> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function escribir(key: string, value: string): Promise<void> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function borrar(key: string): Promise<void> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Agrupa las escrituras: guarda solo el último valor cada ~500 ms (evita escribir en cada tecla).
const pendientes = new Map<string, string>();
let temporizador: ReturnType<typeof setTimeout> | undefined;
function programarGuardado() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    for (const [k, v] of pendientes) escribir(k, v).catch(() => {});
    pendientes.clear();
  }, 500);
}

export const idbStorage: StateStorage = {
  getItem: (name) => leer(name),
  setItem: (name, value) => {
    pendientes.set(name, value);
    programarGuardado();
  },
  removeItem: (name) => {
    pendientes.delete(name);
    return borrar(name);
  },
};
