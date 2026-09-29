-- Editable settings, the newsletter form, and website tracking.
-- Same protections as the first migration: Row Level Security on every table,
-- admins change settings, the server alone writes tracking data.

-- ---------------------------------------------------------------------------
-- New values
-- ---------------------------------------------------------------------------

alter table public.contacts drop constraint contacts_source_check;
alter table public.contacts add constraint contacts_source_check check (source in (
  'website_form', 'instagram', 'google', 'referral', 'wedding_expo', 'mailchimp_signup', 'newsletter_form', 'other'));

alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check check (type in (
  'form_submission', 'email_out', 'email_in', 'call', 'note', 'tour_booked', 'tour_attended',
  'tour_no_show', 'tour_cancelled', 'tour_rescheduled', 'proposal_sent', 'review_requested',
  'mailchimp_signup', 'edm_open', 'edm_click', 'event_booked', 'event_moved', 'event_cancelled',
  'web_visit'));

-- ---------------------------------------------------------------------------
-- Settings edited on the Settings page (admins only)
-- ---------------------------------------------------------------------------

-- Simple named settings, e.g. key 'rules' = {"followUpDays": 5, "replyWithinHours": 24, ...}
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default public.current_actor()
);

insert into public.settings (key, value) values
  ('rules', '{"followUpDays": 5, "replyWithinHours": 24, "proposalWithinHours": 48, "altarRoomCapacity": 150, "newSignupDays": 7}');

create table public.email_templates (
  id text primary key,
  name text not null,
  when_to_use text not null default '',
  subject text not null default '',
  body text not null default '',
  asks_for_google_review boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.tracking_rules (
  id uuid primary key default gen_random_uuid(),
  match text not null check (length(match) between 1 and 200),
  tag text not null check (length(tag) between 1 and 80),
  alert boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.tracking_rules (match, tag, alert) values
  ('/functions/weddings', 'Browsed: Weddings & after-parties', false),
  ('/functions/corporate', 'Browsed: Corporate', false),
  ('/functions/birthdays', 'Browsed: Milestone birthdays', false),
  ('/accessibility', 'Browsed: Accessibility', false),
  ('/functions', 'Browsed: Functions', true),
  ('/enquire', 'Opened the enquiry page', true);

-- ---------------------------------------------------------------------------
-- Website tracking
-- A visitor is one browser on the Confession website (a random id in a
-- Confession-only cookie, set only after they accept cookies). It's linked to a
-- contact when they fill in a form or click a tracked link in an email.
-- ---------------------------------------------------------------------------

create table public.web_visitors (
  visitor_id text primary key check (length(visitor_id) between 16 and 64),
  contact_id uuid references public.contacts (id) on delete cascade,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index web_visitors_contact on public.web_visitors (contact_id);

create table public.web_visits (
  id bigint generated always as identity primary key,
  visitor_id text not null references public.web_visitors (visitor_id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  page_path text not null,          -- path only, never query strings (they can carry personal details)
  page_title text not null default '',
  referrer_host text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  occurred_at timestamptz not null default now()
);
create index web_visits_contact on public.web_visits (contact_id, occurred_at desc);
create index web_visits_visitor on public.web_visits (visitor_id);

-- Anonymous visitors who never became known are removed after 90 days
-- (run by the nightly job, after the backup, like the bin).
create function public.purge_anonymous_visits(older_than interval default interval '90 days') returns int
language plpgsql set search_path = public as $$
declare
  n int;
begin
  with gone as (
    delete from public.web_visitors where contact_id is null and last_seen < now() - older_than returning 1
  )
  select count(*) into n from gone;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- History and security
-- ---------------------------------------------------------------------------

-- Change history for tables keyed by text (a setting's key, a template's id).
alter table public.audit_log add column record_key text;

create function public.write_audit_keyed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
begin
  if tg_op = 'UPDATE' and (before - 'updated_at' - 'updated_by') = (rec - 'updated_at' - 'updated_by') then
    return null;
  end if;
  insert into public.audit_log (table_name, record_key, action, changed_by, old_data, new_data)
  values (tg_table_name, coalesce(rec ->> 'id', rec ->> 'key'), lower(tg_op), public.current_actor(), before,
          case when tg_op = 'DELETE' then null else rec end);
  return null;
end;
$$;

create trigger audit_settings after insert or update or delete on public.settings for each row execute function public.write_audit_keyed();
create trigger audit_templates after insert or update or delete on public.email_templates for each row execute function public.write_audit_keyed();
create trigger audit_tracking after insert or update or delete on public.tracking_rules for each row execute function public.write_audit();

alter table public.settings enable row level security;
alter table public.email_templates enable row level security;
alter table public.tracking_rules enable row level security;
alter table public.web_visitors enable row level security;
alter table public.web_visits enable row level security;

create policy "team can read settings" on public.settings for select using (public.is_team_member());
create policy "admins change settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());

create policy "team can read templates" on public.email_templates for select using (public.is_team_member());
create policy "admins change templates" on public.email_templates for all using (public.is_admin()) with check (public.is_admin());

create policy "team can read tracking rules" on public.tracking_rules for select using (public.is_team_member());
create policy "admins change tracking rules" on public.tracking_rules for all using (public.is_admin()) with check (public.is_admin());

-- Visits are only visible once linked to a contact the person can see. Only the server writes them.
create policy "team can see a contact's visits" on public.web_visits for select using (contact_id is not null and public.can_see_contact(contact_id));
create policy "team can see linked visitors" on public.web_visitors for select using (contact_id is not null and public.can_see_contact(contact_id));

revoke insert, update, delete, truncate on public.web_visits from anon, authenticated;
revoke insert, update, delete, truncate on public.web_visitors from anon, authenticated;
revoke all on function public.purge_anonymous_visits(interval) from public, anon, authenticated;
grant execute on function public.purge_anonymous_visits(interval) to service_role;
