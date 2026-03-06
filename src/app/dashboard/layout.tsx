import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { canAccessDashboard } from "@/lib/dashboard-access";

type UsersTableRow = {
  role?: string | null;
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/dashboard-login?redirect=/dashboard");
  }

  const { data: usersRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<UsersTableRow>();

  const allowed = canAccessDashboard({
    email: user.email,
    usersRow,
  });

  if (!allowed) {
    redirect("/dashboard-login?redirect=/dashboard&error=forbidden");
  }

  return <>{children}</>;
}
