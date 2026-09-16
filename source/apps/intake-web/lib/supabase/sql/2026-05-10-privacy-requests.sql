create table if not exists public.privacy_requests (
  id uuid primary key,
  agent_id uuid references public.agents (id) on delete set null,
  requester_email text,
  request_type text not null check (request_type in ('account_deletion', 'data_deletion')),
  status text not null default 'requested' check (status in ('requested', 'verifying', 'processing', 'completed', 'rejected')),
  source text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_agent_created_at_idx
  on public.privacy_requests (agent_id, created_at desc);

create index if not exists privacy_requests_status_created_at_idx
  on public.privacy_requests (status, created_at desc);

alter table public.privacy_requests enable row level security;

grant select, insert, update on table public.privacy_requests to service_role;
