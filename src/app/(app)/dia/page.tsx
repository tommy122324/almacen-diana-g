"use client";
import { useMemo, useState } from "react";
import { Trash2, Plus, Pencil, Check, X, BarChart3 } from "lucide-react";
import { useStore, baseInicialDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaLarga } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, confirmarEliminar } from "@/lib/alerta";
import { MoneyInput } from "@/components/MoneyInput";
import { IngresosMetodoChart } from "@/components/Charts";
import { Card, Boton, Select, Input } from "@/components/ui";

export default function RegistroDia() {
  const [fecha, setFecha] = useState(hoyISO());
  const [verGrafico, setVerGrafico] = useState(false);

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

  // Ingresos por método (ventas + abonos) del día — para el gráfico del cuadre
  const ingresosPorMetodo = useMemo(() => {
    const map = Object.fromEntries(METODOS.map((m) => [m, 0])) as Record<MetodoPago, number>;
    for (const v of dia.ventas) map[v.metodo] += v.monto;
    for (const ab of dia.abonos) map[ab.metodo ?? "efectivo"] += ab.monto;
    return METODOS.map((m) => ({ nombre: METODO_LABEL[m], valor: map[m] }));
  }, [dia]);

  // Cuadre de caja con base rodante
  const baseInicial = baseInicialDe(cuadres, negocioId, fecha);
  const baseSiguiente = dia.cuadre?.baseSiguiente ?? 0;
  const efectivoDia = dia.ventas.filter((v) => v.metodo === "efectivo").reduce((s, v) => s + v.monto, 0);
  const efectivoAbonos = dia.abonos.filter((ab) => (ab.metodo ?? "efectivo") === "efectivo").reduce((s, ab) => s + ab.monto, 0);
  const efectivoEsperado = baseInicial + efectivoDia + efectivoAbonos + totalEntradas - totalGastos;
  const efectivoNeto = efectivoEsperado - baseSiguiente; // ganancia real en efectivo tras dejar la base

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
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MiniStat label="Ventas" value={totalVentas} tone="text-emerald-600" />
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
              onEdit={(c, m) => { editarEntrada(e.id, c, m); avisar(); }}
              onDelete={() => borrar(() => eliminarEntrada(e.id))}
            />
          ))}
        </div>
      </Card>

      {/* Cuadre de caja */}
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">Cuadre de caja</h2>
          <Boton variant="outline" onClick={() => setVerGrafico((v) => !v)}>
            <BarChart3 className="h-4 w-4" /> {verGrafico ? "Ocultar gráfico" : "Ver ingresos por método"}
          </Boton>
        </div>
        <p className="mb-3 text-xs text-stone-500">
          Efectivo esperado = base de ayer + ventas efectivo + abonos efectivo + entradas − gastos.
        </p>

        {/* Gráfico de ingresos por método (opcional) */}
        {verGrafico && (
          <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="mb-1 text-sm font-medium text-stone-700">Ingresos del día por método de pago</div>
            <IngresosMetodoChart data={ingresosPorMetodo} />
          </div>
        )}

        {/* Base inicial (viene de ayer) */}
        <div className="mb-3 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
          <span className="text-stone-600">Base inicial (quedó de ayer)</span>
          <span className="font-semibold tabular-nums text-stone-700">{formatCOP(baseInicial)}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-stone-500">Efectivo esperado</div>
            <div className="mt-1 rounded-xl bg-stone-100 px-3 py-2.5 text-right font-semibold tabular-nums">
              {formatCOP(efectivoEsperado)}
            </div>
          </div>
          <div>
            <div className="text-xs text-stone-500">Efectivo contado (real)</div>
            <MoneyInput
              value={dia.cuadre?.efectivoReal ?? 0}
              onChange={(n) => setCuadre(fecha, { efectivoReal: n })}
              className="mt-1"
            />
          </div>
          <div>
            <div className="text-xs text-stone-500">Diferencia</div>
            {(() => {
              const dif = (dia.cuadre?.efectivoReal ?? 0) - efectivoEsperado;
              const tone = dif === 0 ? "text-stone-600" : dif > 0 ? "text-emerald-600" : "text-rose-600";
              return (
                <div className={`mt-1 rounded-xl bg-stone-100 px-3 py-2.5 text-right font-semibold tabular-nums ${tone}`}>
                  {dif > 0 ? "+" : ""}
                  {formatCOP(dif)}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Base para mañana + efectivo neto */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-stone-600">Dinero que dejas en caja para mañana</div>
            <MoneyInput
              value={baseSiguiente}
              onChange={(n) => setCuadre(fecha, { baseSiguiente: n })}
              className="mt-1"
            />
            <div className="mt-1 text-[11px] text-stone-500">Se resta del efectivo y será la base de mañana.</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs font-medium text-stone-600">Efectivo neto del día (a retirar)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{formatCOP(efectivoNeto)}</div>
            <div className="mt-1 text-[11px] text-stone-500">Efectivo esperado − base para mañana.</div>
          </div>
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
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${tone}`}>{formatCOP(value)}</div>
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
  onEdit,
  onDelete,
}: {
  metodo: MetodoPago;
  monto: number;
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
      <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600"><Pencil className="h-4 w-4" /></button>
      <button onClick={onDelete} className="text-stone-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

/** Fila de concepto (gasto/entrada) con edición en línea. */
function FilaConcepto({
  concepto,
  monto,
  onEdit,
  onDelete,
}: {
  concepto: string;
  monto: number;
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
      <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600"><Pencil className="h-4 w-4" /></button>
      <button onClick={onDelete} className="text-stone-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function AgregarVenta({ onAdd }: { onAdd: (m: MetodoPago, monto: number) => void }) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState(0);
  function add() {
    if (monto > 0) {
      onAdd(metodo, monto);
      setMonto(0);
    }
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
    if (monto > 0) {
      onAdd(concepto, monto);
      setConcepto("");
      setMonto(0);
    }
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
