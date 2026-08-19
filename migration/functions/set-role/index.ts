// Edge Function : attribuer un rôle (MEMBRE / RESP_SECTION / GRAND_RESPONSABLE).
// Le rôle est écrit dans le JWT (app_metadata) via la clé service_role — jamais
// exposée au navigateur. Seul un GRAND_RESPONSABLE peut appeler cette fonction.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["MEMBRE", "RESP_SECTION", "GRAND_RESPONSABLE"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Identifier l'appelant via son JWT et vérifier qu'il est GRAND_RESPONSABLE.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Non authentifié" }, 401);
    const caller = await admin.auth.getUser(token);
    if (caller.error || !caller.data.user) return json({ error: "Non authentifié" }, 401);
    if (caller.data.user.app_metadata?.role !== "GRAND_RESPONSABLE")
      return json({ error: "Réservé au Grand Responsable" }, 403);

    // 2) Valider la demande.
    const { userId, role } = await req.json();
    if (!userId || !ROLES.includes(role)) return json({ error: "Requête invalide" }, 400);

    // 3) Écrire le rôle dans le JWT (en fusionnant les métadonnées existantes)…
    const target = await admin.auth.admin.getUserById(userId);
    if (target.error || !target.data.user) return json({ error: "Membre introuvable" }, 404);
    const meta = { ...(target.data.user.app_metadata ?? {}), role };
    const upd = await admin.auth.admin.updateUserById(userId, { app_metadata: meta });
    if (upd.error) return json({ error: upd.error.message }, 500);

    // 4) …et dans la fiche (pour l'affichage dans l'annuaire).
    const prof = await admin.from("kun_com_profiles").select("content").eq("id", userId).single();
    if (prof.data?.content) {
      const content = { ...prof.data.content, role };
      await admin.from("kun_com_profiles").upsert({ id: userId, content }, { onConflict: "id" });
    }

    return json({ ok: true, role });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
