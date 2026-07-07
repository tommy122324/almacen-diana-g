-- ============================================================
-- Almacén Diana G 🐝 — Esquema de base de datos (PostgreSQL / Supabase)
-- ------------------------------------------------------------
-- Multi-tenant con seguridad a nivel de fila (RLS).
-- Modelo "plano": cada registro guarda su fecha (sin tabla de días).
-- Ejecuta este script completo en: Supabase → SQL Editor → Run.
-- ============================================================

-- ---------- Tipos ----------
do $$ begin
  create type rol_miembro as enum ('dueño', 'admin', 'empleado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metodo_pago as enum ('efectivo', 'nequi', 'daviplata', 'tarjeta', 'credito', 'sistecredito', 'addi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_apartado as enum ('apartado', 'pedido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_apartado as enum ('pendiente', 'completado');
exception when duplicate_object then null; end $$;

-- ---------- Tablas ----------

create table if not exists public.negocios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  dueno_id   uuid not null references auth.users(id) on delete cascade,
  creado_en  timestamptz not null default now()
);

create table if not exists public.miembros (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  rol         rol_miembro not null default 'empleado',
  creado_en   timestamptz not null default now(),
  unique (negocio_id, usuario_id)
);

create table if not exists public.ventas (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  fecha       date not null,
  metodo      metodo_pago not null,
  monto       bigint not null check (monto >= 0),
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

create table if not exists public.gastos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  fecha       date not null,
  concepto    text not null,
  monto       bigint not null check (monto >= 0),
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

create table if not exists public.entradas (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  fecha       date not null,
  concepto    text not null,
  monto       bigint not null check (monto >= 0),
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

create table if not exists public.apartados (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  tipo         tipo_apartado not null default 'apartado',
  descripcion  text not null default '',
  fecha        date not null,
  cliente      text not null,
  telefono     text not null default '',
  valor_total  bigint not null default 0 check (valor_total >= 0),
  estado       estado_apartado not null default 'pendiente',
  conseguido   boolean not null default false,
  entregado    boolean not null default false,
  creado_por   uuid references auth.users(id),
  creado_en    timestamptz not null default now()
);

create table if not exists public.abonos (
  id           uuid primary key default gen_random_uuid(),
  apartado_id  uuid not null references public.apartados(id) on delete cascade,
  fecha        date not null,
  monto        bigint not null check (monto >= 0),
  metodo       metodo_pago not null default 'efectivo',
  creado_en    timestamptz not null default now()
);

create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  anio        int not null,
  mes         int not null check (mes between 1 and 12),
  monto_meta  bigint not null check (monto_meta >= 0),
  unique (negocio_id, anio, mes)
);

create table if not exists public.cuadres (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null references public.negocios(id) on delete cascade,
  fecha            date not null,
  efectivo_real    bigint not null default 0,
  base_siguiente   bigint not null default 0,
  creado_por       uuid references auth.users(id),
  creado_en        timestamptz not null default now(),
  unique (negocio_id, fecha)
);

-- ---------- Índices ----------
create index if not exists idx_miembros_usuario on public.miembros(usuario_id);
create index if not exists idx_ventas_neg_fecha  on public.ventas(negocio_id, fecha);
create index if not exists idx_gastos_neg_fecha  on public.gastos(negocio_id, fecha);
create index if not exists idx_entradas_neg_fecha on public.entradas(negocio_id, fecha);
create index if not exists idx_apartados_negocio on public.apartados(negocio_id, estado);
create index if not exists idx_abonos_apartado   on public.abonos(apartado_id);
create index if not exists idx_cuadres_neg_fecha on public.cuadres(negocio_id, fecha);

-- ============================================================
-- Funciones de seguridad
-- ============================================================

create or replace function public.es_miembro(negocio uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.miembros
    where negocio_id = negocio and usuario_id = auth.uid()
  );
$$;

create or replace function public.es_admin(negocio uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.miembros
    where negocio_id = negocio and usuario_id = auth.uid() and rol in ('dueño', 'admin')
  );
$$;

create or replace function public.negocio_de_apartado(ap uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select negocio_id from public.apartados where id = ap;
$$;

-- Al crear un negocio, el creador se vuelve dueño automáticamente.
create or replace function public.registrar_dueno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.miembros (negocio_id, usuario_id, rol)
  values (new.id, new.dueno_id, 'dueño');
  return new;
end;
$$;

drop trigger if exists trg_registrar_dueno on public.negocios;
create trigger trg_registrar_dueno
  after insert on public.negocios
  for each row execute function public.registrar_dueno();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.negocios  enable row level security;
alter table public.miembros  enable row level security;
alter table public.ventas    enable row level security;
alter table public.gastos    enable row level security;
alter table public.entradas  enable row level security;
alter table public.apartados enable row level security;
alter table public.abonos    enable row level security;
alter table public.metas     enable row level security;
alter table public.cuadres   enable row level security;

-- NEGOCIOS
drop policy if exists neg_select on public.negocios;
create policy neg_select on public.negocios for select using (public.es_miembro(id));
drop policy if exists neg_insert on public.negocios;
create policy neg_insert on public.negocios for insert with check (dueno_id = auth.uid());
drop policy if exists neg_update on public.negocios;
create policy neg_update on public.negocios for update using (public.es_admin(id));
drop policy if exists neg_delete on public.negocios;
create policy neg_delete on public.negocios for delete using (dueno_id = auth.uid());

-- MIEMBROS
drop policy if exists miem_select on public.miembros;
create policy miem_select on public.miembros for select using (public.es_miembro(negocio_id));
drop policy if exists miem_admin on public.miembros;
create policy miem_admin on public.miembros for all
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));

-- VENTAS / GASTOS / ENTRADAS / APARTADOS / METAS / CUADRES (por negocio)
drop policy if exists ventas_all on public.ventas;
create policy ventas_all on public.ventas for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));

drop policy if exists gastos_all on public.gastos;
create policy gastos_all on public.gastos for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));

drop policy if exists entradas_all on public.entradas;
create policy entradas_all on public.entradas for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));

drop policy if exists apartados_all on public.apartados;
create policy apartados_all on public.apartados for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));

drop policy if exists metas_all on public.metas;
create policy metas_all on public.metas for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));

drop policy if exists cuadres_all on public.cuadres;
create policy cuadres_all on public.cuadres for all
  using (public.es_miembro(negocio_id)) with check (public.es_miembro(negocio_id));

-- ABONOS (a través del apartado → negocio)
drop policy if exists abonos_all on public.abonos;
create policy abonos_all on public.abonos for all
  using (public.es_miembro(public.negocio_de_apartado(apartado_id)))
  with check (public.es_miembro(public.negocio_de_apartado(apartado_id)));

-- ============================================================
-- Permisos para el rol de la app (la seguridad real la pone RLS)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- ============================================================
-- Fin del esquema. Almacén Diana G 🐝
-- ============================================================
