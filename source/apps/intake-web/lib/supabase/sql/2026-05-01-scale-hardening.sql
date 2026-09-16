create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

alter table public.appointments
  add column if not exists agent_id uuid references public.agents (id) on delete cascade;

update public.appointments as appointment
set agent_id = lead.agent_id
from public.leads as lead
where appointment.lead_id = lead.id
  and appointment.agent_id is null;

do $$
begin
  if exists (select 1 from public.appointments where agent_id is null) then
    raise exception 'appointments.agent_id backfill left null rows; fix orphaned appointments before enforcing tenant scope.';
  end if;
end;
$$;

alter table public.appointments
  alter column agent_id set not null;

create or replace function public.enforce_appointment_lead_agent_match()
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
    raise exception 'Appointment lead does not exist.';
  end if;

  if new.agent_id is null then
    new.agent_id := v_lead_agent_id;
  end if;

  if new.agent_id <> v_lead_agent_id then
    raise exception 'Appointment agent_id must match lead agent_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_enforce_lead_agent_match on public.appointments;
create trigger appointments_enforce_lead_agent_match
before insert or update of lead_id, agent_id on public.appointments
for each row
execute function public.enforce_appointment_lead_agent_match();

create index if not exists appointments_agent_status_schedule_idx
  on public.appointments (agent_id, status, date, start_time, created_at desc);

create unique index if not exists appointments_one_scheduled_per_lead_idx
  on public.appointments (lead_id)
  where status = 'scheduled';

create unique index if not exists lead_scores_one_system_score_per_lead_idx
  on public.lead_scores (lead_id)
  where overridden = false;

create index if not exists leads_buyer_name_trgm_idx
  on public.leads using gin (buyer_name gin_trgm_ops);

create index if not exists leads_buyer_email_trgm_idx
  on public.leads using gin (buyer_email gin_trgm_ops);

create index if not exists leads_buyer_phone_trgm_idx
  on public.leads using gin (buyer_phone gin_trgm_ops);

create index if not exists leads_summary_trgm_idx
  on public.leads using gin (summary gin_trgm_ops);

create or replace function public.get_agent_dashboard_summary(p_agent_id uuid)
returns table(
  total_leads bigint,
  new_leads bigint,
  ready_to_show bigint,
  appointment_booked bigint,
  nurture bigint,
  hold bigint,
  average_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped_leads as (
    select id, status, pipeline_stage, score
    from public.leads
    where agent_id = p_agent_id
  ),
  appointment_booked_leads as (
    select id as lead_id
    from scoped_leads
    where pipeline_stage = 'appointment_booked'
    union
    select lead_id
    from public.appointments
    where agent_id = p_agent_id
      and status = 'scheduled'
  )
  select
    count(*)::bigint as total_leads,
    count(*) filter (where status = 'submitted' and pipeline_stage = 'new')::bigint as new_leads,
    count(*) filter (where pipeline_stage = 'ready_to_show')::bigint as ready_to_show,
    (select count(*)::bigint from appointment_booked_leads) as appointment_booked,
    count(*) filter (where pipeline_stage = 'nurture')::bigint as nurture,
    count(*) filter (where pipeline_stage = 'hold')::bigint as hold,
    coalesce(round(avg(score)::numeric, 2), 0)::numeric as average_score
  from scoped_leads;
$$;

create or replace function public.finalize_submitted_invite(
  p_agent_id uuid,
  p_lead_id uuid,
  p_score numeric,
  p_recommendation text,
  p_summary text,
  p_breakdown jsonb
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads;
begin
  if p_recommendation not in ('show', 'nurture', 'hold') then
    raise exception 'Invalid recommendation.';
  end if;

  select *
  into v_lead
  from public.leads
  where id = p_lead_id
    and agent_id = p_agent_id
  for update;

  if v_lead.id is null then
    raise exception 'Lead not found.';
  end if;

  if v_lead.status = 'submitted' then
    return v_lead;
  end if;

  insert into public.lead_scores (
    lead_id,
    total,
    recommendation,
    summary,
    breakdown,
    overridden
  )
  values (
    p_lead_id,
    p_score,
    p_recommendation::public.recommendation,
    p_summary,
    coalesce(p_breakdown, '{}'::jsonb),
    false
  )
  on conflict do nothing;

  update public.leads
  set status = 'submitted',
      pipeline_stage = 'new',
      score = p_score,
      recommendation = p_recommendation::public.recommendation,
      reviewed_stage = null,
      reviewed_at = null,
      summary = p_summary,
      submitted_at = now(),
      updated_at = now()
  where id = p_lead_id
    and agent_id = p_agent_id
    and status <> 'submitted'
  returning * into v_lead;

  if v_lead.id is null then
    select *
    into v_lead
    from public.leads
    where id = p_lead_id
      and agent_id = p_agent_id;
  end if;

  return v_lead;
end;
$$;

create or replace function public.create_agent_appointment(
  p_agent_id uuid,
  p_lead_id uuid,
  p_date date,
  p_start_time time,
  p_notes text,
  p_showings jsonb
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_stage text;
  v_appointment public.appointments;
  v_showing jsonb;
  v_index integer := 0;
begin
  if jsonb_typeof(p_showings) <> 'array' or jsonb_array_length(p_showings) = 0 then
    raise exception 'Appointment requires at least one showing.';
  end if;

  select pipeline_stage into v_lead_stage
  from public.leads
  where id = p_lead_id
    and agent_id = p_agent_id;

  if v_lead_stage is null then
    raise exception 'Lead not found.';
  end if;

  if v_lead_stage not in ('ready_to_show', 'nurture', 'hold') then
    raise exception 'Appointments can only be created for ready, nurture, or hold leads.';
  end if;

  insert into public.appointments (agent_id, lead_id, date, start_time, status, notes)
  values (p_agent_id, p_lead_id, p_date, p_start_time, 'scheduled', nullif(trim(p_notes), ''))
  returning * into v_appointment;

  for v_showing in select * from jsonb_array_elements(p_showings)
  loop
    insert into public.showings (appointment_id, address, order_index, notes)
    values (
      v_appointment.id,
      nullif(trim(v_showing->>'address'), ''),
      v_index,
      nullif(trim(coalesce(v_showing->>'notes', '')), '')
    );
    v_index := v_index + 1;
  end loop;

  return v_appointment;
end;
$$;

create or replace function public.update_agent_appointment(
  p_agent_id uuid,
  p_appointment_id uuid,
  p_date date,
  p_start_time time,
  p_notes text,
  p_showings jsonb
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_showing jsonb;
  v_index integer := 0;
begin
  if jsonb_typeof(p_showings) <> 'array' or jsonb_array_length(p_showings) = 0 then
    raise exception 'Appointment requires at least one showing.';
  end if;

  update public.appointments
  set date = p_date,
      start_time = p_start_time,
      notes = nullif(trim(p_notes), '')
  where id = p_appointment_id
    and agent_id = p_agent_id
  returning * into v_appointment;

  if v_appointment.id is null then
    raise exception 'Appointment not found.';
  end if;

  delete from public.showings
  where appointment_id = p_appointment_id;

  for v_showing in select * from jsonb_array_elements(p_showings)
  loop
    insert into public.showings (appointment_id, address, order_index, notes)
    values (
      p_appointment_id,
      nullif(trim(v_showing->>'address'), ''),
      v_index,
      nullif(trim(coalesce(v_showing->>'notes', '')), '')
    );
    v_index := v_index + 1;
  end loop;

  return v_appointment;
end;
$$;

create table if not exists public.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  agent_id uuid not null references public.agents (id) on delete cascade,
  job_type text not null,
  resource_type text not null,
  resource_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'completed', 'dead')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outbox_jobs_status_available_idx
  on public.outbox_jobs (status, available_at, created_at)
  where status in ('pending', 'failed');

create index if not exists outbox_jobs_stale_processing_idx
  on public.outbox_jobs (locked_at)
  where status = 'processing';

create index if not exists outbox_jobs_agent_created_idx
  on public.outbox_jobs (agent_id, created_at desc);

create or replace function public.claim_outbox_jobs(p_limit integer default 10)
returns setof public.outbox_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate_jobs as (
    select id
    from public.outbox_jobs
    where (
      (
        status in ('pending', 'failed')
        and coalesce(available_at, now()) <= now()
      )
      or (
        status = 'processing'
        and locked_at < now() - interval '15 minutes'
      )
    )
      and attempt_count < max_attempts
    order by created_at
    limit greatest(1, least(p_limit, 25))
    for update skip locked
  )
  update public.outbox_jobs as job
  set status = 'processing',
      attempt_count = job.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from candidate_jobs
  where job.id = candidate_jobs.id
  returning job.*;
end;
$$;

create index if not exists diagnostic_events_occurred_at_idx
  on public.diagnostic_events (occurred_at);

create index if not exists product_events_occurred_at_idx
  on public.product_events (occurred_at);

create index if not exists audit_events_occurred_at_idx
  on public.audit_events (occurred_at);

create index if not exists api_rate_limits_reset_at_idx
  on public.api_rate_limits (reset_at);

drop function if exists public.cleanup_diagnostic_events(timestamptz);
drop function if exists public.cleanup_product_events(timestamptz);
drop function if exists public.cleanup_audit_events(timestamptz);
drop function if exists public.cleanup_api_rate_limits(timestamptz);
drop function if exists public.cleanup_showready_retention(timestamptz);

create or replace function public.cleanup_diagnostic_events(
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
    delete from public.diagnostic_events
    where ctid in (
      select ctid
      from public.diagnostic_events
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

create or replace function public.cleanup_product_events(
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
    delete from public.product_events
    where ctid in (
      select ctid
      from public.product_events
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

create or replace function public.cleanup_audit_events(
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
    delete from public.audit_events
    where ctid in (
      select ctid
      from public.audit_events
      where occurred_at < p_now - interval '7 years'
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

create or replace function public.cleanup_api_rate_limits(
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
    delete from public.api_rate_limits
    where key in (
      select key
      from public.api_rate_limits
      where reset_at < p_now - interval '5 minutes'
      order by reset_at
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
end;
$$;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer,
  p_now timestamptz default now()
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reset_at timestamptz := p_now + make_interval(secs => p_window_ms / 1000.0);
  v_count integer;
begin
  if p_limit < 1 or p_window_ms < 1000 then
    raise exception 'Invalid rate limit configuration.';
  end if;

  insert into public.api_rate_limits as limits (key, count, reset_at, updated_at)
  values (p_key, 1, v_reset_at, p_now)
  on conflict (key) do update
    set count = case
          when limits.reset_at <= p_now then 1
          else limits.count + 1
        end,
        reset_at = case
          when limits.reset_at <= p_now then v_reset_at
          else limits.reset_at
        end,
        updated_at = p_now
  returning limits.count, limits.reset_at into v_count, v_reset_at;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_reset_at;
  return next;
end;
$$;

alter table public.diagnostic_events enable row level security;
alter table public.product_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.consent_records enable row level security;
alter table public.outbox_jobs enable row level security;

revoke all on function public.claim_outbox_jobs(integer) from public;
revoke all on function public.create_agent_appointment(uuid, uuid, date, time, text, jsonb) from public;
revoke all on function public.update_agent_appointment(uuid, uuid, date, time, text, jsonb) from public;
revoke all on function public.finalize_submitted_invite(uuid, uuid, numeric, text, text, jsonb) from public;
revoke all on function public.cleanup_diagnostic_events(timestamptz, integer) from public;
revoke all on function public.cleanup_product_events(timestamptz, integer) from public;
revoke all on function public.cleanup_audit_events(timestamptz, integer) from public;
revoke all on function public.cleanup_api_rate_limits(timestamptz, integer) from public;
revoke all on function public.cleanup_showready_retention(timestamptz, integer) from public;

grant execute on function public.get_agent_dashboard_summary(uuid) to authenticated, service_role;
grant execute on function public.create_agent_appointment(uuid, uuid, date, time, text, jsonb) to service_role;
grant execute on function public.update_agent_appointment(uuid, uuid, date, time, text, jsonb) to service_role;
grant execute on function public.finalize_submitted_invite(uuid, uuid, numeric, text, text, jsonb) to service_role;
grant execute on function public.claim_outbox_jobs(integer) to service_role;
grant execute on function public.cleanup_diagnostic_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_product_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_audit_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_api_rate_limits(timestamptz, integer) to service_role;
grant execute on function public.cleanup_showready_retention(timestamptz, integer) to service_role;
