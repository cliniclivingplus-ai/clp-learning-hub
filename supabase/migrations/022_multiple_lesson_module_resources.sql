-- Lessons and modules could only ever carry one attachment (resource_url/
-- resource_name on the row itself, migration 021). Replace that with a
-- proper one-to-many table so a lesson or module can have several PDFs/
-- images attached (a handout AND a worksheet AND a diagram).
--
-- Idempotent - safe to re-run.

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  url text not null,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  constraint resources_one_owner check (
    (lesson_id is not null and module_id is null) or
    (lesson_id is null and module_id is not null)
  )
);

create index if not exists resources_lesson_id_idx on resources(lesson_id);
create index if not exists resources_module_id_idx on resources(module_id);

alter table resources enable row level security;

-- Same read model as lessons/modules themselves: anyone who can see the
-- lesson/module (enrolled patient, or staff who can manage the course) can
-- see its attachments.
drop policy if exists "Resources are viewable with their lesson" on resources;
create policy "Resources are viewable with their lesson" on resources
  for select using (
    (lesson_id is not null and exists (
      select 1 from lessons l where l.id = resources.lesson_id
    )) or
    (module_id is not null and exists (
      select 1 from modules m where m.id = resources.module_id
    ))
  );

-- Writes: admins everywhere, instructors on their own courses only - same
-- shape as "admins write modules" / "instructors write own modules" (007).
drop policy if exists "admins write resources" on resources;
create policy "admins write resources" on resources
  for all using (is_admin()) with check (is_admin());

drop policy if exists "instructors write own resources" on resources;
create policy "instructors write own resources" on resources
  for all using (
    owns_course(coalesce(course_of_lesson(lesson_id), course_of_module(module_id)))
  ) with check (
    owns_course(coalesce(course_of_lesson(lesson_id), course_of_module(module_id)))
  );

-- Backfill the existing single attachments from migration 021 so nothing
-- already uploaded gets silently dropped.
insert into resources (lesson_id, url, name)
select id, resource_url, resource_name from lessons
where resource_url is not null
on conflict do nothing;

insert into resources (module_id, url, name)
select id, resource_url, resource_name from modules
where resource_url is not null
on conflict do nothing;

alter table lessons drop column if exists resource_url;
alter table lessons drop column if exists resource_name;
alter table modules drop column if exists resource_url;
alter table modules drop column if exists resource_name;
