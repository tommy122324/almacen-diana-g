"use client";
import { useState, useEffect, useRef } from "react";
import { MessageCircle, Save, Check, Lock, KeyRound, RefreshCw, Trash2, DatabaseBackup, Download, Upload, FileSpreadsheet } from "lucide-react";
import { useStore } from "@/lib/store";
import { avisar, avisarError, confirmar } from "@/lib/alerta";
import { telefonoWhatsApp } from "@/lib/whatsapp";
import { generarCodigo, codigoActivo, cancelarCodigo } from "@/lib/db";
import { descargarRespaldoJSON, descargarRespaldoExcel, restaurarRespaldoDesdeArchivo } from "@/lib/backup";
import { Card, Boton, Input, Field } from "@/components/ui";
import { MoneyInput } from "@/components/MoneyInput";
import { GestionUsuarios } from "@/components/GestionUsuarios";

export default function Ajustes() {
  const esAdmin = useStore((s) => s.esAdmin);
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);

  const [whatsapp, setWhatsapp] = useState(config.whatsapp);
  const [salario, setSalario] = useState(config.salarioMinimo);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    await setConfig({ whatsapp: whatsapp.trim(), salarioMinimo: salario });
    setGuardado(true);
    avisar("Configuración guardada");
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

        <div className="mt-4">
          <Field label="Salario mínimo mensual (para el descuento por retraso)">
            <MoneyInput value={salario} onChange={setSalario} className="sm:w-56" />
          </Field>
        </div>

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

      <RespaldoAdmin />
    </div>
  );
}

function RespaldoAdmin() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const negocios = useStore((s) => s.negocios);
  const refrescarRemoto = useStore((s) => s.refrescarRemoto);
  const nombre = negocios.find((n) => n.id === negocioId)?.nombre ?? "Almacén Diana G";
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<"" | "json" | "excel" | "restaurar">("");

  async function bajarJSON() {
    if (!negocioId) return;
    setOcupado("json");
    try {
      await descargarRespaldoJSON(negocioId, nombre);
      avisar("Respaldo descargado");
    } catch {
      avisarError("No se pudo generar el respaldo");
    } finally {
      setOcupado("");
    }
  }
  async function bajarExcel() {
    if (!negocioId) return;
    setOcupado("excel");
    try {
      await descargarRespaldoExcel(negocioId, nombre);
    } catch {
      avisarError("No se pudo generar el Excel");
    } finally {
      setOcupado("");
    }
  }
  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo || !negocioId) return;
    if (!(await confirmar("¿Restaurar este respaldo?", "Se volverán a agregar los registros del archivo a ESTE negocio. Los datos actuales no se borran; los repetidos se dejan igual.", "Sí, restaurar"))) return;
    setOcupado("restaurar");
    try {
      const { total } = await restaurarRespaldoDesdeArchivo(negocioId, archivo);
      await refrescarRemoto();
      avisar(`Respaldo restaurado (${total} registros)`);
    } catch (err) {
      avisarError(err instanceof Error ? err.message : "No se pudo restaurar");
    } finally {
      setOcupado("");
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2 font-semibold text-stone-800">
        <DatabaseBackup className="h-5 w-5 text-sky-600" /> Copia de seguridad
      </div>
      <p className="mb-3 text-xs text-stone-500">
        Descarga todos tus datos y guárdalos en tu computador o celular. Hazlo cada cierto tiempo (por ejemplo, al cerrar el mes) para tener un respaldo por si algo se borra por error.
      </p>

      <div className="flex flex-wrap gap-2">
        <Boton onClick={bajarJSON} disabled={ocupado !== ""}>
          <Download className="h-4 w-4" /> {ocupado === "json" ? "Generando…" : "Descargar respaldo (.json)"}
        </Boton>
        <Boton variant="outline" onClick={bajarExcel} disabled={ocupado !== ""}>
          <FileSpreadsheet className="h-4 w-4" /> {ocupado === "excel" ? "Generando…" : "Descargar en Excel"}
        </Boton>
        <Boton variant="outline" onClick={() => fileRef.current?.click()} disabled={ocupado !== ""}>
          <Upload className="h-4 w-4" /> {ocupado === "restaurar" ? "Restaurando…" : "Restaurar respaldo"}
        </Boton>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={alElegirArchivo} />
      </div>

      <div className="mt-3 rounded-xl bg-sky-50 p-3 text-xs text-stone-600">
        <b>¿Cuál uso?</b> El <b>.json</b> es el respaldo de verdad (sirve para <b>restaurar</b>). El <b>Excel</b> es solo para leer/imprimir los datos. Al restaurar, los registros vuelven al mismo negocio y los que ya existan no se duplican.
      </div>
    </Card>
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
