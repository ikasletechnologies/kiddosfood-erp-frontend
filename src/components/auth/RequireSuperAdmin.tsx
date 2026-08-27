"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Defense-in-depth redirect for admin-only pages (Users/Roles/Permissions/Audit
// Logs). The real enforcement is server-side (authorizeRole(['SUPER_ADMIN'])
// on the corresponding API routes) — this just avoids rendering a broken,
// data-less admin shell to a franchise user who guesses the URL directly.
export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role?.toUpperCase() !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role?.toUpperCase() !== "SUPER_ADMIN") {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return <>{children}</>;
}
