"use client";
import { useState } from "react";
import { Trash2, Phone, ChevronDown, ChevronUp, ChevronRight, CircleDollarSign, Pencil, Check, X, Package, ClipboardList, PackageCheck, RotateCcw, MessageCircle, MapPin } from "lucide-react";
import { useStore, abonadoDe, saldoDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type Apartado, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, confirmarEliminar, avisarFalta, confirmar } from "@/lib/alerta";
import { abrirWhatsApp, mensajePedidoLlego } from "@/lib/whatsapp";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, Input, Field, Chip, Select, inputCls } from "@/components/ui";

/** Confirma y elimina un apartado o pedido (con sus abonos). */
export async function confirmarBorrarApartado(a: Apartado, eliminar: (id: string) => void) {
  const que = a.tipo === "pedido" ? "el PEDIDO" : "el APARTADO";
  if (await confirmarEliminar(`Se eliminará ${que} de "${a.cliente}" y sus abonos. Esto no afecta a los demás registros.`)) {
    eliminar(a.id);
    avisar(a.tipo === "pedido" ? "Pedido eliminado" : "Apartado eliminado");
  }
}

/** Lista plegable de tarjetas (con su propio estado de abierto/cerrado). */
export function ListaPlegable({
  titulo,
  items,
  abiertoInicial,
  forzarAbierto,
  onEliminar,
  puedeAdmin,
}: {
  titulo: string;
  items: Apartado[];
  abiertoInicial: boolean;
  forzarAbierto?: boolean;
  onEliminar: (a: Apartado) => void;
  puedeAdmin: boolean;
}) {
  const [abiertoLocal, setAbierto] = useState(abiertoInicial);
  const abierto = forzarAbierto || abiertoLocal;
  return (
    <div>
      <button onClick={() => setAbierto((v) => !v)} className="mb-2 flex w-full items-center gap-2 text-sm font-semibold text-stone-700">
        {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {titulo} ({items.length})
      </button>
      {abierto &&
        (items.length === 0 ? (
          <p className="px-1 pb-1 text-sm text-stone-400">Nada por aquí. 🎉</p>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <ApartadoCard key={a.id} apartado={a} onEliminar={() => onEliminar(a)} puedeAdmin={puedeAdmin} />
            ))}
          </div>
        ))}
    </div>
  );
}

export function ApartadoCard({ apartado, onEliminar, puedeAdmin, onEntregado }: { apartado: Apartado; onEliminar: () => void; puedeAdmin: boolean; onEntregado?: () => void }) {
  const abonar = useStore((s) => s.abonarApartado);
  const editar = useStore((s) => s.editarApartado);
  const eliminarAbono = useStore((s) => s.eliminarAbono);
  const marcarConseguido = useStore((s) => s.marcarConseguido);
  const marcarEntregado = useStore((s) => s.marcarEntregado);
  const moverPedido = useStore((s) => s.moverPedido);
  const [lugarEd, setLugarEd] = useState(apartado.lugar ?? "");
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(0);
  const [metodoAbono, setMetodoAbono] = useState<MetodoPago>("efectivo");
  const [fechaAbono, setFechaAbono] = useState(hoyISO());
  const [editando, setEditando] = useState(false);
  const [ed, setEd] = useState({
    cliente: apartado.cliente,
    telefono: apartado.telefono,
    fecha: apartado.fecha,
    valorTotal: apartado.valorTotal,
    descripcion: apartado.descripcion,
  });

  const abonado = abonadoDe(apartado);
  const saldo = saldoDe(apartado);
  const conValor = apartado.valorTotal > 0;
  const progreso = conValor ? Math.min(100, (abonado / apartado.valorTotal) * 100) : 0;
  const completado = apartado.estado === "completado";
  const esPedido = apartado.tipo === "pedido";

  function registrarAbono() {
    if (monto <= 0) {
      avisarFalta("Escribe el monto del abono.");
      return;
    }
    abonar(apartado.id, fechaAbono || hoyISO(), monto, metodoAbono);
    setMonto(0);
    setFechaAbono(hoyISO());
    avisar("Abono registrado");
  }

  function guardarEdicion() {
    if (!ed.cliente.trim()) {
      avisarFalta("Falta el nombre del cliente.");
      return;
    }
    editar(apartado.id, ed);
    if (esPedido && lugarEd.trim() !== (apartado.lugar ?? "")) moverPedido(apartado.id, lugarEd.trim());
    setEditando(false);
    avisar();
  }

  async function borrarAbono(abonoId: string) {
    if (await confirmarEliminar("Se eliminará este abono.")) {
      eliminarAbono(apartado.id, abonoId);
      avisar("Abono eliminado");
    }
  }

  if (editando) {
    return (
      <Card className="border-amber-300">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={esPedido ? "¿Qué pidió el cliente?" : "¿Qué prenda(s) deja?"}>
            <textarea className={`${inputCls} min-h-[44px] resize-y`} rows={2} value={ed.descripcion} onChange={(e) => setEd({ ...ed, descripcion: e.target.value })} />
          </Field>
          <Field label="Nombre del cliente">
            <Input value={ed.cliente} onChange={(e) => setEd({ ...ed, cliente: e.target.value })} />
          </Field>
          <Field label="Teléfono">
            <Input value={ed.telefono} onChange={(e) => setEd({ ...ed, telefono: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={ed.fecha} onChange={(e) => setEd({ ...ed, fecha: e.target.value })} />
          </Field>
          <Field label={esPedido ? "Valor (opcional)" : "Valor total"}>
            <MoneyInput value={ed.valorTotal} onChange={(n) => setEd({ ...ed, valorTotal: n })} />
          </Field>
          {esPedido && (
            <Field label="¿Dónde se consigue?">
              <Input value={lugarEd} onChange={(e) => setLugarEd(e.target.value)} placeholder="Ej: Bodega centro" list="lugares-pedidos" />
            </Field>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Boton onClick={guardarEdicion}><Check className="h-4 w-4" /> Guardar</Boton>
          <Boton variant="ghost" onClick={() => { setEd({ cliente: apartado.cliente, telefono: apartado.telefono, fecha: apartado.fecha, valorTotal: apartado.valorTotal, descripcion: apartado.descripcion }); setLugarEd(apartado.lugar ?? ""); setEditando(false); }}>
            <X className="h-4 w-4" /> Cancelar
          </Boton>
        </div>
      </Card>
    );
  }

  return (
    <Card className={completado ? "opacity-80" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-800">{apartado.cliente}</span>
            {esPedido ? <Chip tone="stone">Pedido</Chip> : <Chip tone="stone">Apartado</Chip>}
            {esPedido &&
              (apartado.entregado ? (
                <Chip tone="green">Entregado</Chip>
              ) : apartado.conseguido ? (
                <Chip tone="amber">Conseguido</Chip>
              ) : (
                <Chip tone="red">Por conseguir</Chip>
              ))}
            {conValor && (completado ? <Chip tone="green">Pagado</Chip> : <Chip tone="amber">Pendiente pago</Chip>)}
          </div>
          {apartado.descripcion && (
            <div className="mt-1 flex items-start gap-1.5 text-sm text-stone-600">
              {esPedido ? <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
              <span>{apartado.descripcion}</span>
            </div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500">
            {apartado.telefono && (
              <a href={`tel:${apartado.telefono}`} className="flex items-center gap-1 hover:text-amber-700">
                <Phone className="h-3 w-3" /> {apartado.telefono}
              </a>
            )}
            <span>{formatFechaCorta(apartado.fecha)}</span>
            {esPedido && apartado.lugar && (
              <span className="flex items-center gap-1 font-medium text-sky-700">
                <MapPin className="h-3 w-3" /> {apartado.lugar}
              </span>
            )}
          </div>
        </div>
        {puedeAdmin && (
          <div className="flex gap-1">
            <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onEliminar} className="text-stone-300 hover:text-rose-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Flujo del pedido: por conseguir → conseguido → entregado */}
      {esPedido && (
        <div className="mt-3">
          <PasosPedido conseguido={apartado.conseguido} entregado={apartado.entregado} />
        </div>
      )}
      {esPedido && puedeAdmin && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!apartado.conseguido && (
            <Boton onClick={() => { marcarConseguido(apartado.id, true); avisar("¡Pedido conseguido! 🎉"); }}>
              <PackageCheck className="h-4 w-4" /> Marcar conseguido
            </Boton>
          )}
          {apartado.conseguido && !apartado.entregado && (
            <>
              <Boton
                onClick={async () => {
                  // Confirmación de seguridad para evitar entregas por error
                  const ok = await confirmar(
                    "¿Marcar como ENTREGADO?",
                    `El pedido de ${apartado.cliente} saldrá del tablero y pasará a "Entregados".${apartado.telefono ? " Se abrirá WhatsApp para avisarle." : ""}`,
                    "Sí, entregar",
                  );
                  if (!ok) return;
                  // Abrir WhatsApp (el clic en "Sí" cuenta como gesto) y marcar entregado
                  if (apartado.telefono) abrirWhatsApp(apartado.telefono, mensajePedidoLlego(apartado.descripcion));
                  marcarEntregado(apartado.id, true);
                  avisar("¡Pedido entregado! ✅");
                  onEntregado?.();
                }}
              >
                <Check className="h-4 w-4" /> Entregar + avisar por WhatsApp
              </Boton>
              <Boton variant="ghost" onClick={() => { marcarConseguido(apartado.id, false); avisar("Marcado por conseguir"); }}>
                <RotateCcw className="h-4 w-4" /> Volver a por conseguir
              </Boton>
            </>
          )}
          {apartado.entregado && (
            <>
              {apartado.telefono && (
                <Boton variant="outline" onClick={() => abrirWhatsApp(apartado.telefono, mensajePedidoLlego(apartado.descripcion))}>
                  <MessageCircle className="h-4 w-4" /> Reenviar WhatsApp
                </Boton>
              )}
              <Boton variant="ghost" onClick={() => { marcarEntregado(apartado.id, false); avisar("Reabierto"); }}>
                <RotateCcw className="h-4 w-4" /> Reabrir
              </Boton>
            </>
          )}
        </div>
      )}

      {/* Progreso (solo si tiene valor) */}
      {conValor ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-stone-500">Abonado <span className="font-semibold text-emerald-600">{formatCOP(abonado)}</span></span>
            <span className="text-stone-500">de {formatCOP(apartado.valorTotal)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
            <div className={`h-full rounded-full transition-all ${completado ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${progreso}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-sm">
            <span className="text-stone-400">{progreso.toFixed(0)}%</span>
            <span className="font-semibold">
              Saldo: <span className={saldo > 0 ? "text-rose-600" : "text-emerald-600"}>{formatCOP(saldo)}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span className="text-stone-500">Abonado</span>
          <span className="font-semibold text-emerald-600">{formatCOP(abonado)}</span>
        </div>
      )}

      {/* Acciones */}
      {!completado && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <MoneyInput value={monto} onChange={setMonto} onEnter={registrarAbono} className="flex-1 sm:min-w-[120px]" placeholder="Nuevo abono" />
          <Input type="date" value={fechaAbono} onChange={(e) => setFechaAbono(e.target.value)} className="w-auto" title="Fecha del abono" />
          <Select value={metodoAbono} onChange={(e) => setMetodoAbono(e.target.value as MetodoPago)} className="sm:w-40">
            {METODOS.map((m) => (
              <option key={m} value={m}>{METODO_LABEL[m]}</option>
            ))}
          </Select>
          <Boton onClick={registrarAbono}>
            <CircleDollarSign className="h-4 w-4" /> Abonar
          </Boton>
        </div>
      )}

      {/* Historial de abonos */}
      {apartado.abonos.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-2">
          <button onClick={() => setAbierto((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-amber-700">
            {abierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {apartado.abonos.length} abono(s)
          </button>
          {abierto && (
            <div className="mt-2 space-y-1">
              {apartado.abonos.map((ab) => (
                <div key={ab.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-stone-50">
                  <span className="text-stone-400">{formatFechaCorta(ab.fecha)}</span>
                  <span className="text-stone-500">{METODO_LABEL[ab.metodo ?? "efectivo"]}</span>
                  <span className="flex-1 text-right font-medium tabular-nums text-emerald-600">{formatCOP(ab.monto)}</span>
                  {puedeAdmin && (
                    <button onClick={() => borrarAbono(ab.id)} className="text-stone-300 hover:text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Indicador de pasos del pedido: Pedido → Conseguido → Entregado. */
export function PasosPedido({ conseguido, entregado }: { conseguido: boolean; entregado: boolean }) {
  const pasos = [
    { label: "Pedido", ok: true },
    { label: "Conseguido", ok: conseguido },
    { label: "Entregado", ok: entregado },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
      {pasos.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${p.ok ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-500"}`}>
            {p.ok ? "✓" : i + 1}
          </span>
          <span className={p.ok ? "font-semibold text-emerald-700" : "text-stone-400"}>{p.label}</span>
          {i < pasos.length - 1 && <span className="mx-1 h-px w-4 bg-stone-300" />}
        </span>
      ))}
    </div>
  );
}
