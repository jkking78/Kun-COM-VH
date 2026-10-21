// Rappels du plan de préparation (migration 11) : la veille d'une étape, puis
// une fois si elle est en retard. Logique pure, sans accès à la base, pour
// être testée hors de Supabase (tests/unit/etapes.test.mjs).
//
// Une étape à rappeler = une entrée de content.preparation[<pôle>].taches[]
// .etapes[] non cochée et datée. Heure d'Abidjan = UTC.

export type Etape = { cle: string; titre: string; date: string };
export type GroupeEtapes = {
  evId: string;
  pole: string;
  genre: "veille" | "retard";
  evTitre: string;
  majPar: string | null;
  etapes: Etape[];
};

const H = 3600e3;
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function dateCourte(iso: string): string {
  const [, m, j] = iso.split("-").map(Number);
  return j + " " + (MOIS[m - 1] ?? "");
}

// Étapes dues, regroupées par événement, pôle et genre. debutEvenement :
// l'horodatage du début (au-delà, plus aucun rappel de préparation).
// deno-lint-ignore no-explicit-any
export function etapesDues(evs: { id: string; content: any }[], maintenant: number,
                           debutEvenement: (ev: Record<string, unknown>) => number | null): GroupeEtapes[] {
  const groupes: GroupeEtapes[] = [];
  for (const ligne of evs) {
    const ev = ligne.content ?? {};
    const prep = ev.preparation;
    if (!prep || typeof prep !== "object") continue;
    const debut = debutEvenement(ev);
    if (!debut || maintenant >= debut) continue;
    for (const pole of Object.keys(prep)) {
      const entree = prep[pole];
      if (!entree || !Array.isArray(entree.taches)) continue;
      const parGenre: Record<string, Etape[]> = { veille: [], retard: [] };
      for (const t of entree.taches) {
        for (const e of Array.isArray(t?.etapes) ? t.etapes : []) {
          if (!e || e.fait === true || typeof e.id !== "string") continue;
          if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
          const jour = Date.parse(e.date + "T00:00:00Z");
          if (isNaN(jour)) continue;
          const titre = String(e.titre ?? "").replace(/\s+/g, " ").trim() || "Étape";
          // La veille, à partir de 8 h ; en retard, le lendemain à partir de 8 h.
          if (maintenant >= jour - 16 * H && maintenant < jour) {
            parGenre.veille.push({ cle: "etape-veille:" + ligne.id + ":" + e.id, titre, date: e.date });
          } else if (maintenant >= jour + 32 * H) {
            parGenre.retard.push({ cle: "etape-retard:" + ligne.id + ":" + e.id, titre, date: e.date });
          }
        }
      }
      for (const genre of ["veille", "retard"] as const) {
        if (parGenre[genre].length) {
          groupes.push({ evId: ligne.id, pole, genre, evTitre: String(ev.eventTitle || "Événement"),
            majPar: typeof entree.maj_par === "string" ? entree.maj_par : null, etapes: parGenre[genre] });
        }
      }
    }
  }
  return groupes;
}

// Destinataires d'un groupe : les responsables du pôle ; à défaut, la
// personne qui a écrit le plan (souvent l'Admin).
export function destinataires(groupe: GroupeEtapes, responsables: { id: string; sections: string[] }[]): string[] {
  const ids = responsables.filter((r) => r.sections.includes(groupe.pole)).map((r) => r.id);
  if (ids.length) return ids;
  return groupe.majPar ? [groupe.majPar] : [];
}

// Texte de la notification pour les étapes pas encore rappelées.
export function message(groupe: GroupeEtapes, etapes: Etape[], nomPole: string): { titre: string; corps: string } {
  const n = etapes.length;
  const titre = groupe.genre === "veille"
    ? "Demain : " + (n > 1 ? n + " étapes à faire" : "étape à faire")
    : (n > 1 ? n + " étapes en retard" : "Étape en retard");
  const liste = etapes.map((e) => e.titre + (groupe.genre === "retard" ? " (prévue le " + dateCourte(e.date) + ")" : "")).join(" · ");
  const corps = "« " + groupe.evTitre + " » · " + nomPole + " : " + liste;
  return { titre, corps: corps.length > 180 ? corps.slice(0, 179) + "…" : corps };
}
