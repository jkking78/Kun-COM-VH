// Edge Function : récupération / changement de mot de passe par QUESTIONS DE
// SÉCURITÉ, sans e-mail. Les réponses sont hachées + salées CÔTÉ SERVEUR et
// stockées dans public.kun_com_secrets, table fermée à tout client (voir
// 03_security_questions.sql). Le navigateur ne voit jamais un hash ni ne change
// lui-même un mot de passe : tout passe par la clé service_role, jamais exposée.
//
// Actions :
//  - "set"          (JWT requis) : définir/mettre à jour ses 2 questions+réponses.
//  - "questions"    (public)     : récupérer les questions d'un compte par numéro.
//                                 Réponse identique qu'il existe ou non (S8) :
//                                 un numéro inconnu reçoit deux questions leurres.
//  - "reset"        (public)     : vérifier les réponses puis fixer un nouveau mdp.
//  - "admin-reset"  (Admin)      : réinitialiser le mdp d'un membre (mdp provisoire).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Origines autorisées à appeler la fonction depuis un navigateur : variable
// d'environnement ALLOWED_ORIGINS (ex. « https://kun-com-vh.vercel.app »,
// plusieurs séparées par des virgules). Non définie : toutes (comportement
// historique). L'authentification reste faite par le JWT, quel que soit l'appelant.
const ORIGINES = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
function origineAutorisee(req: Request): string {
  if (!ORIGINES.length) return "*";
  const o = req.headers.get("Origin") ?? "";
  return ORIGINES.includes(o) ? o : ORIGINES[0];
}
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Au plus 30 demandes publiques (questions, reset) par heure et par adresse
// IP. Les essais par compte sont comptés en base (kc_reserver_essai, migration
// 10) : 5 essais, puis un verrou de 15 min qui double à chaque récidive.
const MAX_PAR_IP = 30;

function normalize(a: string): string {
  return (a ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .trim().toLowerCase().replace(/\s+/g, " ");
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashAnswer(answer: string, salt: string): Promise<string> {
  return sha256Hex(salt + "::" + normalize(answer));
}
// Identifiant cherché à l'identique : les chiffres du numéro, rien d'autre
// (plus de recherche approchée, donc plus de jokers possibles).
function chiffres(v: unknown): string {
  return String(v ?? "").replace(/[^0-9]/g, "").slice(0, 15);
}
// Les questions proposées par l'application (01-core.js) : un numéro inconnu
// en reçoit deux, toujours les mêmes pour ce numéro.
const QUESTIONS = [
  "Le prénom de ton meilleur(e) ami(e) d'enfance ?", "Le nom de ton premier animal de compagnie ?",
  "Ta ville de naissance ?", "Le prénom de ta grand-mère maternelle ?", "Le nom de ton école primaire ?",
  "Le titre de ton chant préféré ?", "Le prénom de ton parrain ou de ta marraine ?", "Ton plat préféré ?",
];
async function questionsLeurres(id: string): Promise<{ q1: string; q2: string }> {
  const h = await sha256Hex("leurre::" + id);
  const i = parseInt(h.slice(0, 8), 16) % QUESTIONS.length;
  const j = (i + 1 + parseInt(h.slice(8, 16), 16) % (QUESTIONS.length - 1)) % QUESTIONS.length;
  return { q1: QUESTIONS[i], q2: QUESTIONS[j] };
}
// Adresse du client telle que la passerelle Supabase la transmet ; null si
// absente (on ne met pas alors tout le monde dans le même compteur).
function adresseIp(req: Request): string | null {
  const brute = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0];
  return (brute ?? "").trim() || null;
}
function randHex(n: number): string {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return [...a].map((b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  const cors = { ...corsBase, "Access-Control-Allow-Origin": origineAutorisee(req), "Vary": "Origin" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ---- SET : l'utilisateur (connecté) définit ses questions/réponses ----
    if (action === "set") {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (!token) return json({ error: "Non authentifié" }, 401);
      const caller = await admin.auth.getUser(token);
      if (caller.error || !caller.data.user) return json({ error: "Non authentifié" }, 401);
      const user = caller.data.user;

      const q1 = String(body.q1 || "").trim();
      const q2 = String(body.q2 || "").trim();
      const a1 = String(body.a1 || "");
      const a2 = String(body.a2 || "");
      if (!q1 || !q2 || !normalize(a1) || !normalize(a2))
        return json({ error: "Deux questions et deux réponses sont requises." }, 400);
      if (normalize(q1) === normalize(q2))
        return json({ error: "Choisissez deux questions différentes." }, 400);

      // Clé de recherche = NUMÉRO de téléphone, tiré du COMPTE lui-même
      // (« 2250707070707@commit.aev ») et jamais du client : un membre ne peut
      // plus enregistrer le numéro d'un autre et bloquer sa récupération (S8).
      const local = String(user.email || "").split("@")[0];
      const identifier = /^[0-9]{6,15}$/.test(local) ? local : String(user.phone || "").replace(/[^0-9]/g, "");
      if (!identifier) return json({ error: "Numéro du compte introuvable." }, 400);
      const salt = randHex(16);
      const [a1_hash, a2_hash] = await Promise.all([hashAnswer(a1, salt), hashAnswer(a2, salt)]);
      const up = await admin.from("kun_com_secrets").upsert({
        user_id: user.id, email: identifier, q1, q2, a1_hash, a2_hash, salt,
        fail_count: 0, locked_until: null, verrous: 0, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (up.error) { console.error(up.error); return json({ error: "Enregistrement impossible." }, 500); }
      return json({ ok: true });
    }

    // Actions publiques : limite par adresse IP.
    const ip = adresseIp(req);
    if ((action === "questions" || action === "reset") && ip) {
      const permis = await admin.rpc("kc_limite", { p_cle: "recup:" + ip, p_max: MAX_PAR_IP, p_fenetre: "1 hour" });
      if (permis.error) return json({ error: "Service indisponible, réessayez plus tard." }, 503);
      if (permis.data !== true) return json({ error: "Trop de demandes depuis cette connexion. Réessayez dans une heure." }, 429);
    }

    // ---- QUESTIONS : récupérer les questions d'un compte par NUMÉRO ----
    if (action === "questions") {
      const id = chiffres(body.email || body.phone);
      if (!id) return json({ error: "Identifiant requis." }, 400);
      const row = await admin.from("kun_com_secrets").select("q1,q2").eq("email", id).maybeSingle();
      // Même réponse qu'un compte existe ou non : on ne révèle pas les numéros
      // inscrits. Un verrou éventuel n'est signalé qu'à l'étape suivante.
      if (row.error || !row.data) return json({ found: true, ...(await questionsLeurres(id)) });
      return json({ found: true, q1: row.data.q1, q2: row.data.q2 });
    }

    // ---- RESET : vérifier les réponses puis fixer un nouveau mot de passe ----
    if (action === "reset") {
      const id = chiffres(body.email || body.phone);
      const a1 = String(body.a1 || "");
      const a2 = String(body.a2 || "");
      const newPassword = String(body.newPassword || "");
      if (!id) return json({ error: "Identifiant requis." }, 400);
      if (newPassword.length < 8) return json({ error: "Mot de passe : 8 caractères minimum." }, 400);

      const row = await admin.from("kun_com_secrets").select("*").eq("email", id).maybeSingle();
      // Message neutre : ne révèle pas l'existence du compte.
      if (row.error || !row.data) return json({ error: "Réponses incorrectes." }, 403);
      const sec = row.data;

      // L'essai est réservé AVANT la comparaison, en une seule opération en
      // base : des requêtes simultanées ne peuvent plus dépasser 5 essais.
      const essai = await admin.rpc("kc_reserver_essai", { p_user: sec.user_id });
      if (essai.error) return json({ error: "Service indisponible, réessayez plus tard." }, 503);
      if (essai.data !== true)
        return json({ error: "Trop de tentatives. Réessayez plus tard ou demandez à un Admin." }, 429);

      const [h1, h2] = await Promise.all([hashAnswer(a1, sec.salt), hashAnswer(a2, sec.salt)]);
      const ok = h1 === sec.a1_hash && h2 === sec.a2_hash;
      if (!ok) return json({ error: "Réponses incorrectes." }, 403);

      const upd = await admin.auth.admin.updateUserById(sec.user_id, { password: newPassword });
      if (upd.error) return json({ error: upd.error.message }, 500);
      await admin.from("kun_com_secrets").update({ fail_count: 0, locked_until: null, verrous: 0 }).eq("user_id", sec.user_id);
      return json({ ok: true });
    }

    // ---- ADMIN-RESET : un Admin remet un mot de passe provisoire à un membre ----
    if (action === "admin-reset") {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (!token) return json({ error: "Non authentifié" }, 401);
      const caller = await admin.auth.getUser(token);
      if (caller.error || !caller.data.user) return json({ error: "Non authentifié" }, 401);
      if (caller.data.user.app_metadata?.role !== "GRAND_RESPONSABLE")
        return json({ error: "Réservé à l'Admin" }, 403);

      const userId = String(body.userId || "");
      if (!userId) return json({ error: "Membre manquant." }, 400);
      const provisional = String(body.newPassword || "").length >= 8 ? String(body.newPassword) : randPassword();
      const upd = await admin.auth.admin.updateUserById(userId, { password: provisional });
      if (upd.error) return json({ error: upd.error.message }, 500);
      return json({ ok: true, password: provisional });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Erreur interne" }, 500);
  }
});
