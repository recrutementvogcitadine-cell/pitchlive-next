import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const ALLOWED_REPORT_TYPES = new Set(["live_abusif", "vendeur_frauduleux", "contenu_interdit"]);
const ALLOWED_TARGET_TYPES = new Set(["live", "seller", "user"]);

type ReportBody = {
  reportType?: string;
  targetType?: string;
  targetId?: string;
  details?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ReportBody | null;

  const reportType = String(body?.reportType ?? "").trim();
  const targetType = String(body?.targetType ?? "").trim();
  const targetId = String(body?.targetId ?? "").trim();
  const details = String(body?.details ?? "").trim();

  if (!ALLOWED_REPORT_TYPES.has(reportType) || !ALLOWED_TARGET_TYPES.has(targetType) || !targetId) {
    return NextResponse.json({ error: "Signalement invalide" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    reporter_user_id: user?.id ?? null,
    report_type: reportType,
    target_type: targetType,
    target_id: targetId,
    details,
  };

  const { error } = await supabase.from("reports").insert(payload);
  if (error) {
    return NextResponse.json({ error: "Impossible d'envoyer le signalement" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
