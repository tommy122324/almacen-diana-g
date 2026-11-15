import { createClient } from "@supabase/supabase-js";
import type { MetodoPago, Recibo } from "@/lib/types";

export interface ReciboPublico {
  recibo: Recibo;
  negocio: string;
  politica: string;
  whatsapp: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee un recibo por su id (link público; el id es imposible de adivinar). */
export async function obtenerReciboPublico(id: string): Promise<ReciboPublico | null> {
  if (!UUID.test(id)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("recibo_publico", { p_id: id });
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  const s = (v: unknown) => String(v ?? "");
  return {
    recibo: {
      id: s(r.id),
      negocioId: "",
      numero: Number(r.numero ?? 0),
      ventaId: null,
      fecha: s(r.fecha),
      cliente: s(r.cliente),
      telefono: s(r.telefono),
      detalle: s(r.detalle),
      metodo: (s(r.metodo) || "efectivo") as MetodoPago,
      total: Number(r.total ?? 0),
      atendio: s(r.atendio),
      reclamo: null,
      reclamoEn: null,
      creadoEn: s(r.creado_en),
    },
    negocio: s(r.negocio) || "Almacén",
    politica: s(r.politica),
    whatsapp: s(r.whatsapp),
  };
}

/** Oculta parte del celular del cliente (el link se puede reenviar). */
export function celularOculto(t: string) {
  const d = t.replace(/\D/g, "");
  if (d.length < 7) return t;
  return `${d.slice(0, 3)} *** ${d.slice(-4)}`;
}
