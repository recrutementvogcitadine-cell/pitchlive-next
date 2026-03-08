import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStrictAdmin } from "@/lib/admin-auth";

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

export async function GET(request: Request) {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  }

  let sellersQuery = admin
    .from("sellers")
    .select("id,user_id,store_name,whatsapp_number,category,country,city,identity_document_url,selfie_document_url,profile_photo_url,seller_status,subscription_status,subscription_plan,subscription_expiry_date,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (status) {
    sellersQuery = sellersQuery.eq("seller_status", status);
  }

  const { data: sellers, error } = await sellersQuery.returns<SellerAdminRow[]>();

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

  const filtered = q
    ? rows.filter((row) => row.store_name.toLowerCase().includes(q) || String(row.user?.username ?? "").toLowerCase().includes(q))
    : rows;

  return NextResponse.json({ sellers: filtered });
}
