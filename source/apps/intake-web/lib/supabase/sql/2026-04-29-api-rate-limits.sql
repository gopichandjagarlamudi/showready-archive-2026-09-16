create table if not exists public.api_rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer,
  p_now timestamptz default now()
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reset_at timestamptz := p_now + make_interval(secs => p_window_ms / 1000.0);
  v_count integer;
begin
  if p_limit < 1 or p_window_ms < 1000 then
    raise exception 'Invalid rate limit configuration.';
  end if;

  delete from public.api_rate_limits
  where api_rate_limits.reset_at < p_now - interval '5 minutes';

  insert into public.api_rate_limits as limits (key, count, reset_at, updated_at)
  values (p_key, 1, v_reset_at, p_now)
  on conflict (key) do update
    set count = case
          when limits.reset_at <= p_now then 1
          else limits.count + 1
        end,
        reset_at = case
          when limits.reset_at <= p_now then v_reset_at
          else limits.reset_at
        end,
        updated_at = p_now
  returning limits.count, limits.reset_at into v_count, v_reset_at;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_reset_at;
  return next;
end;
$$;
