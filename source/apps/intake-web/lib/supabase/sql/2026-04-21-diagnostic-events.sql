create table if not exists public.diagnostic_events (
  id uuid primary key,
  agent_id uuid not null references public.agents (id) on delete cascade,
  device_id text not null,
  session_id text not null,
  event_type text not null,
  category text not null,
  severity text not null,
  message text not null,
  fingerprint text,
  screen text,
  app_version text,
  build_number text,
  platform text not null,
  request_path text,
  http_status integer,
  lead_id uuid references public.leads (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  pipeline_stage text,
  context jsonb not null default '{}'::jsonb,
  breadcrumbs jsonb not null default '[]'::jsonb,
  tags jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists diagnostic_events_agent_occurred_at_idx
  on public.diagnostic_events (agent_id, occurred_at desc);

create index if not exists diagnostic_events_event_type_occurred_at_idx
  on public.diagnostic_events (event_type, occurred_at desc);

create index if not exists diagnostic_events_severity_occurred_at_idx
  on public.diagnostic_events (severity, occurred_at desc);

create index if not exists diagnostic_events_fingerprint_occurred_at_idx
  on public.diagnostic_events (fingerprint, occurred_at desc);
