alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

alter table public.agents enable row level security;
alter table public.agent_settings enable row level security;
alter table public.question_templates enable row level security;
alter table public.leads enable row level security;
alter table public.lead_answers enable row level security;
alter table public.lead_scores enable row level security;
alter table public.invites enable row level security;
alter table public.appointments enable row level security;
alter table public.showings enable row level security;
alter table public.agent_device_tokens enable row level security;
alter table public.lead_contact_interactions enable row level security;
alter table public.agent_feedback enable row level security;
alter table public.product_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.consent_records enable row level security;
alter table public.diagnostic_events enable row level security;
alter table public.server_error_events enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.outbox_jobs enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.privacy_requests enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'agents',
        'agent_settings',
        'question_templates',
        'leads',
        'lead_answers',
        'lead_scores',
        'invites',
        'appointments',
        'showings',
        'agent_device_tokens',
        'lead_contact_interactions',
        'agent_feedback',
        'product_events',
        'audit_events',
        'consent_records',
        'diagnostic_events',
        'server_error_events',
        'api_rate_limits',
        'outbox_jobs',
        'notification_outbox',
        'privacy_requests'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

revoke all on table
  public.agents,
  public.agent_settings,
  public.question_templates,
  public.leads,
  public.lead_answers,
  public.lead_scores,
  public.invites,
  public.appointments,
  public.showings,
  public.agent_device_tokens,
  public.lead_contact_interactions,
  public.agent_feedback,
  public.product_events,
  public.audit_events,
  public.consent_records,
  public.diagnostic_events,
  public.server_error_events,
  public.api_rate_limits,
  public.outbox_jobs,
  public.notification_outbox,
  public.privacy_requests
from anon;

revoke all on table
  public.agents,
  public.agent_settings,
  public.question_templates,
  public.leads,
  public.lead_answers,
  public.lead_scores,
  public.invites,
  public.appointments,
  public.showings,
  public.lead_contact_interactions,
  public.agent_feedback,
  public.product_events,
  public.audit_events,
  public.consent_records,
  public.diagnostic_events,
  public.server_error_events,
  public.api_rate_limits,
  public.outbox_jobs,
  public.notification_outbox,
  public.privacy_requests
from authenticated;

grant select on table
  public.agents,
  public.agent_settings,
  public.question_templates,
  public.leads,
  public.lead_answers,
  public.lead_scores,
  public.invites,
  public.appointments,
  public.showings,
  public.lead_contact_interactions
to authenticated;

grant select, insert, update, delete on table public.agent_device_tokens to authenticated;

grant select, insert, update, delete on table
  public.agents,
  public.agent_settings,
  public.question_templates,
  public.leads,
  public.lead_answers,
  public.lead_scores,
  public.invites,
  public.appointments,
  public.showings,
  public.agent_device_tokens,
  public.lead_contact_interactions,
  public.agent_feedback,
  public.product_events,
  public.audit_events,
  public.consent_records,
  public.diagnostic_events,
  public.server_error_events,
  public.api_rate_limits,
  public.outbox_jobs,
  public.notification_outbox,
  public.privacy_requests
to service_role;

grant usage, select on all sequences in schema public to service_role;

create policy agents_select_own
on public.agents
for select
to authenticated
using (id = (select auth.uid()));

create policy agent_settings_select_own
on public.agent_settings
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy question_templates_select_own
on public.question_templates
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy leads_select_own
on public.leads
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy lead_answers_select_own
on public.lead_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_answers.lead_id
      and leads.agent_id = (select auth.uid())
  )
);

create policy lead_scores_select_own
on public.lead_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_scores.lead_id
      and leads.agent_id = (select auth.uid())
  )
);

create policy invites_select_own
on public.invites
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy appointments_select_own
on public.appointments
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy showings_select_own_appointments
on public.showings
for select
to authenticated
using (
  exists (
    select 1
    from public.appointments
    where appointments.id = showings.appointment_id
      and appointments.agent_id = (select auth.uid())
  )
);

create policy lead_contact_interactions_select_own
on public.lead_contact_interactions
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy agent_device_tokens_select_own
on public.agent_device_tokens
for select
to authenticated
using (agent_id = (select auth.uid()));

create policy agent_device_tokens_insert_own
on public.agent_device_tokens
for insert
to authenticated
with check (agent_id = (select auth.uid()));

create policy agent_device_tokens_update_own
on public.agent_device_tokens
for update
to authenticated
using (agent_id = (select auth.uid()))
with check (agent_id = (select auth.uid()));

create policy agent_device_tokens_delete_own
on public.agent_device_tokens
for delete
to authenticated
using (agent_id = (select auth.uid()));

create policy agent_feedback_no_direct_access
on public.agent_feedback
for all
to public
using (false)
with check (false);

create policy product_events_no_direct_access
on public.product_events
for all
to public
using (false)
with check (false);

create policy audit_events_no_direct_access
on public.audit_events
for all
to public
using (false)
with check (false);

create policy consent_records_no_direct_access
on public.consent_records
for all
to public
using (false)
with check (false);

create policy diagnostic_events_no_direct_access
on public.diagnostic_events
for all
to public
using (false)
with check (false);

create policy server_error_events_no_direct_access
on public.server_error_events
for all
to public
using (false)
with check (false);

create policy api_rate_limits_no_direct_access
on public.api_rate_limits
for all
to public
using (false)
with check (false);

create policy outbox_jobs_no_direct_access
on public.outbox_jobs
for all
to public
using (false)
with check (false);

create policy notification_outbox_no_direct_access
on public.notification_outbox
for all
to public
using (false)
with check (false);

create policy privacy_requests_no_direct_access
on public.privacy_requests
for all
to public
using (false)
with check (false);
