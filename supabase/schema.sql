-- ============================================================
--  DONA DE TAREAS — esquema completo
--  Pegá TODO este archivo en Supabase → SQL Editor → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. La tabla
-- ------------------------------------------------------------
-- padre_id apunta a la MISMA tabla: eso es lo que permite
-- tareas dentro de tareas dentro de tareas, sin límite.
-- on delete cascade => borrar una tarea se lleva todo su subárbol.

create table if not exists public.tareas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references auth.users(id) on delete cascade,
  padre_id   uuid references public.tareas(id) on delete cascade,
  titulo     text not null check (char_length(trim(titulo)) between 1 and 200),
  hecho      boolean not null default false,
  orden      integer not null default 0,
  creado_en  timestamptz not null default now()
);

create index if not exists tareas_user_idx  on public.tareas(user_id);
create index if not exists tareas_padre_idx on public.tareas(padre_id);


-- ------------------------------------------------------------
-- 2. PERMISOS (grants)
-- ------------------------------------------------------------
-- Si en la creación del proyecto destildaste "Automatically expose
-- new tables" (recomendado), la tabla NO es visible para la Data API
-- hasta que lo digas explícitamente acá.
--
-- Ojo con la diferencia, porque son dos candados distintos:
--   · el GRANT dice si un rol puede tocar la tabla
--   · la RLS  dice qué filas de esa tabla ve
-- Sin grant, PostgREST corta antes de evaluar la RLS y devuelve
-- "permission denied for table" (código 42501).
--
-- authenticated = tu tío después de loguearse. Es el único rol que
-- necesita permisos. A anon NO le damos nada: sin sesión no hay
-- absolutamente nada que hacer con esta tabla.

grant select, insert, update, delete on public.tareas to authenticated;


-- ------------------------------------------------------------
-- 3. SEGURIDAD (esto es lo que NO se puede saltear)
-- ------------------------------------------------------------
-- La anon key de Supabase es pública: está en el JS que cualquiera
-- puede leer. Lo que impide que un extraño toque los datos NO es
-- esconder la key, es esto de acá abajo.
--
-- Row Level Security: mientras esté activada, Postgres filtra CADA
-- consulta por las políticas. No importa desde dónde venga la request.

alter table public.tareas enable row level security;

-- Por las dudas, si corrés el script dos veces:
drop policy if exists "leer solo lo propio"      on public.tareas;
drop policy if exists "crear solo lo propio"     on public.tareas;
drop policy if exists "modificar solo lo propio" on public.tareas;
drop policy if exists "borrar solo lo propio"    on public.tareas;

-- auth.uid() = el id del usuario logueado en ESTA request.
-- Si nadie está logueado, auth.uid() es null y no matchea nunca:
-- sin sesión no se ve ni se escribe una sola fila.

create policy "leer solo lo propio" on public.tareas
  for select using (auth.uid() = user_id);

create policy "crear solo lo propio" on public.tareas
  for insert with check (auth.uid() = user_id);

create policy "modificar solo lo propio" on public.tareas
  for update using (auth.uid() = user_id)
         with check (auth.uid() = user_id);

create policy "borrar solo lo propio" on public.tareas
  for delete using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. Que una tarea no se pueda colgar de la tarea de otro
-- ------------------------------------------------------------
-- Detalle fino: las políticas de arriba ya impiden ver o tocar filas
-- ajenas, pero un atacante podría intentar crear una tarea propia
-- colgada de un padre ajeno. Este trigger lo corta.

create or replace function public.validar_padre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.padre_id is not null then
    if not exists (
      select 1 from public.tareas
      where id = new.padre_id and user_id = new.user_id
    ) then
      raise exception 'El padre no existe o no es tuyo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_padre_trg on public.tareas;
create trigger validar_padre_trg
  before insert or update on public.tareas
  for each row execute function public.validar_padre();


-- ------------------------------------------------------------
-- 5. Sincronización en vivo entre dispositivos
-- ------------------------------------------------------------
-- Con esto, si marca una tarea en el celular, la tablet se actualiza
-- sola en 1-2 segundos. Realtime respeta la RLS de arriba.

alter table public.tareas replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.tareas;
exception
  when duplicate_object then null;  -- ya estaba agregada
end $$;


-- ------------------------------------------------------------
-- 6. Función de "sigo vivo" para el ping diario
-- ------------------------------------------------------------
-- El workflow de GitHub necesita hacerle UNA request por día al
-- proyecto para que Supabase no lo pause. Antes pegaba contra la
-- tabla, pero ahora anon no tiene permisos ahí (y está bien así).
-- Esta función no lee ni escribe nada: solo contesta.

create or replace function public.ping()
returns text
language sql
stable
as $$ select 'ok'::text $$;

grant execute on function public.ping() to anon;


-- ============================================================
--  Listo. Ahora andá a Authentication → Users → Add user
--  y creá el usuario de tu tío (con "Auto Confirm User" tildado).
-- ============================================================
