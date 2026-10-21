#!/usr/bin/env bash
# Teste les migrations SQL sur un PostgreSQL local (aucune donnée réelle) :
# pour chaque jeu de tests, crée une base jetable imitant Supabase, applique
# les migrations voulues deux fois (elles doivent être idempotentes), puis
# lance les tests.
#
# Usage : PGHOST=/chemin/socket PGPORT=5432 PGUSER=postgres tests/sql/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

# Les rôles sont globaux au serveur : on ne les crée que s'ils manquent.
psql -q -d postgres -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \$\$" >/dev/null

BASES=()
nettoyer() { for b in "${BASES[@]}"; do psql -q -d postgres -c "drop database if exists $b" >/dev/null 2>&1 || true; done; }
trap nettoyer EXIT

# lancer <fichier de tests> <migration>...
lancer() {
  local tests="$1"; shift
  local base="kc_test_$$_${#BASES[@]}"
  BASES+=("$base")
  psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $base" >/dev/null
  sed -e '/^create role anon nologin;$/d' -e '/^create role authenticated nologin;$/d' tests/sql/supabase_mock.sql \
    | psql -q -v ON_ERROR_STOP=1 -d "$base" >/dev/null
  for m in "$@"; do
    for i in 1 2; do psql -q -v ON_ERROR_STOP=1 -d "$base" -f "$m" >/dev/null 2>&1 || psql -q -v ON_ERROR_STOP=1 -d "$base" -f "$m"; done
  done
  echo "— $tests"
  psql -q -v ON_ERROR_STOP=1 -d "$base" -f "$tests" 2>&1 \
    | sed -n 's/^.*NOTICE:  //p; s/^.*\(ERROR:.*\)/\1/p; /passés/p'
}

lancer tests/sql/test_06_durcissement.sql migration/06_durcissement_ecritures.sql
lancer tests/sql/test_07_convocations_validation.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql
lancer tests/sql/test_08_temps_reel.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql
