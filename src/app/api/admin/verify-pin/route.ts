import { NextResponse } from "next/server";

type Body = {
  pin?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const provided = (body.pin ?? "").trim();
    const expected = (process.env.ADMIN_DASHBOARD_PIN ?? "0000").trim();

    if (!provided) {
      return NextResponse.json({ error: "PIN requis" }, { status: 400 });
    }

    if (provided !== expected) {
      return NextResponse.json({ error: "PIN invalide" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Requete invalide" }, { status: 400 });
  }
}
