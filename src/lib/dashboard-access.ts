export type DashboardRole = "owner" | "admin" | "agent";

type UsersTableRow = {
  role?: string | null;
};

function parseOwnerEmails() {
  return new Set(
    (process.env.DASHBOARD_OWNER_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseRole(value: string | null | undefined): DashboardRole | null {
  const role = (value ?? "").trim().toLowerCase();
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  return null;
}

export function resolveDashboardRole(input: {
  email?: string | null;
  usersRow?: UsersTableRow | null;
}): DashboardRole | null {
  const email = (input.email ?? "").trim().toLowerCase();
  const owners = parseOwnerEmails();

  if (email && owners.has(email)) {
    return "owner";
  }

  return parseRole(input.usersRow?.role);
}

export function canAccessDashboard(input: {
  email?: string | null;
  usersRow?: UsersTableRow | null;
}) {
  return resolveDashboardRole(input) !== null;
}
