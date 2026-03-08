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
    .from("live_sessions")
    .select("id,creator_id,title,viewers_count,status,started_at,ended_at")
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Impossible de charger les lives" }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
