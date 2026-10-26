// Edge Function « push » : notifications sur le téléphone (Web Push).
// Déployée SANS vérification automatique du jeton (verify_jwt = false) : le
// client utilise une clé « publishable », et chaque action contrôle elle-même
// ce qu'elle doit contrôler.
//
//   { action: "cle" }                          → clé publique VAPID (publique)
//   { action: "notifier", destinataire, notifId } → envoie au téléphone du
//       destinataire une notification DÉJÀ enregistrée dans sa fiche par
//       l'appelant (le serveur impose senderId = auteur, migration 06). Le
//       titre et le nom de l'expéditeur sont fixés ici (type connu, nom tiré
//       de la fiche de l'appelant) ; chaque notification part une seule fois,
//       au plus 30 par minute et par expéditeur. Seuls les responsables
//       passent outre les préférences (convocations).
//   { action: "rappels" }                      → rappels dus (veille, 2 h avant,
//       oubli de pointage, échéance de tâche ; étapes du plan de préparation,
//       la veille et en cas de retard, aux responsables du pôle). Appelée toutes les 10 min par
//       pg_cron (08b), avec l'en-tête x-kc-jeton (migration 13) : sans ce jeton,
//       connu du seul serveur, l'appel est refusé. Sans effet si on la rappelle :
//       chaque rappel n'est envoyé qu'une fois (journal kun_com_push_envois).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envoyer, genererClesVapid, type Abonnement, type ClesVapid } from "./webpush.ts";
import { destinataires, etapesDues, message } from "./etapes.ts";

// Contact VAPID : l'adresse de l'application (une URL https est admise).
const CONTACT = "https://kun-com-vh.vercel.app";
const ORIGINES = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Catégorie de préférence de chaque type de notification. Les convocations
// sont toujours envoyées ; les J'aime sont coupés par défaut (trop fréquents).
function categorie(type: string): string {
  if (type === "EVENT_ASSIGNED" || type === "CONVOCATION" || type === "ECHANGE" || type === "EVENT_CANCELLED") return "convocations";
  if (type === "MENTION") return "mentions";
  if (type === "LIKE") return "jaime";
  if (type === "COMMENT" || type === "REPLY") return "commentaires";
  if (type === "MESSAGE" || type === "CANAL") return "messages";
  return "autres";
}
function accepte(prefs: Record<string, boolean> | undefined, cat: string): boolean {
  if (cat === "convocations") return true;
  const p = prefs ?? {};
  if (cat in p) return p[cat] !== false;
  return cat !== "jaime";
}
// Titre de la notification selon son type : jamais le titre libre écrit par
// l'expéditeur.
const TITRES: Record<string, string> = {
  LIKE: "J'aime", COMMENT: "Commentaire", REPLY: "Réponse", MENTION: "Mention",
  EVENT_ASSIGNED: "Convocation", CONVOCATION: "Convocation", ECHANGE: "Échange de service",
  EVENT_CANCELLED: "Événement annulé",
  EVALUATION: "Bilan", NEW_MEMBER: "Nouveau membre", MESSAGE: "Nouveau message",
};
const POLES: Record<string, string> = {
  cadrage: "Cadrage", regie: "Régie", web: "Web", proj: "Projection", prod: "Prod", photo: "Photo", vente: "Vente",
};
function court(t: unknown, n: number): string {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
// Écran à ouvrir au toucher de la notification.
function cible(type: string, senderId: string, targetId: string): string {
  if (type === "MESSAGE") return "dm:" + senderId;
  if (type === "CANAL") return String(targetId || "").split("#")[0];   // « pole:<id>#<message> »
  if (type === "EVENT_ASSIGNED" || type === "CONVOCATION" || type === "ECHANGE") return "planning";
  return "notifications";
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function clesVapid(admin: Admin): Promise<ClesVapid> {
  const lue = await admin.from("kun_com_push_cles").select("publique, privee").eq("id", 1).maybeSingle();
  if (lue.data) return { publique: lue.data.publique, privee: lue.data.privee };
  // Première utilisation : une paire est créée et conservée. En cas d'appels
  // simultanés, une seule est enregistrée et tout le monde relit celle-là.
  const neuve = await genererClesVapid();
  await admin.from("kun_com_push_cles").upsert({ id: 1, ...neuve }, { onConflict: "id", ignoreDuplicates: true });
  const relue = await admin.from("kun_com_push_cles").select("publique, privee").eq("id", 1).single();
  return { publique: relue.data.publique, privee: relue.data.privee };
}

// Envoie à tous les téléphones d'un membre ; supprime les abonnements expirés.
async function envoyerA(admin: Admin, cles: ClesVapid, userId: string, charge: unknown): Promise<number> {
  const abos = await admin.from("kun_com_push_abonnements").select("id, abonnement").eq("user_id", userId);
  let envoyes = 0;
  for (const ligne of abos.data ?? []) {
    try {
      const code = await envoyer(ligne.abonnement as Abonnement, charge, cles, CONTACT);
      if (code === 404 || code === 410) await admin.from("kun_com_push_abonnements").delete().eq("id", ligne.id);
      else if (code < 300) envoyes++;
    } catch (_) { /* un téléphone injoignable n'empêche pas les autres */ }
  }
  return envoyes;
}

async function profil(admin: Admin, id: string): Promise<Record<string, unknown> | null> {
  const r = await admin.from("kun_com_profiles").select("content").eq("id", id).maybeSingle();
  let c = r.data?.content;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = null; } }
  return c && typeof c === "object" ? c : null;
}

// Heure locale d'Abidjan = UTC : « 2026-10-25 » + « 09:00 » → horodatage.
function horodatage(date: string, heure?: string): number | null {
  if (!date) return null;
  const t = Date.parse(date + "T" + (heure || "00:00") + ":00Z");
  return isNaN(t) ? null : t;
}
function heureLocale(ts: number): string {
  const d = new Date(ts);
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

// Lit toutes les lignes d'une requête, 1000 par 1000.
async function toutLire(page: (de: number, a: number) => Promise<{ data: unknown[] | null }>): Promise<Admin[]> {
  const tout: Admin[] = [];
  for (let de = 0; de < 50000; de += 1000) {
    const r = await page(de, de + 999);
    const lot = (r.data ?? []) as Admin[];
    tout.push(...lot);
    if (lot.length < 1000) break;
  }
  return tout;
}

async function rappels(admin: Admin): Promise<Record<string, number>> {
  const maintenant = Date.now();
  // Garde-fou : une exécution complète au plus toutes les 2 minutes.
  const tranche = "execution:" + Math.floor(maintenant / 120000);
  const verrou = await admin.from("kun_com_push_envois").insert({ cle: tranche });
  if (verrou.error) return { ignore: 1 };

  // Seuls les événements d'hier et à venir comptent (C4) ; lus page par page,
  // la base ne renvoyant jamais plus de 1000 lignes d'un coup. Puis les
  // pointages et livraisons de ces événements-là seulement.
  const hier = new Date(maintenant - 36 * 3600e3).toISOString().slice(0, 10);
  const [evsLignes, cles] = await Promise.all([
    toutLire((de, a) => admin.from("kun_com_posts").select("id, content").eq("content->>type", "EVENT")
      .gte("content->>eventDate", hier).order("id").range(de, a)),
    clesVapid(admin),
  ]);
  const evs = { data: evsLignes };
  const ids = evsLignes.map((l: Admin) => String(l.id));
  const pointages: Admin[] = [], livraisons: Admin[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const lot = ids.slice(i, i + 100);
    const [p, l] = await Promise.all([
      toutLire((de, a) => admin.from("kun_com_posts").select("content").in("content->>checkInEventId", lot).order("id").range(de, a)),
      toutLire((de, a) => admin.from("kun_com_posts").select("content").eq("content->>type", "TASK_DONE").in("content->>taskEventId", lot).order("id").range(de, a)),
    ]);
    pointages.push(...p); livraisons.push(...l);
  }
  const aPointe = new Set(pointages.map((p: Admin) => p.content?.checkInEventId + "|" + p.content?.userId));
  const aLivre = new Set(livraisons.map((p: Admin) => p.content?.taskEventId + "|" + p.content?.userId));

  const H = 3600e3;
  const aEnvoyer: { cle: string; userId: string; titre: string; corps: string; cible: string }[] = [];
  for (const ligne of evs.data ?? []) {
    const ev = ligne.content ?? {};
    const debut = horodatage(ev.eventDate, ev.eventStart);
    if (!debut) continue;
    // C3 : la date et l'heure font partie de la clé du journal ; un événement
    // reprogrammé reçoit de nouveau ses rappels.
    const quand = ev.eventDate + "T" + (ev.eventStart || "") + ":";
    const titre = ev.eventTitle || "Événement";
    const vus = new Set<string>();
    for (const a of ev.assignments ?? []) {
      const uid = a?.userId;
      if (!uid || vus.has(uid)) continue;
      vus.add(uid);
      if (ev.reponsesConvocation?.[uid]?.statut === "decline") continue;
      const tache = a.task ? " (" + a.task + ")" : "";
      if (a.deadline) {
        const echeance = Date.parse(a.deadline + (a.deadline.length <= 16 ? ":00Z" : ""));
        if (!isNaN(echeance) && maintenant >= echeance - 24 * H && maintenant < echeance && !aLivre.has(ev.id + "|" + uid)) {
          aEnvoyer.push({ cle: "echeance:" + ev.id + ":" + a.deadline + ":" + uid, userId: uid, titre: "Tâche à livrer demain",
            corps: (a.task || "Ta tâche") + " pour « " + titre + " » est attendue avant " + heureLocale(echeance) + ".", cible: "planning" });
        }
        continue;
      }
      if (maintenant >= debut - 24 * H && maintenant < debut - 2 * H) {
        aEnvoyer.push({ cle: "veille:" + ev.id + ":" + quand + uid, userId: uid, titre: "Demain : " + titre,
          corps: "Rendez-vous à " + (ev.eventStart || "l'heure prévue") + (ev.eventLocation ? " · " + ev.eventLocation : "") + tache + ".", cible: "planning" });
      } else if (maintenant >= debut - 2 * H && maintenant < debut) {
        aEnvoyer.push({ cle: "2h:" + ev.id + ":" + quand + uid, userId: uid, titre: "Dans 2 h : " + titre,
          corps: "Pense à pointer à ton arrivée avec « Je suis arrivé »" + tache + ".", cible: "planning" });
      } else if (maintenant >= debut + 10 * 60e3 && maintenant < debut + 3 * H && !aPointe.has(ev.id + "|" + uid)) {
        aEnvoyer.push({ cle: "oubli:" + ev.id + ":" + quand + uid, userId: uid, titre: "Tu es bien arrivé ?",
          corps: "« " + titre + " » a commencé à " + ev.eventStart + ". Pointe ton arrivée dès que tu es sur place.", cible: "planning" });
      }
    }
  }

  const prefsCache: Record<string, Record<string, boolean> | undefined> = {};
  let envoyes = 0, deja = 0;
  for (const r of aEnvoyer) {
    // Le journal d'abord : un rappel n'est jamais envoyé deux fois.
    const ins = await admin.from("kun_com_push_envois").insert({ cle: r.cle });
    if (ins.error) { deja++; continue; }
    if (!(r.userId in prefsCache)) prefsCache[r.userId] = (await profil(admin, r.userId))?.preferencesNotif as Record<string, boolean> | undefined;
    if (!accepte(prefsCache[r.userId], "rappels")) continue;
    envoyes += await envoyerA(admin, cles, r.userId, { titre: r.titre, corps: r.corps, cible: r.cible, tag: r.cle });
  }
  // Étapes du plan de préparation : un seul message par événement, pôle et
  // responsable, qui ne cite que les étapes pas encore rappelées.
  const groupes = etapesDues(evs.data ?? [], maintenant, (ev) => horodatage(String(ev.eventDate ?? ""), String(ev.eventStart ?? "")));
  let etapesEnvoyees = 0;
  if (groupes.length) {
    const comptes = await admin.auth.admin.listUsers({ perPage: 1000 });
    const idsResp = (comptes.data?.users ?? []).filter((u: Admin) => u.app_metadata?.role === "RESP_SECTION").map((u: Admin) => u.id);
    const fiches = idsResp.length ? await admin.from("kun_com_profiles").select("id, content").in("id", idsResp) : { data: [] };
    const responsables = (fiches.data ?? []).map((f: Admin) => {
      const c = f.content ?? {};
      const secs = Array.isArray(c.sections) ? c.sections.map(String) : [];
      if (typeof c.section_id === "string") secs.push(c.section_id);
      return { id: String(f.id), sections: secs };
    });
    for (const g of groupes) {
      for (const uid of destinataires(g, responsables)) {
        const nouvelles: typeof g.etapes = [];
        for (const e of g.etapes) {
          const ins = await admin.from("kun_com_push_envois").insert({ cle: e.cle + ":" + uid });
          if (!ins.error) nouvelles.push(e);
        }
        if (!nouvelles.length) { deja++; continue; }
        if (!(uid in prefsCache)) prefsCache[uid] = (await profil(admin, uid))?.preferencesNotif as Record<string, boolean> | undefined;
        if (!accepte(prefsCache[uid], "rappels")) continue;
        const { titre, corps } = message(g, nouvelles, POLES[g.pole] ?? g.pole);
        etapesEnvoyees += await envoyerA(admin, cles, uid, { titre, corps, cible: "prep:" + g.evId, tag: "prep:" + g.evId + ":" + g.genre });
      }
    }
  }

  // Ménage du journal (au-delà de 30 jours).
  await admin.from("kun_com_push_envois").delete().lt("envoye_le", new Date(maintenant - 30 * 24 * H).toISOString());
  return { candidats: aEnvoyer.length, envoyes, deja, etapes: groupes.length, etapesEnvoyees };
}

Deno.serve(async (req) => {
  const o = req.headers.get("Origin") ?? "";
  const cors = { ...corsBase, "Access-Control-Allow-Origin": !ORIGINES.length ? "*" : (ORIGINES.includes(o) ? o : ORIGINES[0]), "Vary": "Origin" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const corps = await req.json().catch(() => ({}));

    if (corps.action === "cle") return json({ publique: (await clesVapid(admin)).publique });
    if (corps.action === "rappels") {
      // S11 : réservé à l'appel planifié, qui porte le jeton du serveur.
      const attendu = (await admin.from("kun_com_push_cles").select("jeton_rappels").eq("id", 1).maybeSingle()).data?.jeton_rappels;
      if (!attendu || req.headers.get("x-kc-jeton") !== attendu) return json({ error: "Non autorisé" }, 401);
      return json({ ok: true, ...(await rappels(admin)) });
    }

    if (corps.action === "notifier") {
      const jeton = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const appelant = jeton ? await admin.auth.getUser(jeton) : null;
      const moi = appelant?.data?.user;
      if (!moi) return json({ error: "Non authentifié" }, 401);
      const meta = moi.app_metadata ?? {};
      if (meta.approuve !== true && meta.role !== "GRAND_RESPONSABLE" && meta.role !== "RESP_SECTION")
        return json({ error: "Compte non validé" }, 403);

      const destinataire = String(corps.destinataire || "");
      const dest = await profil(admin, destinataire);
      if (!dest) return json({ error: "Destinataire introuvable" }, 404);
      // Notification lue dans kun_com_notifications (migration 22), signée par
      // la base : son expéditeur doit être l'appelant.
      const ligne = await admin.from("kun_com_notifications").select("content")
        .eq("destinataire", destinataire).eq("id", String(corps.notifId || "")).maybeSingle();
      const n = ligne.data?.content as Record<string, string> | undefined;
      if (!n || n.senderId !== moi.id) return json({ error: "Notification introuvable" }, 404);

      // Limite de débit, puis journal « envoyée une fois » : rejouer l'appel
      // ne renvoie rien.
      const depuis = new Date(Date.now() - 60e3).toISOString();
      const recentes = await admin.from("kun_com_push_envois").select("cle", { count: "exact", head: true })
        .like("cle", "notif:" + moi.id + ":%").gte("envoye_le", depuis);
      if ((recentes.count ?? 0) >= 30) return json({ error: "Trop d'envois, réessaie dans une minute." }, 429);
      const journal = await admin.from("kun_com_push_envois").insert({ cle: "notif:" + moi.id + ":" + destinataire + ":" + n.id });
      if (journal.error) return json({ ok: true, envoyes: 0, deja: true });

      // Seuls les responsables passent outre les préférences (convocations) ;
      // pour les autres, c'est la préférence « Le reste » qui décide.
      const responsable = meta.role === "GRAND_RESPONSABLE" || meta.role === "RESP_SECTION";
      let cat = categorie(n.type);
      if (cat === "convocations" && !responsable) cat = "autres";
      if (!accepte(dest.preferencesNotif as Record<string, boolean> | undefined, cat))
        return json({ ok: true, envoyes: 0, coupe: true });

      // Nom de l'expéditeur tiré de SA fiche, jamais du texte de la notification.
      const fiche = await profil(admin, moi.id);
      const nom = court((String(fiche?.prenom ?? "") + " " + String(fiche?.nom ?? "")).trim() || "Un membre", 40);
      let titre = TITRES[n.type] ?? "Commit";
      let texte = court(n.text, 140);
      if (n.type === "MESSAGE" || n.type === "CANAL") {
        // L'aperçu est lu dans le message lui-même (il n'est plus copié dans la
        // fiche du destinataire) et ne voyage que chiffré jusqu'au téléphone.
        const [canal, msgId] = n.type === "CANAL" ? String(n.targetId || "").split("#") : [destinataire, String(n.targetId || "")];
        const msg = await admin.from("kun_com_dms").select("content").eq("id", msgId).eq("from_id", moi.id).eq("to_id", canal).maybeSingle();
        const apercu = court(msg.data?.content?.text, 80);
        texte = apercu ? ": « " + apercu + " »" : (n.type === "CANAL" ? "a écrit dans le canal." : "t'a envoyé un message.");
        if (n.type === "CANAL") titre = "Canal " + (POLES[String(canal).slice(5)] ?? "du pôle");
      }
      const envoyes = await envoyerA(admin, await clesVapid(admin), destinataire, {
        titre,
        corps: nom + " " + texte,
        cible: cible(n.type, n.senderId, n.targetId),
        tag: n.type === "MESSAGE" ? "dm:" + n.senderId : (n.type === "CANAL" ? String(n.targetId || "").split("#")[0] : n.id),
      });
      return json({ ok: true, envoyes });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    // Le détail reste dans les journaux du serveur (S16), pas chez l'appelant.
    console.error(e);
    return json({ error: "Erreur interne" }, 500);
  }
});
