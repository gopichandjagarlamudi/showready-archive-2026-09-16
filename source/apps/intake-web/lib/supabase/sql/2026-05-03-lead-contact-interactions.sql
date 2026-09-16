create table if not exists public.lead_contact_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  method text not null check (method in ('call', 'text', 'email')),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists lead_contact_interactions_agent_lead_occurred_at_idx
  on public.lead_contact_interactions (agent_id, lead_id, occurred_at desc);

create index if not exists lead_contact_interactions_agent_occurred_at_idx
  on public.lead_contact_interactions (agent_id, occurred_at desc);

create index if not exists lead_contact_interactions_occurred_at_idx
  on public.lead_contact_interactions (occurred_at);

create or replace function public.enforce_lead_contact_interaction_agent_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_lead_agent_id uuid;
begin
  select agent_id into v_lead_agent_id
  from public.leads
  where id = new.lead_id;

  if v_lead_agent_id is null then
    raise exception 'Lead does not exist.';
  end if;

  if new.agent_id <> v_lead_agent_id then
    raise exception 'Contact interaction agent_id must match lead agent_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists lead_contact_interactions_enforce_agent_match on public.lead_contact_interactions;
create trigger lead_contact_interactions_enforce_agent_match
before insert or update of lead_id, agent_id on public.lead_contact_interactions
for each row
execute function public.enforce_lead_contact_interaction_agent_match();

create or replace function public.cleanup_lead_contact_interactions(
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
    delete from public.lead_contact_interactions
    where id in (
      select id
      from public.lead_contact_interactions
      where occurred_at < p_now - interval '1 year'
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

alter table public.lead_contact_interactions enable row level security;

revoke all on function public.cleanup_lead_contact_interactions(timestamptz, integer) from public;
revoke all on function public.cleanup_showready_retention(timestamptz, integer) from public;

grant execute on function public.cleanup_lead_contact_interactions(timestamptz, integer) to service_role;
grant execute on function public.cleanup_showready_retention(timestamptz, integer) to service_role;
