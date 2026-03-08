import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

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
    .select("seller_status,subscription_status,subscription_expiry_date,subscription_plan,store_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Impossible de lire le statut vendeur" }, { status: 500 });
  }

  return NextResponse.json({ seller: data ?? null });
}
