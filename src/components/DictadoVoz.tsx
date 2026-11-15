"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check, X, Trash2, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { METODOS, METODO_LABEL, type MetodoPago } from "@/lib/types";
import { interpretarDictado, crearReconocimiento, type ItemDictado, type TipoDictado } from "@/lib/vozRegistro";
import { avisar, avisarFalta, avisarError } from "@/lib/alerta";
import { MoneyInput } from "@/components/MoneyInput";
import { Boton, Input, Select } from "@/components/ui";
import { formatCOP } from "@/lib/format";

const TIPO_LABEL: Record<TipoDictado, string> = { venta: "Venta", gasto: "Gasto", entrada: "Entrada" };
const TIPO_COLOR: Record<TipoDictado, string> = {
  venta: "border-l-emerald-400",
  gasto: "border-l-rose-400",
  entrada: "border-l-sky-400",
};

/** Botón de micrófono: dicta ventas/gastos/entradas y se confirman antes de guardar. */
export function DictadoVoz({ fecha }: { fecha: string }) {
  const agregarVenta = useStore((s) => s.agregarVenta);
  const agregarGasto = useStore((s) => s.agregarGasto);
  const agregarEntrada = useStore((s) => s.agregarEntrada);

  const [soportado, setSoportado] = useState(true);
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<ItemDictado[] | null>(null);
  const recRef = useRef<ReturnType<typeof crearReconocimiento>>(null);
  const finalRef = useRef("");

  useEffect(() => {
    setSoportado(!!crearReconocimiento());
    return () => recRef.current?.abort?.();
  }, []);

  function iniciar() {
    const r = crearReconocimiento();
    if (!r) {
      setSoportado(false);
      return;
    }
    recRef.current = r;
    finalRef.current = "";
    setTexto("");
    setItems(null);
    r.onresult = (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript + " ";
        else interino += res[0].transcript;
      }
      setTexto((finalRef.current + interino).trim());
    };
    r.onerror = (e: { error: string }) => {
      setEscuchando(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") avisarError("Permite el uso del micrófono para dictar");
      else if (e.error === "no-speech") avisarFalta("No se escuchó nada. Intenta de nuevo.");
      else if (e.error !== "aborted") avisarError("No se pudo escuchar. Intenta de nuevo.");
    };
    r.onend = () => {
      setEscuchando(false);
      const dicho = finalRef.current.trim();
      if (!dicho) return;
      setTexto(dicho);
      const res = interpretarDictado(dicho);
      if (res.length === 0) {
        avisarFalta("No entendí el monto. Ej: “vendí 85 mil en Nequi”.");
        return;
      }
      setItems(res);
    };
    try {
      r.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  }

  function detener() {
    recRef.current?.stop?.();
  }

  function cambiar(i: number, p: Partial<ItemDictado>) {
    setItems((l) => (l ? l.map((x, k) => (k === i ? { ...x, ...p } : x)) : l));
  }

  function guardar() {
    if (!items?.length) return;
    for (const it of items) {
      if (it.monto <= 0) return avisarFalta("Hay un registro sin monto.");
      if (it.tipo !== "venta" && !it.concepto.trim()) return avisarFalta(`Escribe el concepto del ${it.tipo}.`);
    }
    for (const it of items) {
      if (it.tipo === "venta") agregarVenta(fecha, it.metodo, it.monto);
      else if (it.tipo === "gasto") agregarGasto(fecha, it.concepto.trim(), it.monto);
      else agregarEntrada(fecha, it.concepto.trim(), it.monto);
    }
    avisar(items.length === 1 ? `${TIPO_LABEL[items[0].tipo]} registrada por voz` : `${items.length} registros guardados`);
    setItems(null);
    setTexto("");
  }

  if (!soportado) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white p-3 shadow-[0_8px_24px_-12px_rgba(120,53,15,0.15)]">
      <div className="flex items-center gap-3">
        <button
          onClick={escuchando ? detener : iniciar}
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 ${escuchando ? "bg-rose-500 shadow-rose-500/30" : "bg-gradient-to-br from-amber-500 to-orange-500 shadow-orange-500/30"}`}
          aria-label={escuchando ? "Detener" : "Dictar por voz"}
        >
          {escuchando && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50" />}
          {escuchando ? <Square className="relative h-5 w-5" /> : <Mic className="h-6 w-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-stone-800">{escuchando ? "Escuchando… habla ahora" : "Registrar por voz"}</div>
          <div className="truncate text-xs text-stone-500">
            {texto ? `“${texto}”` : "Ej: “vendí 85 mil en Nequi y 30 mil en efectivo” · “gasto de 20 mil en almuerzo”"}
          </div>
        </div>
      </div>

      {items && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Revisa antes de guardar</div>
          {items.map((it, i) => (
            <div key={i} className={`flex flex-col gap-2 rounded-xl border border-l-4 border-amber-100 bg-white p-2.5 sm:flex-row sm:items-center ${TIPO_COLOR[it.tipo]}`}>
              <Select value={it.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoDictado })} className="sm:w-32">
                <option value="venta">Venta</option>
                <option value="gasto">Gasto</option>
                <option value="entrada">Entrada</option>
              </Select>
              <MoneyInput value={it.monto} onChange={(n) => cambiar(i, { monto: n })} className="sm:w-40" />
              {it.tipo === "venta" ? (
                <Select value={it.metodo} onChange={(e) => cambiar(i, { metodo: e.target.value as MetodoPago, metodoDicho: true })} className="sm:w-44">
                  {METODOS.map((m) => (
                    <option key={m} value={m}>{METODO_LABEL[m]}</option>
                  ))}
                </Select>
              ) : (
                <Input value={it.concepto} onChange={(e) => cambiar(i, { concepto: e.target.value })} placeholder="Concepto (ej: almuerzo)" className="flex-1" />
              )}
              {it.tipo === "venta" && !it.metodoDicho && <span className="text-[11px] text-amber-700">No dijiste el método: quedó en Efectivo</span>}
              <button onClick={() => setItems((l) => (l ? l.filter((_, k) => k !== i) : l))} className="self-end text-stone-300 hover:text-rose-500 sm:self-auto" aria-label="Quitar">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {items.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Boton onClick={guardar}>
                <Check className="h-4 w-4" /> Guardar {items.length > 1 ? `${items.length} registros` : ""} ({formatCOP(items.reduce((s, x) => s + x.monto, 0))})
              </Boton>
              <Boton variant="outline" onClick={iniciar}>
                <RotateCcw className="h-4 w-4" /> Repetir
              </Boton>
              <Boton variant="ghost" onClick={() => { setItems(null); setTexto(""); }}>
                <X className="h-4 w-4" /> Cancelar
              </Boton>
            </div>
          ) : (
            <Boton variant="ghost" onClick={() => setItems(null)}>
              <X className="h-4 w-4" /> Cerrar
            </Boton>
          )}
        </div>
      )}
    </div>
  );
}
