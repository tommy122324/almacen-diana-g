"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Phone, ChevronDown, ChevronUp, ChevronRight, CircleDollarSign, Pencil, Check, X, Package, ClipboardList, PackageCheck, FileText, RotateCcw, MessageCircle } from "lucide-react";
import { useStore, abonadoDe, saldoDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type Apartado, type MetodoPago, type TipoApartado } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, confirmarEliminar } from "@/lib/alerta";
import { exportarPedidosPDF } from "@/lib/export";
import { abrirWhatsApp, mensajePedidoLlego } from "@/lib/whatsapp";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Chip, Select, inputCls } from "@/components/ui";

export default function Apartados() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const apartados = useStore((s) => s.apartados);
  const agregar = useStore((s) => s.agregarApartado);
  const eliminar = useStore((s) => s.eliminarApartado);

  const [tipo, setTipo] = useState<TipoApartado>("apartado");
  const [descripcion, setDescripcion] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [valorTotal, setValorTotal] = useState(0);
  const [abonoInicial, setAbonoInicial] = useState(0);
  const [metodoInicial, setMetodoInicial] = useState<MetodoPago>("efectivo");

  const esPedido = tipo === "pedido";

  async function borrarApartado(a: Apartado) {
    const que = a.tipo === "pedido" ? "el PEDIDO" : "el APARTADO";
    if (await confirmarEliminar(`Se eliminará ${que} de "${a.cliente}" y sus abonos. Esto no afecta a los demás registros.`)) {
      eliminar(a.id);
      avisar(a.tipo === "pedido" ? "Pedido eliminado" : "Apartado eliminado");
    }
  }

  const g = useMemo(() => {
    const propios = apartados
      .filter((a) => a.negocioId === negocioId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    // Un pedido se "completa" cuando se entrega; un apartado cuando se paga.
    const estaCompleto = (a: Apartado) => (a.tipo === "pedido" ? a.entregado : a.estado === "completado");
    const apart = propios.filter((a) => a.tipo === "apartado");
    const ped = propios.filter((a) => a.tipo === "pedido");
    const apartPend = apart.filter((a) => !estaCompleto(a));
    return {
      apartPend,
      apartComp: apart.filter((a) => estaCompleto(a)),
      pedPend: ped.filter((a) => !estaCompleto(a)),
      pedComp: ped.filter((a) => estaCompleto(a)),
      totValor: apartPend.reduce((s, a) => s + a.valorTotal, 0),
      totAbonado: apartPend.reduce((s, a) => s + abonadoDe(a), 0),
      totSaldo: apartPend.reduce((s, a) => s + saldoDe(a), 0),
    };
  }, [apartados, negocioId]);

  const diferenciaPreview = Math.max(0, valorTotal - abonoInicial);
  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";
  const pedidosNegocio = apartados.filter((a) => a.negocioId === negocioId && a.tipo === "pedido");

  function add() {
    const okCliente = cliente.trim();
    const okApartado = esPedido || valorTotal > 0;
    const okPedido = !esPedido || descripcion.trim();
    if (okCliente && okApartado && okPedido) {
      agregar({ tipo, descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial });
      setDescripcion("");
      setCliente("");
      setTelefono("");
      setValorTotal(0);
      setAbonoInicial(0);
      setMetodoInicial("efectivo");
      avisar(esPedido ? "Pedido registrado" : "Apartado registrado");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-800">Apartados y pedidos</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Valor apartados" value={g.totValor} tone="default" hint="Pendientes" />
        <StatCard label="Abonado" value={g.totAbonado} tone="green" />
        <StatCard label="Por cobrar (saldo)" value={g.totSaldo} tone="red" />
      </div>

      {/* Formulario */}
      <Card>
        {/* Tipo: apartado o pedido */}
        <div className="mb-4 inline-flex rounded-xl border border-stone-200 bg-white p-1">
          <button
            onClick={() => setTipo("apartado")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${!esPedido ? "bg-amber-500 text-white" : "text-stone-500 hover:bg-stone-100"}`}
          >
            <Package className="h-4 w-4" /> Apartado
          </button>
          <button
            onClick={() => setTipo("pedido")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${esPedido ? "bg-amber-500 text-white" : "text-stone-500 hover:bg-stone-100"}`}
          >
            <ClipboardList className="h-4 w-4" /> Pedido
          </button>
        </div>

        <p className="mb-3 text-xs text-stone-500">
          {esPedido
            ? "El cliente encarga algo. Describe exactamente qué quiere. El abono es opcional."
            : "El cliente deja una prenda separada y la va pagando."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={esPedido ? "¿Qué pidió el cliente? (obligatorio)" : "¿Qué prenda(s) deja?"}>
            <textarea
              className={`${inputCls} min-h-[44px] resize-y`}
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={esPedido ? "Ej: 2 camisetas negras talla M y un jean azul talla 32" : "Ej: Vestido rojo talla S"}
            />
          </Field>
          <Field label="Nombre del cliente">
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ej: María Gómez" />
          </Field>
          <Field label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="Ej: 300 123 4567" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label={esPedido ? "Valor (opcional)" : "Valor total del apartado"}>
            <MoneyInput value={valorTotal} onChange={setValorTotal} />
          </Field>
          <Field label={esPedido ? "Abono (opcional)" : "¿Cuánto abona ahora?"}>
            <MoneyInput value={abonoInicial} onChange={setAbonoInicial} onEnter={add} />
          </Field>
          <Field label="¿Con qué paga el abono?">
            <Select value={metodoInicial} onChange={(e) => setMetodoInicial(e.target.value as MetodoPago)}>
              {METODOS.map((m) => (
                <option key={m} value={m}>{METODO_LABEL[m]}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col justify-end">
            <span className="mb-1 block text-xs font-medium text-stone-500">Quedaría debiendo</span>
            <div className="rounded-xl bg-stone-100 px-3 py-2.5 text-right font-bold tabular-nums text-rose-600">
              {formatCOP(diferenciaPreview)}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Boton onClick={add}>
            <Plus className="h-4 w-4" /> {esPedido ? "Registrar pedido" : "Registrar apartado"}
          </Boton>
        </div>
      </Card>

      {/* ── SECCIÓN APARTADOS (ámbar) ── */}
      <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold text-amber-800">Apartados</h2>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">{g.apartPend.length} pendientes</span>
        </div>
        <div className="space-y-3">
          <ListaPlegable titulo="Pendientes" items={g.apartPend} abiertoInicial onEliminar={borrarApartado} />
          {g.apartComp.length > 0 && <ListaPlegable titulo="Completados" items={g.apartComp} abiertoInicial={false} onEliminar={borrarApartado} />}
        </div>
      </section>

      {/* ── SECCIÓN PEDIDOS (azul) ── */}
      <section className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-bold text-sky-800">Pedidos</h2>
            <span className="rounded-full bg-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-800">{g.pedPend.length} pendientes</span>
          </div>
          {pedidosNegocio.length > 0 && (
            <Boton variant="outline" onClick={() => exportarPedidosPDF(negocio, pedidosNegocio)}>
              <FileText className="h-4 w-4" /> PDF de pedidos
            </Boton>
          )}
        </div>
        <div className="space-y-3">
          <ListaPlegable titulo="Pendientes" items={g.pedPend} abiertoInicial onEliminar={borrarApartado} />
          {g.pedComp.length > 0 && <ListaPlegable titulo="Entregados" items={g.pedComp} abiertoInicial={false} onEliminar={borrarApartado} />}
        </div>
      </section>
    </div>
  );
}

/** Lista plegable de tarjetas (con su propio estado de abierto/cerrado). */
function ListaPlegable({
  titulo,
  items,
  abiertoInicial,
  onEliminar,
}: {
  titulo: string;
  items: Apartado[];
  abiertoInicial: boolean;
  onEliminar: (a: Apartado) => void;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
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
              <ApartadoCard key={a.id} apartado={a} onEliminar={() => onEliminar(a)} />
            ))}
          </div>
        ))}
    </div>
  );
}

function ApartadoCard({ apartado, onEliminar }: { apartado: Apartado; onEliminar: () => void }) {
  const abonar = useStore((s) => s.abonarApartado);
  const editar = useStore((s) => s.editarApartado);
  const eliminarAbono = useStore((s) => s.eliminarAbono);
  const marcarConseguido = useStore((s) => s.marcarConseguido);
  const marcarEntregado = useStore((s) => s.marcarEntregado);
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(0);
  const [metodoAbono, setMetodoAbono] = useState<MetodoPago>("efectivo");
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
    if (monto > 0) {
      abonar(apartado.id, hoyISO(), monto, metodoAbono);
      setMonto(0);
      avisar("Abono registrado");
    }
  }

  function guardarEdicion() {
    if (ed.cliente.trim()) {
      editar(apartado.id, ed);
      setEditando(false);
      avisar();
    }
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
        </div>
        <div className="mt-3 flex gap-2">
          <Boton onClick={guardarEdicion}><Check className="h-4 w-4" /> Guardar</Boton>
          <Boton variant="ghost" onClick={() => { setEd({ cliente: apartado.cliente, telefono: apartado.telefono, fecha: apartado.fecha, valorTotal: apartado.valorTotal, descripcion: apartado.descripcion }); setEditando(false); }}>
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
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onEliminar} className="text-stone-300 hover:text-rose-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Flujo del pedido: por conseguir → conseguido → entregado */}
      {esPedido && (
        <div className="mt-3">
          <PasosPedido conseguido={apartado.conseguido} entregado={apartado.entregado} />
        </div>
      )}
      {esPedido && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!apartado.conseguido && (
            <Boton onClick={() => { marcarConseguido(apartado.id, true); avisar("¡Pedido conseguido! 🎉"); }}>
              <PackageCheck className="h-4 w-4" /> Marcar conseguido
            </Boton>
          )}
          {apartado.conseguido && !apartado.entregado && (
            <>
              <Boton
                onClick={() => {
                  // Abrir WhatsApp (dentro del gesto) y marcar entregado
                  if (apartado.telefono) abrirWhatsApp(apartado.telefono, mensajePedidoLlego(apartado.descripcion));
                  marcarEntregado(apartado.id, true);
                  avisar("¡Pedido entregado! ✅");
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
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <MoneyInput value={monto} onChange={setMonto} onEnter={registrarAbono} className="flex-1" placeholder="Nuevo abono" />
          <Select value={metodoAbono} onChange={(e) => setMetodoAbono(e.target.value as MetodoPago)} className="sm:w-44">
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
                  <button onClick={() => borrarAbono(ab.id)} className="text-stone-300 hover:text-rose-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
function PasosPedido({ conseguido, entregado }: { conseguido: boolean; entregado: boolean }) {
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
