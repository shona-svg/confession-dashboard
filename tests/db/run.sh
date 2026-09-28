#!/usr/bin/env bash
# Builds a throwaway local database from the migrations and runs the data-safety tests.
# Needs a local Postgres. Set PGHOST/PGPORT/PGUSER if it isn't the default.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=confession_safety_test
psql -X -q -c "drop database if exists $DB" -c "create database $DB"
psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -f tests/db/supabase-stubs.sql
for m in supabase/migrations/*.sql; do psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -f "$m"; done
psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -f tests/db/safety-tests.sql 2>&1 | grep -E "ok  |FAILED|ERROR|passed" | sed 's/^NOTICE:  /  /'
test "${PIPESTATUS[0]}" -eq 0
