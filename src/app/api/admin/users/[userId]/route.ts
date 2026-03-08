import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

type ActionBody = {
  action?: "suspend" | "ban";
};

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as ActionBody | null;
  const action = body?.action;

  if (!userId || !action) {
    return NextResponse.json({ error: "Parametres invalides" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const moderation_status = action === "ban" ? "banned" : "suspended";

  const { error } = await admin
    .from("users")
    .update({ moderation_status })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Mise a jour utilisateur impossible" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
