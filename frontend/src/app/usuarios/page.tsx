import { AdminPageShell } from "@/components/admin-page-shell";
import { UserManagement } from "@/components/user-management";

export default function UsersPage() {
  return <AdminPageShell><UserManagement /></AdminPageShell>;
}
