"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import Sidebar from "./Sidebar";
import RefrensHeader from "./RefrensHeader";

const PUBLIC_PATHS = ["/login"];
const SETUP_PATH = "/setup";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, setupStatus, setupStatusLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const isSetupPath = pathname === SETUP_PATH;
  const role = user
    ? ((user as any).role?.name || (user as any).role || "").toUpperCase()
    : null;
  const isSuperAdminUser = role === "SUPER_ADMIN";
  // First-run HQ/warehouse setup is a SUPER_ADMIN-only concern (see
  // AuthContext.refreshSetupStatus) — every other role never fetches or
  // waits on this. Waiting until setupStatus has actually resolved (not
  // just until setupStatusLoading flips true) avoids a brief flash of the
  // normal dashboard before the redirect effect below has a value to act on.
  const isWaitingOnSetupStatus =
    isSuperAdminUser && !isSetupPath && (setupStatusLoading || setupStatus === null);

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicPath) {
      router.replace("/login");
      return;
    }

    if (!user) return;

    if (isPublicPath) {
      if (role === "FRANCHISE_ADMIN") {
        router.replace("/franchise/dashboard");
      } else if (isSuperAdminUser && setupStatus && !setupStatus.initialized) {
        router.replace(SETUP_PATH);
      } else {
        router.replace("/");
      }
      return;
    }

    // Never automatically create HQ/Warehouse from any module — the only
    // way setupStatus.initialized becomes true is the Super Admin
    // explicitly completing /setup. This redirect just gets them there.
    if (isSuperAdminUser && !setupStatusLoading && setupStatus) {
      if (!setupStatus.initialized && !isSetupPath) {
        router.replace(SETUP_PATH);
        return;
      }
      if (setupStatus.initialized && isSetupPath) {
        router.replace("/");
        return;
      }
    }

    if (pathname === "/" && role === "FRANCHISE_ADMIN") {
      router.replace("/franchise/dashboard");
    }
  }, [user, loading, isPublicPath, isSetupPath, role, isSuperAdminUser, setupStatus, setupStatusLoading, pathname, router]);

  if (loading || isWaitingOnSetupStatus) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (isSetupPath) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Suspense fallback={<div className="w-64 bg-sidebar shrink-0" />}>
          <Sidebar />
        </Suspense>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <RefrensHeader />
          <main className="flex-1 overflow-y-auto bg-background custom-scrollbar p-3 sm:p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
