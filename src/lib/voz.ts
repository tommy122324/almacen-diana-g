"use client";
// ─── Contabee 🐝 — Voz de bienvenida (Web Speech API, sin archivos) ───

/** Dice en voz alta un mensaje de bienvenida al iniciar sesión. */
export function reproducirBienvenida(
  mensaje = "Bienvenida a tu sistema de gestión confiable. Almacén Diana G.",
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const decir = () => {
      const u = new SpeechSynthesisUtterance(mensaje);
      u.lang = "es-CO";
      u.rate = 1;
      u.pitch = 1.05;
      const voces = window.speechSynthesis.getVoices();
      const esVoz = voces.find((v) => v.lang.toLowerCase().startsWith("es"));
      if (esVoz) u.voice = esVoz;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    };
    // Las voces a veces cargan de forma diferida.
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = decir;
      setTimeout(decir, 250); // respaldo por si el evento no dispara
    } else {
      decir();
    }
  } catch {
    /* si el navegador no soporta voz, no pasa nada */
  }
}
