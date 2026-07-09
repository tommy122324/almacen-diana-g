"use client";
import { useState, useEffect } from "react";
import { MessageCircle, Save, Check, Lock, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { avisar, avisarError, confirmar } from "@/lib/alerta";
import { telefonoWhatsApp } from "@/lib/whatsapp";
import { generarCodigo, codigoActivo, cancelarCodigo } from "@/lib/db";
import { Card, Boton, Input, Field } from "@/components/ui";
import { GestionUsuarios } from "@/components/GestionUsuarios";

export default function Ajustes() {
  const esAdmin = useStore((s) => s.esAdmin);
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);

  const [whatsapp, setWhatsapp] = useState(config.whatsapp);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    await setConfig({ whatsapp: whatsapp.trim() });
    setGuardado(true);
    avisar("WhatsApp del almacén guardado");
    setTimeout(() => setGuardado(false), 2500);
  }

  const numeroFormateado = telefonoWhatsApp(whatsapp);

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
        <h1 className="text-2xl font-bold text-stone-800">Ajustes</h1>
        <p className="text-sm text-stone-500">Configuración de tu almacén</p>
      </div>

      <GestionUsuarios />

      {/* WhatsApp del almacén */}
      <Card>
        <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
          <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp del almacén
        </div>

        <Field label="Número de WhatsApp (celular colombiano, 10 dígitos)">
          <Input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            inputMode="tel"
            placeholder="Ej: 300 123 4567"
          />
        </Field>

        {whatsapp.trim() && (
          <p className="mt-2 text-xs text-stone-500">
            Se usará como: <span className="font-semibold text-stone-700">+{numeroFormateado}</span>
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Boton onClick={guardar}>
            {guardado ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {guardado ? "Guardado" : "Guardar"}
          </Boton>
        </div>

        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-stone-600">
          <b>¿Cómo se envían los mensajes?</b> Cuando marcas un pedido como entregado, se abre WhatsApp con
          el mensaje listo para el cliente. El mensaje sale <b>desde el WhatsApp abierto en ese dispositivo</b>,
          así que ten la sesión del almacén iniciada (en el celular o en WhatsApp Web). Este número queda
          guardado como el número oficial del almacén.
        </div>
      </Card>

      <CodigosAdmin />
    </div>
  );
}

function CodigosAdmin() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const [codigo, setCodigo] = useState("");
  const [expira, setExpira] = useState("");
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!negocioId) return;
    codigoActivo(negocioId).then((c) => {
      if (c) {
        setCodigo(c.codigo);
        setExpira(new Date(c.expiraEn).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
      }
    });
  }, [negocioId]);

  async function generar() {
    if (!negocioId) return;
    setGenerando(true);
    try {
      const r = await generarCodigo(negocioId);
      setCodigo(r.codigo);
      setExpira(new Date(r.expiraEn).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
      avisar("Código generado");
    } catch {
      avisarError("No se pudo generar el código");
    } finally {
      setGenerando(false);
    }
  }

  async function cancelar() {
    if (!negocioId) return;
    if (!(await confirmar("¿Cancelar el código?", "El colaborador ya no podrá entrar con este código.", "Sí, cancelar"))) return;
    try {
      await cancelarCodigo(negocioId);
      setCodigo("");
      setExpira("");
      avisar("Código cancelado");
    } catch {
      avisarError("No se pudo cancelar");
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2 font-semibold text-stone-800">
        <KeyRound className="h-5 w-5 text-amber-600" /> Código de acceso para colaboradores
      </div>
      <p className="mb-3 text-xs text-stone-500">
        Genera un código y compártelo con tu colaborador. Sirve todo el día siguiente. Puedes cancelarlo cuando quieras.
      </p>

      {codigo && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="text-3xl font-bold tracking-widest tabular-nums text-amber-800">{codigo}</div>
          <div className="mt-1 text-xs text-stone-500">Válido hasta el {expira}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton onClick={generar} disabled={generando}>
          <RefreshCw className="h-4 w-4" /> {generando ? "Generando…" : codigo ? "Generar nuevo" : "Generar código"}
        </Boton>
        {codigo && (
          <Boton variant="danger" onClick={cancelar}>
            <Trash2 className="h-4 w-4" /> Cancelar código
          </Boton>
        )}
      </div>
    </Card>
  );
}
