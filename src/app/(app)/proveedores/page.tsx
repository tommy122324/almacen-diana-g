"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Truck, Plus, X, Phone, Pencil, Trash2, ChevronDown, ChevronRight, AlertTriangle, Loader2, ClipboardList, Wallet, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import * as pv from "@/lib/proveedores";
import { METODOS, METODO_LABEL, type MetodoPago } from "@/lib/types";
import { formatCOP, formatFechaCorta } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { avisar, avisarError, avisarFalta, confirmarEliminar } from "@/lib/alerta";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { MoneyInput } from "@/components/MoneyInput";
import { Card, Boton, StatCard, Input, Field, Chip, Select } from "@/components/ui";

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const diasPara = (fecha: string, hoy: string) => Math.round((Date.parse(fecha) - Date.parse(hoy)) / 86400000);

export default function Proveedores() {
  const esAdmin = useStore((s) => s.esAdmin);
  const negocioId = useStore((s) => s.negocioActivoId);
  const apartados = useStore((s) => s.apartados);
  const hoy = hoyISO();

  const [proveedores, setProveedores] = useState<pv.Proveedor[]>([]);
  const [cuentas, setCuentas] = useState<pv.CuentaPagar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [editando, setEditando] = useState<pv.Proveedor | "nuevo" | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    setCargando(true);
    try {
      const [p, c] = await Promise.all([pv.listarProveedores(negocioId), pv.listarCuentasPagar(negocioId)]);
      setProveedores(p);
      setCuentas(c);
      setErrorCarga("");
    } catch (e) {
      console.error(e);
      const err = e as { message?: string; code?: string };
      setErrorCarga(`${err.code ?? ""} ${err.message ?? String(e)}`.trim() || "Error desconocido");
    } finally {
      setCargando(false);
    }
  }, [negocioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Pedidos pendientes por lugar (para enlazar con el tablero de Pedidos)
  const pedidosPorLugar = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const a of apartados) {
      if (a.negocioId !== negocioId || a.tipo !== "pedido" || a.entregado || a.conseguido || !a.lugar?.trim()) continue;
      const k = norm(a.lugar);
      const x = m.get(k) ?? { nombre: a.lugar.trim(), n: 0 };
      x.n++;
      m.set(k, x);
    }
    return m;
  }, [apartados, negocioId]);

  const pendientes = cuentas.filter((c) => pv.saldoCuenta(c) > 0);
  const totalPorPagar = pendientes.reduce((t, c) => t + pv.saldoCuenta(c), 0);
  const vencidas = pendientes.filter((c) => c.vence && c.vence < hoy);
  const proximas = pendientes.filter((c) => c.vence && c.vence >= hoy && diasPara(c.vence, hoy) <= 7);
  const nombreProv = (id: string) => proveedores.find((p) => p.id === id)?.nombre ?? "Proveedor";
  const lugaresSinProveedor = [...pedidosPorLugar.entries()].filter(([k]) => !proveedores.some((p) => norm(p.nombre) === k));

  if (!esAdmin) {
    return (
      <Card>
        <p className="text-sm text-stone-500">Solo el administrador puede ver los proveedores.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-800">
          <Truck className="h-6 w-6 text-amber-600" /> Proveedores
        </h1>
        <Boton onClick={() => setEditando("nuevo")}>
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </Boton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total por pagar" value={totalPorPagar} tone={totalPorPagar ? "amber" : "default"} />
        <StatCard label="Vencido" value={vencidas.reduce((t, c) => t + pv.saldoCuenta(c), 0)} tone={vencidas.length ? "red" : "default"} hint={`${vencidas.length} factura(s)`} />
        <StatCard label="Vence en 7 días" value={proximas.reduce((t, c) => t + pv.saldoCuenta(c), 0)} tone="sky" hint={`${proximas.length} factura(s)`} />
        <StatCard label="Proveedores" value={proveedores.length} esConteo />
      </div>

      {(vencidas.length > 0 || proximas.length > 0) && (
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white">
          <div className="mb-2 flex items-center gap-2 font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" /> Pagos que requieren atención
          </div>
          <ul className="space-y-1.5">
            {[...vencidas, ...proximas].map((c) => {
              const d = diasPara(c.vence!, hoy);
              return (
                <li key={c.id}>
                  <button onClick={() => setAbierto(c.proveedorId)} className="flex w-full flex-wrap items-center gap-x-2 text-left text-sm text-stone-700">
                    <span className="font-semibold">{nombreProv(c.proveedorId)}</span>
                    <span className="text-stone-500">{c.concepto || "Factura"}</span>
                    <span className="font-bold">{formatCOP(pv.saldoCuenta(c))}</span>
                    <Chip tone={d < 0 ? "red" : "amber"}>{d < 0 ? `Vencida hace ${-d} día(s)` : d === 0 ? "Vence hoy" : `Vence en ${d} día(s)`}</Chip>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editando && (
        <FormProveedor
          inicial={editando === "nuevo" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}

      {lugaresSinProveedor.length > 0 && (
        <Card className="bg-[#fffaf2]">
          <p className="text-sm text-stone-600">Lugares de tus pedidos que aún no están como proveedor:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lugaresSinProveedor.map(([k, x]) => (
              <button
                key={k}
                onClick={async () => {
                  try {
                    await pv.crearProveedor({ negocioId: negocioId!, nombre: x.nombre, telefono: "", notas: "" });
                    avisar("Proveedor agregado");
                    cargar();
                  } catch (e) {
                    console.error(e);
                    avisarError("No se pudo agregar");
                  }
                }}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50"
              >
                <Plus className="h-3.5 w-3.5" /> {x.nombre}
              </button>
            ))}
          </div>
        </Card>
      )}

      {cargando ? (
        <div className="flex justify-center py-10 text-stone-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : errorCarga ? (
        <Card>
          <p className="text-sm text-rose-600">No se pudieron cargar los proveedores.</p>
          <p className="mt-1 text-xs text-stone-500">
            {/PGRST205|42P01|does not exist|schema cache/i.test(errorCarga)
              ? "Las tablas aún no existen en Supabase: ejecuta completo el archivo supabase/fase7l_proveedores.sql en el SQL Editor. "
              : "Detalle: "}
            <span className="font-mono">{errorCarga}</span>
          </p>
          <Boton variant="outline" className="mt-3" onClick={cargar}>
            Reintentar
          </Boton>
        </Card>
      ) : proveedores.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-stone-500">Aún no tienes proveedores. Agrega el primero para llevar lo que les debes.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {proveedores.map((p) => (
            <TarjetaProveedor
              key={p.id}
              proveedor={p}
              cuentas={cuentas.filter((c) => c.proveedorId === p.id)}
              pedidos={pedidosPorLugar.get(norm(p.nombre))?.n ?? 0}
              abierto={abierto === p.id}
              onToggle={() => setAbierto((a) => (a === p.id ? null : p.id))}
              onEditar={() => setEditando(p)}
              onCambio={cargar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FormProveedor({ inicial, onCerrar, onGuardado }: { inicial: pv.Proveedor | null; onCerrar: () => void; onGuardado: () => void }) {
  const negocioId = useStore((s) => s.negocioActivoId);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return avisarFalta("Escribe el nombre del proveedor");
    setGuardando(true);
    try {
      const datos = { nombre: nombre.trim(), telefono: telefono.trim(), notas: notas.trim() };
      if (inicial) await pv.actualizarProveedor(inicial.id, datos);
      else await pv.crearProveedor({ negocioId: negocioId!, ...datos });
      avisar(inicial ? "Proveedor actualizado" : "Proveedor agregado");
      onGuardado();
    } catch (e) {
      console.error(e);
      avisarError("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="border-amber-200">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-stone-800">{inicial ? "Editar proveedor" : "Nuevo proveedor"}</h2>
        <button onClick={onCerrar} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre (igual al lugar de los pedidos)">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Gamarra, San Victorino…" />
        </Field>
        <Field label="WhatsApp / teléfono">
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="300 123 4567" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notas (opcional)">
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Qué vende, días de despacho, cuenta…" />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Boton variant="ghost" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
        </Boton>
      </div>
    </Card>
  );
}

function TarjetaProveedor({
  proveedor: p,
  cuentas,
  pedidos,
  abierto,
  onToggle,
  onEditar,
  onCambio,
}: {
  proveedor: pv.Proveedor;
  cuentas: pv.CuentaPagar[];
  pedidos: number;
  abierto: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onCambio: () => void;
}) {
  const negocioId = useStore((s) => s.negocioActivoId);
  const hoy = hoyISO();
  const saldo = cuentas.reduce((t, c) => t + pv.saldoCuenta(c), 0);
  const vencido = cuentas.some((c) => pv.saldoCuenta(c) > 0 && c.vence && c.vence < hoy);
  const [nueva, setNueva] = useState(false);
  const [verPagadas, setVerPagadas] = useState(false);
  const abiertas = cuentas.filter((c) => pv.saldoCuenta(c) > 0);
  const pagadas = cuentas.filter((c) => pv.saldoCuenta(c) === 0);

  async function borrar() {
    if (!(await confirmarEliminar(`Se eliminará ${p.nombre} con todas sus facturas y pagos.`))) return;
    try {
      await pv.eliminarProveedor(p.id);
      avisar("Proveedor eliminado");
      onCambio();
    } catch (e) {
      console.error(e);
      avisarError("No se pudo eliminar");
    }
  }

  return (
    <Card className={`p-0 ${vencido ? "border-rose-200" : ""}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-lg font-bold text-white shadow-sm">
          {p.nombre.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-stone-800">{p.nombre}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            {abiertas.length > 0 ? `${abiertas.length} factura(s) por pagar` : "Al día"}
            {pedidos > 0 && <span className="text-amber-700">· {pedidos} pedido(s) por traer</span>}
          </span>
        </span>
        <span className="text-right">
          <span className={`block font-bold ${saldo ? (vencido ? "text-rose-600" : "text-amber-700") : "text-emerald-600"}`}>{formatCOP(saldo)}</span>
          {vencido && <span className="text-[11px] font-semibold text-rose-600">Vencido</span>}
        </span>
        {abierto ? <ChevronDown className="h-5 w-5 text-stone-400" /> : <ChevronRight className="h-5 w-5 text-stone-400" />}
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-amber-100 p-4">
          <div className="flex flex-wrap gap-2">
            <Boton variant="outline" onClick={() => setNueva((v) => !v)}>
              <Plus className="h-4 w-4" /> Nueva factura / deuda
            </Boton>
            {p.telefono && (
              <Boton variant="outline" onClick={() => abrirWhatsApp(p.telefono, `Hola ${p.nombre}, `)}>
                <Phone className="h-4 w-4" /> WhatsApp
              </Boton>
            )}
            {pedidos > 0 && (
              <Link href="/pedidos" className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-amber-50">
                <ClipboardList className="h-4 w-4" /> Ver pedidos
              </Link>
            )}
            <Boton variant="ghost" onClick={onEditar}>
              <Pencil className="h-4 w-4" /> Editar
            </Boton>
            <Boton variant="danger" onClick={borrar}>
              <Trash2 className="h-4 w-4" /> Eliminar
            </Boton>
          </div>
          {p.notas && <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">{p.notas}</p>}

          {nueva && (
            <FormCuenta
              proveedorId={p.id}
              onCerrar={() => setNueva(false)}
              onGuardado={() => {
                setNueva(false);
                onCambio();
              }}
            />
          )}

          {abiertas.length === 0 && !nueva && <p className="text-sm text-stone-500">No le debes nada a este proveedor. 🎉</p>}
          {abiertas.map((c) => (
            <FilaCuenta key={c.id} cuenta={c} negocioId={negocioId!} onCambio={onCambio} />
          ))}

          {pagadas.length > 0 && (
            <div>
              <button onClick={() => setVerPagadas((v) => !v)} className="flex items-center gap-1 text-sm font-medium text-stone-500">
                {verPagadas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Pagadas ({pagadas.length})
              </button>
              {verPagadas && (
                <div className="mt-2 space-y-2">
                  {pagadas.map((c) => (
                    <FilaCuenta key={c.id} cuenta={c} negocioId={negocioId!} onCambio={onCambio} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function FormCuenta({ proveedorId, onCerrar, onGuardado }: { proveedorId: string; onCerrar: () => void; onGuardado: () => void }) {
  const negocioId = useStore((s) => s.negocioActivoId);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(hoyISO());
  const [vence, setVence] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!monto) return avisarFalta("Escribe el valor de la factura");
    setGuardando(true);
    try {
      await pv.crearCuentaPagar({ negocioId: negocioId!, proveedorId, fecha, vence: vence || null, concepto: concepto.trim(), monto });
      avisar("Factura registrada");
      onGuardado();
    } catch (e) {
      console.error(e);
      avisarError("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[#fffaf2] p-3 ring-1 ring-amber-100">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="¿Qué se compró?">
          <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: 2 docenas de jeans" />
        </Field>
        <Field label="Valor">
          <MoneyInput value={monto} onChange={setMonto} />
        </Field>
        <Field label="Fecha de compra">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Fecha límite de pago (opcional)">
          <Input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Boton variant="ghost" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar factura
        </Boton>
      </div>
    </div>
  );
}

function FilaCuenta({ cuenta: c, negocioId, onCambio }: { cuenta: pv.CuentaPagar; negocioId: string; onCambio: () => void }) {
  const hoy = hoyISO();
  const saldo = pv.saldoCuenta(c);
  const pagado = pv.pagadoDe(c);
  const [abonando, setAbonando] = useState(false);
  const [monto, setMonto] = useState(0);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [fecha, setFecha] = useState(hoy);
  const [guardando, setGuardando] = useState(false);
  const d = c.vence ? diasPara(c.vence, hoy) : null;

  async function pagar() {
    if (!monto) return avisarFalta("Escribe cuánto pagaste");
    if (monto > saldo) return avisarFalta(`El pago no puede ser mayor al saldo (${formatCOP(saldo)})`);
    setGuardando(true);
    try {
      await pv.registrarPagoProveedor({ negocioId, cuentaId: c.id, fecha, monto, metodo });
      avisar(monto === saldo ? "¡Factura pagada!" : "Abono registrado");
      setAbonando(false);
      setMonto(0);
      onCambio();
    } catch (e) {
      console.error(e);
      avisarError("No se pudo registrar el pago");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!(await confirmarEliminar("Se eliminará esta factura y sus pagos."))) return;
    try {
      await pv.eliminarCuentaPagar(c.id);
      onCambio();
    } catch (e) {
      console.error(e);
      avisarError("No se pudo eliminar");
    }
  }

  async function borrarPago(id: string) {
    if (!(await confirmarEliminar("Se eliminará este pago."))) return;
    try {
      await pv.eliminarPagoProveedor(id);
      onCambio();
    } catch (e) {
      console.error(e);
      avisarError("No se pudo eliminar");
    }
  }

  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-stone-800">{c.concepto || "Factura"}</div>
          <div className="text-xs text-stone-500">
            Compra {formatFechaCorta(c.fecha)} · Total {formatCOP(c.monto)}
            {pagado > 0 && ` · Pagado ${formatCOP(pagado)}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saldo === 0 ? (
            <Chip tone="green">Pagada</Chip>
          ) : d !== null ? (
            <Chip tone={d < 0 ? "red" : d <= 7 ? "amber" : "stone"}>{d < 0 ? `Vencida (${formatFechaCorta(c.vence!)})` : `Vence ${formatFechaCorta(c.vence!)}`}</Chip>
          ) : null}
          {saldo > 0 && <span className="font-bold text-amber-700">{formatCOP(saldo)}</span>}
        </div>
      </div>

      {c.pagos.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-dashed border-stone-200 pt-2">
          {c.pagos.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs text-stone-500">
              <Wallet className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                {formatFechaCorta(p.fecha)} · {METODO_LABEL[p.metodo] ?? p.metodo}
              </span>
              <span className="ml-auto font-semibold text-emerald-700">{formatCOP(p.monto)}</span>
              <button onClick={() => borrarPago(p.id)} className="rounded p-0.5 text-stone-300 hover:text-rose-500" aria-label="Eliminar pago">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {abonando ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <MoneyInput value={monto} onChange={setMonto} autoFocus />
          <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {METODO_LABEL[m]}
              </option>
            ))}
          </Select>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <div className="flex gap-1">
            <Boton onClick={pagar} disabled={guardando} className="flex-1">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Pagar
            </Boton>
            <Boton variant="ghost" onClick={() => setAbonando(false)}>
              <X className="h-4 w-4" />
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap justify-end gap-1">
          {saldo > 0 && (
            <>
              <Boton
                variant="outline"
                className="py-1.5"
                onClick={() => {
                  setMonto(saldo);
                  setAbonando(true);
                }}
              >
                <Wallet className="h-4 w-4" /> Registrar pago
              </Boton>
            </>
          )}
          <Boton variant="danger" className="py-1.5" onClick={borrar}>
            <Trash2 className="h-4 w-4" />
          </Boton>
        </div>
      )}
    </div>
  );
}
