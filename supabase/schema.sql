-- ============================================================
-- Contabee 🐝 — Esquema de base de datos (PostgreSQL / Supabase)
-- ------------------------------------------------------------
-- Multi-tenant con seguridad a nivel de fila (RLS).
-- Cada usuario solo puede ver/editar datos de los negocios
-- a los que pertenece (tabla "miembros").
-- Ejecuta este script en: Supabase → SQL Editor.
-- ============================================================

-- ---------- Tipos ----------
do $$ begin
  create type rol_miembro as enum ('dueño', 'admin', 'empleado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metodo_pago as enum ('efectivo', 'credito', 'tarjeta', 'nequi', 'daviplata');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_fiado as enum ('pendiente', 'pagado');
exception when duplicate_object then null; end $$;

-- ---------- Tablas ----------

-- Negocios
create table if not exists public.negocios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  dueno_id   uuid not null references auth.users(id) on delete cascade,
  creado_en  timestamptz not null default now()
);

-- Miembros de cada negocio (con rol)
create table if not exists public.miembros (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  rol         rol_miembro not null default 'empleado',
  creado_en   timestamptz not null default now(),
  unique (negocio_id, usuario_id)
);

-- Días (un registro por fecha por negocio)
create table if not exists public.dias (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  fecha       date not null,
  creado_en   timestamptz not null default now(),
  unique (negocio_id, fecha)
);

-- Ventas por método de pago (montos en COP, enteros)
create table if not exists public.ventas (
  id          uuid primary key default gen_random_uuid(),
  dia_id      uuid not null references public.dias(id) on delete cascade,
  metodo      metodo_pago not null,
  monto       bigint not null check (monto >= 0),
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

-- Gastos (concepto libre + monto)
create table if not exists public.gastos (
  id          uuid primary key default gen_random_uuid(),
  dia_id      uuid not null references public.dias(id) on delete cascade,
  concepto    text not null,
  monto       bigint not null check (monto >= 0),
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

-- Entradas / otros ingresos
create table if not exists public.entradas (
  id          uuid primary key default gen_random_uuid(),
  dia_id      uuid not null references public.dias(id) on delete cascade,
  concepto    text not null,
  monto       bigint not null check (monto >= 0),
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

-- Fiados (crédito con seguimiento)
create table if not exists public.fiados (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  dia_id      uuid references public.dias(id) on delete set null,
  cliente     text not null,
  monto       bigint not null check (monto >= 0),
  estado      estado_fiado not null default 'pendiente',
  fecha_pago  date,
  creado_por  uuid references auth.users(id),
  creado_en   timestamptz not null default now()
);

-- Metas de ventas mensuales
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  anio        int not null,
  mes         int not null check (mes between 1 and 12),
  monto_meta  bigint not null check (monto_meta >= 0),
  unique (negocio_id, anio, mes)
);

-- Cuadre de caja diario
create table if not exists public.cuadre_caja (
  id                 uuid primary key default gen_random_uuid(),
  dia_id             uuid not null references public.dias(id) on delete cascade unique,
  efectivo_esperado  bigint not null default 0,
  efectivo_real      bigint not null default 0,
  diferencia         bigint generated always as (efectivo_real - efectivo_esperado) stored,
  creado_por         uuid references auth.users(id),
  creado_en          timestamptz not null default now()
);

-- Auditoría
create table if not exists public.auditoria (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid references public.negocios(id) on delete cascade,
  usuario_id   uuid references auth.users(id),
  accion       text not null,
  tabla        text not null,
  registro_id  uuid,
  detalle      jsonb,
  fecha        timestamptz not null default now()
);

-- ---------- Índices útiles ----------
create index if not exists idx_miembros_usuario on public.miembros(usuario_id);
create index if not exists idx_dias_negocio      on public.dias(negocio_id, fecha);
create index if not exists idx_ventas_dia        on public.ventas(dia_id);
create index if not exists idx_gastos_dia        on public.gastos(dia_id);
create index if not exists idx_entradas_dia      on public.entradas(dia_id);
create index if not exists idx_fiados_negocio    on public.fiados(negocio_id, estado);

-- ============================================================
-- Funciones auxiliares de seguridad
-- ============================================================

-- ¿El usuario actual es miembro de este negocio?
create or replace function public.es_miembro(negocio uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.miembros
    where negocio_id = negocio and usuario_id = auth.uid()
  );
$$;

-- ¿El usuario actual es dueño o admin de este negocio?
create or replace function public.es_admin(negocio uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.miembros
    where negocio_id = negocio
      and usuario_id = auth.uid()
      and rol in ('dueño', 'admin')
  );
$$;

-- Devuelve el negocio_id al que pertenece un día
create or replace function public.negocio_de_dia(dia uuid)
returns uuid
language sql security definer stable
set search_path = public
as $$
  select negocio_id from public.dias where id = dia;
$$;

-- Al crear un negocio, el creador se vuelve dueño automáticamente
create or replace function public.registrar_dueno()
returns trigger
language plpgsql security definer
set search_path = public
as $$
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
-- Row Level Security (RLS)
-- ============================================================

alter table public.negocios     enable row level security;
alter table public.miembros     enable row level security;
alter table public.dias         enable row level security;
alter table public.ventas       enable row level security;
alter table public.gastos       enable row level security;
alter table public.entradas     enable row level security;
alter table public.fiados       enable row level security;
alter table public.metas        enable row level security;
alter table public.cuadre_caja  enable row level security;
alter table public.auditoria    enable row level security;

-- NEGOCIOS: ves los negocios donde eres miembro; puedes crear los tuyos.
drop policy if exists neg_select on public.negocios;
create policy neg_select on public.negocios for select
  using (public.es_miembro(id));

drop policy if exists neg_insert on public.negocios;
create policy neg_insert on public.negocios for insert
  with check (dueno_id = auth.uid());

drop policy if exists neg_update on public.negocios;
create policy neg_update on public.negocios for update
  using (public.es_admin(id));

drop policy if exists neg_delete on public.negocios;
create policy neg_delete on public.negocios for delete
  using (dueno_id = auth.uid());

-- MIEMBROS: ves los miembros de tus negocios; solo admin gestiona.
drop policy if exists miem_select on public.miembros;
create policy miem_select on public.miembros for select
  using (public.es_miembro(negocio_id));

drop policy if exists miem_admin on public.miembros;
create policy miem_admin on public.miembros for all
  using (public.es_admin(negocio_id))
  with check (public.es_admin(negocio_id));

-- DIAS
drop policy if exists dias_all on public.dias;
create policy dias_all on public.dias for all
  using (public.es_miembro(negocio_id))
  with check (public.es_miembro(negocio_id));

-- VENTAS / GASTOS / ENTRADAS (a través del día → negocio)
drop policy if exists ventas_all on public.ventas;
create policy ventas_all on public.ventas for all
  using (public.es_miembro(public.negocio_de_dia(dia_id)))
  with check (public.es_miembro(public.negocio_de_dia(dia_id)));

drop policy if exists gastos_all on public.gastos;
create policy gastos_all on public.gastos for all
  using (public.es_miembro(public.negocio_de_dia(dia_id)))
  with check (public.es_miembro(public.negocio_de_dia(dia_id)));

drop policy if exists entradas_all on public.entradas;
create policy entradas_all on public.entradas for all
  using (public.es_miembro(public.negocio_de_dia(dia_id)))
  with check (public.es_miembro(public.negocio_de_dia(dia_id)));

-- FIADOS
drop policy if exists fiados_all on public.fiados;
create policy fiados_all on public.fiados for all
  using (public.es_miembro(negocio_id))
  with check (public.es_miembro(negocio_id));

-- METAS (solo admin edita; miembros leen)
drop policy if exists metas_select on public.metas;
create policy metas_select on public.metas for select
  using (public.es_miembro(negocio_id));

drop policy if exists metas_admin on public.metas;
create policy metas_admin on public.metas for all
  using (public.es_admin(negocio_id))
  with check (public.es_admin(negocio_id));

-- CUADRE DE CAJA
drop policy if exists cuadre_all on public.cuadre_caja;
create policy cuadre_all on public.cuadre_caja for all
  using (public.es_miembro(public.negocio_de_dia(dia_id)))
  with check (public.es_miembro(public.negocio_de_dia(dia_id)));

-- AUDITORIA (solo lectura para miembros; escritura vía servidor)
drop policy if exists audit_select on public.auditoria;
create policy audit_select on public.auditoria for select
  using (public.es_miembro(negocio_id));

drop policy if exists audit_insert on public.auditoria;
create policy audit_insert on public.auditoria for insert
  with check (public.es_miembro(negocio_id));

-- ============================================================
-- Fin del esquema. Contabee 🐝
-- ============================================================
