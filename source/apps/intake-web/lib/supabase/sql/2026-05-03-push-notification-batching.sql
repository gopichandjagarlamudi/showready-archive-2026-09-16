create extension if not exists pgcrypto;

create table if not exists public.agent_device_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'unknown')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_device_tokens_token_not_blank check (length(trim(expo_push_token)) > 0),
  constraint agent_device_tokens_agent_token_unique unique (agent_id, expo_push_token)
);

create index if not exists agent_device_tokens_agent_last_seen_idx
  on public.agent_device_tokens (agent_id, last_seen_at desc);

alter table public.agent_device_tokens enable row level security;

drop policy if exists agent_device_tokens_select_own on public.agent_device_tokens;
create policy agent_device_tokens_select_own
  on public.agent_device_tokens
  for select
  to authenticated
  using (agent_id = auth.uid());

drop policy if exists agent_device_tokens_insert_own on public.agent_device_tokens;
create policy agent_device_tokens_insert_own
  on public.agent_device_tokens
  for insert
  to authenticated
  with check (agent_id = auth.uid());

drop policy if exists agent_device_tokens_update_own on public.agent_device_tokens;
create policy agent_device_tokens_update_own
  on public.agent_device_tokens
  for update
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists agent_device_tokens_delete_own on public.agent_device_tokens;
create policy agent_device_tokens_delete_own
  on public.agent_device_tokens
  for delete
  to authenticated
  using (agent_id = auth.uid());

grant select, insert, update, delete on public.agent_device_tokens to authenticated;
grant all on public.agent_device_tokens to service_role;

create or replace function public.claim_agent_push_notification_jobs(
  p_agent_id uuid,
  p_excluded_job_ids uuid[] default '{}'::uuid[],
  p_limit integer default 50
)
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
    where agent_id = p_agent_id
      and job_type = 'intake.submitted.push_notifications'
      and not (id = any(coalesce(p_excluded_job_ids, '{}'::uuid[])))
      and (
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
    limit greatest(0, least(p_limit, 50))
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

revoke all on function public.claim_agent_push_notification_jobs(uuid, uuid[], integer) from public;
grant execute on function public.claim_agent_push_notification_jobs(uuid, uuid[], integer) to service_role;
