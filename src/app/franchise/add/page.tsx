"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickAddFranchiseModal from "@/components/modals/QuickAddFranchiseModal";

// Same returnTo + sessionStorage handoff pattern as
// components/modules/inventory/AddInventoryProductForm.tsx.
function AddFranchisePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const goBack = () => router.push(returnTo || "/franchise");

  return (
    <QuickAddFranchiseModal
      onClose={goBack}
      onCreated={(franchise) => {
        try {
          sessionStorage.setItem("lastCreatedFranchise", JSON.stringify({ id: franchise?.id, name: franchise?.name, at: Date.now() }));
        } catch { /* ignore unavailable storage */ }
        goBack();
      }}
    />
  );
}

export default function AddFranchisePage() {
  return (
    <Suspense fallback={null}>
      <AddFranchisePageInner />
    </Suspense>
  );
}
