import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RtcRole, RtcTokenBuilder } from "agora-token";

type Body = {
  title?: string;
  creatorId?: string;
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
    const title = body.title?.trim() || "Live PITCH LIVE";
    const creatorId = body.creatorId?.trim() || "main-creator";
    const channelName = `pitchlive-${Date.now()}`;

    const supabase = adminClient();
    if (!supabase) return NextResponse.json({ error: "supabase env missing" }, { status: 503 });

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        creator_id: creatorId,
        channel_name: channelName,
        title,
        status: "live",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message ?? "session create failed" }, { status: 500 });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) return NextResponse.json({ error: "agora env missing" }, { status: 503 });

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      0,
      RtcRole.PUBLISHER,
      Math.floor(Date.now() / 1000) + 60 * 60,
      Math.floor(Date.now() / 1000) + 60 * 60
    );

    return NextResponse.json({ sessionId: data.id, channelName, token });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
