"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Proforma Invoice shares the same backend Quotation model and form as Estimation.
// We use a client-side replace here because Next.js App Router server-side
// redirect() in RSC pages can sometimes fail to transition during client-side 
// <Link> navigation.
export default function ProformaInvoiceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sales/estimation");
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname === "/sales/proforma-invoice") {
        window.location.replace("/sales/estimation");
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
        Redirecting to Proforma Invoice (Estimation)...
      </p>
    </div>
  );
}
