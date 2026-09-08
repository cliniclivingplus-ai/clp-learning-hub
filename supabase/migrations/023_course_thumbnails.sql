-- Course cards on the public catalog show a plain placeholder icon when
-- courses.thumbnail_url is empty (which is every course so far - the column
-- already existed but nothing ever wrote to it). Gives admins/instructors a
-- bucket to upload a real cover image into.
--
-- Public bucket, same reasoning as quiz-images (017): a course thumbnail is
-- shown to every visitor browsing the catalog, not a personal document.
--
-- Idempotent - safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-thumbnails', 'course-thumbnails', true, 5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "course thumbnails: anyone can read" on storage.objects;
create policy "course thumbnails: anyone can read" on storage.objects
  for select using (bucket_id = 'course-thumbnails');

drop policy if exists "course thumbnails: staff can manage" on storage.objects;
create policy "course thumbnails: staff can manage" on storage.objects
  for all using (bucket_id = 'course-thumbnails' and is_staff())
  with check (bucket_id = 'course-thumbnails' and is_staff());
