import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";
import { KYC_BUCKET } from "@/lib/seller-workflow";

type RequestBody = {
  sellerId?: string;
  field?: "identity_document_url" | "profile_photo_url" | "selfie_document_url";
};

export async function POST(request: Request) {
  const access = await requireStrictAdmin();
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
