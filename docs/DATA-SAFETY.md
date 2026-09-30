# Keeping Confession's data safe

How the dashboard protects customer data from being lost, wiped by mistake or seen by
the wrong people. Agreed on 28 September 2026.

No single tool can promise "never lose anything", so the protection is in **layers**.
If any one of them fails, another still has the data.

| If this happens… | …this protects you |
|---|---|
| Someone deletes a contact by mistake | The **bin** keeps it for 30 days, and an admin can restore it |
| Someone overwrites details by mistake | The **change history** records what it was before |
| A bug or a bad sync tries to change lots of records | The **safety stop** refuses to delete more than 25, or change more than 200, contacts in one go |
| The website form can't reach the database | Every submission is **also** saved to Netlify storage and emailed to the venue inbox |
| Something goes wrong in the database | **Supabase's daily backups** (7 days, Pro plan) |
| Something goes wrong with Supabase itself | **Our own nightly backups**, encrypted, on your restricted Google Drive |
| A backup turns out to be unusable | A **monthly restore test** proves the backups work, and emails if they don't |
| The backups quietly stop running | The restore test checks the newest backup is recent. You also get a Monday "all good" email, so a missing one is a warning sign |
| A password is stolen | **Two-factor login** on every account; only active team members can see anything |
| The one person with access is unavailable | **Two owners** on every account: the venue manager, with the EA as back-up |

## Decisions

- **Supabase Pro plan** (US$25/month): daily backups kept for 7 days, and the project never pauses.
- **Point-in-Time Recovery:** not for now. It can be switched on later (about US$100/month) to cut the worst
  case from "up to a day of dashboard changes" to "a few seconds". New enquiries are protected either way.
- **Off-site copies:** a restricted Google Drive **shared drive** in the Confession Workspace.
- **Alerts** go to the **venue manager**, with the **EA** as back-up. The EA is also the second owner on each account.
- **Bin:** 30 days before permanent deletion.

## What happens automatically

**Every night** (about 1am Adelaide time):
1. The whole database is exported, and the export is checked to make sure it can be read back.
2. It's encrypted with a passphrase, and checked to make sure it decrypts to exactly the same file.
3. It's uploaded to the shared drive, and checked again (with a checksum) to make sure it arrived intact.
4. A contacts spreadsheet you can open in Google Sheets is saved alongside it. It leaves out sensitive
   fields such as accessibility needs.
5. A **job applications spreadsheet** is saved too (names, contact details, roles, answers, status and
   file names).
6. **Every resume and cover letter** is copied to the shared drive's `application-files` folder, encrypted with
   the same passphrase, and each file is checked to make sure it arrived intact.
7. Only once all of that has worked, the bin is emptied of anything older than 30 days, and job applications
   older than **12 months** are deleted (unless the person was hired), along with their files.
8. Old copies are cleared out automatically. Kept: **30 nightly copies, 12 monthly copies**
   (from the 1st of each month) and **7 spreadsheets**. A resume or cover letter that leaves the dashboard stays
   in the Drive's `removed` folder for 30 days, then it's gone.

**Every Monday:** a short "backups are running" email.

**On the 2nd of every month:** the newest backup is downloaded, decrypted and fully restored into a
separate **test** database, and every table's row count is compared with the count recorded on the night of
the backup. You get a "passed" or an "ACTION NEEDED" email.

**If anything fails:** an "ACTION NEEDED" email with a link to what went wrong. Earlier backups are never
touched by a failed night.

### Built-in failsafes
- The restore test will only ever restore into a database marked as the test copy. If a setting got mixed
  up and pointed it at the live database, it refuses to run.
- Tampered or damaged backup files are detected (checksums) before anything is restored.
- Deleting someone for a **privacy request** removes them *and* their change history straight away.
  Their details remain in the encrypted backups until those backups expire (at most 12 months).
  Mention this in the privacy policy. Job applications work the same way.
- Resumes and cover letters are encrypted on the Drive, including their file names, so even someone who
  somehow opened the shared drive couldn't read them without the passphrase.

## What's inside the database

The rules are written into the database itself (`supabase/migrations/`), so they apply however the data is
reached. They aren't just hidden buttons in the app.
- Row Level Security on every table: nobody sees anything unless they're an active team member.
- Only **admins** can permanently delete, restore from the bin, or read the change history.
- The timeline and stage history can only grow. They can't be edited or deleted from the app.
- Every import is labelled, so a bad import can be removed in one step.
- Team members are matched to their Google login by email, so after a restore into a new project,
  people just sign in again.

These rules are tested: `tests/db/safety-tests.sql` tries to break each one (a stranger reading data, a member
deleting, a 30-contact wipe, the bin, a privacy delete) and fails if any rule doesn't hold.

## Setting it up (Phase 3)

Nothing here goes in chat. Each value is pasted straight into the right settings page.

**You'll do (I'll send click-by-click steps at the time):**
1. **Supabase:** two projects in the **Sydney** region, on the Pro plan: `confession-dashboard` (live) and
   `confession-dashboard-test` (the test copy). Turn on two-factor login and add the EA as an owner.
2. **Google Drive:** create a shared drive, for example "Confession dashboard backups". Only the venue manager and EA
   are members.
3. **Google Cloud (Workspace admin):** create a service account for the backups, and add it to the shared drive
   as a *Content manager*.
4. **An alerts sender:** a Workspace address (for example `alerts@…`) with an app password, used only to send these emails.
5. **A backup passphrase:** a long random passphrase. Store it in **two** places you control (for example your
   password manager and the EA's). **Without it the backups can't be opened**, so this matters.

**Then these go into GitHub** (Repository → Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `SUPABASE_DB_URL` | Live database connection string. Use the **Session pooler** one; GitHub can't use the direct one |
| `TEST_DB_URL` | Same, for the test project |
| `BACKUP_PASSPHRASE` | The backup passphrase |
| `GDRIVE_SERVICE_ACCOUNT_JSON` | The service account key file's contents |
| `GDRIVE_SHARED_DRIVE_ID` | The shared drive's ID (from its web address) |
| `ALERT_SMTP_USER` / `ALERT_SMTP_APP_PASSWORD` | The alerts sender and its app password |
| `ALERT_TO` | `venue.manager@…, ea@…` |
| `SUPABASE_S3_ENDPOINT` / `SUPABASE_S3_REGION` | From Supabase → Storage → Settings → S3 connection |
| `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_ACCESS_KEY` | An S3 access key created on that same page, used only by the backup |

Until the four file-storage secrets are added, the nightly summary shows a warning that resumes and cover
letters aren't being backed up yet.

**One-off step on the test project only:** run this once in its SQL editor to mark it as the test copy:
`create schema restore_guard; create table restore_guard.this_is_the_test_database (note text);`

The schedules only run from the repository's main branch, so they start once this work is merged into it.
Until the secrets are added, they skip quietly instead of failing.

## If something goes wrong: getting data back

| Situation | What to do |
|---|---|
| One contact deleted by mistake (within 30 days) | Admin → Bin → Restore |
| A field overwritten by mistake | Admin → the contact's change history → copy back the old value |
| A bad import | Admin → Imports → Remove this import |
| Bigger problem, within the last 7 days | Supabase dashboard → Database → Backups → restore a daily backup |
| Supabase account lost or project gone | Create a new project, then restore the newest Drive backup into it (below) |

**Restoring a Drive backup into a new project** (I'll do this with you; it takes about 15 minutes):
1. Download the newest `confession-….dump.gpg` from the shared drive's `daily` folder.
2. Decrypt it: `gpg --decrypt confession-….dump.gpg > backup.dump` (it asks for the passphrase).
3. Restore it: `pg_restore --no-owner --no-privileges --dbname "<new project connection string>" backup.dump`
4. Point Netlify at the new project, then everyone signs in again with Google.
5. Copy the resumes and cover letters back from the Drive's `application-files/current` folder. They're
   encrypted, so this is done with the backup tool and the passphrase. I'll run this step with you.
