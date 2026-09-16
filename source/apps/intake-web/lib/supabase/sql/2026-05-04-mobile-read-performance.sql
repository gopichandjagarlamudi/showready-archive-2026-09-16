create index if not exists lead_answers_lead_updated_at_idx
  on public.lead_answers (lead_id, updated_at);

create index if not exists lead_scores_lead_created_at_idx
  on public.lead_scores (lead_id, created_at desc);

create index if not exists showings_appointment_order_idx
  on public.showings (appointment_id, order_index);

create index if not exists leads_agent_updated_id_idx
  on public.leads (agent_id, updated_at desc, id);

create index if not exists leads_agent_submitted_id_idx
  on public.leads (agent_id, submitted_at desc, id);

create or replace function public.consume_rate_limits(
  p_limits jsonb,
  p_now timestamptz default now()
)
returns table(key text, allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry jsonb;
  v_key text;
  v_limit integer;
  v_window_ms integer;
  v_result record;
begin
  if coalesce(jsonb_typeof(p_limits), 'array') <> 'array' then
    raise exception 'Rate limit batch must be a JSON array.';
  end if;

  for v_entry in select * from jsonb_array_elements(coalesce(p_limits, '[]'::jsonb))
  loop
    v_key := v_entry ->> 'key';
    v_limit := coalesce((v_entry ->> 'limit')::integer, 0);
    v_window_ms := coalesce((v_entry ->> 'windowMs')::integer, 0);

    if v_key is null or length(v_key) = 0 then
      raise exception 'Rate limit key is required.';
    end if;

    select *
    into v_result
    from public.consume_rate_limit(v_key, v_limit, v_window_ms, p_now);

    key := v_key;
    allowed := v_result.allowed;
    remaining := v_result.remaining;
    reset_at := v_result.reset_at;
    return next;
  end loop;
end;
$$;

revoke all on function public.consume_rate_limits(jsonb, timestamptz) from public;
grant execute on function public.consume_rate_limits(jsonb, timestamptz) to service_role;
