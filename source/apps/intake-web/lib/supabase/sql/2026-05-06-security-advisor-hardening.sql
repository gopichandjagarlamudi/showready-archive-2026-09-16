create schema if not exists extensions;

alter extension pg_trgm set schema extensions;

alter function public.set_updated_at()
set search_path = public, pg_temp;

revoke all on table public.api_rate_limits from anon, authenticated;
revoke all on table public.notification_outbox from anon, authenticated;
revoke all on table public.outbox_jobs from anon, authenticated;
revoke all on table public.server_error_events from anon, authenticated;

grant select, insert, update, delete on table public.api_rate_limits to service_role;
grant select, insert, update, delete on table public.notification_outbox to service_role;
grant select, insert, update, delete on table public.outbox_jobs to service_role;
grant select, insert, update, delete on table public.server_error_events to service_role;

drop policy if exists api_rate_limits_no_direct_access on public.api_rate_limits;
create policy api_rate_limits_no_direct_access
on public.api_rate_limits
for all
to public
using (false)
with check (false);

drop policy if exists notification_outbox_no_direct_access on public.notification_outbox;
create policy notification_outbox_no_direct_access
on public.notification_outbox
for all
to public
using (false)
with check (false);

drop policy if exists outbox_jobs_no_direct_access on public.outbox_jobs;
create policy outbox_jobs_no_direct_access
on public.outbox_jobs
for all
to public
using (false)
with check (false);

drop policy if exists server_error_events_no_direct_access on public.server_error_events;
create policy server_error_events_no_direct_access
on public.server_error_events
for all
to public
using (false)
with check (false);

revoke execute on function public.claim_agent_push_notification_jobs(uuid, uuid[], integer) from public, anon, authenticated;
revoke execute on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke execute on function public.claim_outbox_jobs(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_api_rate_limits(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_audit_events(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_diagnostic_events(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_lead_contact_interactions(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_product_events(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_server_error_events(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_showready_retention(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, integer, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.consume_rate_limits(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.create_agent_appointment(uuid, uuid, date, time, text, jsonb) from public, anon, authenticated;
revoke execute on function public.finalize_submitted_invite(uuid, uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.get_agent_dashboard_summary(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_agent_appointment(uuid, uuid, date, time, text, jsonb) from public, anon, authenticated;

grant execute on function public.claim_agent_push_notification_jobs(uuid, uuid[], integer) to service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.claim_outbox_jobs(integer) to service_role;
grant execute on function public.cleanup_api_rate_limits(timestamptz, integer) to service_role;
grant execute on function public.cleanup_audit_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_diagnostic_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_lead_contact_interactions(timestamptz, integer) to service_role;
grant execute on function public.cleanup_product_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_server_error_events(timestamptz, integer) to service_role;
grant execute on function public.cleanup_showready_retention(timestamptz, integer) to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer, timestamptz) to service_role;
grant execute on function public.consume_rate_limits(jsonb, timestamptz) to service_role;
grant execute on function public.create_agent_appointment(uuid, uuid, date, time, text, jsonb) to service_role;
grant execute on function public.finalize_submitted_invite(uuid, uuid, numeric, text, text, jsonb) to service_role;
grant execute on function public.get_agent_dashboard_summary(uuid) to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.update_agent_appointment(uuid, uuid, date, time, text, jsonb) to service_role;
