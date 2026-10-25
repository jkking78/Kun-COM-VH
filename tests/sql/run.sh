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
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
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
# La 09 ne change aucun droit : test_08 doit passer à l'identique par-dessus.
lancer tests/sql/test_08_temps_reel.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql
lancer tests/sql/test_09_performances_rls.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql
# La 10 durcit sans retirer de droit : test_08 doit encore passer par-dessus.
lancer tests/sql/test_08_temps_reel.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql
lancer tests/sql/test_10_securite.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql
# La 11 étend la fusion collaborative : test_08 doit encore passer par-dessus.
lancer tests/sql/test_08_temps_reel.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql
lancer tests/sql/test_11_lieux_preparation.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql
# La 12 restreint les assignations d'un Responsable à ses pôles.
lancer tests/sql/test_08_temps_reel.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql
lancer tests/sql/test_11_lieux_preparation.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql
lancer tests/sql/test_12_assignations.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql
# La 13 fige pôles et bonus, horodate les positions tardives, ferme les envois de fichiers.
lancer tests/sql/test_08_temps_reel.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql migration/13_securite_fiabilite.sql
lancer tests/sql/test_12_assignations.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql migration/13_securite_fiabilite.sql
lancer tests/sql/test_13_securite_fiabilite.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql migration/13_securite_fiabilite.sql
# La 14 filtre côté serveur les publications ciblées et programmées.
lancer tests/sql/test_14_visibilite.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql migration/13_securite_fiabilite.sql migration/14_visibilite_ciblee.sql
lancer tests/sql/test_08_temps_reel.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql migration/13_securite_fiabilite.sql migration/14_visibilite_ciblee.sql
# La 15 enrichit l'aperçu public des événements partagés.
lancer tests/sql/test_15_apercu.sql migration/06_durcissement_ecritures.sql migration/15_apercu_evenements.sql
lancer tests/sql/test_06_durcissement.sql migration/06_durcissement_ecritures.sql migration/15_apercu_evenements.sql
# La 16 vide le contenu des publications supprimées.
lancer tests/sql/test_16_suppression.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/16_suppression_videe.sql
lancer tests/sql/test_06_durcissement.sql migration/06_durcissement_ecritures.sql migration/16_suppression_videe.sql
# La 17 enregistre les vues des publications sur le serveur.
lancer tests/sql/test_17_vues.sql migration/03_security_questions.sql migration/06_durcissement_ecritures.sql migration/07_convocations_et_validation.sql migration/08_temps_reel.sql migration/09_performances_rls.sql migration/10_securite.sql migration/11_lieux_et_preparation.sql migration/12_assignations_par_pole.sql migration/13_securite_fiabilite.sql migration/14_visibilite_ciblee.sql migration/16_suppression_videe.sql migration/17_vues.sql
