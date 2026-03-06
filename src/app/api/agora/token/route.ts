import { NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";

type Body = {
  channel?: string;
  uid?: number;
  role?: "publisher" | "subscriber";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const channel = body.channel?.trim();
    const uid = Number(body.uid ?? 0);
    const role = body.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    if (!channel) {
      return NextResponse.json({ error: "channel required" }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json({ error: "agora env missing" }, { status: 503 });
    }

    const expireAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channel, uid, role, expireAt, expireAt);

    return NextResponse.json({ token, appId, channel });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
