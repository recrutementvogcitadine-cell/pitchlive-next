import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const { data: usersRows, error: usersError } = await admin
    .from("users")
    .select("id,username,country,created_at,moderation_status")
    .order("created_at", { ascending: false });

  if (usersError) {
    return NextResponse.json({ error: "Impossible de charger les utilisateurs" }, { status: 500 });
  }

  const { data: authUsersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((authUsersData?.users ?? []).map((item) => [item.id, item.email ?? null]));

  const rows = (usersRows ?? []).map((row) => ({ ...row, email: emailById.get(row.id) ?? null }));
  const filtered = q
    ? rows.filter((row) => String(row.username ?? "").toLowerCase().includes(q) || String(row.email ?? "").toLowerCase().includes(q))
    : rows;

  return NextResponse.json({ rows: filtered });
}
