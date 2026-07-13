"use client";
import { useEffect, useState, useCallback } from "react";
import { UserPlus, Trash2, ShieldCheck, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { cargarMiembros, type Miembro } from "@/lib/db";
import { avisar, avisarError, confirmar, avisarFalta } from "@/lib/alerta";
import { Card, Boton, Input, Field } from "@/components/ui";

export function GestionUsuarios() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creando, setCreando] = useState(false);

  const recargar = useCallback(async () => {
    if (!negocioId) return;
    try {
      setMiembros(await cargarMiembros(negocioId));
    } catch {
      /* noop */
    }
  }, [negocioId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  async function crear() {
    if (!email.trim()) {
      avisarFalta("Escribe el correo del colaborador.");
      return;
    }
    if (password.length < 6) {
      avisarFalta("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCreando(true);
    try {
      const r = await fetch("/api/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId, nombre: nombre.trim(), email: email.trim(), password }),
      });
      const data = await r.json();
      if (!r.ok) {
        avisarError(data.error || "No se pudo crear el colaborador");
      } else {
        avisar("Colaborador creado");
        setNombre("");
        setEmail("");
        setPassword("");
        await recargar();
      }
    } catch {
      avisarError("Error de conexión");
    } finally {
      setCreando(false);
    }
  }

  async function eliminar(m: Miembro) {
    if (!(await confirmar("¿Eliminar colaborador?", `Se eliminará el acceso de ${m.email || m.nombre}.`, "Sí, eliminar"))) return;
    try {
      const r = await fetch("/api/colaboradores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId, usuarioId: m.usuarioId }),
      });
      const data = await r.json();
      if (!r.ok) avisarError(data.error || "No se pudo eliminar");
      else {
        avisar("Colaborador eliminado");
        await recargar();
      }
    } catch {
      avisarError("Error de conexión");
    }
  }

  const colaboradores = miembros.filter((m) => m.rol === "empleado");
  const admins = miembros.filter((m) => m.rol === "dueño" || m.rol === "admin");

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
        <ShieldCheck className="h-5 w-5 text-amber-600" /> Usuarios y colaboradores
      </div>

      {/* Crear colaborador */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
        <div className="mb-2 text-sm font-semibold text-stone-700">Crear colaborador</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Laura" />
          </Field>
          <Field label="Correo (será su usuario)">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="laura@correo.com" autoComplete="off" />
          </Field>
          <Field label="Contraseña (mínimo 6)">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" autoComplete="new-password" />
          </Field>
          <div className="flex items-end">
            <Boton onClick={crear} disabled={creando} className="w-full">
              <UserPlus className="h-4 w-4" /> {creando ? "Creando…" : "Crear colaborador"}
            </Boton>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          El colaborador solo puede <b>agregar</b> ventas, gastos, entradas y apartados/pedidos del <b>día de hoy</b>.
          No ve reportes ni ajustes, y no puede editar ni eliminar.
        </p>
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {admins.map((m) => (
          <div key={m.usuarioId} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span className="flex-1">{m.email || m.nombre || "Administrador"}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 capitalize">{m.rol}</span>
          </div>
        ))}
        {colaboradores.length === 0 && <p className="px-2 text-sm text-stone-400">Aún no hay colaboradores.</p>}
        {colaboradores.map((m) => (
          <div key={m.usuarioId} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-stone-50">
            <User className="h-4 w-4 text-stone-400" />
            <div className="flex-1">
              <div className="font-medium text-stone-800">{m.nombre || m.email}</div>
              {m.nombre && <div className="text-xs text-stone-400">{m.email}</div>}
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">Colaborador</span>
            <button onClick={() => eliminar(m)} className="text-stone-300 hover:text-rose-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
