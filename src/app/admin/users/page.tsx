import UsersClient from "@/components/modules/admin/UsersClient";
import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";

export default function UsersPage() {
  return (
    <RequireSuperAdmin>
      <UsersClient />
    </RequireSuperAdmin>
  );
}
