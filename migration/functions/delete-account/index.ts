// Edge Function : suppression DÉFINITIVE du compte de l'appelant.
// Avant cette fonction, confirmDeleteAccount (client) ne supprimait que la
// ligne de profil et la session locale : le compte restait dans auth.users,
// et une simple reconnexion recréait la fiche — le membre « supprimé »
// réapparaissait dans l'annuaire. Ici, la suppression est faite dans
// auth.users via la clé service_role (jamais exposée au navigateur).
// L'appelant s'authentifie avec son propre JWT : chacun ne peut supprimer
// QUE son propre compte.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Identifier l'appelant via son propre JWT.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Non authentifié" }, 401);
    const caller = await admin.auth.getUser(token);
    if (caller.error || !caller.data.user) return json({ error: "Non authentifié" }, 401);
    const userId = caller.data.user.id;

    // 2) Supprimer le compte dans auth.users. La ligne kun_com_profiles est
    //    supprimée par le client juste avant l'appel ; si elle subsiste (échec
    //    réseau, policy), le nettoyage SQL des comptes fantômes s'en charge.
    const del = await admin.auth.admin.deleteUser(userId);
    if (del.error) return json({ error: del.error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
