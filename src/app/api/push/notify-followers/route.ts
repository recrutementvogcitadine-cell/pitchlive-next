import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configureWebPush, webpush } from "@/lib/webpush";

type Body = {
  creatorId?: string;
  sessionId?: string;
  sellerName?: string;
  threshold?: number;
};

type PushRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(req: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "service role missing" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  const creatorId = (body.creatorId ?? "").trim();
  const sessionId = (body.sessionId ?? "").trim();
  const sellerName = (body.sellerName ?? "Vendeuse").trim() || "Vendeuse";
  const threshold = Number(body.threshold ?? 0);

  if (!creatorId || !sessionId || threshold <= 0) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("live_sessions")
    .select("id, creator_id, status")
    .eq("id", sessionId)
    .eq("creator_id", creatorId)
    .eq("status", "live")
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ ok: false, error: "session not live" }, { status: 409 });
  }

  if (!configureWebPush()) {
    return NextResponse.json({ ok: false, error: "vapid env missing" }, { status: 503 });
  }

  const { data: followers, error: followersError } = await supabase
    .from("followers")
    .select("follower_id")
    .eq("creator_id", creatorId);

  if (followersError) {
    return NextResponse.json({ ok: false, error: followersError.message }, { status: 500 });
  }

  const followerIds = (followers ?? []).map((item) => String(item.follower_id || "")).filter(Boolean);
  if (!followerIds.length) {
    return NextResponse.json({ ok: true, sent: 0, removed: 0 });
  }

  const { data: subscriptions, error: pushError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", followerIds)
    .eq("enabled", true);

  if (pushError) {
    return NextResponse.json({ ok: false, error: pushError.message }, { status: 500 });
  }

  const payload = JSON.stringify({
    title: "PITCH LIVE",
    body: `${sellerName} est en live (${threshold} coeurs)`,
    url: "/watch",
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const row of (subscriptions ?? []) as PushRow[]) {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, payload);
      sent += 1;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(row.endpoint);
      }
    }
  }

  if (staleEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ ok: true, sent, removed: staleEndpoints.length });
}
