"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check, X, Trash2, RotateCcw, Keyboard, ReceiptText, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { METODOS, METODO_LABEL, type MetodoPago, type Recibo } from "@/lib/types";
import { interpretarDictado, mejorInterpretacion, crearReconocimiento, type ItemDictado, type TipoDictado } from "@/lib/vozRegistro";
import { avisar, avisarFalta, avisarError } from "@/lib/alerta";
import { MoneyInput } from "@/components/MoneyInput";
import { Boton, Input, Select, inputCls } from "@/components/ui";
import { crearReciboVenta, ultimoAtendio } from "@/components/CamposRecibo";
import { ReciboModal } from "@/components/ReciboModal";
import { formatCOP } from "@/lib/format";

const TIPO_LABEL: Record<TipoDictado, string> = { venta: "Venta", gasto: "Gasto", entrada: "Entrada" };
const TIPO_COLOR: Record<TipoDictado, string> = {
  venta: "border-l-emerald-400",
  gasto: "border-l-rose-400",
  entrada: "border-l-sky-400",
};
const SILENCIO_MS = 2200; // se detiene solo tras este silencio
const MAX_MS = 25000;

type Alternativas = string[];

/** Registrar por voz (o escribiendo): entiende ventas, gastos y entradas, con descripción y recibo. */
export function DictadoVoz({ fecha }: { fecha: string }) {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const miNombre = useStore((s) => s.miNombre);
  const agregarVenta = useStore((s) => s.agregarVenta);
  const agregarGasto = useStore((s) => s.agregarGasto);
  const agregarEntrada = useStore((s) => s.agregarEntrada);

  const [soportaVoz, setSoportaVoz] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState("");
  const [escribir, setEscribir] = useState(false);
  const [frase, setFrase] = useState("");
  const [items, setItems] = useState<ItemDictado[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [recibo, setRecibo] = useState<Recibo | null>(null);

  const recRef = useRef<ReturnType<typeof crearReconocimiento>>(null);
  const finalesRef = useRef<Alternativas[]>([]);
  const silencioRef = useRef<number | undefined>(undefined);
  const maxRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSoportaVoz(!!crearReconocimiento());
    return () => {
      recRef.current?.abort?.();
      window.clearTimeout(silencioRef.current);
      window.clearTimeout(maxRef.current);
    };
  }, []);

  function mostrar(alternativas: string[]) {
    const limpias = alternativas.map((a) => a.trim()).filter(Boolean);
    if (!limpias.length) return;
    const { texto: t, items: res } = mejorInterpretacion(limpias);
    setTexto(t);
    if (res.length === 0) {
      avisarFalta("No entendí el monto. Ej: “vendí una blusa en 85 mil por Nequi”.");
      setItems(null);
      return;
    }
    // Recibo solo lo maneja el administrador
    setItems(res.map((x) => ({ ...x, recibo: esAdmin && x.recibo })));
  }

  function iniciar() {
    const r = crearReconocimiento();
    if (!r) return;
    recRef.current?.abort?.();
    recRef.current = r;
    finalesRef.current = [];
    setTexto("");
    setItems(null);
    setEscribir(false);

    const reiniciarSilencio = () => {
      window.clearTimeout(silencioRef.current);
      silencioRef.current = window.setTimeout(() => r.stop(), SILENCIO_MS);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const finales: Alternativas[] = [];
      let interino = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const alts: string[] = [];
        for (let k = 0; k < res.length; k++) alts.push(String(res[k].transcript ?? "").trim());
        if (res.isFinal) {
          // Android repite resultados acumulados ("vendí", "vendí 85", "vendí 85 mil"): quedarse con el más completo
          const prev = finales[finales.length - 1];
          if (prev && alts[0].toLowerCase().startsWith(prev[0].toLowerCase())) finales[finales.length - 1] = alts;
          else finales.push(alts);
        } else interino = alts[0];
      }
      finalesRef.current = finales;
      setTexto([...finales.map((f) => f[0]), interino].join(" ").trim());
      reiniciarSilencio();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") avisarError("Permite el uso del micrófono para dictar");
      else if (e.error === "no-speech") avisarFalta("No se escuchó nada. Acércate al celular e intenta de nuevo.");
      else if (e.error === "network") avisarError("El dictado necesita internet. Puedes escribir la frase.");
      else if (e.error !== "aborted") avisarError("No se pudo escuchar. Intenta de nuevo.");
    };
    r.onend = () => {
      setEscuchando(false);
      window.clearTimeout(silencioRef.current);
      window.clearTimeout(maxRef.current);
      const finales = finalesRef.current;
      if (!finales.length) return;
      // Versión principal + variantes cambiando cada fragmento por su alternativa
      const base = finales.map((f) => f[0]);
      const candidatos = [base.join(" ")];
      finales.forEach((f, i) => f.slice(1).forEach((alt) => candidatos.push(base.map((b, k) => (k === i ? alt : b)).join(" "))));
      mostrar(candidatos);
    };
    try {
      r.start();
      setEscuchando(true);
      window.clearTimeout(silencioRef.current);
      silencioRef.current = window.setTimeout(() => r.stop(), 6000); // primer silencio más largo
      maxRef.current = window.setTimeout(() => r.stop(), MAX_MS);
    } catch {
      setEscuchando(false);
    }
  }

  function detener() {
    recRef.current?.stop?.();
  }

  function entenderTexto() {
    if (!frase.trim()) return avisarFalta("Escribe lo que vendiste o gastaste.");
    mostrar([frase]);
    if (interpretarDictado(frase).length) setFrase("");
  }

  function cambiar(i: number, p: Partial<ItemDictado>) {
    setItems((l) => (l ? l.map((x, k) => (k === i ? { ...x, ...p } : x)) : l));
  }

  async function guardar() {
    if (!items?.length || !negocioId) return;
    for (const it of items) {
      if (it.monto <= 0) return avisarFalta("Hay un registro sin monto.");
      if (it.tipo !== "venta" && !it.concepto.trim()) return avisarFalta(`Escribe el concepto del ${it.tipo}.`);
      if (it.tipo === "venta" && it.recibo && it.telefono.replace(/\D/g, "").length < 7) return avisarFalta("Escribe el WhatsApp del cliente para el recibo.");
    }
    setGuardando(true);
    let reciboCreado: Recibo | null = null;
    try {
      for (const it of items) {
        if (it.tipo === "venta") {
          const ventaId = await agregarVenta(fecha, it.metodo, it.monto);
          if (it.recibo && ventaId && !reciboCreado) {
            try {
              reciboCreado = await crearReciboVenta({
                negocioId,
                ventaId,
                fecha,
                metodo: it.metodo,
                total: it.monto,
                atendio: ultimoAtendio() || miNombre,
                datos: { telefono: it.telefono, cliente: it.cliente, detalle: it.concepto },
              });
            } catch {
              avisarError("La venta quedó guardada, pero el recibo no se pudo crear (¿sin internet?). Créalo luego en Recibos.");
            }
          }
        } else if (it.tipo === "gasto") agregarGasto(fecha, it.concepto.trim(), it.monto);
        else agregarEntrada(fecha, it.concepto.trim(), it.monto);
      }
      avisar(items.length === 1 ? `${TIPO_LABEL[items[0].tipo]} registrada` : `${items.length} registros guardados`);
      setItems(null);
      setTexto("");
      if (reciboCreado) setRecibo(reciboCreado);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white p-3 shadow-[0_8px_24px_-12px_rgba(120,53,15,0.15)]">
      {recibo && <ReciboModal recibo={recibo} onCerrar={() => setRecibo(null)} />}

      <div className="flex items-center gap-3">
        {soportaVoz && (
          <button
            onClick={escuchando ? detener : iniciar}
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 ${escuchando ? "bg-rose-500 shadow-rose-500/30" : "bg-gradient-to-br from-amber-500 to-orange-500 shadow-orange-500/30"}`}
            aria-label={escuchando ? "Terminar" : "Dictar por voz"}
          >
            {escuchando && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50" />}
            {escuchando ? <Square className="relative h-5 w-5" /> : <Mic className="h-6 w-6" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold text-stone-800">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {escuchando ? "Te escucho… habla tranquila" : "Registro rápido"}
          </div>
          <div className={`text-xs ${texto ? "text-stone-700" : "text-stone-500"} ${escuchando ? "" : "line-clamp-2"}`}>
            {texto
              ? `“${texto}”`
              : soportaVoz
                ? "Toca el micrófono y di, por ej.: “vendí una blusa negra en 85 mil por Nequi a María 300 123 4567”"
                : "Escribe, por ej.: “vendí una blusa en 85 mil por Nequi”"}
          </div>
          {escuchando && <div className="mt-0.5 text-[11px] text-rose-600">Se detiene solo cuando dejas de hablar (o toca ■).</div>}
        </div>
        <button
          onClick={() => setEscribir((v) => !v)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${escribir || !soportaVoz ? "border-amber-300 bg-amber-100 text-amber-700" : "border-amber-100 bg-white text-stone-500 hover:text-amber-700"}`}
          aria-label="Escribir la frase"
          title="Escribir en vez de hablar"
        >
          <Keyboard className="h-5 w-5" />
        </button>
      </div>

      {(escribir || !soportaVoz) && !items && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entenderTexto()}
            placeholder="Ej: vendí 2 blusas en 120 mil por Nequi"
            className={`${inputCls} flex-1`}
          />
          <Boton onClick={entenderTexto}>
            <Sparkles className="h-4 w-4" /> Entender
          </Boton>
        </div>
      )}

      {items && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Revisa antes de guardar</div>
          {items.map((it, i) => (
            <div key={i} className={`space-y-2 rounded-xl border border-l-4 border-amber-100 bg-white p-2.5 ${TIPO_COLOR[it.tipo]}`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[8rem_10rem_1fr_auto]">
                <Select value={it.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoDictado })}>
                  <option value="venta">Venta</option>
                  <option value="gasto">Gasto</option>
                  <option value="entrada">Entrada</option>
                </Select>
                <MoneyInput value={it.monto} onChange={(n) => cambiar(i, { monto: n })} />
                {it.tipo === "venta" ? (
                  <Select value={it.metodo} onChange={(e) => cambiar(i, { metodo: e.target.value as MetodoPago, metodoDicho: true })} className="col-span-1">
                    {METODOS.map((m) => (
                      <option key={m} value={m}>{METODO_LABEL[m]}</option>
                    ))}
                  </Select>
                ) : (
                  <Input value={it.concepto} onChange={(e) => cambiar(i, { concepto: e.target.value })} placeholder="Concepto (ej: almuerzo)" />
                )}
                <button onClick={() => setItems((l) => (l ? l.filter((_, k) => k !== i) : l))} className="flex items-center justify-center text-stone-300 hover:text-rose-500" aria-label="Quitar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {it.tipo === "venta" && (
                <>
                  {!it.metodoDicho && <p className="text-[11px] text-amber-700">No dijiste el método de pago: quedó en Efectivo.</p>}
                  <Input value={it.concepto} onChange={(e) => cambiar(i, { concepto: e.target.value })} placeholder="Descripción: ¿qué se vendió? (sale en el recibo)" />
                  {esAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => cambiar(i, { recibo: !it.recibo })}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${it.recibo ? "border-emerald-300 bg-emerald-50" : "border-amber-100 bg-amber-50/50"}`}
                      >
                        <ReceiptText className={`h-4 w-4 ${it.recibo ? "text-emerald-600" : "text-amber-600"}`} />
                        <span className="flex-1 font-semibold text-stone-700">Enviar recibo al cliente</span>
                        <span className={`relative h-5 w-9 rounded-full transition ${it.recibo ? "bg-emerald-500" : "bg-stone-300"}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${it.recibo ? "left-[18px]" : "left-0.5"}`} />
                        </span>
                      </button>
                      {it.recibo && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input value={it.telefono} onChange={(e) => cambiar(i, { telefono: e.target.value })} inputMode="tel" placeholder="WhatsApp del cliente" />
                          <Input value={it.cliente} onChange={(e) => cambiar(i, { cliente: e.target.value })} placeholder="Nombre del cliente (opcional)" />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
          {items.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Boton onClick={guardar} disabled={guardando}>
                <Check className="h-4 w-4" /> Guardar {items.length > 1 ? `${items.length} registros` : ""} ({formatCOP(items.reduce((s, x) => s + x.monto, 0))})
              </Boton>
              {soportaVoz && (
                <Boton variant="outline" onClick={iniciar}>
                  <RotateCcw className="h-4 w-4" /> Repetir
                </Boton>
              )}
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
