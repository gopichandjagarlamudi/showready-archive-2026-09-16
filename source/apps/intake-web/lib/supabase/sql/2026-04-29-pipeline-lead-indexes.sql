create index if not exists leads_agent_stage_submitted_at_idx
  on public.leads (agent_id, pipeline_stage, submitted_at desc);

create index if not exists leads_agent_stage_updated_at_idx
  on public.leads (agent_id, pipeline_stage, updated_at desc);

create index if not exists leads_agent_status_stage_idx
  on public.leads (agent_id, status, pipeline_stage);

create index if not exists appointments_lead_status_date_time_idx
  on public.appointments (lead_id, status, date, start_time);
