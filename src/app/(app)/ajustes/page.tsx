"use client";
import { useState } from "react";
import { MessageCircle, Save, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { avisar } from "@/lib/alerta";
import { telefonoWhatsApp } from "@/lib/whatsapp";
import { Card, Boton, Input, Field } from "@/components/ui";

export default function Ajustes() {
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Ajustes</h1>
        <p className="text-sm text-stone-500">Configuración de tu almacén</p>
      </div>

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

      {/* Códigos (Fase 7) — próximamente */}
      <Card className="opacity-70">
        <div className="mb-1 flex items-center gap-2 font-semibold text-stone-800">🔑 Códigos de acceso</div>
        <p className="text-sm text-stone-500">
          Aquí configurarás el correo a donde llegan los códigos diarios para los colaboradores. (Próximo paso)
        </p>
      </Card>
    </div>
  );
}
