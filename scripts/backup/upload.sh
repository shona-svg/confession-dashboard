#!/usr/bin/env bash
# Nightly backup, step 2: copy tonight's files to the restricted Google Drive,
# check they arrived intact, and clear out copies past their keep-by date.
#
# Keeps: 30 nightly copies, 12 monthly copies (1st of each month), 7 spreadsheets.
# Needs: BACKUP_REMOTE (default "gdrive:"), plus rclone's Google Drive settings from secrets.
set -euo pipefail
# Remotes are set up from environment variables, so there is no rclone config file.
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"
OUT_DIR="${OUT_DIR:-backup-out}"
REMOTE="${BACKUP_REMOTE:-gdrive:}"
NAME="$(cat "$OUT_DIR/latest-name")"
FILES=("$NAME.dump.gpg" "$NAME.counts.json" "$NAME.sha256")

copy_and_check() {
  local dest="$1"
  for f in "${FILES[@]}"; do rclone copyto "$OUT_DIR/$f" "$REMOTE$dest/$f"; done
  # Compare what's on the Drive with what we made, byte for byte (checksums).
  for f in "${FILES[@]}"; do
    rclone check "$OUT_DIR" "$REMOTE$dest" --one-way --include "$f" --quiet
  done
}

# Make sure the folders exist (the first run starts with an empty drive).
for d in daily monthly spreadsheets; do rclone mkdir "$REMOTE$d"; done

echo "Uploading nightly copy…"
copy_and_check "daily"
if [ "$(date -u +%d)" = "01" ] || [ "${FORCE_MONTHLY:-}" = "1" ]; then
  echo "First of the month: keeping a monthly copy too…"
  copy_and_check "monthly"
fi
rclone copy "$OUT_DIR" "${REMOTE}spreadsheets" --include "contacts-*.csv"

echo "Clearing out old copies…"
rclone delete "${REMOTE}daily" --min-age 31d
rclone delete "${REMOTE}monthly" --min-age 366d
rclone delete "${REMOTE}spreadsheets" --min-age 8d

COUNT="$(rclone lsf "${REMOTE}daily" --include '*.dump.gpg' | wc -l)"
echo "Stored safely. Nightly copies on the Drive: $COUNT"
