"use client";
import { useMemo, useState } from "react";
import { Plus, X, Package, Search } from "lucide-react";
import { useStore, abonadoDe, saldoDe } from "@/lib/store";
import { METODOS, METODO_LABEL, type Apartado, type MetodoPago } from "@/lib/types";
import { formatCOP } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisarError } from "@/lib/alerta";
import { ReciboModal } from "@/components/ReciboModal";
import { ultimoAtendio } from "@/components/CamposRecibo";
import { reciboParaApartado, errorRecibo } from "@/lib/reciboApartado";
import type { Recibo } from "@/lib/types";
import { avisar, avisarFalta } from "@/lib/alerta";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Select, inputCls } from "@/components/ui";
import { ListaPlegable, confirmarBorrarApartado } from "@/components/ApartadoCard";

export default function Apartados() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
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

  const [busqueda, setBusqueda] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [valorTotal, setValorTotal] = useState(0);
  const [abonoInicial, setAbonoInicial] = useState(0);
  const [metodoInicial, setMetodoInicial] = useState<MetodoPago>("efectivo");

  const borrarApartado = (a: Apartado) => confirmarBorrarApartado(a, eliminar);

  const g = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, "");
    const coincide = (a: Apartado) => {
      if (!q) return true;
      const porNombre = a.cliente.toLowerCase().includes(q);
      const porTel = qDigitos.length > 0 && a.telefono.replace(/\D/g, "").includes(qDigitos);
      return porNombre || porTel;
    };
    const apart = apartados
      .filter((a) => a.negocioId === negocioId && a.tipo === "apartado" && coincide(a))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const apartPend = apart.filter((a) => a.estado !== "completado");
    return {
      apartPend,
      apartComp: apart.filter((a) => a.estado === "completado"),
      totValor: apartPend.reduce((s, a) => s + a.valorTotal, 0),
      totAbonado: apartPend.reduce((s, a) => s + abonadoDe(a), 0),
      totSaldo: apartPend.reduce((s, a) => s + saldoDe(a), 0),
    };
  }, [apartados, negocioId, busqueda]);

  const buscando = busqueda.trim().length > 0;
  const diferenciaPreview = Math.max(0, valorTotal - abonoInicial);

  async function add() {
    if (!cliente.trim()) {
      avisarFalta("Falta el nombre del cliente.");
      return;
    }
    if (valorTotal <= 0) {
      avisarFalta("Falta el valor total del apartado.");
      return;
    }
    const nuevoId = await agregar({ tipo: "apartado", descripcion, fecha, cliente, telefono, valorTotal, abonoInicial, metodoInicial });
    setDescripcion("");
    setCliente("");
    setTelefono("");
    setValorTotal(0);
    setAbonoInicial(0);
    setMetodoInicial("efectivo");
    avisar("Apartado registrado");
    if (esAdmin && conRecibo) await reciboDe(nuevoId);
  }

  return (
    <div className="space-y-5">
      {reciboNuevo && <ReciboModal recibo={reciboNuevo} onCerrar={() => setReciboNuevo(null)} />}
      <h1 className="text-2xl font-bold text-stone-800">Apartados</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Valor apartados" value={g.totValor} tone="default" hint="Pendientes" />
        <StatCard label="Abonado" value={g.totAbonado} tone="green" />
        <StatCard label="Por cobrar (saldo)" value={g.totSaldo} tone="red" />
      </div>

      {/* Formulario */}
      <Card>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-stone-500">
          <Package className="h-4 w-4 text-amber-500" /> El cliente deja una prenda separada y la va pagando.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="¿Qué prenda(s) deja?">
            <textarea
              className={`${inputCls} min-h-[44px] resize-y`}
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Vestido rojo talla S"
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
        {esAdmin && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-amber-100">
            <input type="checkbox" checked={conRecibo} onChange={(e) => setConRecibo(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            Generar recibo para el cliente al guardar
          </label>
        )}
        <div className="mt-4">
          <Boton onClick={add}>
            <Plus className="h-4 w-4" /> Registrar apartado
          </Boton>
        </div>
      </Card>

      {/* Buscador */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o número…"
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

      <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold text-amber-800">Apartados</h2>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">{g.apartPend.length} pendientes</span>
        </div>
        <div className="space-y-3">
          <ListaPlegable titulo="Pendientes" items={g.apartPend} abiertoInicial forzarAbierto={buscando} onEliminar={borrarApartado} puedeAdmin={esAdmin} />
          {g.apartComp.length > 0 && <ListaPlegable titulo="Completados" items={g.apartComp} abiertoInicial={false} forzarAbierto={buscando} onEliminar={borrarApartado} puedeAdmin={esAdmin} />}
        </div>
      </section>
    </div>
  );
}
