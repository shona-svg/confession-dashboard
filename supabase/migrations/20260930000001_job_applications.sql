-- "Work with us" job applications, with resumes and cover letters.
-- Kept completely apart from sales contacts: never in the pipeline, never sent to Mailchimp.
-- Same protections as before: Row Level Security, change history, a 30-day bin,
-- plus automatic deletion after 12 months unless the person was hired.

-- ---------------------------------------------------------------------------
-- The applications
-- ---------------------------------------------------------------------------

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(first_name) between 1 and 100),
  last_name text not null check (length(last_name) between 1 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  mobile text not null check (length(mobile) between 6 and 30),
  roles text[] not null check (cardinality(roles) between 1 and 10),
  message text not null check (length(btrim(message)) between 1 and 5000),
  -- Every question is required, including both files.
  -- Paths inside the private 'job-applications' file store. The files themselves never
  -- go in the database or in email.
  resume_path text not null,
  resume_name text not null,
  cover_letter_path text not null,
  cover_letter_name text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'interview', 'hired', 'not_suitable')),
  notes text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text
);
create index job_applications_live on public.job_applications (submitted_at desc) where deleted_at is null;

-- Files that should be removed from file storage. Deleting a database row can't remove
-- the file itself, so the nightly job (scripts/backup/storage-cleanup.sh) empties this queue after the backup.
create table public.storage_cleanup (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now()
);

create function public.queue_application_files() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.storage_cleanup (bucket, path)
  select 'job-applications', p from unnest(array[old.resume_path, old.cover_letter_path]) p where p is not null;
  return null;
end;
$$;

create trigger job_applications_files after delete on public.job_applications
  for each row execute function public.queue_application_files();

create trigger audit_job_applications after insert or update or delete on public.job_applications
  for each row execute function public.write_audit();

create trigger job_applications_bulk_delete_guard after delete on public.job_applications
  referencing old table as changed_rows for each statement execute function public.guard_bulk_changes();

-- ---------------------------------------------------------------------------
-- The bin, privacy deletes and automatic clean-up
-- ---------------------------------------------------------------------------

create function public.bin_application(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_member() then raise exception 'Not allowed'; end if;
  update public.job_applications set deleted_at = now(), deleted_by = public.current_actor()
  where id = aid and deleted_at is null;
end;
$$;

create function public.restore_application(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can restore from the bin'; end if;
  update public.job_applications set deleted_at = null, deleted_by = null where id = aid;
end;
$$;

-- "Please delete my application": removes it, its files and its change history now.
create function public.forget_application(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or current_setting('role') in ('none', 'service_role')) then
    raise exception 'Only admins can permanently delete';
  end if;
  delete from public.job_applications where id = aid;
  delete from public.audit_log where table_name = 'job_applications' and record_id = aid;
end;
$$;

-- Run nightly after the backup: empties the bin after 30 days and removes applications
-- older than 12 months unless the person was hired. Server only.
create function public.purge_job_applications(
  bin_after interval default interval '30 days',
  keep_for interval default interval '12 months'
) returns int
language plpgsql set search_path = public as $$
declare
  ids uuid[];
begin
  perform set_config('app.allow_bulk', 'on', true);
  perform set_config('app.actor', 'Application clean-up', true);
  select coalesce(array_agg(id), '{}') into ids from public.job_applications
  where deleted_at < now() - bin_after or (status <> 'hired' and submitted_at < now() - keep_for);
  delete from public.job_applications where id = any (ids);
  delete from public.audit_log where table_name = 'job_applications' and record_id = any (ids);
  return coalesce(array_length(ids, 1), 0);
end;
$$;

revoke insert, delete, truncate on public.job_applications from anon, authenticated;
revoke all on public.storage_cleanup from anon, authenticated;
revoke execute on function public.purge_job_applications(interval, interval) from public, anon, authenticated;
revoke execute on function public.forget_application(uuid) from public, anon;
revoke execute on function public.bin_application(uuid) from public, anon;
revoke execute on function public.restore_application(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------------

alter table public.job_applications enable row level security;
alter table public.storage_cleanup enable row level security;

-- New applications arrive only through the website form's Netlify Function (server key),
-- so there is no insert rule for anyone signed in or anonymous.
create policy "team can see applications" on public.job_applications for select
  using (public.is_team_member() and (deleted_at is null or public.is_admin()));
create policy "team can update applications" on public.job_applications for update
  using (public.is_team_member() and deleted_at is null) with check (public.is_team_member());
-- storage_cleanup has no rules at all: only the server can use it.

-- Private file storage for resumes and cover letters (Supabase Storage).
-- Skipped on the local test database, which doesn't have Supabase Storage.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('job-applications', 'job-applications', false, 5 * 1024 * 1024, array[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
  on conflict (id) do nothing;
  -- The team can open files (the app asks for a short-lived link each time).
  -- Uploads come only from the form's Netlify Function, which uses the server key.
  execute $p$create policy "team can open application files" on storage.objects for select
    using (bucket_id = 'job-applications' and public.is_team_member())$p$;
end $$;
