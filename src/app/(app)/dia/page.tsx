"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { Trash2, Plus, Pencil, Check, X, BarChart3 } from "lucide-react";
import { useStore, cajaAyerDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaLarga } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, confirmarEliminar, avisarFalta } from "@/lib/alerta";
import { MoneyInput } from "@/components/MoneyInput";
import { IngresosMetodoChart } from "@/components/Charts";
import { Card, Boton, Select, Input } from "@/components/ui";

export default function RegistroDia() {
  const [fecha, setFecha] = useState(hoyISO());
  const [verGrafico, setVerGrafico] = useState(false);
  const [calculando, setCalculando] = useState(false);

  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const ventas = useStore((s) => s.ventas);
  const gastos = useStore((s) => s.gastos);
  const entradas = useStore((s) => s.entradas);
  const apartados = useStore((s) => s.apartados);
  const cuadres = useStore((s) => s.cuadres);

  const agregarVenta = useStore((s) => s.agregarVenta);
  const editarVenta = useStore((s) => s.editarVenta);
  const eliminarVenta = useStore((s) => s.eliminarVenta);
  const agregarGasto = useStore((s) => s.agregarGasto);
  const editarGasto = useStore((s) => s.editarGasto);
  const eliminarGasto = useStore((s) => s.eliminarGasto);
  const agregarEntrada = useStore((s) => s.agregarEntrada);
  const editarEntrada = useStore((s) => s.editarEntrada);
  const eliminarEntrada = useStore((s) => s.eliminarEntrada);
  const setCuadre = useStore((s) => s.setCuadre);
  const asegurarRango = useStore((s) => s.asegurarRango);

  // Cargar el día seleccionado si aún no está en memoria (el admin puede ir a fechas viejas)
  useEffect(() => {
    asegurarRango(fecha, fecha);
  }, [fecha, asegurarRango]);

  // Datos del día seleccionado
  const dia = useMemo(() => {
    const f = (x: { negocioId: string; fecha: string }) => x.negocioId === negocioId && x.fecha === fecha;
    // Abonos de apartados hechos en esta fecha (cuentan como ganancia del día)
    const abonosDia = apartados
      .filter((a) => a.negocioId === negocioId)
      .flatMap((a) => a.abonos)
      .filter((ab) => ab.fecha === fecha);
    return {
      ventas: ventas.filter(f),
      gastos: gastos.filter(f),
      entradas: entradas.filter(f),
      cuadre: cuadres.find(f),
      abonos: abonosDia,
    };
  }, [ventas, gastos, entradas, cuadres, apartados, negocioId, fecha]);

  const totalVentas = dia.ventas.reduce((s, v) => s + v.monto, 0);
  const totalGastos = dia.gastos.reduce((s, g) => s + g.monto, 0);
  const totalEntradas = dia.entradas.reduce((s, e) => s + e.monto, 0);
  const totalAbonos = dia.abonos.reduce((s, ab) => s + ab.monto, 0);
  const totalDia = totalVentas + totalEntradas + totalAbonos; // todo lo recibido
  const utilidad = totalDia - totalGastos;

  // Valor total de los APARTADOS creados este día. Se muestra SOLO en "Ventas"
  // (no entra a utilidad, efectivo ni total del día — los abonos siguen su lógica).
  const apartadosDelDia = apartados
    .filter((a) => a.negocioId === negocioId && a.tipo === "apartado" && a.fecha === fecha)
    .reduce((s, a) => s + a.valorTotal, 0);
  const ventasConApartados = totalVentas + apartadosDelDia;

  // Ingresos por método (ventas + abonos) del día — para el gráfico del cuadre
  const ingresosPorMetodo = useMemo(() => {
    const map = Object.fromEntries(METODOS.map((m) => [m, 0])) as Record<MetodoPago, number>;
    for (const v of dia.ventas) map[v.metodo] += v.monto;
    for (const ab of dia.abonos) map[ab.metodo ?? "efectivo"] += ab.monto;
    return METODOS.map((m) => ({ nombre: METODO_LABEL[m], valor: map[m] }));
  }, [dia]);

  // Cuadre de caja v2 — la caja de hoy usa estado local + guardado con retraso (sin lentitud)
  const cajaAyer = cajaAyerDe(cuadres, negocioId, fecha);
  const cajaGuardada = dia.cuadre?.efectivoReal ?? 0;
  const [cajaEdit, setCajaEdit] = useState<number | null>(null);
  const cajaTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setCajaEdit(null); // al cambiar de día, vuelve a tomar el valor guardado
  }, [fecha]);
  const cajaHoy = cajaEdit ?? cajaGuardada; // lo que el usuario cuenta hoy
  function onCajaHoy(nv: number) {
    setCajaEdit(nv);
    setCalculando(true);
    if (cajaTimer.current) window.clearTimeout(cajaTimer.current);
    cajaTimer.current = window.setTimeout(() => {
      setCuadre(fecha, { efectivoReal: nv });
      setCalculando(false);
    }, 500);
  }
  const efectivoDia = dia.ventas.filter((v) => v.metodo === "efectivo").reduce((s, v) => s + v.monto, 0);
  const efectivoAbonos = dia.abonos.filter((ab) => (ab.metodo ?? "efectivo") === "efectivo").reduce((s, ab) => s + ab.monto, 0);
  // Utilidad en efectivo del día = ventas efectivo + abonos efectivo + entradas − gastos
  const utilidadEfectivo = efectivoDia + efectivoAbonos + totalEntradas - totalGastos;
  // Efectivo neto = utilidad efectivo + caja de ayer − caja de hoy
  const efectivoNeto = utilidadEfectivo + cajaAyer - cajaHoy;
  const cuadrado = dia.cuadre?.cuadrado ?? null;
  const diferencia = dia.cuadre?.diferencia ?? 0;

  async function borrar(accion: () => void) {
    if (await confirmarEliminar()) {
      accion();
      avisar("Eliminado");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Registro del día</h1>
          <p className="text-sm capitalize text-stone-500">{formatFechaLarga(fecha)}</p>
        </div>
        {esAdmin ? (
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
        ) : (
          <span className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-medium text-stone-600">Hoy</span>
        )}
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MiniStat label="Ventas" value={ventasConApartados} tone="text-emerald-600" hint={apartadosDelDia > 0 ? "incluye apartados" : undefined} />
        <MiniStat label="Abonos" value={totalAbonos} tone="text-amber-600" />
        <MiniStat label="Entradas" value={totalEntradas} tone="text-sky-600" />
        <MiniStat label="Gastos" value={totalGastos} tone="text-rose-600" />
        <MiniStat label="Utilidad" value={utilidad} tone={utilidad >= 0 ? "text-stone-800" : "text-rose-600"} />
      </div>

      {/* Ventas */}
      <Card>
        <h2 className="mb-3 font-semibold text-stone-800">Ventas por método de pago</h2>
        <AgregarVenta onAdd={(m, monto) => { agregarVenta(fecha, m, monto); avisar("Venta agregada"); }} />
        <div className="mt-3 space-y-1">
          {dia.ventas.length === 0 && <Vacio texto="Aún no hay ventas registradas hoy." />}
          {dia.ventas.map((v) => (
            <FilaVenta
              key={v.id}
              metodo={v.metodo}
              monto={v.monto}
              puedeEditar={esAdmin}
              onEdit={(m, monto) => { editarVenta(v.id, m, monto); avisar(); }}
              onDelete={() => borrar(() => eliminarVenta(v.id))}
            />
          ))}
        </div>
      </Card>

      {/* Gastos */}
      <Card>
        <h2 className="mb-3 font-semibold text-stone-800">Gastos</h2>
        <AgregarConcepto placeholder="¿En qué se gastó? (ej: aromáticas)" onAdd={(c, m) => { agregarGasto(fecha, c, m); avisar("Gasto agregado"); }} />
        <div className="mt-3 space-y-1">
          {dia.gastos.length === 0 && <Vacio texto="Sin gastos registrados hoy." />}
          {dia.gastos.map((g) => (
            <FilaConcepto
              key={g.id}
              concepto={g.concepto}
              monto={g.monto}
              puedeEditar={esAdmin}
              onEdit={(c, m) => { editarGasto(g.id, c, m); avisar(); }}
              onDelete={() => borrar(() => eliminarGasto(g.id))}
            />
          ))}
        </div>
      </Card>

      {/* Entradas */}
      <Card>
        <h2 className="mb-3 font-semibold text-stone-800">Otras entradas de dinero</h2>
        <AgregarConcepto placeholder="¿De qué entró? (ej: abono apartado)" onAdd={(c, m) => { agregarEntrada(fecha, c, m); avisar("Entrada agregada"); }} />
        <div className="mt-3 space-y-1">
          {dia.entradas.length === 0 && <Vacio texto="Sin otras entradas hoy." />}
          {dia.entradas.map((e) => (
            <FilaConcepto
              key={e.id}
              concepto={e.concepto}
              monto={e.monto}
              puedeEditar={esAdmin}
              onEdit={(c, m) => { editarEntrada(e.id, c, m); avisar(); }}
              onDelete={() => borrar(() => eliminarEntrada(e.id))}
            />
          ))}
        </div>
      </Card>

      {/* Cuadre de caja (solo admin) */}
      {esAdmin && (
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">Cuadre de caja</h2>
          <Boton variant="outline" onClick={() => setVerGrafico((v) => !v)}>
            <BarChart3 className="h-4 w-4" /> {verGrafico ? "Ocultar gráfico" : "Ver ingresos por método"}
          </Boton>
        </div>
        <p className="mb-3 text-xs text-stone-500">
          Efectivo neto = utilidad en efectivo + caja de ayer − caja de hoy.
        </p>

        {/* Gráfico de ingresos por método (opcional) */}
        {verGrafico && (
          <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="mb-1 text-sm font-medium text-stone-700">Ingresos del día por método de pago</div>
            <IngresosMetodoChart data={ingresosPorMetodo} />
          </div>
        )}

        {/* Datos base */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-stone-50 px-3 py-2">
            <div className="text-xs text-stone-500">Caja de ayer</div>
            <div className="mt-0.5 text-right font-semibold tabular-nums text-stone-700">{formatCOP(cajaAyer)}</div>
          </div>
          <div className="rounded-xl bg-stone-50 px-3 py-2">
            <div className="text-xs text-stone-500">Utilidad en efectivo (hoy)</div>
            <div className="mt-0.5 text-right font-semibold tabular-nums text-stone-700">{formatCOP(utilidadEfectivo)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-amber-700">¿Cuánto quedó hoy en la caja?</div>
            <MoneyInput value={cajaHoy} onChange={onCajaHoy} className="mt-1" />
          </div>
        </div>

        {/* Efectivo neto + ¿Cuadró? */}
        <div
          className={`mt-3 rounded-xl border-2 p-4 transition-colors ${
            cuadrado === true ? "border-emerald-300 bg-emerald-50" : cuadrado === false ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-stone-50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-stone-600">Efectivo neto del día</div>
              {calculando ? (
                <div className="mt-1 text-lg font-semibold text-stone-400">Calculando…</div>
              ) : (
                <div className={`mt-1 text-2xl font-bold tabular-nums ${efectivoNeto >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatCOP(efectivoNeto)}
                </div>
              )}
            </div>
            {!calculando && (
              <div className="text-right">
                <div className="mb-1 text-xs font-medium text-stone-600">¿La caja cuadró?</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCuadre(fecha, { cuadrado: true, diferencia: 0 })}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${cuadrado === true ? "bg-emerald-500 text-white" : "border border-stone-300 bg-white text-stone-600 hover:bg-emerald-50"}`}
                  >
                    Sí ✓
                  </button>
                  <button
                    onClick={() => setCuadre(fecha, { cuadrado: false })}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${cuadrado === false ? "bg-rose-500 text-white" : "border border-stone-300 bg-white text-stone-600 hover:bg-rose-50"}`}
                  >
                    No ✗
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Si NO cuadró: pedir la diferencia (con signo) */}
          {cuadrado === false && (
            <div className="mt-3 border-t border-rose-200 pt-3">
              <div className="text-xs font-medium text-rose-700">¿Cuál fue la diferencia?</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
                  <button
                    onClick={() => setCuadre(fecha, { diferencia: Math.abs(diferencia) })}
                    className={`rounded-md px-3 py-1 font-semibold ${diferencia >= 0 ? "bg-emerald-500 text-white" : "text-stone-500"}`}
                  >
                    Sobró +
                  </button>
                  <button
                    onClick={() => setCuadre(fecha, { diferencia: -Math.abs(diferencia) })}
                    className={`rounded-md px-3 py-1 font-semibold ${diferencia < 0 ? "bg-rose-500 text-white" : "text-stone-500"}`}
                  >
                    Faltó −
                  </button>
                </div>
                <MoneyInput
                  value={Math.abs(diferencia)}
                  onChange={(nv) => setCuadre(fecha, { diferencia: diferencia < 0 ? -nv : nv })}
                  className="sm:w-40"
                />
              </div>
            </div>
          )}

          {/* Estado del día */}
          {cuadrado === true && <div className="mt-2 text-sm font-semibold text-emerald-700">🟢 Día cuadrado</div>}
          {cuadrado === false && <div className="mt-2 text-sm font-semibold text-rose-700">🔴 Día con descuadre</div>}
        </div>

        {/* Total del día contando TODOS los métodos */}
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-stone-800">Total del día (todos los métodos)</div>
              <div className="text-xs text-stone-500">Efectivo + Nequi + DaviPlata + Tarjetas + Sistecrédito + Addi + entradas + abonos</div>
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-700">{formatCOP(totalDia)}</div>
          </div>
        </div>
      </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone, hint }: { label: string; value: number; tone: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${tone}`}>{formatCOP(value)}</div>
      {hint && <div className="text-[10px] text-stone-400">{hint}</div>}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="px-2 py-1 text-sm text-stone-400">{texto}</p>;
}

/** Fila de venta con edición en línea (método + monto). */
function FilaVenta({
  metodo,
  monto,
  puedeEditar,
  onEdit,
  onDelete,
}: {
  metodo: MetodoPago;
  monto: number;
  puedeEditar: boolean;
  onEdit: (m: MetodoPago, monto: number) => void;
  onDelete: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [m, setM] = useState<MetodoPago>(metodo);
  const [v, setV] = useState(monto);

  if (editando) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-amber-50 p-2 sm:flex-row sm:items-center">
        <Select value={m} onChange={(e) => setM(e.target.value as MetodoPago)} className="sm:w-52">
          {METODOS.map((x) => (
            <option key={x} value={x}>{METODO_LABEL[x]}</option>
          ))}
        </Select>
        <MoneyInput value={v} onChange={setV} className="flex-1" onEnter={() => { onEdit(m, v); setEditando(false); }} />
        <div className="flex gap-1">
          <Boton onClick={() => { onEdit(m, v); setEditando(false); }}><Check className="h-4 w-4" /></Boton>
          <Boton variant="ghost" onClick={() => { setM(metodo); setV(monto); setEditando(false); }}><X className="h-4 w-4" /></Boton>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-stone-50">
      <span className="flex-1 text-stone-700">{METODO_LABEL[metodo]}</span>
      <span className="tabular-nums font-medium text-stone-800">{formatCOP(monto)}</span>
      {puedeEditar && (
        <>
          <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} className="text-stone-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
        </>
      )}
    </div>
  );
}

/** Fila de concepto (gasto/entrada) con edición en línea. */
function FilaConcepto({
  concepto,
  monto,
  puedeEditar,
  onEdit,
  onDelete,
}: {
  concepto: string;
  monto: number;
  puedeEditar: boolean;
  onEdit: (c: string, monto: number) => void;
  onDelete: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [c, setC] = useState(concepto);
  const [v, setV] = useState(monto);

  if (editando) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-amber-50 p-2 sm:flex-row sm:items-center">
        <Input value={c} onChange={(e) => setC(e.target.value)} className="flex-1" />
        <MoneyInput value={v} onChange={setV} className="sm:w-40" onEnter={() => { onEdit(c, v); setEditando(false); }} />
        <div className="flex gap-1">
          <Boton onClick={() => { onEdit(c, v); setEditando(false); }}><Check className="h-4 w-4" /></Boton>
          <Boton variant="ghost" onClick={() => { setC(concepto); setV(monto); setEditando(false); }}><X className="h-4 w-4" /></Boton>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-stone-50">
      <span className="flex-1 text-stone-700">{concepto}</span>
      <span className="tabular-nums font-medium text-stone-800">{formatCOP(monto)}</span>
      {puedeEditar && (
        <>
          <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} className="text-stone-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
        </>
      )}
    </div>
  );
}

function AgregarVenta({ onAdd }: { onAdd: (m: MetodoPago, monto: number) => void }) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState(0);
  function add() {
    if (monto <= 0) {
      avisarFalta("Escribe el monto de la venta.");
      return;
    }
    onAdd(metodo, monto);
    setMonto(0);
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className="sm:w-52">
        {METODOS.map((m) => (
          <option key={m} value={m}>{METODO_LABEL[m]}</option>
        ))}
      </Select>
      <MoneyInput value={monto} onChange={setMonto} onEnter={add} className="flex-1" />
      <Boton onClick={add}>
        <Plus className="h-4 w-4" /> Agregar
      </Boton>
    </div>
  );
}

function AgregarConcepto({ placeholder, onAdd }: { placeholder: string; onAdd: (c: string, m: number) => void }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  function add() {
    if (monto <= 0) {
      avisarFalta("Escribe el monto.");
      return;
    }
    onAdd(concepto, monto);
    setConcepto("");
    setMonto(0);
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder={placeholder}
        className="flex-1"
      />
      <MoneyInput value={monto} onChange={setMonto} onEnter={add} className="sm:w-40" />
      <Boton onClick={add}>
        <Plus className="h-4 w-4" /> Agregar
      </Boton>
    </div>
  );
}
