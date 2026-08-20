// Edge Function : récupération / changement de mot de passe par QUESTIONS DE
// SÉCURITÉ, sans e-mail. Les réponses sont hachées + salées CÔTÉ SERVEUR et
// stockées dans public.kun_com_secrets, table fermée à tout client (voir
// 03_security_questions.sql). Le navigateur ne voit jamais un hash ni ne change
// lui-même un mot de passe : tout passe par la clé service_role, jamais exposée.
//
// Actions :
//  - "set"          (JWT requis) : définir/mettre à jour ses 2 questions+réponses.
//  - "questions"    (public)     : récupérer les questions d'un compte par e-mail.
//  - "reset"        (public)     : vérifier les réponses puis fixer un nouveau mdp.
//  - "admin-reset"  (Admin)      : réinitialiser le mdp d'un membre (mdp provisoire).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

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

      // Clé de recherche = NUMÉRO de téléphone (le membre s'y connecte). Le champ
      // « email » de la table sert d'identifiant générique : on y stocke le numéro
      // (chiffres canoniques) transmis par le client, pas l'e-mail interne.
      const identifier = String(body.phone || user.phone || user.email || "").trim();
      const salt = randHex(16);
      const [a1_hash, a2_hash] = await Promise.all([hashAnswer(a1, salt), hashAnswer(a2, salt)]);
      const up = await admin.from("kun_com_secrets").upsert({
        user_id: user.id, email: identifier, q1, q2, a1_hash, a2_hash, salt,
        fail_count: 0, locked_until: null, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ ok: true });
    }

    // ---- QUESTIONS : récupérer les questions d'un compte par NUMÉRO ----
    if (action === "questions") {
      const id = String(body.email || body.phone || "").trim().toLowerCase();
      if (!id) return json({ error: "Identifiant requis." }, 400);
      const row = await admin.from("kun_com_secrets")
        .select("q1,q2,locked_until").ilike("email", id).maybeSingle();
      if (row.error || !row.data) return json({ found: false });
      if (row.data.locked_until && new Date(row.data.locked_until) > new Date())
        return json({ found: true, locked: true, q1: row.data.q1, q2: row.data.q2 });
      return json({ found: true, q1: row.data.q1, q2: row.data.q2 });
    }

    // ---- RESET : vérifier les réponses puis fixer un nouveau mot de passe ----
    if (action === "reset") {
      const id = String(body.email || body.phone || "").trim().toLowerCase();
      const a1 = String(body.a1 || "");
      const a2 = String(body.a2 || "");
      const newPassword = String(body.newPassword || "");
      if (!id) return json({ error: "Identifiant requis." }, 400);
      if (newPassword.length < 8) return json({ error: "Mot de passe : 8 caractères minimum." }, 400);

      const row = await admin.from("kun_com_secrets")
        .select("*").ilike("email", id).maybeSingle();
      // Message neutre : ne révèle pas l'existence du compte.
      if (row.error || !row.data) return json({ error: "Réponses incorrectes." }, 403);
      const sec = row.data;

      if (sec.locked_until && new Date(sec.locked_until) > new Date())
        return json({ error: "Trop de tentatives. Réessayez plus tard ou demandez à un Admin." }, 429);

      const [h1, h2] = await Promise.all([hashAnswer(a1, sec.salt), hashAnswer(a2, sec.salt)]);
      const ok = h1 === sec.a1_hash && h2 === sec.a2_hash;
      if (!ok) {
        const fails = (sec.fail_count || 0) + 1;
        const locked = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
        await admin.from("kun_com_secrets").update({
          fail_count: locked ? 0 : fails, locked_until: locked,
        }).eq("user_id", sec.user_id);
        return json({ error: locked ? "Trop de tentatives. Compte verrouillé 15 min." : "Réponses incorrectes." }, 403);
      }

      const upd = await admin.auth.admin.updateUserById(sec.user_id, { password: newPassword });
      if (upd.error) return json({ error: upd.error.message }, 500);
      await admin.from("kun_com_secrets").update({ fail_count: 0, locked_until: null }).eq("user_id", sec.user_id);
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
    return json({ error: String(e) }, 500);
  }
});
