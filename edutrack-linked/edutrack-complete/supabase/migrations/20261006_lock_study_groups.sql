drop policy if exists "Users access their own study groups" on public.study_groups;
drop policy if exists study_groups_instructor_write_assigned on public.study_groups;
drop policy if exists study_groups_instructor_read_assigned on public.study_groups;
create policy study_groups_instructor_read_assigned
on public.study_groups for select to authenticated
using (exists (
  select 1 from public.group_instructors gi
  where gi.group_id = study_groups.id
    and gi.instructor_id = (select auth.uid())
    and gi.active = true
));
