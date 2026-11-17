"use client";
// ─── Sonidos de la app (sintetizados con Web Audio: sin archivos, no pesan nada) ───

export type Sonido = "entrada" | "salida" | "guino" | "logro" | "meta" | "moneda";

const CLAVE = "cb-sonidos";
let ctx: AudioContext | null = null;
let maestro: GainNode | null = null;

export function sonidosActivos(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "0";
  } catch {
    return true;
  }
}
export function setSonidosActivos(v: boolean) {
  try {
    localStorage.setItem(CLAVE, v ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event("cb-sonidos"));
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
      maestro = ctx.createGain();
      maestro.gain.value = 0.8;
      maestro.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Desbloquea el audio (los navegadores exigen un toque del usuario). */
export function cebarAudio() {
  audio();
}

function nota(c: AudioContext, frec: number, t0: number, dur: number, vol = 0.12, tipo: OscillatorType = "triangle", hasta?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t0);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(maestro!);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Zumbido de abeja: diente de sierra con vibrato, filtrado para que suene suave. */
function zumbido(c: AudioContext, t0: number, dur: number, vol = 0.035, desde = 180, hasta = 230) {
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  const filtro = c.createBiquadFilter();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(desde, t0);
  o.frequency.linearRampToValueAtTime(hasta, t0 + dur);
  lfo.frequency.value = 26;
  lfoG.gain.value = 14;
  lfo.connect(lfoG).connect(o.frequency);
  filtro.type = "lowpass";
  filtro.frequency.value = 950;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.12);
  g.gain.setValueAtTime(vol, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(filtro).connect(g).connect(maestro!);
  o.start(t0);
  lfo.start(t0);
  o.stop(t0 + dur + 0.05);
  lfo.stop(t0 + dur + 0.05);
}

export function sonar(s: Sonido) {
  if (!sonidosActivos()) return;
  const c = audio();
  if (!c || !maestro) return;
  const t = c.currentTime + 0.02;
  try {
    switch (s) {
      case "entrada":
        zumbido(c, t, 1.5, 0.035, 170, 240);
        [1047, 1319, 1568, 2093].forEach((f, i) => nota(c, f, t + 1.55 + i * 0.08, 0.6, 0.1));
        break;
      case "guino":
        nota(c, 1700, t, 0.12, 0.07, "sine", 2600);
        break;
      case "salida":
        [1568, 1319, 1047, 784].forEach((f, i) => nota(c, f, t + i * 0.11, 0.55, 0.1));
        zumbido(c, t + 0.9, 1.2, 0.03, 240, 140);
        break;
      case "moneda":
        nota(c, 988, t, 0.09, 0.09, "square");
        nota(c, 1319, t + 0.08, 0.45, 0.08, "square");
        break;
      case "logro":
        [523, 659, 784, 1047].forEach((f, i) => nota(c, f, t + i * 0.09, 0.3, 0.1));
        [1047, 1319, 1568].forEach((f) => nota(c, f, t + 0.4, 0.9, 0.07));
        break;
      case "meta":
        [784, 784, 784].forEach((f, i) => nota(c, f, t + i * 0.13, 0.12, 0.1, "square"));
        nota(c, 1047, t + 0.42, 0.5, 0.11, "square");
        [1047, 1319, 1568, 2093].forEach((f) => nota(c, f, t + 0.75, 1.3, 0.06));
        [2637, 3136, 2637, 3520].forEach((f, i) => nota(c, f, t + 0.9 + i * 0.12, 0.25, 0.04, "sine"));
        break;
    }
  } catch {
    /* el audio nunca debe romper la app */
  }
}
