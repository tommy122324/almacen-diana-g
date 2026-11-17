"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, X, ClipboardList, Search, FileText, MapPin, GripVertical, Phone, Pencil, Trash2, Check } from "lucide-react";
import { useStore, abonadoDe, saldoDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type Apartado, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisarError } from "@/lib/alerta";
import { ReciboModal } from "@/components/ReciboModal";
import { ultimoAtendio } from "@/components/CamposRecibo";
import { reciboParaApartado, errorRecibo } from "@/lib/reciboApartado";
import type { Recibo } from "@/lib/types";
import { avisar, avisarFalta, confirmarEliminar } from "@/lib/alerta";
import { exportarPedidosPDF, exportarPedidosPorLugarPDF } from "@/lib/export";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Chip, Select, inputCls } from "@/components/ui";
import { ApartadoCard, ListaPlegable, confirmarBorrarApartado } from "@/components/ApartadoCard";

const SIN = ""; // columna "Sin lugar"

/** Color cálido estable por lugar (para el punto de la columna). */
const COLORES = ["bg-orange-400", "bg-amber-400", "bg-rose-400", "bg-yellow-400", "bg-red-400", "bg-pink-400", "bg-lime-500", "bg-teal-400"];
function colorDe(l: string) {
  let h = 0;
  for (const ch of l) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

/** Columnas extra (lugares creados vacíos) guardadas solo en este dispositivo. */
function leerLugaresExtra(negocioId: string | null): string[] {
  if (!negocioId) return [];
  try {
    const v = JSON.parse(localStorage.getItem(`cb-lugares-${negocioId}`) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function guardarLugaresExtra(negocioId: string | null, lugares: string[]) {
  if (!negocioId) return;
  try {
    localStorage.setItem(`cb-lugares-${negocioId}`, JSON.stringify(lugares));
  } catch {}
}

export default function Pedidos() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const apartados = useStore((s) => s.apartados);
  const agregar = useStore((s) => s.agregarApartado);
  const miNombre = useStore((s) => s.miNombre);
  const [conRecibo, setConRecibo] = useState(false);
  const [reciboNuevo, setReciboNuevo] = useState<Recibo | null>(null);

  /** Genera el recibo del apartado/pedido recién guardado. */
  async function reciboDe(id: string | undefined) {
    const ap = id ? useStore.getState().apartados.find((a) => a.id === id) : undefined;
    if (!ap) return;
    try {
      setReciboNuevo(await reciboParaApartado(ap, ultimoAtendio() || miNombre));
    } catch (e) {
      console.error(e);
      avisarError(errorRecibo(e));
    }
  }
  const eliminar = useStore((s) => s.eliminarApartado);
  const moverPedido = useStore((s) => s.moverPedido);

  const [busqueda, setBusqueda] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [lugar, setLugar] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [abonoInicial, setAbonoInicial] = useState(0);
  const [metodoInicial, setMetodoInicial] = useState<MetodoPago>("efectivo");

  const [extras, setExtras] = useState<string[]>([]);
  const [nuevoLugar, setNuevoLugar] = useState("");
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [editandoCol, setEditandoCol] = useState<string | null>(null);
  const [nombreCol, setNombreCol] = useState("");

  useEffect(() => setExtras(leerLugaresExtra(negocioId)), [negocioId]);

  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";
  const borrar = (a: Apartado) => confirmarBorrarApartado(a, eliminar);

  const g = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, "");
    const coincide = (a: Apartado) => {
      if (!q) return true;
      const porNombre = a.cliente.toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q) || (a.lugar ?? "").toLowerCase().includes(q);
      const porTel = qDigitos.length > 0 && a.telefono.replace(/\D/g, "").includes(qDigitos);
      return porNombre || porTel;
    };
    const todos = apartados.filter((a) => a.negocioId === negocioId && a.tipo === "pedido");
    const pend = todos.filter((a) => !a.entregado);
    const visibles = pend.filter(coincide).sort((a, b) => Number(a.conseguido) - Number(b.conseguido) || a.fecha.localeCompare(b.fecha));
    // Lugares conocidos: los de todos los pedidos (para sugerir) + los creados a mano
    const conocidos = new Set<string>();
    for (const a of todos) if (a.lugar?.trim()) conocidos.add(a.lugar.trim());
    for (const e of extras) conocidos.add(e);
    const lugares = [...conocidos].sort((a, b) => a.localeCompare(b, "es"));
    // Columnas del tablero: Sin lugar + lugares con pedidos pendientes + los creados a mano
    const conPend = new Set(pend.map((a) => a.lugar?.trim() ?? "").filter(Boolean));
    const columnas = [SIN, ...lugares.filter((l) => conPend.has(l) || extras.includes(l))];
    const porColumna = new Map<string, Apartado[]>(columnas.map((c) => [c, []]));
    for (const a of visibles) porColumna.get(a.lugar?.trim() ?? SIN)?.push(a);
    return {
      todos,
      pend,
      entregados: todos.filter((a) => a.entregado && coincide(a)).sort((a, b) => b.fecha.localeCompare(a.fecha)),
      lugares,
      columnas,
      porColumna,
      porConseguir: pend.filter((a) => !a.conseguido).length,
      conseguidos: pend.filter((a) => a.conseguido).length,
      saldo: pend.reduce((s, a) => s + saldoDe(a), 0),
    };
  }, [apartados, negocioId, busqueda, extras]);

  const buscando = busqueda.trim().length > 0;
  const abierto = abiertoId ? apartados.find((a) => a.id === abiertoId) : undefined;

  async function add() {
    if (!cliente.trim()) {
      avisarFalta("Falta el nombre del cliente.");
      return;
    }
    if (!descripcion.trim()) {
      avisarFalta("Describe qué pidió el cliente.");
      return;
    }
    const nuevoId = await agregar({ tipo: "pedido", descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial, lugar });
    setDescripcion("");
    setCliente("");
    setTelefono("");
    setLugar("");
    setValorTotal(0);
    setAbonoInicial(0);
    setMetodoInicial("efectivo");
    avisar("Pedido registrado");
    if (esAdmin && conRecibo) await reciboDe(nuevoId);
  }

  function mover(id: string, destino: string) {
    const a = apartados.find((x) => x.id === id);
    if (!a || (a.lugar?.trim() ?? "") === destino) return;
    moverPedido(id, destino);
    avisar(destino ? `Movido a "${destino}"` : "Movido a Sin lugar");
  }

  function crearLugar() {
    const l = nuevoLugar.trim();
    if (!l) {
      avisarFalta("Escribe el nombre del lugar.");
      return;
    }
    if (!extras.includes(l)) {
      const v = [...extras, l];
      setExtras(v);
      guardarLugaresExtra(negocioId, v);
    }
    setNuevoLugar("");
  }

  function quitarColumna(l: string) {
    const v = extras.filter((x) => x !== l);
    setExtras(v);
    guardarLugaresExtra(negocioId, v);
  }

  /** Renombra un lugar: cambia el lugar de sus pedidos (solo ese campo). */
  function renombrarLugar(viejo: string) {
    const nuevo = nombreCol.trim();
    setEditandoCol(null);
    if (!nuevo || nuevo === viejo) return;
    for (const a of g.todos) if ((a.lugar?.trim() ?? "") === viejo) moverPedido(a.id, nuevo);
    const v = [...new Set(extras.map((x) => (x === viejo ? nuevo : x)))];
    setExtras(v);
    guardarLugaresExtra(negocioId, v);
    avisar(`Lugar renombrado a "${nuevo}"`);
  }

  /** Elimina un lugar: sus pedidos pasan a "Sin lugar" (no se borra ningún pedido). */
  async function eliminarLugar(l: string) {
    const n = g.todos.filter((a) => (a.lugar?.trim() ?? "") === l).length;
    const msg = n > 0 ? `Se quitará el lugar "${l}". Sus ${n} pedido(s) pasarán a "Sin lugar". No se borra ningún pedido.` : `Se quitará el lugar "${l}".`;
    if (!(await confirmarEliminar(msg))) return;
    for (const a of g.todos) if ((a.lugar?.trim() ?? "") === l) moverPedido(a.id, "");
    quitarColumna(l);
    avisar("Lugar eliminado");
  }

  return (
    <div className="space-y-5">
      {reciboNuevo && <ReciboModal recibo={reciboNuevo} onCerrar={() => setReciboNuevo(null)} />}
      <h1 className="text-2xl font-bold text-stone-800">Pedidos</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Por conseguir" value={g.porConseguir} tone="red" hint="Pedidos" esConteo />
        <StatCard label="Conseguidos sin entregar" value={g.conseguidos} tone="green" hint="Pedidos" esConteo />
        <StatCard label="Por cobrar (saldo)" value={g.saldo} tone="default" hint="Pedidos pendientes" />
      </div>

      {/* Sugerencias de lugares (formulario y edición) */}
      <datalist id="lugares-pedidos">
        {g.lugares.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      {/* Formulario */}
      <Card>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-stone-500">
          <ClipboardList className="h-4 w-4 text-sky-500" /> El cliente encarga algo. Describe exactamente qué quiere y dónde lo vas a conseguir. El abono es opcional.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="¿Qué pidió el cliente? (obligatorio)">
            <textarea
              className={`${inputCls} min-h-[44px] resize-y`}
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: 2 camisetas negras talla M y un jean azul talla 32"
            />
          </Field>
          <Field label="Nombre del cliente">
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ej: María Gómez" />
          </Field>
          <Field label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="Ej: 300 123 4567" />
          </Field>
          <Field label="¿Dónde se va a conseguir? (opcional)">
            <Input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej: Bodega centro, proveedor Juan…" list="lugares-pedidos" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Valor (opcional)">
            <MoneyInput value={valorTotal} onChange={setValorTotal} />
          </Field>
          <Field label="Abono (opcional)">
            <MoneyInput value={abonoInicial} onChange={setAbonoInicial} onEnter={add} />
          </Field>
          <Field label="¿Con qué paga el abono?">
            <Select value={metodoInicial} onChange={(e) => setMetodoInicial(e.target.value as MetodoPago)}>
              {METODOS.map((m) => (
                <option key={m} value={m}>{METODO_LABEL[m]}</option>
              ))}
            </Select>
          </Field>
        </div>
        {esAdmin && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-amber-100">
            <input type="checkbox" checked={conRecibo} onChange={(e) => setConRecibo(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            Generar recibo para el cliente al guardar
          </label>
        )}
        <div className="mt-4">
          <Boton onClick={add}>
            <Plus className="h-4 w-4" /> Registrar pedido
          </Boton>
        </div>
      </Card>

      {/* Buscador */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, número, pedido o lugar…"
          className={`${inputCls} pl-9 pr-9`}
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-500"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── TABLERO POR LUGAR ── */}
      <section className="min-w-0 rounded-3xl border border-amber-100 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/50 p-4 shadow-[0_8px_30px_-12px_rgba(154,52,18,0.15)] md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/25">
              <MapPin className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-extrabold tracking-tight text-stone-800">Tablero por lugar</h2>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">{g.pend.length} pendientes</span>
          </div>
          {esAdmin && g.todos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {g.pend.length > 0 && (
                <Boton onClick={() => exportarPedidosPorLugarPDF(negocio, g.pend)}>
                  <FileText className="h-4 w-4" /> PDF por lugares
                </Boton>
              )}
              <Boton variant="outline" onClick={() => exportarPedidosPDF(negocio, g.todos)}>
                <FileText className="h-4 w-4" /> PDF de todos
              </Boton>
            </div>
          )}
        </div>

        {esAdmin && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={nuevoLugar}
              onChange={(e) => setNuevoLugar(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crearLugar()}
              placeholder="Nuevo lugar (columna)…"
              className="sm:max-w-xs"
            />
            <Boton variant="outline" onClick={crearLugar}>
              <Plus className="h-4 w-4" /> Agregar lugar
            </Boton>
          </div>
        )}
        {esAdmin && <p className="mb-3 text-xs text-stone-500">Arrastra las tarjetas entre columnas (en el celular usa “Mover a”). Toca una tarjeta para ver abonos y entregar. Al entregarlo sale del tablero y pasa a “Entregados”.</p>}

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] md:overflow-visible md:px-0">
          {g.columnas.map((col) => {
            const items = g.porColumna.get(col) ?? [];
            const falta = items.filter((a) => !a.conseguido).length;
            const resaltada = sobre === col && arrastrando !== null;
            return (
              <div
                key={col || "__sin"}
                onDragOver={(e) => {
                  if (!esAdmin || !arrastrando) return;
                  e.preventDefault();
                  setSobre(col);
                }}
                onDragLeave={() => setSobre((s) => (s === col ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastrando) mover(arrastrando, col);
                  setArrastrando(null);
                  setSobre(null);
                }}
                className={`flex w-[85%] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl md:w-auto md:max-w-none border p-2.5 transition ${resaltada ? "border-orange-400 bg-orange-50 ring-4 ring-orange-100" : col ? "border-amber-100 bg-[#fffaf2]" : "border-stone-200/80 bg-stone-50/80"}`}
              >
                <div className="mb-2.5 flex items-start justify-between gap-2 px-1">
                  {editandoCol === col && col ? (
                    <div className="flex w-full items-center gap-1">
                      <input
                        autoFocus
                        value={nombreCol}
                        onChange={(e) => setNombreCol(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renombrarLugar(col);
                          if (e.key === "Escape") setEditandoCol(null);
                        }}
                        className={`${inputCls} !py-1.5`}
                      />
                      <button onClick={() => renombrarLugar(col)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" aria-label="Guardar">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditandoCol(null)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Cancelar">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${col ? colorDe(col) : "bg-stone-300"}`} />
                          <span className={`break-words text-sm font-bold leading-tight ${col ? "text-stone-800" : "text-stone-500"}`} title={col || "Sin lugar"}>{col || "Sin lugar"}</span>
                          <span className="shrink-0 rounded-full bg-white px-2 text-xs font-semibold text-stone-500 shadow-sm ring-1 ring-amber-100">{items.length}</span>
                        </div>
                        {falta > 0 && <span className="ml-[18px] mt-1 inline-block rounded-full bg-rose-50 px-2 text-[11px] font-semibold text-rose-600">{falta} por conseguir</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 self-start">
                        {esAdmin && col && (
                          <>
                            <button
                              onClick={() => {
                                setNombreCol(col);
                                setEditandoCol(col);
                              }}
                              className="rounded-lg p-1 text-stone-300 transition hover:bg-amber-100 hover:text-amber-700"
                              aria-label="Renombrar lugar"
                              title="Renombrar lugar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarLugar(col)}
                              className="rounded-lg p-1 text-stone-300 transition hover:bg-rose-50 hover:text-rose-500"
                              aria-label="Eliminar lugar"
                              title="Eliminar lugar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex min-h-[60px] flex-col gap-2">
                  {items.length === 0 && <p className="rounded-xl border-2 border-dashed border-amber-200/70 px-1 py-5 text-center text-xs text-stone-400">{esAdmin ? "Suelta aquí un pedido" : "Sin pedidos"}</p>}
                  {items.map((a) => (
                    <TarjetaPedido
                      key={a.id}
                      a={a}
                      esAdmin={esAdmin}
                      columnas={g.columnas}
                      arrastrandoEste={arrastrando === a.id}
                      onAbrir={() => setAbiertoId(a.id)}
                      onDragStart={() => setArrastrando(a.id)}
                      onDragEnd={() => {
                        setArrastrando(null);
                        setSobre(null);
                      }}
                      onMover={(destino) => mover(a.id, destino)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Entregados */}
      {g.entregados.length > 0 && (
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
          <ListaPlegable titulo="Entregados" items={g.entregados} abiertoInicial={false} forzarAbierto={buscando} onEliminar={borrar} puedeAdmin={esAdmin} />
        </section>
      )}

      {/* Detalle del pedido (abonos, conseguir, entregar, editar) */}
      {abierto && (
        <div className="cb-fondo fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center" onClick={() => setAbiertoId(null)}>
          <div className="cb-modal max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setAbiertoId(null)} className="rounded-full bg-white p-1.5 text-stone-500 shadow hover:text-rose-500" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ApartadoCard
              key={abierto.id}
              apartado={abierto}
              puedeAdmin={esAdmin}
              onEntregado={() => setAbiertoId(null)}
              onEliminar={async () => {
                await borrar(abierto);
                if (!useStore.getState().apartados.some((x) => x.id === abierto.id)) setAbiertoId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaPedido({
  a,
  esAdmin,
  columnas,
  arrastrandoEste,
  onAbrir,
  onDragStart,
  onDragEnd,
  onMover,
}: {
  a: Apartado;
  esAdmin: boolean;
  columnas: string[];
  arrastrandoEste: boolean;
  onAbrir: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMover: (destino: string) => void;
}) {
  const saldo = saldoDe(a);
  const abonado = abonadoDe(a);
  const actual = a.lugar?.trim() ?? "";
  return (
    <div
      draggable={esAdmin}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", a.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border border-l-4 bg-white p-3 shadow-[0_1px_2px_rgba(120,53,15,0.05),0_4px_12px_-6px_rgba(120,53,15,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(154,52,18,0.3)] ${arrastrandoEste ? "rotate-1 opacity-40" : ""} ${a.conseguido ? "border-amber-100 border-l-emerald-400" : "border-amber-100 border-l-orange-400"}`}
    >
      <button onClick={onAbrir} className="block w-full text-left">
        <div className="flex items-start gap-1">
          {esAdmin && <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 cursor-grab text-stone-300 transition group-hover:text-amber-500 md:block" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-stone-800">{a.cliente}</span>
              {a.conseguido ? <Chip tone="green">Conseguido</Chip> : <Chip tone="red">Por conseguir</Chip>}
            </div>
            {a.descripcion && <p className="mt-1 line-clamp-3 text-sm text-stone-600">{a.descripcion}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-stone-400">
              <span>{formatFechaCorta(a.fecha)}</span>
              {a.telefono && (
                <span className="flex items-center gap-0.5">
                  <Phone className="h-3 w-3" /> {a.telefono}
                </span>
              )}
            </div>
            {(a.valorTotal > 0 || abonado > 0) && (
              <div className="mt-1 text-xs">
                <span className="text-emerald-600">Abonado {formatCOP(abonado)}</span>
                {a.valorTotal > 0 && <span className={`ml-2 font-semibold ${saldo > 0 ? "text-rose-600" : "text-emerald-600"}`}>Saldo {formatCOP(saldo)}</span>}
              </div>
            )}
          </div>
        </div>
      </button>
      {esAdmin && (
        <Select value={actual} onChange={(e) => onMover(e.target.value)} className="mt-2.5 !border-amber-100 !bg-amber-50/60 !py-1.5 text-xs" aria-label="Mover a">
          {columnas.map((c) => (
            <option key={c || "__sin"} value={c}>
              {c === actual ? "📍 " : "Mover a: "}
              {c || "Sin lugar"}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
