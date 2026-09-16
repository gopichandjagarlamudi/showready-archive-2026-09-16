create extension if not exists pgcrypto;

create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  message text not null,
  source text not null default 'mobile-settings',
  created_at timestamptz not null default now()
);

create index if not exists agent_feedback_agent_created_at_idx
  on public.agent_feedback (agent_id, created_at desc);

alter table public.agent_feedback enable row level security;
