#!/usr/bin/env bash
# Nightly backup, step 1: export the database, check the export is readable,
# record exact row counts, and encrypt it. Also writes spreadsheets of contacts and job applications.
#
# Needs: DATABASE_URL (Supabase session-pooler connection string, read from a secret)
#        BACKUP_PASSPHRASE (the backup encryption passphrase, read from a secret)
# Writes into $OUT_DIR (default: backup-out).
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
OUT_DIR="${OUT_DIR:-backup-out}"
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
DAY="$(date -u +%Y-%m-%d)"
NAME="confession-$STAMP"
mkdir -p "$OUT_DIR"
umask 077

echo "Exporting the database…"
pg_dump "$DATABASE_URL" --schema=public --format=custom --no-owner --no-privileges --file "$OUT_DIR/$NAME.dump"

echo "Checking the export can be read back…"
pg_restore --list "$OUT_DIR/$NAME.dump" > /dev/null
TABLES_IN_DUMP="$(pg_restore --list "$OUT_DIR/$NAME.dump" | grep -c 'TABLE DATA public' || true)"
if [ "$TABLES_IN_DUMP" -lt 10 ]; then
  echo "The export only contains $TABLES_IN_DUMP tables. Something is wrong." >&2
  exit 1
fi

echo "Recording row counts…"
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select public.backup_row_counts()" > "$OUT_DIR/$NAME.counts.json"

echo "Encrypting…"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$OUT_DIR/$NAME.dump.gpg" "$OUT_DIR/$NAME.dump" \
  3<<<"$BACKUP_PASSPHRASE"
# Prove the encrypted copy decrypts to exactly the same file before deleting the original.
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$OUT_DIR/$NAME.dump.gpg" 3<<<"$BACKUP_PASSPHRASE" \
  | cmp - "$OUT_DIR/$NAME.dump"
rm -f "$OUT_DIR/$NAME.dump"

echo "Writing the contacts spreadsheet (no sensitive fields)…"
psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "\copy (
  select c.first_name, c.last_name, c.email, c.phone, c.company, et.name as event_type, c.event_date,
         c.guest_count, c.estimated_value, c.source, c.stage, c.tags, tm.name as owner, c.marketing_consent,
         c.created_at
  from public.contacts c
  left join public.event_types et on et.id = c.event_type_id
  left join public.team_members tm on tm.id = c.owner_id
  where c.deleted_at is null
  order by c.created_at
) to '$OUT_DIR/contacts-$DAY.csv' with csv header"

echo "Writing the job applications spreadsheet…"
psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "\copy (
  select first_name, last_name, email, mobile, array_to_string(roles, ', ') as roles, message, status, notes,
         resume_name, cover_letter_name, submitted_at
  from public.job_applications
  where deleted_at is null
  order by submitted_at
) to '$OUT_DIR/job-applications-$DAY.csv' with csv header"

(cd "$OUT_DIR" && sha256sum "$NAME.dump.gpg" "$NAME.counts.json" > "$NAME.sha256")
echo "$NAME" > "$OUT_DIR/latest-name"
echo "Backup ready: $NAME ($(du -h "$OUT_DIR/$NAME.dump.gpg" | cut -f1))"
