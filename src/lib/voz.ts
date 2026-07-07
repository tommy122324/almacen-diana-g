"use client";
// ─── Contabee 🐝 — Voz de bienvenida (Web Speech API, sin archivos) ───

// Nombres de voces femeninas / naturales en español que suenan mejor.
const PREFERIDAS = [
  "natural",
  "online",
  "google",
  "sabina",
  "helena",
  "laura",
  "paulina",
  "mónica",
  "monica",
  "marisol",
  "camila",
  "elvira",
];
// Voces masculinas conocidas (a evitar para un tono amable).
const EVITAR = ["raul", "raúl", "pablo", "jorge", "diego", "miguel", "carlos"];

function elegirVoz(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const es = voces.filter((v) => v.lang.toLowerCase().startsWith("es"));
  if (es.length === 0) return null;
  let mejor = es[0];
  let mejorPuntaje = -Infinity;
  for (const v of es) {
    const n = v.name.toLowerCase();
    let p = 0;
    PREFERIDAS.forEach((pref, i) => {
      if (n.includes(pref)) p += PREFERIDAS.length - i + 3;
    });
    if (EVITAR.some((e) => n.includes(e))) p -= 20;
    if (!v.localService) p += 3; // las voces "online" suelen ser más naturales
    if (n.includes("female") || n.includes("mujer")) p += 4;
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = v;
    }
  }
  return mejor;
}

/** Dice en voz alta un mensaje de bienvenida amable al iniciar sesión. */
export function reproducirBienvenida(
  mensaje = "Hola Diana. Bienvenida a tu sistema de gestión. Que tengas un excelente día.",
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const decir = () => {
      const u = new SpeechSynthesisUtterance(mensaje);
      u.lang = "es-MX";
      u.rate = 0.93; // ritmo calmado, sin arrastrar
      u.pitch = 1.05; // tono natural y cálido (no agudo = menos robótico)
      u.volume = 1;
      const voz = elegirVoz(window.speechSynthesis.getVoices());
      if (voz) {
        u.voice = voz;
        u.lang = voz.lang;
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    };
    // Las voces a veces cargan de forma diferida.
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = decir;
      setTimeout(decir, 300); // respaldo por si el evento no dispara
    } else {
      decir();
    }
  } catch {
    /* si el navegador no soporta voz, no pasa nada */
  }
}
