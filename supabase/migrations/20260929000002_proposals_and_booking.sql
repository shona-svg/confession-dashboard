-- Proposals, the Finalising stage, and the booking paperwork:
-- proposal accepted → hire agreement sent → signed → deposit invoice sent → deposit paid (event is live).

alter table public.contacts drop constraint contacts_stage_check;
alter table public.contacts add constraint contacts_stage_check check (stage in (
  'prospect', 'lead', 'tour_booked', 'toured', 'proposal_sent', 'finalising', 'confirmed', 'event_held', 'lost'));

alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check check (type in (
  'form_submission', 'email_out', 'email_in', 'call', 'note', 'tour_booked', 'tour_attended',
  'tour_no_show', 'tour_cancelled', 'tour_rescheduled', 'proposal_sent', 'review_requested',
  'mailchimp_signup', 'edm_open', 'edm_click', 'event_booked', 'event_moved', 'event_cancelled',
  'web_visit', 'proposal_accepted', 'agreement_sent', 'agreement_signed', 'invoice_sent', 'deposit_paid'));

-- ---------------------------------------------------------------------------
-- Templates (admins edit, the team reads)
-- ---------------------------------------------------------------------------

create table public.proposal_templates (
  id text primary key,
  name text not null,
  audience text not null check (audience in ('milestone', 'corporate', 'accessibility')),
  headline text not null default '',
  intro text not null default '',
  inclusions text not null default '',
  next_steps text not null default '',
  updated_at timestamptz not null default now()
);

create table public.agreement_templates (
  id text primary key,
  name text not null,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Proposals (one client can have several versions)
-- ---------------------------------------------------------------------------

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  template_id text references public.proposal_templates (id) on delete set null,
  headline text not null default '',
  intro text not null default '',
  inclusions text not null default '',
  next_steps text not null default '',
  lines jsonb not null default '[]',  -- [{ "label": "Venue hire", "amount": 8500 }]
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  pdf_path text,                      -- the designed PDF, once layouts exist (file storage)
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz
);
create index proposals_contact on public.proposals (contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Paperwork on the event
-- ---------------------------------------------------------------------------

alter table public.events
  add column agreement_template_id text references public.agreement_templates (id) on delete set null,
  add column agreement_text text not null default '',
  add column agreement_sent_at timestamptz,
  add column agreement_signed_at timestamptz,
  -- The signing record, written only by the server when the client signs:
  add column signed_name text not null default '',
  add column signed_email text not null default '',
  add column signed_ip text not null default '',
  add column signed_user_agent text not null default '',
  add column signed_document_sha256 text not null default '',  -- fingerprint of the exact text signed
  add column signed_pdf_path text,                             -- signed PDF in file storage (copied to Drive nightly)
  add column deposit_amount numeric(10, 2) check (deposit_amount >= 0),
  add column payment_link text not null default '',
  add column deposit_invoice_sent_at timestamptz,
  add column deposit_paid_at timestamptz;

-- The private signing links emailed to clients. Only a hash of the token is stored,
-- links expire, and each can be used to sign once. Server-only.
create table public.signing_links (
  token_sha256 text primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz
);

-- Once signed, the agreement and its signing record can't be changed from the app.
create function public.protect_signed_agreement() returns trigger
language plpgsql as $$
begin
  if old.agreement_signed_at is not null and current_setting('role') not in ('none', 'service_role') and (
       new.agreement_text is distinct from old.agreement_text
    or new.agreement_signed_at is distinct from old.agreement_signed_at
    or new.signed_name is distinct from old.signed_name
    or new.signed_document_sha256 is distinct from old.signed_document_sha256
    or new.signed_pdf_path is distinct from old.signed_pdf_path) then
    raise exception 'This agreement has been signed and can''t be changed. Send a new agreement instead.';
  end if;
  return new;
end;
$$;

create trigger events_protect_signed before update on public.events
  for each row execute function public.protect_signed_agreement();

-- ---------------------------------------------------------------------------
-- History and security
-- ---------------------------------------------------------------------------

create trigger audit_proposals after insert or update or delete on public.proposals for each row execute function public.write_audit();
create trigger audit_proposal_templates after insert or update or delete on public.proposal_templates for each row execute function public.write_audit_keyed();
create trigger audit_agreement_templates after insert or update or delete on public.agreement_templates for each row execute function public.write_audit_keyed();

alter table public.proposal_templates enable row level security;
alter table public.agreement_templates enable row level security;
alter table public.proposals enable row level security;
alter table public.signing_links enable row level security;

create policy "team can read proposal templates" on public.proposal_templates for select using (public.is_team_member());
create policy "admins change proposal templates" on public.proposal_templates for all using (public.is_admin()) with check (public.is_admin());
create policy "team can read agreement templates" on public.agreement_templates for select using (public.is_team_member());
create policy "admins change agreement templates" on public.agreement_templates for all using (public.is_admin()) with check (public.is_admin());

create policy "team can see proposals" on public.proposals for select using (public.can_see_contact(contact_id));
create policy "team can write proposals" on public.proposals for insert with check (public.can_see_contact(contact_id));
create policy "team can update proposals" on public.proposals for update using (public.can_see_contact(contact_id));
create policy "admins can delete proposals" on public.proposals for delete using (public.is_admin());
-- signing_links: no policies, so only the server can use them.
