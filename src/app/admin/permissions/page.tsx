import PermissionsClient from "@/components/modules/admin/PermissionsClient";
import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";

export default function PermissionsPage() {
  return (
    <RequireSuperAdmin>
      <PermissionsClient />
    </RequireSuperAdmin>
  );
}
