import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/seller-workflow";

type SellerInput = {
  storeName?: string;
  whatsappNumber?: string;
  category?: string;
  country?: string;
  city?: string;
};

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sellers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Impossible de charger le profil vendeur" }, { status: 500 });
  }

  return NextResponse.json({ seller: data ?? null, user: { id: user.id, email: user.email ?? null } });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SellerInput | null;

  const storeName = String(body?.storeName ?? "").trim();
  const whatsappNumber = normalizePhone(String(body?.whatsappNumber ?? ""));
  const category = String(body?.category ?? "").trim();
  const country = String(body?.country ?? "").trim();
  const city = String(body?.city ?? "").trim();

  if (!storeName || !whatsappNumber || !category || !country || !city) {
    return NextResponse.json({ error: "Tous les champs sont obligatoires" }, { status: 400 });
  }

  if (whatsappNumber.length < 8) {
    return NextResponse.json({ error: "Numero WhatsApp invalide" }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    store_name: storeName,
    whatsapp_number: whatsappNumber,
    category,
    country,
    city,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("sellers")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Impossible de sauvegarder le profil vendeur" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seller: data });
}
