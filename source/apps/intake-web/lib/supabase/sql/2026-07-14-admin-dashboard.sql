create index if not exists product_events_occurred_agent_idx
  on public.product_events (occurred_at desc, agent_id);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

create index if not exists leads_submitted_at_idx
  on public.leads (submitted_at desc)
  where submitted_at is not null;

create index if not exists appointments_created_at_idx
  on public.appointments (created_at desc);

create or replace function public.get_admin_dashboard_overview(p_range_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_recorded_errors integer;
begin
  if p_range_days not in (7, 30, 90) then
    raise exception 'rangeDays must be 7, 30, or 90';
  end if;

  select
    (select count(*) from public.diagnostic_events where occurred_at >= now() - make_interval(days := p_range_days)) +
    (select count(*) from public.server_error_events where occurred_at >= now() - make_interval(days := p_range_days))
  into v_recorded_errors;

  return (
    with daily_event_volume as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d, 'YYYY-MM-DD'),
          'count', count
        )
        order by d
      ), '[]'::jsonb) as volume
      from (
        select occurred_at::date as d, count(*)::int as count
        from public.product_events
        where occurred_at >= now() - make_interval(days := p_range_days)
        group by d
      ) as daily
    ), error_groups as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'source', source,
          'label', label,
          'count', count
        )
      ), '[]'::jsonb) as groups
      from (
        select 'diagnostic' as source, fingerprint as label, count(*)::int as count
        from public.diagnostic_events
        where occurred_at >= now() - make_interval(days := p_range_days)
          and fingerprint is not null
        group by fingerprint
        union all
        select 'server' as source, error_type as label, count(*)::int as count
        from public.server_error_events
        where occurred_at >= now() - make_interval(days := p_range_days)
        group by error_type
        order by count desc
        limit 5
      ) as eg
    )
    select jsonb_build_object(
      'rangeDays', p_range_days,
      'metrics', jsonb_build_array(
        jsonb_build_object('label', 'Total agents', 'value', (select count(*)::int from public.agents), 'helpText', 'All ShowReady agent accounts'),
        jsonb_build_object('label', 'New agents', 'value', (select count(*)::int from public.agents where onboarded_at >= now() - make_interval(days := p_range_days)), 'helpText', 'Accounts onboarded in the selected period'),
        jsonb_build_object('label', 'Tracked active agents (7d)', 'value', (select count(distinct agent_id)::int from public.product_events where occurred_at >= now() - interval '7 days'), 'helpText', 'Agents with a persisted product event in the last 7 days'),
        jsonb_build_object('label', 'Tracked active agents (30d)', 'value', (select count(distinct agent_id)::int from public.product_events where occurred_at >= now() - interval '30 days'), 'helpText', 'Agents with a persisted product event in the last 30 days'),
        jsonb_build_object('label', 'Intakes submitted', 'value', (select count(*)::int from public.leads where submitted_at is not null and submitted_at >= now() - make_interval(days := p_range_days)), 'helpText', 'Lead records submitted in the selected period'),
        jsonb_build_object('label', 'Leads created', 'value', (select count(*)::int from public.leads where created_at >= now() - make_interval(days := p_range_days)), 'helpText', 'Lead records created in the selected period'),
        jsonb_build_object('label', 'Appointments created', 'value', (select count(*)::int from public.appointments where created_at >= now() - make_interval(days := p_range_days)), 'helpText', 'Appointment records created in the selected period'),
        jsonb_build_object('label', 'Recorded errors', 'value', v_recorded_errors, 'helpText', 'Diagnostic errors and server errors in the selected period')
      ),
      'dailyEventVolume', (select volume from daily_event_volume),
      'errorGroups', (select groups from error_groups)
    )
  );
end;
$$;

revoke all on function public.get_admin_dashboard_overview(integer) from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_overview(integer) to service_role;

create or replace function public.list_admin_agents(
  p_query text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with agent_base as (
    select
      a.id,
      a.full_name,
      a.email,
      a.brokerage,
      a.onboarded_at,
      (
        select max(pe.occurred_at)
        from public.product_events pe
        where pe.agent_id = a.id
      ) as last_tracked_activity_at,
      (select count(*)::int from public.leads l where l.agent_id = a.id) as lead_count,
      (select count(*)::int from public.leads l where l.agent_id = a.id and l.submitted_at is not null) as submitted_intake_count,
      (select count(*)::int from public.appointments ap where ap.agent_id = a.id) as appointment_count
    from public.agents a
    where p_query = ''
      or a.full_name ilike '%' || p_query || '%'
      or a.email ilike '%' || p_query || '%'
      or a.brokerage ilike '%' || p_query || '%'
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'fullName', full_name,
          'email', email,
          'brokerage', brokerage,
          'joinedAt', onboarded_at,
          'lastTrackedActivityAt', last_tracked_activity_at,
          'leadCount', lead_count,
          'submittedIntakeCount', submitted_intake_count,
          'appointmentCount', appointment_count
        )
        order by last_tracked_activity_at desc nulls last, full_name, id
      )
      from (
        select *
        from agent_base
        order by last_tracked_activity_at desc nulls last, full_name, id
        limit p_limit offset p_offset
      ) as paged_agents
    ), '[]'::jsonb),
    'total', coalesce((select count(*)::int from agent_base), 0)
  );
$$;

revoke all on function public.list_admin_agents(text, integer, integer) from public, anon, authenticated;
grant execute on function public.list_admin_agents(text, integer, integer) to service_role;

create or replace function public.get_admin_agent_detail(
  p_agent_id uuid,
  p_range_days integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select
    case when exists (select 1 from public.agents where id = p_agent_id) then
      (
        select jsonb_build_object(
        'profile', jsonb_build_object(
          'id', a.id,
          'fullName', a.full_name,
          'email', a.email,
          'brokerage', a.brokerage,
          'joinedAt', a.onboarded_at,
          'lastTrackedActivityAt', (
            select max(pe.occurred_at)
            from public.product_events pe
            where pe.agent_id = a.id
          )
        ),
        'aggregates', jsonb_build_object(
          'leadCount', (select count(*)::int from public.leads l where l.agent_id = a.id),
          'submittedIntakeCount', (select count(*)::int from public.leads l where l.agent_id = a.id and l.submitted_at is not null),
          'appointmentCount', (select count(*)::int from public.appointments ap where ap.agent_id = a.id)
        ),
        'recentEvents', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'eventName', event_name,
              'occurredAt', occurred_at,
              'platform', platform,
              'appVersion', app_version,
              'route', route
            )
            order by occurred_at desc
          )
          from (
            select event_name, occurred_at, platform, app_version, route
            from public.product_events
            where agent_id = a.id
              and occurred_at >= now() - make_interval(days := p_range_days)
            order by occurred_at desc
            limit 20
          ) as recent_events
        ), '[]'::jsonb),
        'feedback', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', id,
              'source', source,
              'message', message,
              'createdAt', created_at
            )
            order by created_at desc
          )
          from (
            select id, source, message, created_at
            from public.agent_feedback
            where agent_id = a.id
            order by created_at desc
            limit 20
          ) as recent_feedback
        ), '[]'::jsonb),
        'diagnostics', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', id,
              'severity', severity,
              'message', message,
              'fingerprint', fingerprint,
              'screen', screen,
              'requestPath', request_path,
              'appVersion', app_version,
              'occurredAt', occurred_at
            )
            order by occurred_at desc
          )
          from (
            select id, severity, message, fingerprint, screen, request_path, app_version, occurred_at
            from public.diagnostic_events
            where agent_id = a.id
              and occurred_at >= now() - make_interval(days := p_range_days)
            order by occurred_at desc
            limit 20
          ) as recent_diagnostics
        ), '[]'::jsonb),
        'serverErrors', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', id,
              'errorType', error_type,
              'message', message,
              'route', route,
              'path', path,
              'status', status,
              'occurredAt', occurred_at
            )
            order by occurred_at desc
          )
          from (
            select id, error_type, message, route, path, status, occurred_at
            from public.server_error_events
            where agent_id = a.id
              and occurred_at >= now() - make_interval(days := p_range_days)
            order by occurred_at desc
            limit 20
          ) as recent_server_errors
        ), '[]'::jsonb)
        )
        from public.agents a
        where a.id = p_agent_id
      )
    else null
    end;
$$;

revoke all on function public.get_admin_agent_detail(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_admin_agent_detail(uuid, integer) to service_role;

create or replace function public.list_admin_feedback(
  p_query text,
  p_range_days integer,
  p_limit integer,
  p_offset integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with feedback_base as (
    select
      af.id,
      af.agent_id,
      a.full_name as agent_full_name,
      a.email as agent_email,
      af.source,
      af.message,
      af.created_at
    from public.agent_feedback af
    join public.agents a on a.id = af.agent_id
    where af.created_at >= now() - make_interval(days := p_range_days)
      and (
        p_query = ''
        or a.full_name ilike '%' || p_query || '%'
        or a.email ilike '%' || p_query || '%'
      )
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'agentId', agent_id,
          'agentFullName', agent_full_name,
          'agentEmail', agent_email,
          'source', source,
          'message', message,
          'createdAt', created_at
        )
        order by created_at desc, id desc
      )
      from (
        select *
        from feedback_base
        order by created_at desc, id desc
        limit p_limit offset p_offset
      ) as paged_feedback
    ), '[]'::jsonb),
    'total', coalesce((select count(*)::int from feedback_base), 0)
  );
$$;

revoke all on function public.list_admin_feedback(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.list_admin_feedback(text, integer, integer, integer) to service_role;
