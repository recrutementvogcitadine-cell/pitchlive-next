import { createClient as createServerClient } from "@/lib/supabase/server";

type UsersRoleRow = {
  role?: string | null;
};

export async function requireStrictAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false as const, status: 401, userId: null, email: null };
  }

  const { data: row } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<UsersRoleRow>();

  const role = String(row?.role ?? "").trim().toLowerCase();
  if (role !== "admin") {
    return { ok: false as const, status: 403, userId: user.id, email: user.email ?? null };
  }

  return { ok: true as const, status: 200, userId: user.id, email: user.email ?? null };
}
