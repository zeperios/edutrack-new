-- Daily memo: 3 daily lessons, Monday-Friday, 45 + 45 + 30 minutes.
-- The base table and advisor/instructor access were already deployed in the project.
-- This migration documents the deployed schema and the tightened instructor rules.

create table if not exists public.daily_memos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  memo_date date not null default current_date,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','review','approved','rejected')),
  lesson1_topic text,
  lesson1_steps text,
  lesson1_completed boolean not null default false,
  lesson1_notes text,
  lesson2_topic text,
  lesson2_steps text,
  lesson2_completed boolean not null default false,
  lesson2_notes text,
  lesson3_topic text,
  lesson3_steps text,
  lesson3_completed boolean not null default false,
  lesson3_notes text,
  general_notes text,
  rejection_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  original_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, memo_date)
);

alter table public.daily_memos drop constraint if exists daily_memos_weekday_check;
alter table public.daily_memos add constraint daily_memos_weekday_check
  check (extract(isodow from memo_date) between 1 and 5);

-- The connected project already has the advisor policy. Instructor access is deliberately
-- split so an instructor cannot approve/reject/delete a memo or impersonate another instructor.
drop policy if exists daily_memos_instructor_assigned on public.daily_memos;
create policy daily_memos_instructor_select on public.daily_memos for select to authenticated
using (exists (
  select 1 from public.group_instructors gi
  where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true
));
create policy daily_memos_instructor_insert on public.daily_memos for insert to authenticated
with check (
  instructor_id=(select auth.uid()) and status in ('draft','review') and exists (
    select 1 from public.group_instructors gi
    where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true
  )
);
create policy daily_memos_instructor_update on public.daily_memos for update to authenticated
using (
  instructor_id=(select auth.uid()) and status in ('draft','review','rejected') and exists (
    select 1 from public.group_instructors gi
    where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true
  )
)
with check (
  instructor_id=(select auth.uid()) and status in ('draft','review') and exists (
    select 1 from public.group_instructors gi
    where gi.group_id=daily_memos.group_id and gi.instructor_id=(select auth.uid()) and gi.active=true
  )
);
