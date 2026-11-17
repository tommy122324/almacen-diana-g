-- Ejecutar COMPLETO en Supabase > SQL Editor. Solo agrega columnas; no toca datos existentes.
-- Fase 7n: recibos para apartados y pedidos (separados de las ventas)
-- Solo AGREGA columnas; los recibos existentes quedan como "venta".
alter table public.recibos add column if not exists tipo text not null default 'venta';
alter table public.recibos add column if not exists apartado_id uuid;
alter table public.recibos add column if not exists abonado bigint;
create index if not exists idx_recibos_apartado on public.recibos(apartado_id);
create or replace function public.recibo_publico(p_id uuid)
returns json language sql security definer stable set search_path = public as $$
  select json_build_object(
    'id', r.id, 'numero', r.numero, 'fecha', r.fecha, 'cliente', r.cliente, 'telefono', r.telefono,
    'detalle', r.detalle, 'metodo', r.metodo, 'total', r.total, 'atendio', r.atendio, 'creado_en', r.creado_en,
    'calificacion', r.calificacion, 'comentario', r.comentario, 'tipo', r.tipo, 'abonado', r.abonado,
    'negocio', n.nombre, 'politica', c.politica_recibo, 'whatsapp', c.whatsapp)
  from public.recibos r join public.negocios n on n.id = r.negocio_id
  left join public.configuracion c on c.negocio_id = r.negocio_id
  where r.id = p_id;
$$;
grant execute on function public.recibo_publico(uuid) to anon, authenticated;
notify pgrst, 'reload schema';

