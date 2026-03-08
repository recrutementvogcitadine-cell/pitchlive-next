import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KYC_BUCKET, SELLER_ALLOWED_IMAGE_TYPES, SELLER_UPLOAD_MAX_BYTES } from "@/lib/seller-workflow";

type KycDocumentType = "identity_document" | "profile_photo" | "selfie_document";

const FIELD_BY_TYPE: Record<KycDocumentType, "identity_document_url" | "profile_photo_url" | "selfie_document_url"> = {
  identity_document: "identity_document_url",
  profile_photo: "profile_photo_url",
  selfie_document: "selfie_document_url",
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80) || "file";
}

async function ensureBucket() {
  const admin = createAdminClient();
  if (!admin) return;

  const { data } = await admin.storage.listBuckets();
  const hasBucket = (data ?? []).some((bucket) => bucket.name === KYC_BUCKET);
  if (!hasBucket) {
    await admin.storage.createBucket(KYC_BUCKET, { public: false });
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const formData = await request.formData();
  const docType = String(formData.get("documentType") ?? "") as KycDocumentType;
  const file = formData.get("file");

  if (!FIELD_BY_TYPE[docType]) {
    return NextResponse.json({ error: "Type de document invalide" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  if (!SELLER_ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Seules les images JPG, PNG ou WEBP sont autorisees" }, { status: 400 });
  }

  if (file.size > SELLER_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 5MB)" }, { status: 400 });
  }

  await ensureBucket();

  const safeName = sanitizeFileName(file.name);
  const path = `${user.id}/${Date.now()}-${docType}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(KYC_BUCKET).upload(path, buffer, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    return NextResponse.json({ error: "Upload KYC impossible" }, { status: 500 });
  }

  const field = FIELD_BY_TYPE[docType];
  const updatePayload: Record<string, string> = {
    [field]: path,
    seller_status: "pending_verification",
    updated_at: new Date().toISOString(),
  };

  const { error: sellerUpdateError } = await admin
    .from("sellers")
    .update(updatePayload)
    .eq("user_id", user.id);

  if (sellerUpdateError) {
    return NextResponse.json({ error: "Document charge mais profil vendeur non mis a jour" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, message: "Votre demande vendeur est en cours de verification." });
}
