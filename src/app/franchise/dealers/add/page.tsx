"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { franchiseApi } from "@/lib/api";
import QuickAddDealerModal from "@/components/modals/QuickAddDealerModal";

// Same returnTo + sessionStorage handoff pattern as
// components/modules/inventory/AddInventoryProductForm.tsx.
function AddDealerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const defaultFranchiseId = searchParams.get("franchiseId") || undefined;

  const [franchises, setFranchises] = useState<any[]>([]);

  useEffect(() => {
    franchiseApi.getAll().then((res) => setFranchises((res as any).data || [])).catch(() => setFranchises([]));
  }, []);

  const goBack = () => router.push(returnTo || "/franchise/dealers");

  return (
    <QuickAddDealerModal
      franchises={franchises}
      defaultFranchiseId={defaultFranchiseId}
      onClose={goBack}
      onCreated={(dealer) => {
        try {
          sessionStorage.setItem("lastCreatedDealer", JSON.stringify({ id: dealer?.id, name: dealer?.name, at: Date.now() }));
        } catch { /* ignore unavailable storage */ }
        goBack();
      }}
    />
  );
}

export default function AddDealerPage() {
  return (
    <Suspense fallback={null}>
      <AddDealerPageInner />
    </Suspense>
  );
}
