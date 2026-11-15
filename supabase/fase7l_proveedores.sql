-- Ejecutar COMPLETO en Supabase > SQL Editor. Solo agrega tablas nuevas; no toca datos existentes.
-- Fase 7l: Proveedores y cuentas por pagar (solo administrador)
-- Solo AGREGA tablas nuevas. No modifica ventas, gastos ni pedidos.
-- ============================================================
create table if not exists public.proveedores (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  nombre      text not null,
  telefono    text not null default '',
  notas       text not null default '',
  creado_en   timestamptz not null default now()
);
create table if not exists public.cuentas_pagar (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  fecha        date not null default public.hoy_bogota(),
  vence        date,
  concepto     text not null default '',
  monto        bigint not null default 0,
  creado_en    timestamptz not null default now()
);
create table if not exists public.pagos_proveedor (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  cuenta_id   uuid not null references public.cuentas_pagar(id) on delete cascade,
  fecha       date not null default public.hoy_bogota(),
  monto       bigint not null default 0,
  metodo      text not null default 'efectivo',
  creado_en   timestamptz not null default now()
);
create index if not exists idx_proveedores_neg on public.proveedores(negocio_id);
create index if not exists idx_cuentas_pagar_neg on public.cuentas_pagar(negocio_id);
create index if not exists idx_pagos_proveedor_cuenta on public.pagos_proveedor(cuenta_id);
alter table public.proveedores enable row level security;
alter table public.cuentas_pagar enable row level security;
alter table public.pagos_proveedor enable row level security;
drop policy if exists proveedores_admin on public.proveedores;
create policy proveedores_admin on public.proveedores for all
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
drop policy if exists cuentas_pagar_admin on public.cuentas_pagar;
create policy cuentas_pagar_admin on public.cuentas_pagar for all
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
drop policy if exists pagos_proveedor_admin on public.pagos_proveedor;
create policy pagos_proveedor_admin on public.pagos_proveedor for all
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
grant select, insert, update, delete on public.proveedores, public.cuentas_pagar, public.pagos_proveedor to authenticated;
grant all on public.proveedores, public.cuentas_pagar, public.pagos_proveedor to service_role;

-- Fase 7m: calificaciones en tiempo real (recibos en Realtime)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recibos') then
    alter publication supabase_realtime add table public.recibos;
  end if;
end $$;
-- Que la API vea de inmediato las tablas nuevas
notify pgrst, 'reload schema';

