-- Semana 10 - GeoCam ve + Tutor IA (taller T3 + casa C5)
-- Ejecutar en el SQL Editor DESPUÉS de semana8-geocam.sql y semana9-geocam.sql, una sola vez.

-- T3. Descripción de la foto sugerida por la IA y revisada por el usuario.
-- Viaja con la sincronización de la Semana 9 (push y pull), igual que la nota.
alter table public.photos
  add column ai_description text;

-- C5. Límite de peticiones de IA por usuario: una fila por cada petición aceptada.
-- Las Edge Functions cuentan y escriben con el cliente DEL USUARIO (su token), no con la
-- secret key: así RLS garantiza que nadie cuenta, ve ni inserta filas de otra persona.
create table public.uso_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  funcion text not null check (funcion in ('tutor', 'describir-foto', 'tarjetas')),
  created_at timestamptz not null default now()
);

create index uso_ia_user_created_idx on public.uso_ia (user_id, created_at desc);

alter table public.uso_ia enable row level security;

-- Ver lo propio (para contar las peticiones de las últimas 24 horas)
create policy "ver mi uso de ia" on public.uso_ia
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Insertar lo propio
create policy "registrar mi uso de ia" on public.uso_ia
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Sin políticas de UPDATE ni DELETE: nadie puede borrar su historial para "recargar" el cupo.
-- Además, la fecha la pone el servidor: un cliente no puede insertar filas con fechas viejas.
revoke update, delete on public.uso_ia from authenticated, anon;

create or replace function public.uso_ia_fecha_servidor()
returns trigger language plpgsql as $$
begin
  new.created_at = now();
  return new;
end;
$$;

create trigger uso_ia_fecha_servidor
  before insert on public.uso_ia
  for each row execute function public.uso_ia_fecha_servidor();
