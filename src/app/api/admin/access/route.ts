import { NextResponse } from "next/server";
import { requireStrictAdmin } from "@/lib/admin-auth";

export async function GET() {
  const access = await requireStrictAdmin();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });
  }

  return NextResponse.json({ ok: true, role: "admin", userId: access.userId, email: access.email });
}
