"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Phone, ChevronDown, ChevronUp, CircleDollarSign, Pencil, Check, X } from "lucide-react";
import { useStore, abonadoDe, saldoDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type Apartado, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, confirmarEliminar } from "@/lib/alerta";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Chip, Select } from "@/components/ui";

export default function Apartados() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const apartados = useStore((s) => s.apartados);
  const agregar = useStore((s) => s.agregarApartado);
  const eliminar = useStore((s) => s.eliminarApartado);

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [valorTotal, setValorTotal] = useState(0);
  const [abonoInicial, setAbonoInicial] = useState(0);
  const [metodoInicial, setMetodoInicial] = useState<MetodoPago>("efectivo");

  async function borrarApartado(id: string) {
    if (await confirmarEliminar("Se eliminará el apartado y todos sus abonos.")) {
      eliminar(id);
      avisar("Apartado eliminado");
    }
  }

  const { pendientes, completados, totValor, totAbonado, totSaldo } = useMemo(() => {
    const propios = apartados
      .filter((a) => a.negocioId === negocioId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const pendientes = propios.filter((a) => a.estado === "pendiente");
    const completados = propios.filter((a) => a.estado === "completado");
    return {
      pendientes,
      completados,
      totValor: pendientes.reduce((s, a) => s + a.valorTotal, 0),
      totAbonado: pendientes.reduce((s, a) => s + abonadoDe(a), 0),
      totSaldo: pendientes.reduce((s, a) => s + saldoDe(a), 0),
    };
  }, [apartados, negocioId]);

  const diferenciaPreview = Math.max(0, valorTotal - abonoInicial);

  function add() {
    if (valorTotal > 0 && cliente.trim()) {
      agregar({ fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial });
      setCliente("");
      setTelefono("");
      setValorTotal(0);
      setAbonoInicial(0);
      setMetodoInicial("efectivo");
      avisar("Apartado registrado");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-800">Apartados</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Valor apartado" value={totValor} tone="default" hint="Solo pendientes" />
        <StatCard label="Abonado" value={totAbonado} tone="green" />
        <StatCard label="Por cobrar (saldo)" value={totSaldo} tone="red" />
      </div>

      {/* Formulario */}
      <Card>
        <h2 className="mb-4 font-semibold text-stone-800">Registrar un apartado</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del cliente">
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ej: María Gómez" />
          </Field>
          <Field label="Teléfono">
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="Ej: 300 123 4567" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Valor total del apartado">
            <MoneyInput value={valorTotal} onChange={setValorTotal} />
          </Field>
          <Field label="¿Cuánto abona ahora?">
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
            <Plus className="h-4 w-4" /> Registrar apartado
          </Boton>
        </div>
      </Card>

      {/* Pendientes */}
      <div>
        <h2 className="mb-2 font-semibold text-stone-800">Pendientes ({pendientes.length})</h2>
        {pendientes.length === 0 ? (
          <Card><p className="text-sm text-stone-400">No hay apartados pendientes. 🎉</p></Card>
        ) : (
          <div className="space-y-3">
            {pendientes.map((a) => (
              <ApartadoCard key={a.id} apartado={a} onEliminar={() => borrarApartado(a.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Completados */}
      {completados.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-stone-800">Completados ({completados.length})</h2>
          <div className="space-y-3">
            {completados.map((a) => (
              <ApartadoCard key={a.id} apartado={a} onEliminar={() => borrarApartado(a.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApartadoCard({ apartado, onEliminar }: { apartado: Apartado; onEliminar: () => void }) {
  const abonar = useStore((s) => s.abonarApartado);
  const editar = useStore((s) => s.editarApartado);
  const eliminarAbono = useStore((s) => s.eliminarAbono);
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(0);
  const [metodoAbono, setMetodoAbono] = useState<MetodoPago>("efectivo");
  const [editando, setEditando] = useState(false);
  const [ed, setEd] = useState({
    cliente: apartado.cliente,
    telefono: apartado.telefono,
    fecha: apartado.fecha,
    valorTotal: apartado.valorTotal,
  });

  const abonado = abonadoDe(apartado);
  const saldo = saldoDe(apartado);
  const progreso = apartado.valorTotal > 0 ? Math.min(100, (abonado / apartado.valorTotal) * 100) : 0;
  const completado = apartado.estado === "completado";

  function registrarAbono() {
    if (monto > 0) {
      abonar(apartado.id, hoyISO(), monto, metodoAbono);
      setMonto(0);
      avisar("Abono registrado");
    }
  }

  function guardarEdicion() {
    if (ed.valorTotal > 0 && ed.cliente.trim()) {
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
          <Field label="Nombre del cliente">
            <Input value={ed.cliente} onChange={(e) => setEd({ ...ed, cliente: e.target.value })} />
          </Field>
          <Field label="Teléfono">
            <Input value={ed.telefono} onChange={(e) => setEd({ ...ed, telefono: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={ed.fecha} onChange={(e) => setEd({ ...ed, fecha: e.target.value })} />
          </Field>
          <Field label="Valor total del apartado">
            <MoneyInput value={ed.valorTotal} onChange={(n) => setEd({ ...ed, valorTotal: n })} />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Boton onClick={guardarEdicion}><Check className="h-4 w-4" /> Guardar</Boton>
          <Boton variant="ghost" onClick={() => { setEd({ cliente: apartado.cliente, telefono: apartado.telefono, fecha: apartado.fecha, valorTotal: apartado.valorTotal }); setEditando(false); }}>
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
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-800">{apartado.cliente}</span>
            {completado ? <Chip tone="green">Completado</Chip> : <Chip tone="amber">Pendiente</Chip>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500">
            {apartado.telefono && (
              <a href={`tel:${apartado.telefono}`} className="flex items-center gap-1 hover:text-amber-700">
                <Phone className="h-3 w-3" /> {apartado.telefono}
              </a>
            )}
            <span>Apartado: {formatFechaCorta(apartado.fecha)}</span>
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

      {/* Barra de progreso */}
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
