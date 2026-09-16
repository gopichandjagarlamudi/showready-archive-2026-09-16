create table if not exists public.product_events (
  id uuid primary key,
  agent_id uuid references public.agents (id) on delete cascade,
  workspace_id uuid,
  actor_id text,
  event_name text not null,
  resource_type text,
  resource_id text,
  platform text,
  app_version text,
  build_number text,
  route text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists product_events_agent_occurred_at_idx
  on public.product_events (agent_id, occurred_at desc);

create index if not exists product_events_event_name_occurred_at_idx
  on public.product_events (event_name, occurred_at desc);

create index if not exists product_events_resource_occurred_at_idx
  on public.product_events (resource_type, resource_id, occurred_at desc);

create table if not exists public.audit_events (
  id uuid primary key,
  agent_id uuid references public.agents (id) on delete cascade,
  workspace_id uuid,
  actor_id text,
  actor_type text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_ip text,
  user_agent text,
  platform text,
  app_version text,
  before_summary jsonb not null default '{}'::jsonb,
  after_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists audit_events_agent_occurred_at_idx
  on public.audit_events (agent_id, occurred_at desc);

create index if not exists audit_events_actor_occurred_at_idx
  on public.audit_events (actor_id, occurred_at desc);

create index if not exists audit_events_resource_occurred_at_idx
  on public.audit_events (resource_type, resource_id, occurred_at desc);

create index if not exists audit_events_action_occurred_at_idx
  on public.audit_events (action, occurred_at desc);

create table if not exists public.consent_records (
  id uuid primary key,
  subject_type text not null,
  subject_id text,
  agent_id uuid references public.agents (id) on delete cascade,
  consent_type text not null,
  status text not null,
  policy_version text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  expires_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists consent_records_subject_type_id_type_occurred_at_idx
  on public.consent_records (subject_type, subject_id, consent_type, occurred_at desc);

create index if not exists consent_records_agent_type_occurred_at_idx
  on public.consent_records (agent_id, consent_type, occurred_at desc);
