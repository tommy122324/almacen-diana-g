"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, FileText, User, DollarSign, Ban, RotateCcw, Timer, Trash2, Pencil, Check, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  registrarEntrada,
  miRegistroHoy,
  entradaBloqueadaHoy,
  cargarRegistrosHora,
  cargarPagosEmpleado,
  insertPagoEmpleado,
  updatePagoEmpleado,
  cargarMiembros,
  marcarEntradaATiempo,
  anularEntrada,
  eliminarEntradaRegistro,
  deleteGasto,
  type Miembro,
} from "@/lib/db";
import type { RegistroHora, Gasto } from "@/lib/types";
import { avisar, avisarError, confirmar, confirmarEliminar } from "@/lib/alerta";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { exportarNominaPDF } from "@/lib/export";
import { Card, Boton, Input, StatCard, Select, Chip } from "@/components/ui";
import { MoneyInput } from "@/components/MoneyInput";
import { FirmaPad } from "@/components/FirmaPad";

export default function Nomina() {
  const esAdmin = useStore((s) => s.esAdmin);
  return esAdmin ? <NominaAdmin /> : <MiEntrada />;
}

/* ─── Empleado: registrar entrada ─── */
function MiEntrada() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const revision = useStore((s) => s.revision);
  const [registro, setRegistro] = useState<RegistroHora | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    try {
      const [reg, bloq] = await Promise.all([miRegistroHoy(negocioId), entradaBloqueadaHoy(negocioId)]);
      setRegistro(reg);
      setBloqueado(bloq);
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [negocioId]);
  useEffect(() => {
    cargar();
  }, [cargar, revision]);

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
      ) : registro && !registro.anulada ? (
        <Card>
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <div className="font-semibold">Entrada registrada hoy</div>
              <div className="text-sm text-stone-500">A las {registro.hora}</div>
            </div>
          </div>
          {registro.minutosTarde > 0 ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <div className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Llegaste {registro.minutosTarde} min tarde
              </div>
              <p className="mt-1">
                Tu tiempo de retraso será descontado de tu sueldo de la próxima quincena. Descuento:{" "}
                <b>{formatCOP(registro.descuento)}</b>.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              ¡Llegaste a tiempo! Sin descuentos. 🎉
            </div>
          )}
        </Card>
      ) : bloqueado ? (
        <Card>
          <div className="flex items-center gap-3 text-stone-600">
            <CheckCircle2 className="h-8 w-8 text-stone-400" />
            <div>
              <div className="font-semibold">Ya registraste tu entrada hoy</div>
              <div className="text-sm text-stone-500">
                {registro?.anulada
                  ? "El administrador anuló tu registro de hoy. Podrás registrar de nuevo mañana."
                  : "Podrás registrar de nuevo mañana."}
              </div>
            </div>
          </div>
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
  const salario = useStore((s) => s.config.salarioMinimo); // reactivo: cambia al instante
  const revision = useStore((s) => s.revision);
  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";

  const [empleados, setEmpleados] = useState<Miembro[]>([]);
  const [selId, setSelId] = useState("");
  const [mes, setMes] = useState(mesActual());
  const [registros, setRegistros] = useState<RegistroHora[]>([]);
  const [pagos, setPagos] = useState<Gasto[]>([]);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  const [firma, setFirma] = useState("");
  const [firmaKey, setFirmaKey] = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!negocioId) return;
    cargarMiembros(negocioId).then((ms) => {
      const emp = ms.filter((m) => m.rol === "empleado");
      setEmpleados(emp);
      setSelId((prev) => prev || (emp[0]?.usuarioId ?? ""));
    });
  }, [negocioId]);

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
  }, [cargarDetalle, revision]);

  const sel = empleados.find((e) => e.usuarioId === selId);
  const totalDesc = registros.filter((r) => !r.anulada).reduce((s, r) => s + r.descuento, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  const seLeDebe = salario - totalDesc - totalPagos;
  const mesLabel = new Date(mes + "-01T00:00").toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  async function pagar() {
    if (!negocioId || !selId || monto <= 0) return;
    if (!firma) {
      avisarError("Falta la firma del empleado para registrar el pago.");
      return;
    }
    setGuardando(true);
    try {
      const hoy = new Date().toLocaleDateString("sv", { timeZone: "America/Bogota" });
      await insertPagoEmpleado({
        negocioId,
        empleadoId: selId,
        concepto: concepto.trim() || `Pago a ${sel?.nombre || sel?.email}`,
        monto,
        fecha: hoy,
        firma,
      });
      avisar("Pago registrado (también se sumó a gastos)");
      setConcepto("");
      setMonto(0);
      setFirma("");
      setFirmaKey((k) => k + 1);
      await cargarDetalle();
    } catch {
      avisarError("No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  }

  async function aTiempo(r: RegistroHora) {
    try {
      await marcarEntradaATiempo(r.id);
      avisar("Marcada como a tiempo");
      await cargarDetalle();
    } catch {
      avisarError("No se pudo actualizar");
    }
  }
  async function togglAnular(r: RegistroHora) {
    const anular = !r.anulada;
    if (anular && !(await confirmar("¿Anular esta entrada?", "No contará para descuentos, pero el empleado NO podrá volver a registrarla hoy.", "Sí, anular"))) return;
    try {
      await anularEntrada(r.id, anular);
      avisar(anular ? "Entrada anulada" : "Entrada restaurada");
      await cargarDetalle();
    } catch {
      avisarError("No se pudo actualizar");
    }
  }
  async function eliminarReg(r: RegistroHora) {
    if (!(await confirmarEliminar("Se borrará este registro de entrada. El empleado seguirá sin poder registrar de nuevo hoy."))) return;
    try {
      await eliminarEntradaRegistro(r.id);
      avisar("Registro eliminado");
      await cargarDetalle();
    } catch {
      avisarError("No se pudo eliminar");
    }
  }
  async function eliminarPago(p: Gasto) {
    if (!(await confirmarEliminar("Se eliminará este pago (también se quita de los gastos del almacén)."))) return;
    try {
      await deleteGasto(p.id);
      avisar("Pago eliminado");
      await cargarDetalle();
    } catch {
      avisarError("No se pudo eliminar");
    }
  }
  async function guardarEdicionPago(p: Gasto, nConcepto: string, nMonto: number, nFirma: string): Promise<boolean> {
    if (nMonto <= 0) return false;
    if (!nFirma) {
      avisarError("Falta la firma nueva del empleado para guardar el cambio.");
      return false;
    }
    try {
      await updatePagoEmpleado(p.id, { concepto: nConcepto.trim() || p.concepto, monto: nMonto, firma: nFirma });
      avisar("Pago actualizado");
      await cargarDetalle();
      return true;
    } catch {
      avisarError("No se pudo actualizar");
      return false;
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
              <Boton variant="outline" onClick={() => exportarNominaPDF({ negocio, empleado: sel.nombre || sel.email, mesLabel, salario, registros, pagos })}>
                <FileText className="h-4 w-4" /> PDF del mes
              </Boton>
            )}
          </div>

          {/* Cuenta del mes */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Sueldo del mes" value={salario} tone="default" />
            <StatCard label="Descuentos por retraso" value={totalDesc} tone="red" />
            <StatCard label="Pagado en el mes" value={totalPagos} tone="green" />
            <StatCard label="Se le debe" value={seLeDebe} tone={seLeDebe >= 0 ? "amber" : "green"} hint={salario === 0 ? "Configura el salario en Ajustes" : undefined} />
          </div>

          {/* Entradas / retrasos */}
          <Card>
            <div className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
              <Clock className="h-4 w-4 text-amber-600" /> Entradas y retrasos
            </div>
            {registros.length === 0 ? (
              <p className="text-sm text-stone-400">Sin registros de entrada este mes.</p>
            ) : (
              <div className="space-y-1">
                {registros.map((r) => (
                  <div key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-sm ${r.anulada ? "opacity-50" : "hover:bg-stone-50"}`}>
                    <span className="w-20 text-stone-500">{formatFechaCorta(r.fecha)}</span>
                    <span className="w-14 font-medium text-stone-700">{r.hora}</span>
                    {r.anulada ? (
                      <Chip tone="stone">Anulada</Chip>
                    ) : r.minutosTarde > 0 ? (
                      <>
                        <Chip tone="red">{r.minutosTarde} min tarde</Chip>
                        <span className="tabular-nums font-medium text-rose-600">−{formatCOP(r.descuento)}</span>
                      </>
                    ) : (
                      <Chip tone="green">A tiempo</Chip>
                    )}
                    <div className="ml-auto flex gap-1">
                      {!r.anulada && r.minutosTarde > 0 && (
                        <button onClick={() => aTiempo(r)} title="Marcar que llegó a tiempo" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50">
                          <Timer className="h-3.5 w-3.5" /> Llegó a tiempo
                        </button>
                      )}
                      <button onClick={() => togglAnular(r)} title={r.anulada ? "Restaurar" : "Anular"} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100">
                        {r.anulada ? <><RotateCcw className="h-3.5 w-3.5" /> Restaurar</> : <><Ban className="h-3.5 w-3.5" /> Anular</>}
                      </button>
                      <button onClick={() => eliminarReg(r)} title="Eliminar registro" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-400 hover:bg-rose-50 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pagos / abonos con firma */}
          <Card>
            <div className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Pagos y abonos al empleado
            </div>
            <p className="mb-3 text-xs text-stone-500">Cada pago o abono se suma a los gastos del almacén. El empleado firma como constancia de recibido.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Concepto (ej: abono quincena)" className="flex-1" />
              <MoneyInput value={monto} onChange={setMonto} className="sm:w-40" />
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-stone-500">Firma del empleado (recibí conforme)</span>
              <FirmaPad key={firmaKey} onChange={setFirma} />
            </div>
            <div className="mt-2">
              <Boton onClick={pagar} disabled={guardando}>
                <DollarSign className="h-4 w-4" /> {guardando ? "Guardando…" : "Registrar pago"}
              </Boton>
            </div>

            <div className="mt-4 space-y-1 border-t border-stone-100 pt-3">
              {pagos.length === 0 && <p className="px-1 text-sm text-stone-400">Sin pagos este mes.</p>}
              {pagos.map((p) => (
                <FilaPago key={p.id} pago={p} onEliminar={() => eliminarPago(p)} onGuardar={(c, m, f) => guardarEdicionPago(p, c, m, f)} />
              ))}
            </div>
          </Card>

          <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500 flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
            El empleado registra su entrada desde su propia sesión; aquí se actualiza solo. El sueldo del mes se toma de Ajustes.
          </div>
        </>
      )}
    </div>
  );
}

/** Fila de un pago de nómina: ver firma, editar (pide firma de nuevo) o eliminar. */
function FilaPago({
  pago,
  onEliminar,
  onGuardar,
}: {
  pago: Gasto;
  onEliminar: () => void;
  onGuardar: (concepto: string, monto: number, firma: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [concepto, setConcepto] = useState(pago.concepto);
  const [monto, setMonto] = useState(pago.monto);
  const [firma, setFirma] = useState("");

  if (editando) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="flex-1" />
          <MoneyInput value={monto} onChange={setMonto} className="sm:w-40" />
        </div>
        <div className="mt-2">
          <span className="mb-1 block text-xs font-medium text-stone-500">Firma nueva del empleado (obligatoria para editar)</span>
          <FirmaPad onChange={setFirma} />
        </div>
        <div className="mt-2 flex gap-2">
          <Boton onClick={async () => { if (await onGuardar(concepto, monto, firma)) setEditando(false); }}>
            <Check className="h-4 w-4" /> Guardar
          </Boton>
          <Boton variant="ghost" onClick={() => { setConcepto(pago.concepto); setMonto(pago.monto); setFirma(""); setEditando(false); }}>
            <X className="h-4 w-4" /> Cancelar
          </Boton>
        </div>
      </div>
    );
  }

  // Solo mostramos la firma si de verdad es una imagen (evita URLs maliciosas por API).
  const firmaValida = typeof pago.firma === "string" && pago.firma.startsWith("data:image/");
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
      <span className="text-stone-400">{formatFechaCorta(pago.fecha)}</span>
      <span className="flex-1">{pago.concepto}</span>
      {firmaValida ? (
        <a href={pago.firma} target="_blank" rel="noreferrer" title="Ver firma">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pago.firma} alt="firma" className="h-7 w-16 rounded border border-stone-200 object-contain" />
        </a>
      ) : (
        <span className="text-xs text-stone-300">sin firma</span>
      )}
      <span className="tabular-nums font-medium text-emerald-600">{formatCOP(pago.monto)}</span>
      <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600" title="Editar">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onEliminar} className="text-stone-300 hover:text-rose-500" title="Eliminar">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
