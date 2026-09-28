-- Confession dashboard: tables, security rules and data-safety protections.
-- See docs/DATA-SAFETY.md for the plain-language version of what this protects against.
--
-- Built for Supabase (Postgres + Supabase Auth). Every table has Row Level
-- Security switched on: nobody can read or change anything unless they are an
-- active team member, and some actions (permanent deletes, the change history)
-- are admin-only.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Team
-- ---------------------------------------------------------------------------

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  -- The login account. Deliberately not a hard link to auth.users: after restoring a backup
  -- into a new project, logins are new, and link_my_account() reconnects people by email.
  user_id uuid unique,
  name text not null,
  email text not null unique check (email = lower(email)),
  role text not null default 'member' check (role in ('admin', 'member')),
  active boolean not null default true,
  gets_alerts boolean not null default false, -- backup / sync failure emails
  created_at timestamptz not null default now()
);

-- Who is asking? Used by every security rule below.
create function public.is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid() and active);
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where user_id = auth.uid() and active and role = 'admin');
$$;

-- Called by the app straight after sign-in: connects the Google login to the team
-- member with the same email (first sign-in, or after a restore into a new project).
create function public.link_my_account() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or my_email = '' then return false; end if;
  update public.team_members tm set user_id = auth.uid()
  where tm.email = my_email and tm.active
    and (tm.user_id is null or not exists (select 1 from auth.users u where u.id = tm.user_id));
  return public.is_team_member();
end;
$$;

-- A readable name for "who did this" in the history tables.
create function public.current_actor() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('app.actor', true), ''),              -- set by syncs, e.g. 'Mailchimp sync'
    (select 'tm:' || id::text from public.team_members where user_id = auth.uid()),
    case when auth.uid() is null then 'system' else 'user:' || auth.uid()::text end
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference lists
-- ---------------------------------------------------------------------------

create table public.event_types (
  id text primary key,
  name text not null,
  default_audience text not null check (default_audience in ('milestone', 'corporate', 'accessibility')),
  sort_order int not null default 0,
  active boolean not null default true
);

insert into public.event_types (id, name, default_audience, sort_order) values
  ('milestone_birthday', 'Milestone birthday', 'milestone', 1),
  ('engagement', 'Engagement party', 'milestone', 2),
  ('anniversary', 'Anniversary', 'milestone', 3),
  ('wedding_afterparty', 'Wedding after-party', 'milestone', 4),
  ('celebration_of_life', 'Celebration of life', 'milestone', 5),
  ('corporate_eoy', 'Corporate EOY / Christmas', 'corporate', 6),
  ('corporate_launch', 'Corporate milestone / launch', 'corporate', 7),
  ('gala', 'Small gala / fundraiser', 'corporate', 8),
  ('community', 'Community / organisation function', 'milestone', 9),
  ('other', 'Other', 'milestone', 10);

-- Every import is labelled so a bad one can be removed in one step.
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- e.g. 'HubSpot export'
  file_name text,
  row_count int not null default 0,
  created_by text not null default public.current_actor(),
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text not null check (email = lower(btrim(email)) and email like '%@%'),
  phone text not null default '',
  company text not null default '',
  event_type_id text references public.event_types (id),
  audience text not null default 'milestone' check (audience in ('milestone', 'corporate', 'accessibility')),
  event_date date,
  guest_count int check (guest_count > 0),
  estimated_value numeric(10, 2) check (estimated_value >= 0),
  source text not null default 'other'
    check (source in ('website_form', 'instagram', 'google', 'referral', 'wedding_expo', 'mailchimp_signup', 'other')),
  owner_id uuid references public.team_members (id) on delete set null,
  tags text[] not null default '{}',
  stage text not null default 'lead'
    check (stage in ('prospect', 'lead', 'tour_booked', 'toured', 'proposal_sent', 'confirmed', 'event_held', 'lost')),
  lost_reason text check (lost_reason in
    ('date_unavailable', 'over_budget', 'chose_another_venue', 'went_quiet', 'guest_count_too_large', 'other')),
  lost_reason_note text not null default '',
  lost_from_stage text,
  -- Sensitive (health) information under the Privacy Act: only ever shown inside the dashboard.
  accessibility_needs text not null default '',
  marketing_consent text not null default 'not_subscribed'
    check (marketing_consent in ('subscribed', 'not_subscribed', 'unsubscribed')),
  review_requested_at timestamptz,
  review_received boolean not null default false,
  acknowledged_at timestamptz,
  mailchimp_id text,
  import_batch_id uuid references public.import_batches (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The bin: deleted contacts stay recoverable for 30 days.
  deleted_at timestamptz,
  deleted_by text,
  constraint lost_needs_reason check (stage <> 'lost' or lost_reason is not null)
);

-- One live contact per email address (people in the bin don't block a new enquiry).
create unique index contacts_email_live on public.contacts (email) where deleted_at is null;
create index contacts_stage on public.contacts (stage) where deleted_at is null;
create index contacts_owner on public.contacts (owner_id);

-- Tidy emails before they're saved, so matching with Mailchimp and Gmail works.
create function public.normalise_contact() returns trigger
language plpgsql as $$
begin
  new.email := lower(btrim(new.email));
  new.updated_at := now();
  if new.stage <> 'lost' then
    new.lost_reason := null;
    new.lost_reason_note := '';
    new.lost_from_stage := null;
  elsif tg_op = 'UPDATE' and old.stage <> 'lost' then
    new.lost_from_stage := old.stage;
  end if;
  return new;
end;
$$;

create trigger contacts_normalise before insert or update on public.contacts
  for each row execute function public.normalise_contact();

-- A contact is visible to the team unless it's in the bin (admins can see the bin).
create function public.can_see_contact(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_team_member() and exists (
    select 1 from public.contacts c where c.id = cid and (c.deleted_at is null or public.is_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- History: stage changes (for speed reports) and the timeline
-- ---------------------------------------------------------------------------

create table public.stage_changes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null default now(),
  changed_by text not null
);
create index stage_changes_contact on public.stage_changes (contact_id, changed_at);

-- Written by the database itself, however the stage was changed.
create function public.record_stage_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.stage_changes (contact_id, from_stage, to_stage, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage, public.current_actor());
  end if;
  return null;
end;
$$;

create trigger contacts_stage_history after insert or update of stage on public.contacts
  for each row execute function public.record_stage_change();

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  scheduled_for timestamptz not null,
  booked_at timestamptz not null default now(),
  status text not null default 'booked' check (status in ('booked', 'attended', 'no_show', 'cancelled')),
  host_id uuid references public.team_members (id) on delete set null,
  notes text not null default '',
  google_event_id text,
  updated_at timestamptz not null default now()
);
create index tours_when on public.tours (scheduled_for);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  space text not null default 'altar_room' check (space in ('altar_room', 'altar_room_plus')),
  guest_count int check (guest_count > 0),
  status text not null default 'confirmed' check (status in ('hold', 'confirmed', 'cancelled')),
  notes text not null default '',
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_date on public.events (date) where status <> 'cancelled';

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type text not null check (type in (
    'form_submission', 'email_out', 'email_in', 'call', 'note', 'tour_booked', 'tour_attended',
    'tour_no_show', 'tour_cancelled', 'tour_rescheduled', 'proposal_sent', 'review_requested',
    'mailchimp_signup', 'edm_open', 'edm_click', 'event_booked', 'event_moved', 'event_cancelled')),
  occurred_at timestamptz not null default now(),
  summary text not null default '',
  created_by text not null default public.current_actor(),
  -- Links back to the source so syncs never add the same thing twice.
  -- Email text is not stored: it's read from Gmail when opened.
  external_id text unique,
  created_at timestamptz not null default now()
);
create index activities_contact on public.activities (contact_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Every website form submission, exactly as received, before anything else
-- happens to it. If processing fails, nothing is lost.
-- ---------------------------------------------------------------------------

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  payload jsonb not null,
  contact_id uuid references public.contacts (id) on delete set null,
  processed_at timestamptz,
  error text
);

-- ---------------------------------------------------------------------------
-- Sync bookkeeping
-- ---------------------------------------------------------------------------

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'failed', 'stopped')),
  added int not null default 0,
  updated int not null default 0,
  message text
);

create table public.sync_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Change history: who changed what, and what it was before.
-- Lets a mistake be put back. Admin-only, and nobody can edit it.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  contact_id uuid,  -- so a privacy request can remove everything about one person
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by text not null,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_record on public.audit_log (record_id);
create index audit_log_contact on public.audit_log (contact_id);

create function public.write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
begin
  -- Skip updates that didn't change anything except the timestamp.
  if tg_op = 'UPDATE' and (before - 'updated_at') = (rec - 'updated_at') then
    return null;
  end if;
  insert into public.audit_log (table_name, record_id, contact_id, action, changed_by, old_data, new_data)
  values (
    tg_table_name,
    (rec ->> 'id')::uuid,
    case when tg_table_name = 'contacts' then (rec ->> 'id')::uuid else (rec ->> 'contact_id')::uuid end,
    lower(tg_op),
    public.current_actor(),
    before,
    case when tg_op = 'DELETE' then null else rec end
  );
  return null;
end;
$$;

create trigger audit_contacts after insert or update or delete on public.contacts for each row execute function public.write_audit();
create trigger audit_tours after insert or update or delete on public.tours for each row execute function public.write_audit();
create trigger audit_events after insert or update or delete on public.events for each row execute function public.write_audit();
create trigger audit_activities after delete on public.activities for each row execute function public.write_audit();
create trigger audit_team after insert or update or delete on public.team_members for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Circuit breaker: stop a bug, a bad sync or a slip of the mouse from wiping
-- or rewriting lots of records in one go. A deliberate bulk job has to switch
-- this off for its own transaction with: set local app.allow_bulk = 'on';
-- ---------------------------------------------------------------------------

create function public.guard_bulk_changes() returns trigger
language plpgsql as $$
declare
  n int;
  limit_n int := case when tg_op = 'DELETE' then 25 else 200 end;
begin
  if coalesce(current_setting('app.allow_bulk', true), '') = 'on' then
    return null;
  end if;
  select count(*) into n from changed_rows;
  if n > limit_n then
    raise exception 'Safety stop: % % contacts in one go is more than the limit of %. Nothing was changed.',
      lower(tg_op), n, limit_n
      using hint = 'If this is intentional, run it as a bulk job with app.allow_bulk switched on.';
  end if;
  return null;
end;
$$;

create trigger contacts_bulk_delete_guard after delete on public.contacts
  referencing old table as changed_rows for each statement execute function public.guard_bulk_changes();
create trigger contacts_bulk_update_guard after update on public.contacts
  referencing new table as changed_rows for each statement execute function public.guard_bulk_changes();

-- ---------------------------------------------------------------------------
-- The bin, permanent deletion and privacy requests
-- ---------------------------------------------------------------------------

-- Anyone on the team can move a contact to the bin (it can be restored for 30 days).
create function public.move_to_bin(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_member() then raise exception 'Not allowed'; end if;
  update public.contacts set deleted_at = now(), deleted_by = public.current_actor()
  where id = cid and deleted_at is null;
end;
$$;

create function public.restore_from_bin(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can restore from the bin'; end if;
  if exists (
    select 1 from public.contacts live join public.contacts binned on binned.email = live.email
    where binned.id = cid and live.deleted_at is null and live.id <> cid
  ) then
    raise exception 'Can''t restore: a current contact already uses this email address. Update that contact instead.';
  end if;
  update public.contacts set deleted_at = null, deleted_by = null where id = cid;
end;
$$;

-- Privacy request ("please delete my information"): removes the person, their
-- timeline, tours and events, AND their entries in the change history.
-- Admin-only. Copies in encrypted backups expire on their normal schedule.
create function public.forget_contact(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Admins in the app, or the server itself: the service role, or a direct database
  -- login that hasn't switched to the app's signed-in role ('role' is then 'none').
  if not (public.is_admin() or current_setting('role') in ('none', 'service_role')) then
    raise exception 'Only admins can permanently delete';
  end if;
  delete from public.contacts where id = cid;
  -- Runs after the delete, so the history rows the delete itself just wrote are removed too.
  delete from public.audit_log where contact_id = cid;
end;
$$;

-- Empties the bin of anything older than 30 days. Run by the nightly backup job
-- AFTER that night's backup has been safely stored off-site. Only the server can run it.
create function public.purge_bin(older_than interval default interval '30 days') returns int
language plpgsql set search_path = public as $$
declare
  ids uuid[];
begin
  perform set_config('app.allow_bulk', 'on', true);
  perform set_config('app.actor', 'Bin clean-up', true);
  select coalesce(array_agg(id), '{}') into ids from public.contacts where deleted_at < now() - older_than;
  delete from public.contacts where id = any (ids);
  delete from public.audit_log where contact_id = any (ids);
  return coalesce(array_length(ids, 1), 0);
end;
$$;

-- Exact row counts for every table: stored with each backup and compared after a test restore.
create function public.backup_row_counts() returns jsonb
language plpgsql stable set search_path = public as $$
declare
  t record;
  n bigint;
  result jsonb := '{}';
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select count(*) from public.%I', t.tablename) into n;
    result := result || jsonb_build_object(t.tablename, n);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.team_members enable row level security;
alter table public.event_types enable row level security;
alter table public.import_batches enable row level security;
alter table public.contacts enable row level security;
alter table public.stage_changes enable row level security;
alter table public.tours enable row level security;
alter table public.events enable row level security;
alter table public.activities enable row level security;
alter table public.form_submissions enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_state enable row level security;
alter table public.audit_log enable row level security;

-- Team
create policy "team can see the team" on public.team_members for select using (public.is_team_member());
create policy "admins manage the team" on public.team_members for all using (public.is_admin()) with check (public.is_admin());

-- Reference lists
create policy "team can read event types" on public.event_types for select using (public.is_team_member());
create policy "admins edit event types" on public.event_types for all using (public.is_admin()) with check (public.is_admin());
create policy "team can see imports" on public.import_batches for select using (public.is_team_member());
create policy "team can start imports" on public.import_batches for insert with check (public.is_team_member());
create policy "admins update imports" on public.import_batches for update using (public.is_admin());

-- Contacts: everyone on the team can add and edit; only admins can permanently delete.
create policy "team can see contacts" on public.contacts for select
  using (public.is_team_member() and (deleted_at is null or public.is_admin()));
create policy "team can add contacts" on public.contacts for insert with check (public.is_team_member());
create policy "team can edit contacts" on public.contacts for update
  using (public.is_team_member() and (deleted_at is null or public.is_admin()))
  with check (public.is_team_member());
create policy "admins can permanently delete" on public.contacts for delete using (public.is_admin());

-- Tours and events: add and edit freely; cancel instead of deleting.
create policy "team can see tours" on public.tours for select using (public.can_see_contact(contact_id));
create policy "team can book tours" on public.tours for insert with check (public.can_see_contact(contact_id));
create policy "team can update tours" on public.tours for update using (public.can_see_contact(contact_id));
create policy "admins can delete tours" on public.tours for delete using (public.is_admin());

create policy "team can see events" on public.events for select using (public.can_see_contact(contact_id));
create policy "team can book events" on public.events for insert with check (public.can_see_contact(contact_id));
create policy "team can update events" on public.events for update using (public.can_see_contact(contact_id));
create policy "admins can delete events" on public.events for delete using (public.is_admin());

-- The timeline and stage history only ever grow.
create policy "team can see the timeline" on public.activities for select using (public.can_see_contact(contact_id));
create policy "team can add to the timeline" on public.activities for insert with check (public.can_see_contact(contact_id));
create policy "team can see stage history" on public.stage_changes for select using (public.can_see_contact(contact_id));

-- Admin-only views of the machinery. Only the server (service role) writes these.
create policy "admins see form submissions" on public.form_submissions for select using (public.is_admin());
create policy "admins see sync runs" on public.sync_runs for select using (public.is_admin());
create policy "admins see the change history" on public.audit_log for select using (public.is_admin());
-- sync_state: no policies, so only the server can read or write it.

-- Belt and braces: nobody signed in through the app can alter the history tables,
-- whatever the policies say.
revoke update, delete, truncate on public.audit_log from anon, authenticated;
revoke update, delete, truncate on public.stage_changes from anon, authenticated;
revoke update, delete, truncate on public.activities from anon, authenticated;
revoke truncate on all tables in schema public from anon, authenticated;
revoke all on function public.purge_bin(interval) from public, anon, authenticated;
revoke all on function public.backup_row_counts() from public, anon, authenticated;
grant execute on function public.purge_bin(interval) to service_role;
grant execute on function public.backup_row_counts() to service_role;
