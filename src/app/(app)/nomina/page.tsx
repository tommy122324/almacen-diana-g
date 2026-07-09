"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, FileText, User, DollarSign } from "lucide-react";
import { useStore } from "@/lib/store";
import { registrarEntrada, miRegistroHoy, cargarRegistrosHora, cargarPagosEmpleado, insertPagoEmpleado, cargarMiembros, type Miembro } from "@/lib/db";
import type { RegistroHora, Gasto } from "@/lib/types";
import { avisar, avisarError } from "@/lib/alerta";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { exportarNominaPDF } from "@/lib/export";
import { Card, Boton, Input, Field, StatCard, Select } from "@/components/ui";
import { MoneyInput } from "@/components/MoneyInput";

export default function Nomina() {
  const esAdmin = useStore((s) => s.esAdmin);
  return esAdmin ? <NominaAdmin /> : <MiEntrada />;
}

/* ─── Empleado: registrar entrada ─── */
function MiEntrada() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const [registro, setRegistro] = useState<RegistroHora | null>(null);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    setCargando(true);
    try {
      setRegistro(await miRegistroHoy(negocioId));
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [negocioId]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function registrar() {
    if (!negocioId) return;
    setRegistrando(true);
    try {
      const r = await registrarEntrada(negocioId);
      if (r.error) avisarError(r.error);
      else {
        avisar("Entrada registrada");
        await cargar();
      }
    } catch {
      avisarError("No se pudo registrar tu entrada");
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-800">Mi entrada</h1>
      {cargando ? (
        <Card><p className="text-sm text-stone-400">Cargando…</p></Card>
      ) : registro ? (
        <Card>
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <div className="font-semibold">Entrada registrada hoy</div>
              <div className="text-sm text-stone-500">A las {registro.hora}</div>
            </div>
          </div>
          {registro.minutosTarde > 0 && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <div className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Llegaste {registro.minutosTarde} min tarde
              </div>
              <p className="mt-1">
                Tu tiempo de retraso será descontado de tu sueldo de la próxima quincena. Descuento:{" "}
                <b>{formatCOP(registro.descuento)}</b>.
              </p>
            </div>
          )}
        </Card>
      ) : (
        <Card className="text-center">
          <Clock className="mx-auto h-12 w-12 text-amber-500" />
          <p className="mt-2 text-stone-700">Aún no has registrado tu entrada de hoy.</p>
          <p className="text-xs text-stone-400">Horario: 9:00 am. Después de las 9:15 aplica descuento.</p>
          <div className="mt-4">
            <Boton onClick={registrar} disabled={registrando}>
              <Clock className="h-4 w-4" /> {registrando ? "Registrando…" : "Registrar entrada ahora"}
            </Boton>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Admin: nómina de empleados ─── */
function mesActual() {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" }).slice(0, 7);
}
function rangoMes(am: string) {
  const [y, m] = am.split("-").map(Number);
  const ult = new Date(y, m, 0).getDate();
  return { desde: `${am}-01`, hasta: `${am}-${String(ult).padStart(2, "0")}` };
}

function NominaAdmin() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";

  const [empleados, setEmpleados] = useState<Miembro[]>([]);
  const [selId, setSelId] = useState("");
  const [mes, setMes] = useState(mesActual());
  const [registros, setRegistros] = useState<RegistroHora[]>([]);
  const [pagos, setPagos] = useState<Gasto[]>([]);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);

  useEffect(() => {
    if (!negocioId) return;
    cargarMiembros(negocioId).then((ms) => {
      const emp = ms.filter((m) => m.rol === "empleado");
      setEmpleados(emp);
      if (emp.length && !selId) setSelId(emp[0].usuarioId);
    });
  }, [negocioId, selId]);

  const cargarDetalle = useCallback(async () => {
    if (!negocioId || !selId) {
      setRegistros([]);
      setPagos([]);
      return;
    }
    const { desde, hasta } = rangoMes(mes);
    try {
      setRegistros(await cargarRegistrosHora(negocioId, selId, desde, hasta));
      setPagos(await cargarPagosEmpleado(negocioId, selId, desde, hasta));
    } catch {
      /* noop */
    }
  }, [negocioId, selId, mes]);
  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  const sel = empleados.find((e) => e.usuarioId === selId);
  const totalDesc = registros.reduce((s, r) => s + r.descuento, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  const mesLabel = new Date(mes + "-01T00:00").toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  async function pagar() {
    if (!negocioId || !selId || monto <= 0) return;
    try {
      const hoy = new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" });
      await insertPagoEmpleado({
        negocioId,
        empleadoId: selId,
        concepto: concepto.trim() || `Pago a ${sel?.nombre || sel?.email}`,
        monto,
        fecha: hoy,
      });
      avisar("Pago registrado (también se sumó a gastos)");
      setConcepto("");
      setMonto(0);
      await cargarDetalle();
    } catch {
      avisarError("No se pudo registrar el pago");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-800">Nómina</h1>

      {empleados.length === 0 ? (
        <Card><p className="text-sm text-stone-400">Aún no hay colaboradores. Créalos en Ajustes → Usuarios.</p></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-stone-600">
              <span className="mb-1 block text-xs font-medium text-stone-500">Empleado</span>
              <Select value={selId} onChange={(e) => setSelId(e.target.value)} className="sm:w-56">
                {empleados.map((e) => (
                  <option key={e.usuarioId} value={e.usuarioId}>{e.nombre || e.email}</option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-stone-600">
              <span className="mb-1 block text-xs font-medium text-stone-500">Mes</span>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-auto" />
            </label>
            {sel && (
              <Boton variant="outline" onClick={() => exportarNominaPDF({ negocio, empleado: sel.nombre || sel.email, mesLabel, registros, pagos })}>
                <FileText className="h-4 w-4" /> PDF del mes
              </Boton>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Descuentos por retraso" value={totalDesc} tone="red" />
            <StatCard label="Pagado en el mes" value={totalPagos} tone="green" />
          </div>

          {/* Entradas / retrasos */}
          <Card>
            <div className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
              <Clock className="h-4 w-4 text-amber-600" /> Entradas y retrasos
            </div>
            {registros.length === 0 ? (
              <p className="text-sm text-stone-400">Sin registros de entrada este mes.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                    <th className="py-1">Fecha</th>
                    <th className="py-1">Entrada</th>
                    <th className="py-1 text-right">Min. tarde</th>
                    <th className="py-1 text-right">Descuento</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} className="border-b border-stone-100">
                      <td className="py-1.5">{formatFechaCorta(r.fecha)}</td>
                      <td className="py-1.5">{r.hora}</td>
                      <td className={`py-1.5 text-right ${r.minutosTarde > 0 ? "text-rose-600" : "text-stone-400"}`}>{r.minutosTarde || "-"}</td>
                      <td className="py-1.5 text-right tabular-nums text-rose-600">{r.descuento ? formatCOP(r.descuento) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Pagos / abonos */}
          <Card>
            <div className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Pagos y abonos al empleado
            </div>
            <p className="mb-3 text-xs text-stone-500">Cada pago o abono se suma automáticamente a los gastos del almacén.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Concepto (ej: abono quincena)" className="flex-1" />
              <MoneyInput value={monto} onChange={setMonto} onEnter={pagar} className="sm:w-40" />
              <Boton onClick={pagar}><DollarSign className="h-4 w-4" /> Registrar pago</Boton>
            </div>
            <div className="mt-3 space-y-1">
              {pagos.length === 0 && <p className="px-1 text-sm text-stone-400">Sin pagos este mes.</p>}
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                  <span className="text-stone-400">{formatFechaCorta(p.fecha)}</span>
                  <span className="flex-1">{p.concepto}</span>
                  <span className="tabular-nums font-medium text-emerald-600">{formatCOP(p.monto)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500 flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
            El empleado registra su entrada desde su propia sesión; aquí lo ves apenas abres esta sección.
          </div>
        </>
      )}
    </div>
  );
}
