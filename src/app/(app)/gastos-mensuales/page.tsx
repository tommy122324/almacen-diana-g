"use client";
import { useMemo, useState } from "react";
import { Receipt, Plus, Trash2, Pencil, Check, X, Search, FileText, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import type { GastoMensual } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO, periodoDe } from "@/lib/calc";
import { avisar, avisarFalta, confirmarEliminar } from "@/lib/alerta";
import { exportarGastosMensualesPDF } from "@/lib/export";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, Input, Field, StatCard, inputCls } from "@/components/ui";

export default function GastosMensuales() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const gastosMensuales = useStore((s) => s.gastosMensuales);
  const agregar = useStore((s) => s.agregarGastoMensual);
  const editar = useStore((s) => s.editarGastoMensual);
  const eliminar = useStore((s) => s.eliminarGastoMensual);

  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";
  const mes = periodoDe("mes");

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(hoyISO());
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState(mes.desde);
  const [hasta, setHasta] = useState(mes.hasta);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return gastosMensuales
      .filter((g) => g.negocioId === negocioId && g.fecha >= desde && g.fecha <= hasta && (!q || g.concepto.toLowerCase().includes(q)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [gastosMensuales, negocioId, desde, hasta, busqueda]);

  const total = lista.reduce((s, g) => s + g.monto, 0);

  function add() {
    if (monto <= 0) {
      avisarFalta("Escribe el monto del gasto.");
      return;
    }
    if (!concepto.trim()) {
      avisarFalta("Escribe el concepto (¿de qué es el gasto?).");
      return;
    }
    agregar(fecha, concepto, monto);
    setConcepto("");
    setMonto(0);
    setFecha(hoyISO());
    avisar("Gasto mensual registrado");
  }

  async function borrar(g: GastoMensual) {
    if (await confirmarEliminar(`Se eliminará "${g.concepto}".`)) {
      eliminar(g.id);
      avisar("Eliminado");
    }
  }

  if (!esAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <Lock className="h-10 w-10 text-stone-300" />
        <p className="text-stone-500">Esta sección es solo para el administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Gastos Mensuales</h1>
        <p className="text-sm text-stone-500">Gastos fijos del negocio (arriendo, servicios, etc.). Se restan de la utilidad del mes en el Panel.</p>
      </div>

      {/* Registrar */}
      <Card>
        <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
          <Receipt className="h-5 w-5 text-rose-600" /> Registrar gasto mensual
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Concepto (¿de qué es?)">
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Arriendo del local" onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <Field label="Monto">
            <MoneyInput value={monto} onChange={setMonto} onEnter={add} />
          </Field>
          <Field label="Fecha del gasto">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Boton onClick={add} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Registrar
            </Boton>
          </div>
        </div>
      </Card>

      {/* Filtros + PDF */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-stone-600">
            <span className="mb-1 block text-xs font-medium text-stone-500">Desde</span>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-auto" />
          </label>
          <label className="text-sm text-stone-600">
            <span className="mb-1 block text-xs font-medium text-stone-500">Hasta</span>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-auto" />
          </label>
          <Boton variant="outline" onClick={() => exportarGastosMensualesPDF({ negocio, desde, hasta, items: lista })}>
            <FileText className="h-4 w-4" /> PDF por fechas
          </Boton>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por concepto…"
            className={`${inputCls} pl-9 pr-9`}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-rose-500" aria-label="Limpiar">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total del rango" value={total} tone="red" hint={`${lista.length} gasto(s)`} />
      </div>

      {/* Lista */}
      <Card>
        <h2 className="mb-2 font-semibold text-stone-800">Gastos del rango</h2>
        <div className="space-y-1">
          {lista.length === 0 && <p className="px-2 py-1 text-sm text-stone-400">No hay gastos en este rango.</p>}
          {lista.map((g) => (
            <FilaGasto key={g.id} gasto={g} onEditar={(f, c, m) => { editar(g.id, f, c, m); avisar(); }} onEliminar={() => borrar(g)} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function FilaGasto({
  gasto,
  onEditar,
  onEliminar,
}: {
  gasto: GastoMensual;
  onEditar: (fecha: string, concepto: string, monto: number) => void;
  onEliminar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [c, setC] = useState(gasto.concepto);
  const [m, setM] = useState(gasto.monto);
  const [f, setF] = useState(gasto.fecha);

  function guardar() {
    if (m <= 0) {
      avisarFalta("Escribe el monto del gasto.");
      return;
    }
    if (!c.trim()) {
      avisarFalta("Escribe el concepto.");
      return;
    }
    onEditar(f, c, m);
    setEditando(false);
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-rose-50 p-2 sm:flex-row sm:items-center">
        <Input value={c} onChange={(e) => setC(e.target.value)} className="flex-1" />
        <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="w-auto" />
        <MoneyInput value={m} onChange={setM} className="sm:w-40" onEnter={guardar} />
        <div className="flex gap-1">
          <Boton onClick={guardar}><Check className="h-4 w-4" /></Boton>
          <Boton variant="ghost" onClick={() => { setC(gasto.concepto); setM(gasto.monto); setF(gasto.fecha); setEditando(false); }}><X className="h-4 w-4" /></Boton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-stone-50">
      <span className="w-20 shrink-0 text-stone-400">{formatFechaCorta(gasto.fecha)}</span>
      <span className="flex-1 text-stone-700">{gasto.concepto}</span>
      <span className="tabular-nums font-medium text-rose-600">{formatCOP(gasto.monto)}</span>
      <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600" title="Editar"><Pencil className="h-4 w-4" /></button>
      <button onClick={onEliminar} className="text-stone-300 hover:text-rose-500" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
