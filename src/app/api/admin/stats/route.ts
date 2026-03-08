import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

async function safeCount(admin: ReturnType<typeof createAdminClient>, table: string, filter?: (query: any) => any) {
  if (!admin) return 0;
  let query = admin.from(table).select("id", { count: "exact", head: true });
  if (filter) {
    query = filter(query);
  }
  const { count } = await query;
  return count ?? 0;
}

export async function GET() {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const [totalUsers, totalSellers, activeSellers, liveNow, totalViewers] = await Promise.all([
    safeCount(admin, "users"),
    safeCount(admin, "sellers"),
    safeCount(admin, "sellers", (q) => q.eq("seller_status", "active").eq("subscription_status", "paid")),
    safeCount(admin, "live_sessions", (q) => q.eq("status", "live")),
    safeCount(admin, "live_presence"),
  ]);

  return NextResponse.json({
    totals: {
      totalUsers,
      totalSellers,
      activeSellers,
      liveNow,
      totalViewers,
    },
  });
}
