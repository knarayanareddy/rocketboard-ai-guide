-- Create table for managing job locks
create table if not exists public.pack_job_locks (
  pack_id uuid not null,
  lock_name text not null,
  lock_token uuid not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pack_id, lock_name)
);

-- Index for expiry checks
create index if not exists idx_pack_job_locks_expiry on public.pack_job_locks (locked_until);

-- Function to acquire a lock
create or replace function public.acquire_pack_lock(
  p_pack_id uuid,
  p_lock_name text,
  p_ttl_seconds int default 3600
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_token uuid := gen_random_uuid();
begin
  insert into public.pack_job_locks (pack_id, lock_name, lock_token, locked_until)
  values (p_pack_id, p_lock_name, v_lock_token, now() + (p_ttl_seconds || ' seconds')::interval)
  on conflict (pack_id, lock_name)
  do update set
    lock_token = v_lock_token,
    locked_until = now() + (p_ttl_seconds || ' seconds')::interval,
    updated_at = now()
  where pack_job_locks.locked_until < now();

  if found then
    return v_lock_token;
  else
    return null;
  end if;
end;
$$;

-- Function to release a lock
create or replace function public.release_pack_lock(
  p_pack_id uuid,
  p_lock_name text,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pack_job_locks
  where pack_id = p_pack_id
    and lock_name = p_lock_name
    and lock_token = p_lock_token;

  return found;
end;
$$;

-- RLS Logic
alter table public.pack_job_locks enable row level security;

-- Only service_role can manage locks
create policy "Only service_role can manage locks"
  on public.pack_job_locks
  for all
  to service_role
  using (true)
  with check (true);

-- Revoke all from public
revoke all on public.pack_job_locks from public;
revoke all on function public.acquire_pack_lock(uuid, text, int) from public;
revoke all on function public.release_pack_lock(uuid, text, uuid) from public;

-- Grant to service_role (explicitly, though it usually has it)
grant all on public.pack_job_locks to service_role;
grant execute on function public.acquire_pack_lock(uuid, text, int) to service_role;
grant execute on function public.release_pack_lock(uuid, text, uuid) to service_role;
