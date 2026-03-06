import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  sessionId?: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const sessionId = body.sessionId?.trim();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const supabase = adminClient();
    if (!supabase) return NextResponse.json({ error: "supabase env missing" }, { status: 503 });

    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
