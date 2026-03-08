import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDashboardRole } from "@/lib/dashboard-access";
import { KYC_BUCKET } from "@/lib/seller-workflow";

type RequestBody = {
  sellerId?: string;
  field?: "identity_document_url" | "profile_photo_url" | "selfie_document_url";
};

async function requireAdminAccess() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return { ok: false as const, status: 401 };

  const { data: usersRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role?: string | null }>();

  const role = resolveDashboardRole({ email: user.email, usersRow });
  if (!role) return { ok: false as const, status: 403 };

  return { ok: true as const, role };
}

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const sellerId = String(body?.sellerId ?? "").trim();
  const field = body?.field;

  if (!sellerId || !field) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const { data: seller, error } = await admin
    .from("sellers")
    .select("identity_document_url,profile_photo_url,selfie_document_url")
    .eq("id", sellerId)
    .maybeSingle<{ identity_document_url: string | null; profile_photo_url: string | null; selfie_document_url: string | null }>();

  if (error || !seller) {
    return NextResponse.json({ error: "Vendeur introuvable" }, { status: 404 });
  }

  const path = seller[field];
  if (!path) {
    return NextResponse.json({ error: "Document indisponible" }, { status: 404 });
  }

  const { data: signed, error: signedError } = await admin.storage.from(KYC_BUCKET).createSignedUrl(path, 60 * 15);
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Impossible de generer l'URL du document" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
