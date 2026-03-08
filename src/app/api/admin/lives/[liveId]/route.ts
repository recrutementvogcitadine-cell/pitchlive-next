import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

type ActionBody = {
  action?: "end_live" | "ban_seller";
};

export async function PATCH(request: Request, context: { params: Promise<{ liveId: string }> }) {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const { liveId } = await context.params;
  const body = (await request.json().catch(() => null)) as ActionBody | null;
  const action = body?.action;

  if (!liveId || !action) {
    return NextResponse.json({ error: "Parametres invalides" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const { data: live } = await admin
    .from("live_sessions")
    .select("creator_id")
    .eq("id", liveId)
    .maybeSingle<{ creator_id: string }>();

  if (action === "end_live") {
    const { error } = await admin
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", liveId);
    if (error) {
      return NextResponse.json({ error: "Impossible de terminer le live" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!live?.creator_id) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }

  const { error: banError } = await admin
    .from("sellers")
    .update({ seller_status: "rejected", subscription_status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", live.creator_id);

  if (banError) {
    return NextResponse.json({ error: "Impossible de bannir ce vendeur" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
