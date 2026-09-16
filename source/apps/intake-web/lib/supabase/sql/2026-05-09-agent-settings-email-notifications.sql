alter table public.agent_settings
  add column if not exists email_notifications_enabled boolean not null default true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_settings'
      and column_name = 'notification_preference'
  ) then
    execute 'update public.agent_settings set email_notifications_enabled = true where notification_preference in (''email'', ''email_and_push'')';
  end if;
end $$;
