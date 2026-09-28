#!/usr/bin/env bash
# Sends a plain-text alert email through Google Workspace (Gmail SMTP), using curl.
# Usage: send-email.sh "Subject" "Body text"
# Needs: ALERT_SMTP_USER (a Workspace address, e.g. alerts@…), ALERT_SMTP_APP_PASSWORD,
#        ALERT_TO (comma-separated: venue manager, EA).
set -euo pipefail
: "${ALERT_SMTP_USER:?}" "${ALERT_SMTP_APP_PASSWORD:?}" "${ALERT_TO:?}"
SUBJECT="$1"
BODY="$2"
MAIL="$(mktemp)"
trap 'rm -f "$MAIL"' EXIT
{
  echo "From: Confession Dashboard <$ALERT_SMTP_USER>"
  echo "To: $ALERT_TO"
  echo "Subject: $SUBJECT"
  echo "Content-Type: text/plain; charset=utf-8"
  echo
  echo "$BODY"
} > "$MAIL"
RCPT=()
IFS=',' read -ra ADDRS <<< "$ALERT_TO"
for a in "${ADDRS[@]}"; do RCPT+=(--mail-rcpt "$(echo "$a" | xargs)"); done
curl --silent --show-error --ssl-reqd --url "smtps://smtp.gmail.com:465" \
  --user "$ALERT_SMTP_USER:$ALERT_SMTP_APP_PASSWORD" \
  --mail-from "$ALERT_SMTP_USER" "${RCPT[@]}" --upload-file "$MAIL"
