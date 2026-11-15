"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Star, Send, Loader2 } from "lucide-react";

const TEXTOS = ["", "Muy mala", "Mala", "Regular", "Buena", "¡Excelente!"];

/** "¿Cómo te atendimos?" — el cliente califica su compra (una sola vez). */
export function CalificarRecibo({ id, inicial, atendio }: { id: string; inicial: number | null; atendio: string }) {
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<number | null>(inicial);
  const [error, setError] = useState("");
  const nombre = atendio.trim().split(/\s+/)[0];

  async function enviar() {
    if (!estrellas) return setError("Toca las estrellas para calificar.");
    setEnviando(true);
    setError("");
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error: e } = await sb.rpc("calificar_recibo", { p_id: id, p_estrellas: estrellas, p_comentario: comentario.trim() });
      if (e) throw e;
      if (data === false) setError("Esta compra ya fue calificada. ¡Gracias!");
      setListo(estrellas);
    } catch {
      setError("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="mt-5 rounded-[2rem] bg-white p-6 text-center shadow-[0_20px_50px_-15px_rgba(154,52,18,0.25)]">
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`h-7 w-7 ${n <= listo ? "fill-amber-400 text-amber-400" : "text-stone-200"}`} />
          ))}
        </div>
        <p className="mt-2 font-bold text-stone-800">¡Gracias por tu calificación! 💛</p>
        <p className="text-sm text-stone-500">Nos ayuda a atenderte cada vez mejor.</p>
      </div>
    );
  }

  const activa = hover || estrellas;
  return (
    <div className="mt-5 rounded-[2rem] bg-white p-6 shadow-[0_20px_50px_-15px_rgba(154,52,18,0.25)]">
      <h2 className="text-center text-lg font-extrabold text-stone-800">¿Cómo te atendimos?</h2>
      <p className="text-center text-sm text-stone-500">{nombre ? `Te atendió ${nombre}. ` : ""}Califica tu experiencia de compra.</p>
      <div className="mt-4 flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setEstrellas(n);
              setError("");
            }}
            onMouseEnter={() => setHover(n)}
            className="transition active:scale-90"
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          >
            <Star className={`h-10 w-10 transition ${n <= activa ? "fill-amber-400 text-amber-400 drop-shadow" : "text-stone-200"}`} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-semibold text-amber-600">{TEXTOS[activa]}</p>
      {estrellas > 0 && (
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value.slice(0, 500))}
          rows={3}
          placeholder={estrellas >= 4 ? "¿Qué te gustó? (opcional)" : "¿Qué podemos mejorar? (opcional)"}
          className="mt-3 w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
        />
      )}
      {error && <p className="mt-2 text-center text-sm text-rose-600">{error}</p>}
      <button
        onClick={enviar}
        disabled={enviando || !estrellas}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 font-semibold text-white shadow-md shadow-orange-500/25 transition active:scale-[0.98] disabled:opacity-50"
      >
        {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Enviar calificación
      </button>
    </div>
  );
}
