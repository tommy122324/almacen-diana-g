"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReceiptText, Search, X, Plus, ChevronDown, ChevronRight, Send, AlertTriangle, Trash2, Check, FileText, Phone, Loader2, Star, Trophy, Pencil } from "lucide-react";
import Link from "next/link";
import { suscribirRecibos } from "@/lib/realtime";
import { useStore } from "@/lib/store";
import * as db from "@/lib/db";
import { METODOS, METODO_LABEL, type MetodoPago, type Recibo } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, avisarError, avisarFalta, confirmarEliminar } from "@/lib/alerta";
import { numeroRecibo } from "@/lib/recibo";
import { exportarRecibosPDF } from "@/lib/export";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Chip, Select, inputCls } from "@/components/ui";
import { CamposRecibo, crearReciboVenta, reciboVacio, type DatosRecibo } from "@/components/CamposRecibo";
import { ReciboModal } from "@/components/ReciboModal";

const inicioMes = () => `${hoyISO().slice(0, 8)}01`;

export default function Recibos() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const miNombre = useStore((s) => s.miNombre);
  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";

  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [busqueda, setBusqueda] = useState("");
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [abierto, setAbierto] = useState<Recibo | null>(null);

  // Formulario de recibo manual
  const [formAbierto, setFormAbierto] = useState(false);
  const [datos, setDatos] = useState<DatosRecibo>(reciboVacio);
  const [total, setTotal] = useState(0);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [fecha, setFecha] = useState(hoyISO());
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    setCargando(true);
    try {
      setRecibos(await db.listarRecibos(negocioId, desde, hasta));
      setErrorCarga(false);
    } catch (e) {
      console.error(e);
      setErrorCarga(true);
    } finally {
      setCargando(false);
    }
  }, [negocioId, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Tiempo real: cuando un cliente califica o se edita un recibo en otro dispositivo
  useEffect(() => {
    if (!negocioId || !esAdmin) return;
    return suscribirRecibos(negocioId, () => cargar());
  }, [negocioId, esAdmin, cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return recibos;
    const dig = q.replace(/\D/g, "");
    return recibos.filter(
      (r) =>
        r.cliente.toLowerCase().includes(q) ||
        r.detalle.toLowerCase().includes(q) ||
        (dig && (r.telefono.replace(/\D/g, "").includes(dig) || numeroRecibo(r.numero).includes(dig) || String(r.numero) === dig)),
    );
  }, [recibos, busqueda]);

  const totalRango = filtrados.reduce((s, r) => s + r.total, 0);
  const reclamos = filtrados.filter((r) => r.reclamo).length;
  const calificados = filtrados.filter((r) => r.calificacion);
  const promedio = calificados.length ? calificados.reduce((s, r) => s + (r.calificacion ?? 0), 0) / calificados.length : 0;
  // Ranking por quién atendió
  const ranking = useMemo(() => {
    const m = new Map<string, { suma: number; n: number; recibos: number }>();
    for (const r of filtrados) {
      const k = r.atendio.trim() || "Sin nombre";
      const x = m.get(k) ?? { suma: 0, n: 0, recibos: 0 };
      x.recibos++;
      if (r.calificacion) {
        x.suma += r.calificacion;
        x.n++;
      }
      m.set(k, x);
    }
    return [...m.entries()]
      .map(([nombre, x]) => ({ nombre, promedio: x.n ? x.suma / x.n : 0, calificaciones: x.n, recibos: x.recibos }))
      .sort((a, b) => b.promedio - a.promedio || b.calificaciones - a.calificaciones);
  }, [filtrados]);

  async function crearManual() {
    if (!negocioId) return;
    if (datos.telefono.replace(/\D/g, "").length < 7) {
      avisarFalta("Escribe el WhatsApp del cliente.");
      return;
    }
    if (total <= 0) {
      avisarFalta("Escribe el total de la compra.");
      return;
    }
    setCreando(true);
    try {
      const r = await crearReciboVenta({ negocioId, ventaId: null, fecha, metodo, total, atendio: miNombre, datos });
      setRecibos((l) => (r.fecha >= desde && r.fecha <= hasta ? [r, ...l] : l));
      setDatos(reciboVacio);
      setTotal(0);
      setMetodo("efectivo");
      setFormAbierto(false);
      setAbierto(r);
      avisar(`Recibo N° ${numeroRecibo(r.numero)} creado`);
    } catch (e) {
      console.error(e);
      avisarError("No se pudo crear el recibo. Revisa tu conexión a internet.");
    } finally {
      setCreando(false);
    }
  }

  function actualizarLocal(r: Recibo) {
    setRecibos((l) => l.map((x) => (x.id === r.id ? r : x)));
  }

  async function borrar(r: Recibo) {
    if (!(await confirmarEliminar(`Se eliminará el recibo N° ${numeroRecibo(r.numero)}. La venta NO se borra.`))) return;
    try {
      await db.eliminarRecibo(r.id);
      setRecibos((l) => l.filter((x) => x.id !== r.id));
      avisar("Recibo eliminado");
    } catch {
      avisarError("No se pudo eliminar. Revisa tu conexión.");
    }
  }

  if (!esAdmin) {
    return (
      <Card>
        <p className="text-sm text-stone-500">Solo el administrador puede ver los recibos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {abierto && <ReciboModal recibo={abierto} onCerrar={() => setAbierto(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-stone-800">Recibos</h1>
        {filtrados.length > 0 && (
          <Boton variant="outline" onClick={() => exportarRecibosPDF(negocio, filtrados, desde, hasta)}>
            <FileText className="h-4 w-4" /> PDF del rango
          </Boton>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Recibos" value={filtrados.length} esConteo hint="En el rango" />
        <StatCard label="Total con recibo" value={totalRango} tone="green" />
        <Link href="/calificaciones" className="block rounded-2xl transition hover:-translate-y-0.5">
        <Card className="relative h-full overflow-hidden p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Calificación</div>
          <div className="mt-1 flex items-center gap-1.5 text-2xl font-bold text-amber-600">
            {promedio ? promedio.toFixed(1).replace(".", ",") : "—"} <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </div>
          <div className="mt-0.5 text-xs text-stone-400">{calificados.length} calificación(es) · <span className="font-semibold text-amber-700">Ver todas →</span></div>
        </Card>
        </Link>
        <StatCard label="Reclamos / cambios" value={reclamos} tone={reclamos ? "red" : "default"} esConteo />
      </div>

      {calificados.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <Trophy className="h-4 w-4 text-amber-600" /> ¿Quién atiende mejor?
          </div>
          <div className="space-y-2">
            {ranking.map((x, i) => (
              <div key={x.nombre} className="flex items-center gap-3 rounded-xl bg-[#fffaf2] px-3 py-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 && x.calificaciones ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" : "bg-white text-stone-500 ring-1 ring-amber-100"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-stone-800">{x.nombre}</span>
                <span className="text-xs text-stone-500">{x.recibos} venta(s) · {x.calificaciones} calif.</span>
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  {x.calificaciones ? x.promedio.toFixed(1).replace(".", ",") : "—"} <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recibo manual */}
      <Card>
        <button onClick={() => setFormAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left">
          {formAbierto ? <ChevronDown className="h-4 w-4 text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-500" />}
          <Plus className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-stone-800">Crear recibo de una venta ya registrada</span>
        </button>
        {formAbierto && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-stone-500">
              Solo crea el recibo; <b>no</b> registra una venta nueva. Para ventas nuevas, activa “Enviar recibo” en Registro del día.
            </p>
            <CamposRecibo datos={datos} onChange={setDatos} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Total">
                <MoneyInput value={total} onChange={setTotal} />
              </Field>
              <Field label="Método de pago">
                <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                  {METODOS.map((m) => (
                    <option key={m} value={m}>{METODO_LABEL[m]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha de la compra">
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Field>
            </div>
            <Boton onClick={crearManual} disabled={creando}>
              {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />} Crear recibo
            </Boton>
          </div>
        )}
      </Card>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por N° de recibo, nombre, celular o prenda…" className={`${inputCls} pl-9 pr-9`} />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-500" aria-label="Limpiar búsqueda">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="sm:w-40" title="Desde" />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="sm:w-40" title="Hasta" />
        </div>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center py-10 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : errorCarga ? (
        <Card>
          <p className="text-sm text-rose-600">No se pudieron cargar los recibos. Revisa tu conexión a internet e inténtalo de nuevo.</p>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-stone-400">No hay recibos en este rango. 🧾</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((r) => (
            <FilaRecibo key={r.id} r={r} onVer={() => setAbierto(r)} onBorrar={() => borrar(r)} onActualizado={actualizarLocal} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaRecibo({ r, onVer, onBorrar, onActualizado }: { r: Recibo; onVer: () => void; onBorrar: () => void; onActualizado: (r: Recibo) => void }) {
  const [editReclamo, setEditReclamo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState(r.reclamo ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardarReclamo(valor: string | null) {
    setGuardando(true);
    try {
      await db.marcarReclamoRecibo(r.id, valor);
      onActualizado({ ...r, reclamo: valor, reclamoEn: valor ? new Date().toISOString() : null });
      setEditReclamo(false);
      avisar(valor ? "Reclamo registrado" : "Reclamo cerrado");
    } catch {
      avisarError("No se pudo guardar. Revisa tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className={`p-4 ${r.reclamo ? "!border-rose-200" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-orange-700">
          <span className="text-[10px] font-semibold uppercase">N°</span>
          <span className="text-sm font-extrabold leading-none">{numeroRecibo(r.numero)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-800">{r.cliente || "Cliente"}</span>
            <Chip tone="stone">{METODO_LABEL[r.metodo] ?? r.metodo}</Chip>
            {r.reclamo && <Chip tone="red">Reclamo</Chip>}
            {r.calificacion ? (
              <span className="flex items-center gap-0.5" title={`${r.calificacion} de 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= (r.calificacion ?? 0) ? "fill-amber-400 text-amber-400" : "text-stone-200"}`} />
                ))}
              </span>
            ) : (
              <span className="text-[11px] text-stone-400">Sin calificar</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-stone-500">
            <span>{formatFechaCorta(r.fecha)}</span>
            {r.telefono && (
              <a href={`tel:${r.telefono}`} className="flex items-center gap-1 hover:text-amber-700">
                <Phone className="h-3 w-3" /> {r.telefono}
              </a>
            )}
            {r.atendio && <span>Atendió: {r.atendio}</span>}
          </div>
          {r.detalle && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{r.detalle}</p>}
          {r.comentario && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs italic text-stone-600">“{r.comentario}”</p>}
        </div>
        <div className="shrink-0 text-right font-bold tabular-nums text-stone-800">{formatCOP(r.total)}</div>
      </div>

      {r.reclamo && !editReclamo && (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Reclamo / cambio {r.reclamoEn ? `· ${formatFechaCorta(r.reclamoEn.slice(0, 10))}` : ""}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap">{r.reclamo}</p>
        </div>
      )}

      {editReclamo && (
        <div className="mt-3 space-y-2">
          <textarea
            autoFocus
            className={`${inputCls} min-h-[60px] resize-y`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: Cambió la blusa talla M por talla L el 18/11"
          />
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => (nota.trim() ? guardarReclamo(nota.trim()) : avisarFalta("Describe el reclamo o cambio."))} disabled={guardando}>
              <Check className="h-4 w-4" /> Guardar
            </Boton>
            {r.reclamo && (
              <Boton variant="outline" onClick={() => guardarReclamo(null)} disabled={guardando}>
                Cerrar reclamo
              </Boton>
            )}
            <Boton variant="ghost" onClick={() => { setNota(r.reclamo ?? ""); setEditReclamo(false); }}>
              <X className="h-4 w-4" /> Cancelar
            </Boton>
          </div>
        </div>
      )}

      {editando && (
        <EditarRecibo
          r={r}
          onCerrar={() => setEditando(false)}
          onGuardado={(nuevo) => {
            onActualizado(nuevo);
            setEditando(false);
          }}
        />
      )}

      {!editReclamo && !editando && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Boton onClick={onVer}>
            <Send className="h-4 w-4" /> Ver / enviar
          </Boton>
          <Boton variant="outline" onClick={() => setEditReclamo(true)}>
            <AlertTriangle className="h-4 w-4" /> {r.reclamo ? "Editar reclamo" : "Reclamo / cambio"}
          </Boton>
          <Boton variant="outline" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Boton>
          <Boton variant="ghost" onClick={onBorrar} className="ml-auto !text-stone-400 hover:!text-rose-500">
            <Trash2 className="h-4 w-4" />
          </Boton>
        </div>
      )}
    </Card>
  );
}

function EditarRecibo({ r, onCerrar, onGuardado }: { r: Recibo; onCerrar: () => void; onGuardado: (r: Recibo) => void }) {
  const [f, setF] = useState({ fecha: r.fecha, cliente: r.cliente, telefono: r.telefono, detalle: r.detalle, metodo: r.metodo, total: r.total, atendio: r.atendio });
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    if (!f.total) return avisarFalta("Escribe el total del recibo.");
    setGuardando(true);
    try {
      const datos = { ...f, cliente: f.cliente.trim(), telefono: f.telefono.replace(/[^\d+]/g, ""), detalle: f.detalle.trim(), atendio: f.atendio.trim() };
      await db.editarRecibo(r.id, datos);
      onGuardado({ ...r, ...datos });
      avisar("Recibo actualizado");
    } catch (e) {
      console.error(e);
      avisarError("No se pudo guardar. Revisa tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-[#fffaf2] p-3 ring-1 ring-amber-100">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cliente">
          <Input value={f.cliente} onChange={(e) => set("cliente", e.target.value)} />
        </Field>
        <Field label="WhatsApp">
          <Input value={f.telefono} inputMode="tel" onChange={(e) => set("telefono", e.target.value)} />
        </Field>
        <Field label="Total">
          <MoneyInput value={f.total} onChange={(v) => set("total", v)} />
        </Field>
        <Field label="Método de pago">
          <Select value={f.metodo} onChange={(e) => set("metodo", e.target.value as MetodoPago)}>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {METODO_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha">
          <Input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
        </Field>
        <Field label="¿Quién atendió?">
          <Input value={f.atendio} onChange={(e) => set("atendio", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripción de la compra">
            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={f.detalle} onChange={(e) => set("detalle", e.target.value)} />
          </Field>
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-400">Solo cambia el recibo; la venta registrada en el día no se modifica.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Boton variant="ghost" onClick={onCerrar}>
          <X className="h-4 w-4" /> Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar cambios
        </Boton>
      </div>
    </div>
  );
}
