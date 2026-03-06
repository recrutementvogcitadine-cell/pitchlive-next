import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { containsBannedWord } from "@/lib/moderation";

type Body = {
  liveSessionId?: string;
  userId?: string;
  username?: string;
  content?: string;
};

export async function POST(req: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "service role missing" }, { status: 503 });
  }

  const body = (await req.json()) as Body;
  const liveSessionId = (body.liveSessionId ?? "").trim();
  const userId = (body.userId ?? "").trim();
  const username = (body.username ?? "").trim();
  const content = (body.content ?? "").trim();

  if (!liveSessionId || !userId || !username || !content) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  if (containsBannedWord(content)) {
    return NextResponse.json({ ok: false, error: "blocked_by_moderation" }, { status: 400 });
  }

  const { error } = await supabase.from("messages").insert({
    live_session_id: liveSessionId,
    user_id: userId,
    username,
    content,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
