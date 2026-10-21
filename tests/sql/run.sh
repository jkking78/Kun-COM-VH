#!/usr/bin/env bash
# Teste les migrations SQL sur un PostgreSQL local (aucune donnée réelle) :
# crée une base jetable imitant Supabase, applique la migration 06 deux fois
# (elle doit être idempotente), puis lance les tests.
#
# Usage : PGHOST=/chemin/socket PGPORT=5432 PGUSER=postgres tests/sql/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

BASE="kc_test_$$"
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $BASE" >/dev/null
nettoyer() { psql -q -d postgres -c "drop database if exists $BASE" >/dev/null 2>&1 || true; }
trap nettoyer EXIT

# Les rôles sont globaux au serveur : on ne les crée que s'ils manquent.
psql -q -d postgres -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \$\$" >/dev/null
sed -e '/^create role anon nologin;$/d' -e '/^create role authenticated nologin;$/d' tests/sql/supabase_mock.sql \
  | psql -q -v ON_ERROR_STOP=1 -d "$BASE" >/dev/null

for i in 1 2; do
  psql -q -v ON_ERROR_STOP=1 -d "$BASE" -f migration/06_durcissement_ecritures.sql >/dev/null
done

psql -q -v ON_ERROR_STOP=1 -d "$BASE" -f tests/sql/test_06_durcissement.sql 2>&1 \
  | sed -n 's/^.*NOTICE:  //p; s/^.*\(ERROR:.*\)/\1/p; /passés/p'
