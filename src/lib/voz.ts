"use client";
// ─── Almacén Diana G 🐝 — Voz de bienvenida (Web Speech API, sin archivos) ───

// Preferimos voces LOCALES (offline, instantáneas) para que no se demore en el celular,
// y femeninas para un tono amable. Las "online/naturales" se descargan por red y tardan.
const PREF_FEM = ["sabina", "helena", "laura", "paulina", "monica", "mónica", "marisol", "female", "mujer"];
const EVITAR = ["raul", "raúl", "pablo", "jorge", "diego", "miguel", "carlos"];

function elegirVoz(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const es = voces.filter((v) => v.lang.toLowerCase().startsWith("es"));
  if (es.length === 0) return null;
  let mejor = es[0];
  let mejorPuntaje = -Infinity;
  for (const v of es) {
    const n = v.name.toLowerCase();
    let p = 0;
    if (v.localService) p += 6; // local = rápida y consistente
    PREF_FEM.forEach((f, i) => {
      if (n.includes(f)) p += PREF_FEM.length - i + 2;
    });
    if (EVITAR.some((e) => n.includes(e))) p -= 20;
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = v;
    }
  }
  return mejor;
}

/**
 * Debe llamarse DENTRO del gesto del usuario (el clic de "Entrar") para desbloquear
 * la voz en el celular. Si no, iOS/Android bloquean el audio tras un `await`.
 */
export function cebarVoz() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.getVoices(); // fuerza la carga de voces
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u); // "despierta" el motor dentro del gesto
  } catch {
    /* noop */
  }
}

/** Dice en voz alta un mensaje de bienvenida amable al iniciar sesión. */
export function reproducirBienvenida(
  mensaje = "Hola Diana. Bienvenida a tu sistema de gestión. Que tengas un excelente día.",
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const decir = () => {
    const u = new SpeechSynthesisUtterance(mensaje);
    u.lang = "es-MX";
    u.rate = 0.97; // ritmo natural
    u.pitch = 1.05; // cálido
    u.volume = 1;
    const voz = elegirVoz(window.speechSynthesis.getVoices());
    if (voz) {
      u.voice = voz;
      u.lang = voz.lang;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  try {
    if (window.speechSynthesis.getVoices().length > 0) {
      decir();
    } else {
      // Solo si las voces aún no cargaron (raro tras el cebado).
      window.speechSynthesis.onvoiceschanged = () => {
        decir();
        window.speechSynthesis.onvoiceschanged = null;
      };
      setTimeout(decir, 200);
    }
  } catch {
    /* si el navegador no soporta voz, no pasa nada */
  }
}
