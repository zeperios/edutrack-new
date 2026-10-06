-- OCR + original image storage for daily memos.
-- This migration mirrors the schema already applied to the hosted project.
alter table public.daily_memos add column if not exists ocr_text text;
alter table public.daily_memos add column if not exists ocr_status text not null default 'not_run' check (ocr_status in ('not_run','processing','needs_review','completed','failed'));
alter table public.daily_memos add column if not exists ocr_error text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('daily-memo-images','daily-memo-images',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "daily_memo_images_select" on storage.objects;
drop policy if exists "daily_memo_images_insert" on storage.objects;
drop policy if exists "daily_memo_images_update" on storage.objects;
create policy "daily_memo_images_select" on storage.objects for select to authenticated using (
 bucket_id='daily-memo-images' and ((select private.is_advisor()) or exists (select 1 from public.group_instructors gi where gi.group_id::text=(storage.foldername(name))[1] and gi.instructor_id=(select auth.uid()) and gi.active=true))
);
create policy "daily_memo_images_insert" on storage.objects for insert to authenticated with check (
 bucket_id='daily-memo-images' and ((select private.is_advisor()) or exists (select 1 from public.group_instructors gi where gi.group_id::text=(storage.foldername(name))[1] and gi.instructor_id=(select auth.uid()) and gi.active=true))
);
create policy "daily_memo_images_update" on storage.objects for update to authenticated using (
 bucket_id='daily-memo-images' and ((select private.is_advisor()) or exists (select 1 from public.group_instructors gi where gi.group_id::text=(storage.foldername(name))[1] and gi.instructor_id=(select auth.uid()) and gi.active=true))
) with check (
 bucket_id='daily-memo-images' and ((select private.is_advisor()) or exists (select 1 from public.group_instructors gi where gi.group_id::text=(storage.foldername(name))[1] and gi.instructor_id=(select auth.uid()) and gi.active=true))
);
