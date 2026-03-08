import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDashboardRole } from "@/lib/dashboard-access";

type ActionBody = {
  action?: "approve" | "reject" | "confirm_payment";
  subscriptionPlan?: "jour" | "semaine" | "mois";
};

async function requireAdminAccess() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return { ok: false as const, status: 401 };

  const { data: usersRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role?: string | null }>();

  const role = resolveDashboardRole({ email: user.email, usersRow });
  if (!role) return { ok: false as const, status: 403 };

  return { ok: true as const, role };
}

function computeExpiry(plan: "jour" | "semaine" | "mois") {
  const now = new Date();
  if (plan === "jour") now.setDate(now.getDate() + 1);
  else if (plan === "semaine") now.setDate(now.getDate() + 7);
  else now.setDate(now.getDate() + 30);
  return now.toISOString();
}

export async function PATCH(request: Request, context: { params: Promise<{ sellerId: string }> }) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const params = await context.params;
  const sellerId = String(params.sellerId ?? "").trim();
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId manquant" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as ActionBody | null;
  const action = body?.action;

  if (!action) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const payload: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if (action === "approve") {
    payload.seller_status = "approved";
    payload.subscription_status = "pending_payment";
  } else if (action === "reject") {
    payload.seller_status = "rejected";
    payload.subscription_status = "unpaid";
  } else {
    const plan = body?.subscriptionPlan ?? "mois";
    payload.seller_status = "active";
    payload.subscription_status = "paid";
    payload.subscription_plan = plan;
    payload.subscription_expiry_date = computeExpiry(plan);
  }

  const { data, error } = await admin
    .from("sellers")
    .update(payload)
    .eq("id", sellerId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Mise a jour du vendeur impossible" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seller: data });
}
