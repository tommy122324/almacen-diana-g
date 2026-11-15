"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore, uuid } from "@/lib/store";
import * as db from "@/lib/db";
import type { MetodoPago, Recibo } from "@/lib/types";
import { Field, Input, inputCls } from "@/components/ui";

export interface DatosRecibo {
  telefono: string;
  cliente: string;
  detalle: string;
}

export const reciboVacio: DatosRecibo = { telefono: "", cliente: "", detalle: "" };

const soloDigitos = (t: string) => t.replace(/\D/g, "").slice(-10);

/** Clientes conocidos (de recibos y apartados/pedidos) para autocompletar. */
function useClientesConocidos() {
  const negocioId = useStore((s) => s.negocioActivoId);
  const apartados = useStore((s) => s.apartados);
  const [deRecibos, setDeRecibos] = useState<{ telefono: string; cliente: string }[]>([]);
  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    db.clientesRecibos(negocioId).then((l) => vivo && setDeRecibos(l));
    return () => {
      vivo = false;
    };
  }, [negocioId]);
  return useMemo(() => {
    const mapa = new Map<string, { telefono: string; cliente: string }>();
    const agregar = (telefono: string, cliente: string) => {
      const k = soloDigitos(telefono);
      if (k.length >= 7 && !mapa.has(k)) mapa.set(k, { telefono: telefono.trim(), cliente: cliente.trim() });
    };
    deRecibos.forEach((c) => agregar(c.telefono, c.cliente));
    apartados.filter((a) => a.negocioId === negocioId).forEach((a) => agregar(a.telefono, a.cliente));
    return mapa;
  }, [deRecibos, apartados, negocioId]);
}

/** Campos del cliente para el recibo (WhatsApp, nombre, qué compró). */
export function CamposRecibo({ datos, onChange }: { datos: DatosRecibo; onChange: (d: DatosRecibo) => void }) {
  const clientes = useClientesConocidos();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <datalist id="clientes-recibo">
        {[...clientes.values()].map((c) => (
          <option key={c.telefono} value={c.telefono}>{c.cliente}</option>
        ))}
      </datalist>
      <Field label="WhatsApp del cliente">
        <Input
          value={datos.telefono}
          inputMode="tel"
          list="clientes-recibo"
          placeholder="Ej: 300 123 4567"
          onChange={(e) => {
            const telefono = e.target.value;
            const conocido = clientes.get(soloDigitos(telefono));
            onChange({ ...datos, telefono, cliente: !datos.cliente.trim() && conocido ? conocido.cliente : datos.cliente });
          }}
        />
      </Field>
      <Field label="Nombre del cliente (opcional)">
        <Input value={datos.cliente} onChange={(e) => onChange({ ...datos, cliente: e.target.value })} placeholder="Ej: María Gómez" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="¿Qué compró? (recomendado, sirve para cambios y reclamos)">
          <textarea
            className={`${inputCls} min-h-[44px] resize-y`}
            rows={2}
            value={datos.detalle}
            onChange={(e) => onChange({ ...datos, detalle: e.target.value })}
            placeholder="Ej: Jean azul talla 32 y blusa negra talla M"
          />
        </Field>
      </div>
    </div>
  );
}

/** Crea el recibo en la nube (requiere internet). */
export async function crearReciboVenta(d: {
  negocioId: string;
  ventaId: string | null;
  fecha: string;
  metodo: MetodoPago;
  total: number;
  atendio: string;
  datos: DatosRecibo;
}): Promise<Recibo> {
  return db.crearRecibo({
    id: uuid(),
    negocioId: d.negocioId,
    ventaId: d.ventaId,
    fecha: d.fecha,
    cliente: d.datos.cliente.trim(),
    telefono: d.datos.telefono.trim(),
    detalle: d.datos.detalle.trim(),
    metodo: d.metodo,
    total: d.total,
    atendio: d.atendio.trim(),
  });
}
