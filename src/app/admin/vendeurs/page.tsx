import { redirect } from "next/navigation";

export default function LegacyAdminVendeursPage() {
  redirect("/dashboard/validation-vendeurs");
}
