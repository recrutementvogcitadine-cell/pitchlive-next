import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDashboardRole } from "@/lib/dashboard-access";

type UsersRow = { id: string; username: string | null; role: string | null };

type SellerAdminRow = {
  id: string;
  user_id: string;
  store_name: string;
  whatsapp_number: string;
  category: string;
  country: string;
  city: string;
  identity_document_url: string | null;
  selfie_document_url: string | null;
  profile_photo_url: string | null;
  seller_status: string;
  subscription_status: string;
  subscription_plan: string | null;
  subscription_expiry_date: string | null;
  created_at: string;
  updated_at: string;
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

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  const { data: sellers, error } = await admin
    .from("sellers")
    .select("id,user_id,store_name,whatsapp_number,category,country,city,identity_document_url,selfie_document_url,profile_photo_url,seller_status,subscription_status,subscription_plan,subscription_expiry_date,created_at,updated_at")
    .order("created_at", { ascending: false })
    .returns<SellerAdminRow[]>();

  if (error) {
    return NextResponse.json({ error: "Impossible de charger les vendeurs" }, { status: 500 });
  }

  const userIds = (sellers ?? []).map((row) => row.user_id);
  let usersById = new Map<string, UsersRow>();

  if (userIds.length) {
    const { data: usersRows } = await admin
      .from("users")
      .select("id,username,role")
      .in("id", userIds)
      .returns<UsersRow[]>();

    usersById = new Map((usersRows ?? []).map((item) => [item.id, item]));
  }

  const rows = (sellers ?? []).map((seller) => ({
    ...seller,
    user: usersById.get(seller.user_id) ?? null,
  }));

  return NextResponse.json({ sellers: rows });
}
