import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toCsv(rows: Array<{ metric: string; value: number | string }>) {
  const header = "metric,value";
  const lines = rows.map((row) => `${row.metric},${row.value}`);
  return [header, ...lines].join("\n");
}

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "service role missing" }, { status: 503 });
  }

  const [liveCount, messageCount, likeCount, giftCount, followerCount] = await Promise.all([
    supabase.from("live_sessions").select("id", { count: "exact", head: true }).eq("status", "live"),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("likes").select("id", { count: "exact", head: true }),
    supabase.from("gifts").select("id", { count: "exact", head: true }),
    supabase.from("followers").select("creator_id", { count: "exact", head: true }),
  ]);

  const csv = toCsv([
    { metric: "active_lives", value: liveCount.count ?? 0 },
    { metric: "messages", value: messageCount.count ?? 0 },
    { metric: "likes", value: likeCount.count ?? 0 },
    { metric: "gifts", value: giftCount.count ?? 0 },
    { metric: "followers", value: followerCount.count ?? 0 },
    { metric: "generated_at", value: new Date().toISOString() },
  ]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=dashboard-analytics.csv",
      "Cache-Control": "no-store",
    },
  });
}
