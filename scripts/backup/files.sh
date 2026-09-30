#!/usr/bin/env bash
# Nightly backup, step 3: copy every resume and cover letter from the private file store
# to the restricted Google Drive, encrypted with the backup passphrase, then check that
# every file arrived intact.
#
# The Drive keeps an exact copy of what's in the dashboard ("current"). Files that leave
# the dashboard (bin emptied, 12-month clean-up, privacy delete) move to "removed/<date>"
# on the Drive and are deleted from there after 30 days, like the bin.
#
# Needs: BACKUP_PASSPHRASE, plus rclone settings for the file store ("supa:") and the
#        Drive ("gdrive:") from secrets. FILES_REMOTE and FILES_DEST can point elsewhere for testing.
set -euo pipefail
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"
SOURCE="${FILES_REMOTE:-supa:}job-applications"
DEST="${FILES_DEST:-gdrive:application-files}"
KEEP_REMOVED_DAYS="${KEEP_REMOVED_DAYS:-30}"
TODAY="$(date -u +%Y-%m-%d)"

# An encrypted view of the Drive folder: files and their names are unreadable without the passphrase.
export RCLONE_CONFIG_FILESCRYPT_TYPE=crypt
export RCLONE_CONFIG_FILESCRYPT_REMOTE="$DEST"
RCLONE_CONFIG_FILESCRYPT_PASSWORD="$(rclone obscure - <<<"$BACKUP_PASSPHRASE")"
export RCLONE_CONFIG_FILESCRYPT_PASSWORD

rclone mkdir "$SOURCE"
rclone mkdir "filescrypt:current"

echo "Copying resumes and cover letters to the Drive…"
rclone sync "$SOURCE" "filescrypt:current" --backup-dir "filescrypt:removed/$TODAY"
rclone rmdirs "filescrypt:current" --leave-root

echo "Checking every file arrived intact…"
rclone cryptcheck "$SOURCE" "filescrypt:current" --one-way --quiet

echo "Clearing removed files older than $KEEP_REMOVED_DAYS days…"
cutoff="$(date -u -d "-$KEEP_REMOVED_DAYS days" +%Y-%m-%d)"
for d in $(rclone lsf "filescrypt:removed" --dirs-only 2>/dev/null | tr -d /); do
  if [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ && "$d" < "$cutoff" ]]; then rclone purge "filescrypt:removed/$d"; fi
done

COUNT="$(rclone lsf "$SOURCE" -R --files-only | wc -l)"
echo "Application files backed up: $COUNT"
