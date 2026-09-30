#!/usr/bin/env bash
# Nightly, after the backups: removes files the database has marked for deletion
# (an application was deleted, cleaned up after 12 months, or forgotten on request).
# The Drive keeps them in "removed" for 30 days, then they're gone everywhere.
#
# Needs: DATABASE_URL, plus rclone settings for the file store ("supa:").
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is not set}"
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"
REMOTE="${FILES_REMOTE:-supa:}"
n=0
while IFS=$'\t' read -r id bucket path; do
  [ -n "$id" ] || continue
  if [ -n "$(rclone lsf "$REMOTE$bucket/$path" 2>/dev/null)" ]; then
    rclone deletefile "$REMOTE$bucket/$path"
  fi
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "delete from public.storage_cleanup where id = $id"
  n=$((n + 1))
done < <(psql "$DATABASE_URL" -X -A -t -F $'\t' -v ON_ERROR_STOP=1 -c "select id, bucket, path from public.storage_cleanup order by id")
echo "Files removed from storage: $n"
