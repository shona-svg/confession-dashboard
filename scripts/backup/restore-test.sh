#!/usr/bin/env bash
# Monthly check that the backups actually work: download the newest nightly copy,
# decrypt it, restore it into the separate TEST database, and compare every table's
# row count with the counts recorded when the backup was made.
#
# Needs: RESTORE_DATABASE_URL (the TEST project, never production), BACKUP_PASSPHRASE,
#        BACKUP_REMOTE (default "gdrive:"). Optional: MAX_BACKUP_AGE_HOURS (default 36).
set -euo pipefail
# Remotes are set up from environment variables, so there is no rclone config file.
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
REMOTE="${BACKUP_REMOTE:-gdrive:}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Failsafe: only ever restore into a database that has been marked as the test copy.
# Production never has this marker, so a mixed-up setting can't overwrite real data.
IS_TEST="$(psql "$RESTORE_DATABASE_URL" -X -A -t -c "select to_regclass('restore_guard.this_is_the_test_database') is not null")"
if [ "$IS_TEST" != "t" ]; then
  echo "Refusing to restore: this database isn't marked as the test copy (see docs/DATA-SAFETY.md)." >&2
  exit 1
fi

LATEST="$(rclone lsf "${REMOTE}daily" --include 'confession-20[0-9][0-9]-*.dump.gpg' | sort | tail -n 1)"
if [ -z "$LATEST" ]; then echo "No backups found on the Drive." >&2; exit 1; fi
NAME="${LATEST%.dump.gpg}"
echo "Testing backup: $NAME"

# The newest backup must be recent, otherwise the nightly job has quietly stopped.
STAMP="${NAME#confession-}"
BACKUP_TIME="$(date -u -d "$(echo "$STAMP" | sed -E 's/T([0-9]{2})([0-9]{2})Z/ \1:\2 UTC/')" +%s)"
AGE_HOURS=$(( ($(date -u +%s) - BACKUP_TIME) / 3600 ))
if [ "$AGE_HOURS" -gt "${MAX_BACKUP_AGE_HOURS:-36}" ]; then
  echo "The newest backup is $AGE_HOURS hours old. The nightly backup may have stopped running." >&2
  exit 1
fi

for f in "$NAME.dump.gpg" "$NAME.counts.json" "$NAME.sha256"; do rclone copyto "${REMOTE}daily/$f" "$WORK/$f"; done
(cd "$WORK" && sha256sum --check --quiet "$NAME.sha256")
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --output "$WORK/$NAME.dump" --decrypt "$WORK/$NAME.dump.gpg" 3<<<"$BACKUP_PASSPHRASE"

echo "Restoring into the test database…"
# The backup recreates the public schema itself, so clear it out first.
psql "$RESTORE_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "set client_min_messages to warning" -c "drop schema if exists public cascade"
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$RESTORE_DATABASE_URL" "$WORK/$NAME.dump"
psql "$RESTORE_DATABASE_URL" -X -q -c "grant usage on schema public to anon, authenticated, service_role" >/dev/null 2>&1 || true

echo "Comparing row counts…"
RESTORED="$(psql "$RESTORE_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select public.backup_row_counts()")"
EXPECTED="$(cat "$WORK/$NAME.counts.json")"
MATCH="$(psql "$RESTORE_DATABASE_URL" -X -A -t -c "select '$RESTORED'::jsonb = '$EXPECTED'::jsonb")"
if [ "$MATCH" != "t" ]; then
  echo "Row counts don't match. Expected $EXPECTED, restored $RESTORED" >&2
  exit 1
fi
echo "Restore test passed: $NAME restored completely ($RESTORED)"
