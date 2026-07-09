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
  efectivo_real    bigint not null default 0,   -- efectivo contado hoy en la caja
  base_siguiente   bigint not null default 0,   -- (sin uso; se conserva por compatibilidad)
  cuadrado         boolean,                      -- true = cuadró (verde), false = no cuadró (rojo)
  diferencia       bigint not null default 0,   -- diferencia cuando NO cuadró (±)
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

-- Configuración por negocio (WhatsApp del almacén, correo para códigos, etc.)
create table if not exists public.configuracion (
  negocio_id     uuid primary key references public.negocios(id) on delete cascade,
  whatsapp       text not null default '',
  correo_codigos text not null default '',
  actualizado_en timestamptz not null default now()
);
alter table public.configuracion enable row level security;
drop policy if exists config_select on public.configuracion;
create policy config_select on public.configuracion for select using (public.es_miembro(negocio_id));
drop policy if exists config_write on public.configuracion;
create policy config_write on public.configuracion for all
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));

-- ============================================================
-- FASE 7a — Roles: admin = todo · empleado = solo HOY y solo agregar
-- ============================================================

-- Columnas para mostrar colaboradores en el panel de admin
alter table public.miembros add column if not exists email text;
alter table public.miembros add column if not exists nombre text;

-- Fecha de hoy en Bogotá (para limitar al empleado al día actual)
create or replace function public.hoy_bogota()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- Trigger: recalcular estado del apartado cuando cambian sus abonos
-- (así el empleado puede abonar sin necesidad de permiso para editar apartados)
create or replace function public.recalcular_estado_apartado()
returns trigger language plpgsql security definer set search_path = public as $$
declare ap_id uuid; total bigint; vt bigint;
begin
  ap_id := coalesce(new.apartado_id, old.apartado_id);
  select coalesce(sum(monto), 0) into total from public.abonos where apartado_id = ap_id;
  select valor_total into vt from public.apartados where id = ap_id;
  update public.apartados
    set estado = case when vt > 0 and total >= vt then 'completado' else 'pendiente' end
    where id = ap_id;
  return null;
end;
$$;
drop trigger if exists trg_recalc_estado on public.abonos;
create trigger trg_recalc_estado
  after insert or update or delete on public.abonos
  for each row execute function public.recalcular_estado_apartado();

-- VENTAS
drop policy if exists ventas_all on public.ventas;
drop policy if exists ventas_sel on public.ventas;
drop policy if exists ventas_ins on public.ventas;
drop policy if exists ventas_upd on public.ventas;
drop policy if exists ventas_del on public.ventas;
create policy ventas_sel on public.ventas for select using (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy ventas_ins on public.ventas for insert with check (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy ventas_upd on public.ventas for update using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
create policy ventas_del on public.ventas for delete using (public.es_admin(negocio_id));

-- GASTOS
drop policy if exists gastos_all on public.gastos;
drop policy if exists gastos_sel on public.gastos;
drop policy if exists gastos_ins on public.gastos;
drop policy if exists gastos_upd on public.gastos;
drop policy if exists gastos_del on public.gastos;
create policy gastos_sel on public.gastos for select using (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy gastos_ins on public.gastos for insert with check (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy gastos_upd on public.gastos for update using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
create policy gastos_del on public.gastos for delete using (public.es_admin(negocio_id));

-- ENTRADAS
drop policy if exists entradas_all on public.entradas;
drop policy if exists entradas_sel on public.entradas;
drop policy if exists entradas_ins on public.entradas;
drop policy if exists entradas_upd on public.entradas;
drop policy if exists entradas_del on public.entradas;
create policy entradas_sel on public.entradas for select using (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy entradas_ins on public.entradas for insert with check (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy entradas_upd on public.entradas for update using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
create policy entradas_del on public.entradas for delete using (public.es_admin(negocio_id));

-- APARTADOS
drop policy if exists apartados_all on public.apartados;
drop policy if exists apartados_sel on public.apartados;
drop policy if exists apartados_ins on public.apartados;
drop policy if exists apartados_upd on public.apartados;
drop policy if exists apartados_del on public.apartados;
create policy apartados_sel on public.apartados for select using (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy apartados_ins on public.apartados for insert with check (public.es_admin(negocio_id) or (public.es_miembro(negocio_id) and fecha = public.hoy_bogota()));
create policy apartados_upd on public.apartados for update using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
create policy apartados_del on public.apartados for delete using (public.es_admin(negocio_id));

-- ABONOS: ver/insertar cualquier miembro (el apartado ya limita la visibilidad); borrar solo admin
drop policy if exists abonos_all on public.abonos;
drop policy if exists abonos_sel on public.abonos;
drop policy if exists abonos_ins on public.abonos;
drop policy if exists abonos_del on public.abonos;
create policy abonos_sel on public.abonos for select using (public.es_miembro(public.negocio_de_apartado(apartado_id)));
create policy abonos_ins on public.abonos for insert with check (public.es_miembro(public.negocio_de_apartado(apartado_id)));
create policy abonos_del on public.abonos for delete using (public.es_admin(public.negocio_de_apartado(apartado_id)));

-- CUADRES y METAS: solo admin
drop policy if exists cuadres_all on public.cuadres;
create policy cuadres_admin on public.cuadres for all using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));
drop policy if exists metas_all on public.metas;
create policy metas_admin on public.metas for all using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));

-- ============================================================
-- FASE 7b — Códigos de acceso para colaboradores
-- ============================================================
create table if not exists public.codigos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  codigo      text not null,
  expira_en   timestamptz not null,
  creado_en   timestamptz not null default now()
);
create index if not exists idx_codigos_neg on public.codigos(negocio_id, expira_en);
alter table public.codigos enable row level security;
drop policy if exists codigos_admin on public.codigos;
create policy codigos_admin on public.codigos for all
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));

-- El colaborador NO lee la tabla; solo valida con esta función (security definer)
create or replace function public.validar_codigo(p_negocio uuid, p_codigo text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.codigos
    where negocio_id = p_negocio and codigo = p_codigo and expira_en > now()
      and public.es_miembro(p_negocio)
  );
$$;
grant execute on function public.validar_codigo(uuid, text) to anon, authenticated;

-- ============================================================
-- FASE 7c — Registro de hora (entrada) + nómina
-- ============================================================

-- Salario mínimo mensual (base para el descuento por retraso)
alter table public.configuracion add column if not exists salario_minimo bigint not null default 0;

-- Vincular un gasto con el empleado al que se le pagó (nómina)
alter table public.gastos add column if not exists empleado_id uuid references auth.users(id);

-- Registro de entrada del empleado (una por día)
create table if not exists public.registros_hora (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  fecha         date not null,
  hora_entrada  timestamptz not null default now(),
  minutos_tarde int not null default 0,
  descuento     bigint not null default 0,
  creado_en     timestamptz not null default now(),
  unique (negocio_id, usuario_id, fecha)
);
create index if not exists idx_registros_hora_neg on public.registros_hora(negocio_id, fecha);

alter table public.registros_hora enable row level security;
-- El empleado ve solo lo suyo; el admin ve todo el negocio
drop policy if exists rh_sel on public.registros_hora;
create policy rh_sel on public.registros_hora for select
  using (public.es_admin(negocio_id) or usuario_id = auth.uid());
-- El insert real lo hace la función (security definer); esta política es de respaldo
drop policy if exists rh_ins on public.registros_hora;
create policy rh_ins on public.registros_hora for insert
  with check (usuario_id = auth.uid() and public.es_miembro(negocio_id) and fecha = public.hoy_bogota());

-- Registrar la entrada de hoy. Horario 9:00 am, tolerancia hasta 9:15.
-- Después de las 9:15 se descuenta cada minuto según el salario mínimo
-- (jornada 9am–9pm = 12 h, 30 días → salario / (30*12*60) por minuto).
create or replace function public.registrar_entrada(p_negocio uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid          uuid := auth.uid();
  hoy          date := public.hoy_bogota();
  ahora_local  timestamp := (now() at time zone 'America/Bogota');
  limite       timestamp := date_trunc('day', ahora_local) + time '09:15';
  mins         int := 0;
  desc_val     bigint := 0;
  sal          bigint := 0;
  ya           public.registros_hora;
begin
  if uid is null or not public.es_miembro(p_negocio) then
    return json_build_object('error', 'No autorizado');
  end if;

  select * into ya from public.registros_hora
    where negocio_id = p_negocio and usuario_id = uid and fecha = hoy;
  if found then
    return json_build_object(
      'error', 'Ya registraste tu entrada hoy',
      'minutosTarde', ya.minutos_tarde,
      'descuento', ya.descuento,
      'hora', to_char(ya.hora_entrada at time zone 'America/Bogota', 'HH12:MI AM')
    );
  end if;

  if ahora_local > limite then
    mins := ceil(extract(epoch from (ahora_local - limite)) / 60.0)::int;
    select coalesce(salario_minimo, 0) into sal from public.configuracion where negocio_id = p_negocio;
    desc_val := round(coalesce(sal, 0)::numeric / (30 * 12 * 60) * mins)::bigint;
  end if;

  insert into public.registros_hora (negocio_id, usuario_id, fecha, hora_entrada, minutos_tarde, descuento)
    values (p_negocio, uid, hoy, now(), mins, desc_val);

  return json_build_object(
    'minutosTarde', mins,
    'descuento', desc_val,
    'hora', to_char(ahora_local, 'HH12:MI AM')
  );
end;
$$;
grant execute on function public.registrar_entrada(uuid) to authenticated;

-- ============================================================
-- FASE 7d — Sincronía en tiempo real · firma de pagos · corrección de entradas
-- ============================================================

-- Firma del empleado (data URL) al recibir un pago de nómina
alter table public.gastos add column if not exists firma text;

-- Entrada anulada por el admin (sigue bloqueando el reintento del día)
alter table public.registros_hora add column if not exists anulada boolean not null default false;

-- El admin puede corregir entradas (marcar "llegó a tiempo" / anular).
-- No hay política de DELETE: así la entrada del día no se puede borrar de verdad
-- y el empleado no puede volver a registrarla.
drop policy if exists rh_upd on public.registros_hora;
create policy rh_upd on public.registros_hora for update
  using (public.es_admin(negocio_id)) with check (public.es_admin(negocio_id));

-- Realtime: publicar los cambios de estas tablas para sincronizar dispositivos.
-- (RLS sigue decidiendo qué filas recibe cada usuario.)
do $$
declare t text;
begin
  foreach t in array array['ventas','gastos','entradas','apartados','abonos','cuadres','metas','registros_hora','configuracion']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- Permisos para el rol de la app (la seguridad real la pone RLS)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- service_role (llave secreta): acceso total (necesario porque se desactivó "auto expose")
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- ============================================================
-- Fin del esquema. Almacén Diana G 🐝
-- ============================================================
