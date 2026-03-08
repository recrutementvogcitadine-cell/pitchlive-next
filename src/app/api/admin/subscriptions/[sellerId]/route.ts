import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

type ActionBody = {
  action?: "confirm_payment" | "extend" | "suspend";
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export async function PATCH(request: Request, context: { params: Promise<{ sellerId: string }> }) {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const { sellerId } = await context.params;
  const body = (await request.json().catch(() => null)) as ActionBody | null;
  const action = body?.action;

  if (!sellerId || !action) {
    return NextResponse.json({ error: "Parametres invalides" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  let payload: Record<string, string> = { updated_at: new Date().toISOString() };
  if (action === "confirm_payment") {
    payload = {
      ...payload,
      seller_status: "active",
      subscription_status: "paid",
      subscription_expiry_date: addDays(30),
    };
  } else if (action === "extend") {
    payload = {
      ...payload,
      subscription_status: "paid",
      subscription_expiry_date: addDays(30),
    };
  } else {
    payload = {
      ...payload,
      seller_status: "approved",
      subscription_status: "expired",
    };
  }

  const { error } = await admin.from("sellers").update(payload).eq("id", sellerId);
  if (error) {
    return NextResponse.json({ error: "Mise a jour abonnement impossible" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
