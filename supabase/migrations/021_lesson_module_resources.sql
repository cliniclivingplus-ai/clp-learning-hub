-- A downloadable attachment (PDF, image) directly on a lesson or a module -
-- a cookbook, a handout, a worksheet - uploaded through the editor instead
-- of an admin hand-writing a link into notes HTML and running a script
-- against the lesson-resources bucket (migration 019) by hand.
--
-- Idempotent - safe to re-run.

alter table lessons add column if not exists resource_url text;
alter table lessons add column if not exists resource_name text;

alter table modules add column if not exists resource_url text;
alter table modules add column if not exists resource_name text;
