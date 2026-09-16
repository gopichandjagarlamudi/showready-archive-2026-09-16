alter table public.appointments enable row level security;
alter table public.showings enable row level security;

revoke all on table public.appointments from anon;
revoke all on table public.showings from anon;

grant select on table public.appointments to authenticated;
grant select on table public.showings to authenticated;

drop policy if exists appointments_select_own on public.appointments;
create policy appointments_select_own
on public.appointments
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = agent_id
);

drop policy if exists showings_select_own_appointments on public.showings;
create policy showings_select_own_appointments
on public.showings
for select
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.appointments
    where appointments.id = showings.appointment_id
      and appointments.agent_id = (select auth.uid())
  )
);
