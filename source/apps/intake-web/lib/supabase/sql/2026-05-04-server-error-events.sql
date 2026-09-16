create table if not exists public.server_error_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete set null,
  request_id text not null,
  route text not null,
  method text not null,
  path text not null,
  status integer not null,
  error_type text not null,
  message text not null,
  stack text,
  query_keys text[] not null default '{}'::text[],
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists server_error_events_occurred_at_idx
  on public.server_error_events (occurred_at);

create index if not exists server_error_events_route_occurred_at_idx
  on public.server_error_events (route, occurred_at desc);

create index if not exists server_error_events_status_occurred_at_idx
  on public.server_error_events (status, occurred_at desc);

create index if not exists server_error_events_request_id_idx
  on public.server_error_events (request_id);

create index if not exists server_error_events_agent_occurred_at_idx
  on public.server_error_events (agent_id, occurred_at desc)
  where agent_id is not null;

create or replace function public.cleanup_server_error_events(
  p_now timestamptz default now(),
  p_batch_size integer default 5000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  with deleted_rows as (
    delete from public.server_error_events
    where ctid in (
      select ctid
      from public.server_error_events
      where occurred_at < p_now - interval '90 days'
      order by occurred_at
      limit greatest(1, least(coalesce(p_batch_size, 5000), 50000))
    )
    returning 1
  )
  select count(*) into v_deleted
  from deleted_rows;

  return v_deleted;
end;
$$;

create or replace function public.cleanup_showready_retention(
  p_now timestamptz default now(),
  p_batch_size integer default 5000
)
returns table(target_table text, deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  target_table := 'diagnostic_events';
  deleted_count := public.cleanup_diagnostic_events(p_now, p_batch_size);
  return next;

  target_table := 'server_error_events';
  deleted_count := public.cleanup_server_error_events(p_now, p_batch_size);
  return next;

  target_table := 'product_events';
  deleted_count := public.cleanup_product_events(p_now, p_batch_size);
  return next;

  target_table := 'audit_events';
  deleted_count := public.cleanup_audit_events(p_now, p_batch_size);
  return next;

  target_table := 'api_rate_limits';
  deleted_count := public.cleanup_api_rate_limits(p_now, p_batch_size);
  return next;

  target_table := 'lead_contact_interactions';
  deleted_count := public.cleanup_lead_contact_interactions(p_now, p_batch_size);
  return next;
end;
$$;

alter table public.server_error_events enable row level security;

revoke all on function public.cleanup_server_error_events(timestamptz, integer) from public;
revoke all on function public.cleanup_showready_retention(timestamptz, integer) from public;

grant execute on function public.cleanup_server_error_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_showready_retention(timestamptz, integer) to service_role;
