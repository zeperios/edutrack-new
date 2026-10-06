-- EduTrack: secure instructor management and group assignment
-- Safe to run after the existing edutrack_accounts_and_group_assignments migration.

alter table public.profiles
  add column if not exists auth_email text;

create unique index if not exists profiles_auth_email_unique
  on public.profiles(auth_email)
  where auth_email is not null;

alter table public.group_instructors enable row level security;

drop policy if exists group_instructors_advisor_all on public.group_instructors;
create policy group_instructors_advisor_all
on public.group_instructors
for all to authenticated
using ((select private.is_advisor()))
with check ((select private.is_advisor()));

drop policy if exists group_instructors_instructor_select on public.group_instructors;
create policy group_instructors_instructor_select
on public.group_instructors
for select to authenticated
using ((select auth.uid()) = instructor_id);

drop policy if exists profiles_advisor_select on public.profiles;
create policy profiles_advisor_select
on public.profiles
for select to authenticated
using ((select private.is_advisor()));

drop policy if exists profiles_advisor_update_instructors on public.profiles;
create policy profiles_advisor_update_instructors
on public.profiles
for update to authenticated
using (
  (select private.is_advisor())
  and account_role = 'instructor'
)
with check (
  (select private.is_advisor())
  and account_role = 'instructor'
);

create index if not exists group_instructors_instructor_active_idx
  on public.group_instructors(instructor_id)
  where active = true;

create index if not exists group_instructors_group_active_idx
  on public.group_instructors(group_id)
  where active = true;
