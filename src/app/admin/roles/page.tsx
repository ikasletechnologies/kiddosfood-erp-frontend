import RolesClient from "@/components/modules/admin/RolesClient";
import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";

export default function RolesPage() {
  return (
    <RequireSuperAdmin>
      <RolesClient />
    </RequireSuperAdmin>
  );
}
