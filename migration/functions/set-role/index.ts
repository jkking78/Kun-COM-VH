// Edge Function : attribuer un rôle (RESP_SECTION / GRAND_RESPONSABLE) à un membre.
// Déploiement : supabase functions deploy set-role
// Le rôle est écrit dans le JWT (app_metadata) via la clé service_role, JAMAIS
// exposée au navigateur. Seul un GRAND_RESPONSABLE peut appeler cette fonction.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Vérifier que l'appelant est bien un Grand Responsable.
    const caller = await admin.auth.getUser(token);
    if (caller.data?.user?.app_metadata?.role !== "GRAND_RESPONSABLE") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // 2) Valider la demande.
    const { userId, role } = await req.json();
    const roles = ["MEMBRE", "RESP_SECTION", "GRAND_RESPONSABLE"];
    if (!userId || !roles.includes(role)) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    }

    // 3) Écrire le rôle dans le JWT + dans la fiche (affichage).
    await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
    const { data: prof } = await admin
      .from("kun_com_profiles").select("content").eq("id", userId).single();
    if (prof?.content) {
      prof.content.role = role;
      await admin.from("kun_com_profiles")
        .upsert({ id: userId, content: prof.content }, { onConflict: "id" });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
