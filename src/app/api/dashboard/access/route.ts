import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveDashboardRole } from "@/lib/dashboard-access";

type UsersTableRow = {
  role?: string | null;
};

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { data: usersRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<UsersTableRow>();

    const role = resolveDashboardRole({
      email: user.email,
      usersRow,
    });

    if (!role) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, role, email: user.email ?? null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
