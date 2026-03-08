import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveDashboardRole } from "@/lib/dashboard-access";
import { createAdminClient } from "@/lib/supabase/admin";

type UsersRow = {
  id: string;
  role?: string | null;
};

type TeamBody = {
  userId?: string;
  email?: string;
  role?: "owner" | "admin" | "agent" | null;
};

async function getCaller() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }

  const { data: usersRow } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle<{ role?: string | null }>();

  const role = resolveDashboardRole({
    email: user.email,
    usersRow,
  });

  if (!role) {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }

  return { user, role };
}

export async function GET() {
  try {
    const caller = await getCaller();
    if ("error" in caller) return caller.error;

    const canManage = caller.role === "owner" || caller.role === "admin";

    if (!canManage) {
      return NextResponse.json({ ok: true, team: [], callerRole: caller.role, canManage: false });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "service role missing" }, { status: 503 });
    }

    const { data: usersData, error: usersError } = await admin
      .from("users")
      .select("id,role")
      .order("id", { ascending: true })
      .limit(500);

    if (usersError) {
      return NextResponse.json({ ok: false, error: usersError.message }, { status: 500 });
    }

    const authUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map<string, string | null>();
    for (const authUser of authUsers.data.users ?? []) {
      emailById.set(authUser.id, authUser.email ?? null);
    }

    const team = ((usersData as UsersRow[] | null) ?? []).map((row) => ({
      id: row.id,
      email: emailById.get(row.id) ?? null,
      role: row.role ?? null,
    }));

    return NextResponse.json({ ok: true, team, callerRole: caller.role, canManage: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await getCaller();
    if ("error" in caller) return caller.error;

    if (caller.role === "agent") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as TeamBody;
    let userId = (body.userId ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const nextRole = body.role ?? null;

    if (!userId && !email) {
      return NextResponse.json({ ok: false, error: "userId ou email requis" }, { status: 400 });
    }

    if (nextRole !== "owner" && nextRole !== "admin" && nextRole !== "agent" && nextRole !== null) {
      return NextResponse.json({ ok: false, error: "role invalide" }, { status: 400 });
    }

    if (caller.role !== "owner" && nextRole === "owner") {
      return NextResponse.json({ ok: false, error: "seul le proprietaire peut attribuer ce role" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "service role missing" }, { status: 503 });
    }

    if (!userId && email) {
      const authUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matched = (authUsers.data.users ?? []).find((item) => (item.email ?? "").toLowerCase() === email);
      if (!matched?.id) {
        return NextResponse.json({ ok: false, error: "aucun compte trouve pour cet email" }, { status: 404 });
      }
      userId = matched.id;
    }

    const { data: targetRow } = await admin
      .from("users")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle<UsersRow>();

    if (caller.role !== "owner" && (targetRow?.role ?? "").toLowerCase() === "owner") {
      return NextResponse.json({ ok: false, error: "seul le proprietaire peut modifier un proprietaire" }, { status: 403 });
    }

    let error: { message?: string } | null = null;
    if (targetRow?.id) {
      const updateRes = await admin
        .from("users")
        .update({ role: nextRole })
        .eq("id", userId);
      error = updateRes.error;
    } else {
      if (nextRole === null) {
        return NextResponse.json({ ok: false, error: "aucun role a retirer: utilisateur sans fiche" }, { status: 404 });
      }
      const insertRes = await admin
        .from("users")
        .insert({ id: userId, role: nextRole });
      error = insertRes.error;
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
