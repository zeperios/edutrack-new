-- EduTrack: harden instructor isolation and account security.
-- Already applied to the hosted Supabase project; this file keeps the change reproducible.

-- Instructors may read only their own profile. They cannot update profiles directly.
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "profiles_advisor_all" on public.profiles;

create policy "profiles_self_read"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_advisor()));

create policy "profiles_advisor_all"
on public.profiles for all to authenticated
using ((select private.is_advisor()))
with check ((select private.is_advisor()));

-- Group assignments: instructors can only see their own active assignments.
drop policy if exists "group_instructors_instructor_read_own" on public.group_instructors;
drop policy if exists "group_instructors_instructor_select" on public.group_instructors;
drop policy if exists "group_instructors_instructor_select_active_own" on public.group_instructors;
create policy "group_instructors_instructor_select_active_own"
on public.group_instructors for select to authenticated
using (
  instructor_id = (select auth.uid())
  and active = true
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.account_role = 'instructor'
      and p.is_active = true
  )
);

-- Instructors can work only with groups currently assigned to them.
drop policy if exists "study_groups_instructor_read_assigned" on public.study_groups;
create policy "study_groups_instructor_read_assigned"
on public.study_groups for select to authenticated
using (
  exists (
    select 1 from public.group_instructors gi
    where gi.group_id = study_groups.id
      and gi.instructor_id = (select auth.uid())
      and gi.active = true
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.account_role = 'instructor'
      and p.is_active = true
  )
);

drop policy if exists "study_groups_instructor_update_assigned" on public.study_groups;
create policy "study_groups_instructor_update_assigned"
on public.study_groups for update to authenticated
using (
  exists (
    select 1 from public.group_instructors gi
    where gi.group_id = study_groups.id
      and gi.instructor_id = (select auth.uid())
      and gi.active = true
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.account_role = 'instructor'
      and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.group_instructors gi
    where gi.group_id = study_groups.id
      and gi.instructor_id = (select auth.uid())
      and gi.active = true
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.account_role = 'instructor'
      and p.is_active = true
  )
);

-- Child data: assignment + active account are required for every operation.
drop policy if exists "beneficiaries_instructor_assigned" on public.beneficiaries;
create policy "beneficiaries_instructor_assigned"
on public.beneficiaries for all to authenticated
using (
  exists (select 1 from public.group_instructors gi where gi.group_id=beneficiaries.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
)
with check (
  exists (select 1 from public.group_instructors gi where gi.group_id=beneficiaries.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

drop policy if exists "attendance_instructor_assigned" on public.attendance;
create policy "attendance_instructor_assigned"
on public.attendance for all to authenticated
using (
  exists (select 1 from public.group_instructors gi where gi.group_id=attendance.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
)
with check (
  exists (select 1 from public.group_instructors gi where gi.group_id=attendance.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

drop policy if exists "evaluations_instructor_assigned" on public.evaluations;
create policy "evaluations_instructor_assigned"
on public.evaluations for all to authenticated
using (
  exists (select 1 from public.group_instructors gi where gi.group_id=evaluations.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
)
with check (
  exists (select 1 from public.group_instructors gi where gi.group_id=evaluations.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

-- Daily memos: instructor can create/edit only their own draft/review work in assigned active groups.
drop policy if exists "daily_memos_instructor_select" on public.daily_memos;
create policy "daily_memos_instructor_select"
on public.daily_memos for select to authenticated
using (
  exists (select 1 from public.group_instructors gi where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

drop policy if exists "daily_memos_instructor_insert" on public.daily_memos;
create policy "daily_memos_instructor_insert"
on public.daily_memos for insert to authenticated
with check (
  instructor_id=(select auth.uid()) and status=any(array['draft','review'])
  and exists (select 1 from public.group_instructors gi where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

drop policy if exists "daily_memos_instructor_update" on public.daily_memos;
create policy "daily_memos_instructor_update"
on public.daily_memos for update to authenticated
using (
  instructor_id=(select auth.uid()) and status=any(array['draft','review','rejected'])
  and exists (select 1 from public.group_instructors gi where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
)
with check (
  instructor_id=(select auth.uid()) and status=any(array['draft','review'])
  and exists (select 1 from public.group_instructors gi where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

-- Alerts: assigned active instructors only.
drop policy if exists "alerts_instructor_assigned" on public.alerts;
create policy "alerts_instructor_assigned"
on public.alerts for select to authenticated
using (
  exists (select 1 from public.group_instructors gi where gi.group_id=alerts.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);

drop policy if exists "alerts_instructor_update" on public.alerts;
create policy "alerts_instructor_update"
on public.alerts for update to authenticated
using (
  exists (select 1 from public.group_instructors gi where gi.group_id=alerts.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
)
with check (
  exists (select 1 from public.group_instructors gi where gi.group_id=alerts.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true)
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_role='instructor' and p.is_active=true)
);
