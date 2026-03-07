import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultSellerProfile, normalizeWhatsappNumber } from "@/lib/boutique-data";

type SellerProfileRow = {
  seller_id: string;
  store_name: string;
  tagline: string;
  whatsapp_number: string;
  updated_at: string;
};

function getFallbackProfile(sellerId: string) {
  return getDefaultSellerProfile(sellerId);
}

export async function GET(request: NextRequest) {
  const sellerId = request.nextUrl.searchParams.get("sellerId")?.trim() ?? "";
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId requis" }, { status: 400 });
  }

  const admin = createAdminClient();
  const fallback = getFallbackProfile(sellerId);

  if (!admin) {
    return NextResponse.json({ profile: fallback, source: "fallback" });
  }

  try {
    const { data, error } = await admin
      .from("seller_store_profiles")
      .select("seller_id,store_name,tagline,whatsapp_number,updated_at")
      .eq("seller_id", sellerId)
      .maybeSingle<SellerProfileRow>();

    if (error) {
      return NextResponse.json({ profile: fallback, source: "fallback" });
    }

    if (!data) {
      return NextResponse.json({ profile: fallback, source: "fallback" });
    }

    return NextResponse.json({
      profile: {
        sellerId: data.seller_id,
        storeName: data.store_name,
        tagline: data.tagline,
        whatsappNumber: data.whatsapp_number,
      },
      source: "database",
    });
  } catch {
    return NextResponse.json({ profile: fallback, source: "fallback" });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        sellerId?: string;
        storeName?: string;
        tagline?: string;
        whatsappNumber?: string;
      }
    | null;

  const sellerId = body?.sellerId?.trim() ?? "";
  const storeName = body?.storeName?.trim() ?? "";
  const tagline = body?.tagline?.trim() ?? "";
  const whatsappNumber = normalizeWhatsappNumber(body?.whatsappNumber ?? "");

  if (!sellerId || !storeName || !tagline || !whatsappNumber) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  if (whatsappNumber.length < 8) {
    return NextResponse.json({ error: "Numero WhatsApp invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const { error } = await admin.from("seller_store_profiles").upsert(
    {
      seller_id: sellerId,
      store_name: storeName,
      tagline,
      whatsapp_number: whatsappNumber,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seller_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Impossible de sauvegarder le profil vendeur" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      sellerId,
      storeName,
      tagline,
      whatsappNumber,
    },
  });
}
