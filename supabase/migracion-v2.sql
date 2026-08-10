-- ============================================================
--  MIGRACIÓN v1 → v2
--  Corré esto SOLO si ya creaste la tabla con el schema anterior.
--  (Si empezás de cero, usá schema.sql, que ya viene actualizado.)
--
--  Pegalo en Supabase → SQL Editor → Run.
--  Se puede correr dos veces sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El campo nuevo: estado
-- ------------------------------------------------------------
-- Antes teníamos un booleano `hecho`. Ahora una tarea puede estar
-- en tres lugares distintos:
--
--   'cola'   → la anotó para más adelante. NO aparece en la dona
--              ni cuenta para el progreso.
--   'activa' → está en la dona. Es el trabajo comprometido.
--   'hecha'  → terminada. Sale de la dona y se va a la lista de
--              hechas, PERO sigue contando como 1 en el progreso
--              del padre (si no, el padre nunca se completaría).

alter table public.tareas
  add column if not exists estado text not null default 'activa';

-- Pasamos lo que había: lo tildado a 'hecha', el resto a 'activa'.
update public.tareas
   set estado = case when hecho then 'hecha' else 'activa' end
 where estado not in ('cola', 'activa', 'hecha')
    or estado is null;

-- Y recién ahora le ponemos el candado, con los datos ya limpios.
do $$
begin
  alter table public.tareas
    add constraint tareas_estado_valido
    check (estado in ('cola', 'activa', 'hecha'));
exception
  when duplicate_object then null;
end $$;

create index if not exists tareas_estado_idx on public.tareas(estado);


-- ------------------------------------------------------------
-- 2. Chau `hecho`
-- ------------------------------------------------------------
-- Dos columnas que dicen lo mismo es una garantía de que en algún
-- momento se van a contradecir. Una sola fuente de verdad.

alter table public.tareas drop column if exists hecho;


-- ============================================================
--  Listo. Actualizá también los archivos js/ y css/ del proyecto.
-- ============================================================
