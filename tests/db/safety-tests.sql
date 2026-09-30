-- Tries to break the data-safety rules. Every check raises an error if a rule
-- doesn't hold, so the script only finishes if they all pass.
-- Run with: npm run test:db   (needs a local Postgres; see tests/db/run.sh)
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------- Setup (as the database owner) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'member@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com');
insert into public.team_members (user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Ada Admin', 'admin@example.com', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'Mo Member', 'member@example.com', 'member');

create function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', false);
end $$;

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- ---------- Linking a login to a team member by email ----------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'new.starter@example.com');
insert into public.team_members (name, email) values ('New Starter', 'new.starter@example.com');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select set_config('request.jwt.claims', '{"role":"authenticated","email":"New.Starter@example.com"}', false);
set role authenticated;
do $$ begin
  perform pg_temp.expect(not public.is_team_member(), 'a new login isn''t on the team until it''s linked');
  perform pg_temp.expect(public.link_my_account(), 'signing in with the matching email links the account');
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.com"}', false);
  perform pg_temp.expect(not public.link_my_account(), 'an email that isn''t on the team list gets nothing');
end $$;
reset role;

-- ---------- As someone who isn't on the team ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
insert into public.contacts (first_name, email) select 'Sneaky', 'sneaky@example.com' where false; -- (no-op)
do $$ begin
  perform pg_temp.expect((select count(*) from public.contacts) = 0 and (select count(*) from public.team_members) = 0,
    'a signed-in stranger sees nothing');
  begin
    insert into public.contacts (first_name, email) values ('Sneaky', 'sneaky@example.com');
    raise exception 'FAILED: stranger could add a contact';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'a stranger cannot add contacts');
  end;
end $$;
reset role;

-- ---------- As a team member ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$
declare cid uuid;
begin
  insert into public.contacts (first_name, last_name, email, stage)
  values ('Olivia', 'Nguyen', '  Olivia.Nguyen@Example.com ', 'lead') returning id into cid;
  perform pg_temp.expect((select email from public.contacts where id = cid) = 'olivia.nguyen@example.com',
    'emails are tidied to lower case');
  perform pg_temp.expect((select count(*) from public.stage_changes where contact_id = cid and to_stage = 'lead'
                          and changed_by like 'tm:%') = 1, 'a new contact gets its first stage history row, credited to the team member');

  begin
    insert into public.contacts (first_name, email) values ('Dup', 'OLIVIA.NGUYEN@example.com');
    raise exception 'FAILED: duplicate email allowed';
  exception when unique_violation then
    perform pg_temp.expect(true, 'the same email cannot be added twice');
  end;

  update public.contacts set stage = 'tour_booked' where id = cid;
  perform pg_temp.expect((select count(*) from public.stage_changes where contact_id = cid) = 2, 'moving stage is recorded');

  begin
    update public.contacts set stage = 'lost' where id = cid;
    raise exception 'FAILED: lost without a reason';
  exception when check_violation then
    perform pg_temp.expect(true, 'lost needs a reason');
  end;
  update public.contacts set stage = 'lost', lost_reason = 'over_budget' where id = cid;
  perform pg_temp.expect((select lost_from_stage from public.contacts where id = cid) = 'tour_booked', 'lost remembers the stage they were at');

  insert into public.activities (contact_id, type, summary) values (cid, 'call', 'Talked dates');
  begin
    delete from public.activities where contact_id = cid;
    raise exception 'FAILED: member deleted timeline';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'the timeline cannot be deleted from the app');
  end;

  delete from public.contacts where id = cid;
  perform pg_temp.expect((select count(*) from public.contacts where id = cid) = 1, 'a member cannot permanently delete a contact');
  perform pg_temp.expect((select count(*) from public.audit_log) = 0, 'a member cannot read the change history');

  perform public.move_to_bin(cid);
  perform pg_temp.expect((select count(*) from public.contacts where id = cid) = 0, 'a member can move a contact to the bin, and it disappears for them');

  insert into public.contacts (first_name, email) values ('Olivia again', 'olivia.nguyen@example.com');
  perform pg_temp.expect(true, 'someone in the bin doesn''t block a new enquiry from the same email');

  begin
    perform public.forget_contact(cid);
    raise exception 'FAILED: member used forget_contact';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    perform pg_temp.expect(true, 'a member cannot use the privacy delete');
  end;

  begin
    perform public.purge_bin();
    raise exception 'FAILED: member emptied the bin';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'a member cannot empty the bin');
  end;

  begin
    perform public.backup_row_counts();
    raise exception 'FAILED: member ran backup counts';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'backup tools are server-only');
  end;
end $$;
reset role;

-- ---------- As an admin ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
declare
  binned uuid;
  n int;
begin
  select id into binned from public.contacts where deleted_at is not null;
  perform pg_temp.expect(binned is not null, 'an admin can see the bin');
  perform pg_temp.expect((select count(*) from public.audit_log where contact_id = binned) >= 3, 'an admin can read the change history');

  begin
    perform public.restore_from_bin(binned);
    raise exception 'FAILED: restored over a live duplicate';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    perform pg_temp.expect(sqlerrm like 'Can''t restore%', 'restoring is blocked, with a clear message, if the email is now in use');
  end;

  insert into public.contacts (first_name, email) values ('Restore me', 'restore.me@example.com');
  perform public.move_to_bin((select id from public.contacts where email = 'restore.me@example.com'));
  perform public.restore_from_bin((select id from public.contacts where email = 'restore.me@example.com'));
  perform pg_temp.expect((select deleted_at from public.contacts where email = 'restore.me@example.com') is null,
    'an admin can restore from the bin');

  insert into public.contacts (first_name, email)
  select 'Bulk ' || g, 'bulk' || g || '@example.com' from generate_series(1, 30) g;
  begin
    delete from public.contacts where email like 'bulk%';
    raise exception 'FAILED: bulk delete allowed';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    perform pg_temp.expect(sqlerrm like 'Safety stop%', 'deleting 30 contacts at once is stopped');
  end;
  select count(*) into n from public.contacts where email like 'bulk%';
  perform pg_temp.expect(n = 30, 'and nothing was deleted');

  begin
    update public.contacts set tags = '{oops}';
    perform pg_temp.expect((select count(*) from public.contacts) <= 200, 'small updates are fine');
  end;
end $$;
reset role;

-- ---------- The nightly job (server) ----------
do $$
declare
  old_id uuid;
  recent_id uuid;
  n int;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  select id into old_id from public.contacts where deleted_at is not null limit 1;
  update public.contacts set deleted_at = now() - interval '31 days' where id = old_id;
  insert into public.contacts (first_name, email, deleted_at) values ('Recent bin', 'recent@example.com', now() - interval '5 days')
  returning id into recent_id;

  n := public.purge_bin();
  perform pg_temp.expect(n = 1, 'the bin empties contacts older than 30 days');
  perform pg_temp.expect(not exists (select 1 from public.contacts where id = old_id), '...and they are gone');
  perform pg_temp.expect(not exists (select 1 from public.audit_log where contact_id = old_id), '...including from the change history');
  perform pg_temp.expect(not exists (select 1 from public.activities where contact_id = old_id), '...and their timeline');
  perform pg_temp.expect(exists (select 1 from public.contacts where id = recent_id), 'contacts binned 5 days ago are kept');

  perform public.forget_contact(recent_id);
  perform pg_temp.expect(not exists (select 1 from public.audit_log where contact_id = recent_id)
                         and not exists (select 1 from public.contacts where id = recent_id), 'a privacy delete removes the person and their history');

  perform pg_temp.expect((public.backup_row_counts() ->> 'contacts')::int = (select count(*) from public.contacts), 'backup row counts are exact');
end $$;

\echo 'All data-safety checks passed'

-- ---------- Settings and website tracking (second migration) ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  perform pg_temp.expect((select count(*) from public.email_templates) >= 0 and (select count(*) from public.tracking_rules) = 6,
    'the team can read settings and tracking rules');
  update public.tracking_rules set alert = false;
  perform pg_temp.expect((select count(*) from public.tracking_rules where alert) = 2, 'a member cannot change tracking rules');
  update public.settings set value = '{}' where key = 'rules';
  perform pg_temp.expect((select value ->> 'followUpDays' from public.settings where key = 'rules') = '5', 'a member cannot change the rules');
  begin
    insert into public.web_visits (visitor_id, page_path) values ('abcdefghijklmnop', '/functions');
    raise exception 'FAILED: member wrote website visits';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'only the server can record website visits');
  end;
end $$;
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  update public.settings set value = jsonb_set(value, '{followUpDays}', '4') where key = 'rules';
  perform pg_temp.expect((select value ->> 'followUpDays' from public.settings where key = 'rules') = '4', 'an admin can change the rules');
  perform pg_temp.expect(exists (select 1 from public.audit_log where table_name = 'settings' and record_key = 'rules'), '...and the change is in the history');
end $$;
reset role;

do $$
declare
  cid uuid;
  n int;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  insert into public.contacts (first_name, email) values ('Visitor', 'visitor@example.com') returning id into cid;
  insert into public.web_visitors (visitor_id, contact_id, last_seen) values ('known-visitor-0001', cid, now() - interval '200 days');
  insert into public.web_visitors (visitor_id, last_seen) values ('anon-visitor-00001', now() - interval '100 days');
  insert into public.web_visitors (visitor_id, last_seen) values ('anon-visitor-00002', now() - interval '10 days');
  insert into public.web_visits (visitor_id, contact_id, page_path) values ('known-visitor-0001', cid, '/functions/corporate');
  insert into public.web_visits (visitor_id, page_path) values ('anon-visitor-00001', '/gallery');
  n := public.purge_anonymous_visits();
  perform pg_temp.expect(n = 1, 'anonymous visitors older than 90 days are removed');
  perform pg_temp.expect(exists (select 1 from public.web_visitors where visitor_id = 'known-visitor-0001'), 'known contacts keep their visit history');
  perform public.forget_contact(cid);
  perform pg_temp.expect(not exists (select 1 from public.web_visits where contact_id = cid) and not exists (select 1 from public.web_visitors where visitor_id = 'known-visitor-0001'),
    'a privacy delete removes their website history too');
end $$;

\echo 'Settings and tracking checks passed'

-- ---------- Proposals and signed agreements (third migration) ----------
do $$
declare
  cid uuid;
  eid uuid;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  insert into public.contacts (first_name, email, stage) values ('Signer', 'signer@example.com', 'finalising') returning id into cid;
  insert into public.events (contact_id, date, start_time, end_time, status, agreement_text, agreement_sent_at, agreement_signed_at, signed_name)
  values (cid, current_date + 90, '18:00', '23:00', 'hold', 'Agreed terms', now(), now(), 'Signer') returning id into eid;
  perform set_config('app.test_event', eid::text, false);
  perform pg_temp.expect((select stage from public.contacts where id = cid) = 'finalising', 'contacts can be in the Finalising stage');
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$
declare eid uuid := current_setting('app.test_event')::uuid;
begin
  begin
    update public.events set agreement_text = 'Sneaky new terms' where id = eid;
    raise exception 'FAILED: signed agreement was changed';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    perform pg_temp.expect(sqlerrm like 'This agreement has been signed%', 'a signed agreement can''t be changed');
  end;
  update public.events set deposit_invoice_sent_at = now() where id = eid;
  perform pg_temp.expect((select deposit_invoice_sent_at from public.events where id = eid) is not null, 'the team can still record the deposit invoice');
  perform pg_temp.expect((select count(*) from public.signing_links) = 0, 'signing links are hidden from the app');
end $$;
reset role;

\echo 'Proposal and agreement checks passed'

-- ---------- Job applications (fourth migration) ----------
do $$
declare
  aid uuid;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  -- As the website form's server function would.
  insert into public.job_applications (first_name, last_name, email, mobile, roles, resume_path, resume_name)
  values ('Tahlia', 'Brennan', 'tahlia@example.com', '0491 570 150', array['Bar staff'], 'a/resume.pdf', 'resume.pdf')
  returning id into aid;
  perform set_config('app.test_application', aid::text, false);
  begin
    insert into public.job_applications (first_name, last_name, email, mobile, roles, resume_path, resume_name)
    values ('No', 'Role', 'norole@example.com', '0491 570 151', '{}', 'b/resume.pdf', 'resume.pdf');
    raise exception 'FAILED: application without a role was accepted';
  exception when check_violation then
    perform pg_temp.expect(true, 'an application needs at least one role');
  end;
end $$;

-- Someone on the website, not signed in
set role anon;
do $$
begin
  perform pg_temp.expect((select count(*) from public.job_applications) = 0, 'the public can''t read applications');
  begin
    insert into public.job_applications (first_name, last_name, email, mobile, roles, resume_path, resume_name)
    values ('Sneaky', 'Bot', 'bot@example.com', '0491 570 152', array['Glassy'], 'x', 'x.pdf');
    raise exception 'FAILED: anonymous insert worked';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'the public can''t write applications directly (only the form''s server function can)');
  end;
end $$;
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
do $$ begin
  perform pg_temp.expect((select count(*) from public.job_applications) = 0, 'a stranger with a login can''t see applications');
end $$;
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$
declare aid uuid := current_setting('app.test_application')::uuid;
begin
  perform pg_temp.expect((select count(*) from public.job_applications) = 1, 'the team can see applications');
  update public.job_applications set status = 'interview', notes = 'Trial shift Friday' where id = aid;
  perform pg_temp.expect((select status from public.job_applications where id = aid) = 'interview', 'the team can update status and notes');
  begin
    delete from public.job_applications where id = aid;
    raise exception 'FAILED: member deleted an application';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'a member can''t permanently delete an application');
  end;
  begin
    perform count(*) from public.storage_cleanup;
    raise exception 'FAILED: member read the clean-up queue';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'the file clean-up queue is hidden from the app');
  end;
  perform public.bin_application(aid);
  perform pg_temp.expect((select count(*) from public.job_applications where id = aid) = 0, 'a member can move an application to the bin');
  begin
    perform public.purge_job_applications();
    raise exception 'FAILED: member ran the clean-up';
  exception when insufficient_privilege then
    perform pg_temp.expect(true, 'a member can''t run the application clean-up');
  end;
end $$;
reset role;

do $$
declare
  aid uuid := current_setting('app.test_application')::uuid;
  old_id uuid;
  hired_id uuid;
  n int;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  insert into public.job_applications (first_name, last_name, email, mobile, roles, resume_path, resume_name, cover_letter_path, cover_letter_name, submitted_at)
  values ('Old', 'Applicant', 'old@example.com', '0491 570 153', array['Glassy'], 'c/resume.pdf', 'resume.pdf', 'c/cover.pdf', 'cover.pdf', now() - interval '13 months')
  returning id into old_id;
  insert into public.job_applications (first_name, last_name, email, mobile, roles, resume_path, resume_name, status, submitted_at)
  values ('Hired', 'Person', 'hired@example.com', '0491 570 154', array['Bar staff'], 'd/resume.pdf', 'resume.pdf', 'hired', now() - interval '13 months')
  returning id into hired_id;
  n := public.purge_job_applications();
  perform pg_temp.expect(n = 1, 'applications older than 12 months are removed');
  perform pg_temp.expect(not exists (select 1 from public.job_applications where id = old_id), '...and they are gone');
  perform pg_temp.expect(exists (select 1 from public.job_applications where id = hired_id), '...unless the person was hired');
  perform pg_temp.expect(exists (select 1 from public.job_applications where id = aid), 'something binned today stays in the bin for 30 days');
  perform pg_temp.expect((select count(*) from public.storage_cleanup where path in ('c/resume.pdf', 'c/cover.pdf')) = 2,
    'their resume and cover letter are queued for deletion from file storage');
  perform pg_temp.expect(not exists (select 1 from public.audit_log where record_id = old_id), '...and removed from the change history');
  perform public.forget_application(aid);
  perform pg_temp.expect(not exists (select 1 from public.job_applications where id = aid)
    and not exists (select 1 from public.audit_log where record_id = aid), 'a privacy delete removes an application and its history');
end $$;

\echo 'Job application checks passed'
