"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, X, ClipboardList, Search, FileText, MapPin, GripVertical, Phone } from "lucide-react";
import { useStore, abonadoDe, saldoDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type Apartado, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, avisarFalta } from "@/lib/alerta";
import { exportarPedidosPDF, exportarPedidosPorLugarPDF } from "@/lib/export";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Chip, Select, inputCls } from "@/components/ui";
import { ApartadoCard, ListaPlegable, confirmarBorrarApartado } from "@/components/ApartadoCard";

const SIN = ""; // columna "Sin lugar"

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

  function add() {
    if (!cliente.trim()) {
      avisarFalta("Falta el nombre del cliente.");
      return;
    }
    if (!descripcion.trim()) {
      avisarFalta("Describe qué pidió el cliente.");
      return;
    }
    agregar({ tipo: "pedido", descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial, lugar });
    setDescripcion("");
    setCliente("");
    setTelefono("");
    setLugar("");
    setValorTotal(0);
    setAbonoInicial(0);
    setMetodoInicial("efectivo");
    avisar("Pedido registrado");
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

  return (
    <div className="space-y-5">
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
      <section className="min-w-0 rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-bold text-sky-800">Tablero por lugar</h2>
            <span className="rounded-full bg-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-800">{g.pend.length} pendientes</span>
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
        {esAdmin && <p className="mb-3 text-xs text-sky-700">Arrastra las tarjetas entre columnas (en el celular usa “Mover a”). Toca una tarjeta para ver abonos y entregar.</p>}

        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
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
                className={`flex w-72 shrink-0 snap-start flex-col rounded-xl border p-2 transition ${resaltada ? "border-sky-500 bg-sky-100" : "border-stone-200 bg-stone-50"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MapPin className={`h-4 w-4 shrink-0 ${col ? "text-sky-600" : "text-stone-400"}`} />
                    <span className={`truncate text-sm font-bold ${col ? "text-stone-800" : "text-stone-500"}`}>{col || "Sin lugar"}</span>
                    <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-stone-500 ring-1 ring-stone-200">{items.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {falta > 0 && <span className="text-[11px] font-semibold text-rose-600">{falta} por conseguir</span>}
                    {esAdmin && col && items.length === 0 && extras.includes(col) && (
                      <button onClick={() => quitarColumna(col)} className="text-stone-300 hover:text-rose-500" aria-label="Quitar columna">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex min-h-[60px] flex-col gap-2">
                  {items.length === 0 && <p className="px-1 py-3 text-center text-xs text-stone-400">{esAdmin ? "Suelta aquí un pedido" : "Sin pedidos"}</p>}
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
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
          <ListaPlegable titulo="Entregados" items={g.entregados} abiertoInicial={false} forzarAbierto={buscando} onEliminar={borrar} puedeAdmin={esAdmin} />
        </section>
      )}

      {/* Detalle del pedido (abonos, conseguir, entregar, editar) */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setAbiertoId(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setAbiertoId(null)} className="rounded-full bg-white p-1.5 text-stone-500 shadow hover:text-rose-500" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ApartadoCard
              key={abierto.id}
              apartado={abierto}
              puedeAdmin={esAdmin}
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
      className={`rounded-lg border bg-white p-2.5 shadow-sm transition ${arrastrandoEste ? "opacity-40" : ""} ${a.conseguido ? "border-emerald-300" : "border-stone-200"}`}
    >
      <button onClick={onAbrir} className="block w-full text-left">
        <div className="flex items-start gap-1">
          {esAdmin && <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 cursor-grab text-stone-300 md:block" />}
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
        <Select value={actual} onChange={(e) => onMover(e.target.value)} className="mt-2 !py-1.5 text-xs" aria-label="Mover a">
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
