"use client";
import { useCallback, useEffect, useState } from "react";
import { ListChecks, Plus, Trash2, Pencil, Check, X, CheckCircle2, Circle } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  cargarMiembros,
  cargarTareas,
  misTareasHoy,
  insertTarea,
  updateTareaTexto,
  updateTareaProgreso,
  deleteTarea,
  type Miembro,
} from "@/lib/db";
import type { Tarea } from "@/lib/types";
import { avisar, avisarError, confirmarEliminar, avisarFalta } from "@/lib/alerta";
import { formatFechaLarga } from "@/lib/format";
import { hoyISO } from "@/lib/calc";
import { Card, Boton, Input, Select, Chip, inputCls } from "@/components/ui";

export default function Tareas() {
  const esAdmin = useStore((s) => s.esAdmin);
  return esAdmin ? <TareasAdmin /> : <MisTareas />;
}

const PASOS = [0, 25, 50, 75, 100];

/** Barra de progreso de una tarea. */
function Barra({ progreso, completada }: { progreso: number; completada: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full transition-all ${completada ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${progreso}%` }} />
    </div>
  );
}

/* ─── Empleado: mis tareas de hoy ─── */
function MisTareas() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const revision = useStore((s) => s.revision);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    try {
      setTareas(await misTareasHoy(negocioId));
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [negocioId]);
  useEffect(() => {
    cargar();
  }, [cargar, revision]);

  async function fijar(t: Tarea, progreso: number, completada: boolean) {
    // Optimista para que se sienta al instante
    setTareas((prev) => prev.map((x) => (x.id === t.id ? { ...x, progreso, completada } : x)));
    try {
      await updateTareaProgreso(t.id, progreso, completada);
    } catch {
      avisarError("No se pudo guardar el avance");
      cargar();
    }
  }

  const pendientes = tareas.filter((t) => !t.completada);
  const hechas = tareas.filter((t) => t.completada);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Mis tareas</h1>
        <p className="text-sm capitalize text-stone-500">{formatFechaLarga(hoyISO())}</p>
      </div>

      {cargando ? (
        <Card><p className="text-sm text-stone-400">Cargando…</p></Card>
      ) : tareas.length === 0 ? (
        <Card className="text-center">
          <ListChecks className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-2 text-stone-500">No tienes tareas asignadas para hoy. 🎉</p>
        </Card>
      ) : (
        <>
          {pendientes.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start gap-2">
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="flex-1 text-stone-800">{t.descripcion}</p>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-stone-500">
                  <span>Avance</span>
                  <span className="font-semibold text-amber-600">{t.progreso}%</span>
                </div>
                <Barra progreso={t.progreso} completada={false} />
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {PASOS.map((p) => (
                    <button
                      key={p}
                      onClick={() => fijar(t, p, p === 100)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${t.progreso === p ? "bg-amber-500 text-white" : "border border-stone-300 bg-white text-stone-600 hover:bg-amber-50"}`}
                    >
                      {p}%
                    </button>
                  ))}
                  <Boton className="ml-auto" onClick={() => fijar(t, 100, true)}>
                    <Check className="h-4 w-4" /> Completada
                  </Boton>
                </div>
              </div>
            </Card>
          ))}

          {hechas.length > 0 && (
            <div>
              <div className="mb-2 mt-4 text-sm font-semibold text-stone-500">Completadas ({hechas.length})</div>
              <div className="space-y-2">
                {hechas.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="flex-1 text-stone-600 line-through">{t.descripcion}</span>
                    <button onClick={() => fijar(t, 75, false)} className="text-xs font-medium text-stone-400 hover:text-amber-600">
                      Reabrir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Admin: asignar y controlar tareas ─── */
function TareasAdmin() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const revision = useStore((s) => s.revision);
  const [empleados, setEmpleados] = useState<Miembro[]>([]);
  const [selId, setSelId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [nueva, setNueva] = useState("");

  useEffect(() => {
    if (!negocioId) return;
    cargarMiembros(negocioId).then((ms) => {
      const emp = ms.filter((m) => m.rol === "empleado");
      setEmpleados(emp);
      setSelId((prev) => prev || (emp[0]?.usuarioId ?? ""));
    });
  }, [negocioId]);

  const cargar = useCallback(async () => {
    if (!negocioId || !selId) {
      setTareas([]);
      return;
    }
    try {
      setTareas(await cargarTareas(negocioId, selId, fecha));
    } catch {
      /* noop */
    }
  }, [negocioId, selId, fecha]);
  useEffect(() => {
    cargar();
  }, [cargar, revision]);

  const sel = empleados.find((e) => e.usuarioId === selId);

  async function agregar() {
    if (!negocioId || !selId) return;
    if (!nueva.trim()) {
      avisarFalta("Escribe la tarea que vas a asignar.");
      return;
    }
    try {
      await insertTarea({ negocioId, usuarioId: selId, fecha, descripcion: nueva.trim() });
      setNueva("");
      avisar("Tarea asignada");
      await cargar();
    } catch {
      avisarError("No se pudo asignar la tarea");
    }
  }
  async function borrar(t: Tarea) {
    if (!(await confirmarEliminar("Se eliminará esta tarea."))) return;
    try {
      await deleteTarea(t.id);
      avisar("Tarea eliminada");
      await cargar();
    } catch {
      avisarError("No se pudo eliminar");
    }
  }
  async function guardarTexto(t: Tarea, texto: string) {
    try {
      await updateTareaTexto(t.id, texto.trim() || t.descripcion);
      avisar();
      await cargar();
    } catch {
      avisarError("No se pudo guardar");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-800">Tareas</h1>

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
              <span className="mb-1 block text-xs font-medium text-stone-500">Día</span>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
            </label>
          </div>

          {/* Asignar nueva tarea */}
          <Card>
            <div className="mb-2 flex items-center gap-2 font-semibold text-stone-800">
              <ListChecks className="h-4 w-4 text-amber-600" /> Asignar tarea a {sel?.nombre || sel?.email}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                className={`${inputCls} min-h-[44px] flex-1 resize-y`}
                rows={2}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Ej: Organizar la vitrina de la entrada y limpiar los probadores"
              />
              <Boton onClick={agregar}>
                <Plus className="h-4 w-4" /> Asignar
              </Boton>
            </div>
            <p className="mt-2 text-xs text-stone-500">El empleado verá esta tarea el día indicado y podrá marcar su avance.</p>
          </Card>

          {/* Lista de tareas del día */}
          <div className="space-y-2">
            {tareas.length === 0 && <Card><p className="text-sm text-stone-400">Sin tareas para este día.</p></Card>}
            {tareas.map((t) => (
              <TareaAdminRow key={t.id} tarea={t} onBorrar={() => borrar(t)} onGuardarTexto={(txt) => guardarTexto(t, txt)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TareaAdminRow({ tarea, onBorrar, onGuardarTexto }: { tarea: Tarea; onBorrar: () => void; onGuardarTexto: (texto: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(tarea.descripcion);

  return (
    <Card>
      <div className="flex items-start gap-2">
        {tarea.completada ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
        {editando ? (
          <div className="flex-1">
            <textarea className={`${inputCls} min-h-[44px] resize-y`} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <Boton onClick={() => { if (!texto.trim()) { avisarFalta("La tarea no puede quedar vacía."); return; } onGuardarTexto(texto); setEditando(false); }}><Check className="h-4 w-4" /> Guardar</Boton>
              <Boton variant="ghost" onClick={() => { setTexto(tarea.descripcion); setEditando(false); }}><X className="h-4 w-4" /> Cancelar</Boton>
            </div>
          </div>
        ) : (
          <p className={`flex-1 ${tarea.completada ? "text-stone-500 line-through" : "text-stone-800"}`}>{tarea.descripcion}</p>
        )}
        {!editando && (
          <div className="flex gap-1">
            <button onClick={() => setEditando(true)} className="text-stone-300 hover:text-amber-600" title="Editar"><Pencil className="h-4 w-4" /></button>
            <button onClick={onBorrar} className="text-stone-300 hover:text-rose-500" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {!editando && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <Barra progreso={tarea.progreso} completada={tarea.completada} />
          </div>
          {tarea.completada ? <Chip tone="green">Completada</Chip> : <Chip tone="amber">{tarea.progreso}%</Chip>}
        </div>
      )}
    </Card>
  );
}
