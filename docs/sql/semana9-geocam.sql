-- Semana 9 - GeoCam sincronizada (taller T1 + casa C1)
-- Ejecutar en el SQL Editor DESPUÉS de semana8-geocam.sql, una sola vez.

-- T1. Reloj del servidor: cuándo llegó cada cambio a Supabase (cursor de bajada).
-- updated_at lo escribe el teléfono y decide los conflictos; server_updated_at lo
-- escribe PostgreSQL y dice "qué llegó después de X", aunque se haya editado sin conexión.
alter table public.photos
  add column server_updated_at timestamptz not null default now();

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

create trigger photos_touch_server_updated_at
  before insert or update on public.photos
  for each row execute function public.touch_server_updated_at();

create index photos_user_server_updated_idx
  on public.photos (user_id, server_updated_at);

-- La política de UPDATE que pide la guía ("editar las mías") ya existe desde la Semana 8
-- con el nombre "actualizar las mías": no se vuelve a crear.

-- C1. Borrado lógico: borrar una foto deja la fila con deleted_at para que los demás
-- teléfonos se enteren en su siguiente bajada. El archivo del bucket sí se elimina.
alter table public.photos
  add column deleted_at timestamptz;

-- C2. El feed de la pestaña Nube pagina por taken_at y oculta las borradas
create index photos_user_taken_idx
  on public.photos (user_id, taken_at desc)
  where deleted_at is null;
