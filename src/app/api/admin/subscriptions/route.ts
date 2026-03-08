import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

export async function GET() {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("sellers")
    .select("id,store_name,seller_status,subscription_status,subscription_plan,subscription_expiry_date")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Impossible de charger les abonnements" }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
