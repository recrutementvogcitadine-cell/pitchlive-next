import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  userId?: string;
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

export async function POST(req: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "service role missing" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  const userId = (body.userId ?? "").trim();
  const endpoint = (body.subscription?.endpoint ?? "").trim();
  const p256dh = (body.subscription?.keys?.p256dh ?? "").trim();
  const auth = (body.subscription?.keys?.auth ?? "").trim();

  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get("user-agent") ?? null,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
