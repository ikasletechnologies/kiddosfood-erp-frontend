"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickAddCustomerModal from "@/components/modals/QuickAddCustomerModal";

// Same returnTo + sessionStorage handoff pattern as
// components/modules/inventory/AddInventoryProductForm.tsx — lets a caller
// (e.g. Delivery Challan's "+" button) deep-link here and resume with the
// newly created record once this redirects back.
function AddCustomerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const goBack = () => router.push(returnTo || "/customers");

  return (
    <QuickAddCustomerModal
      onClose={goBack}
      onCreated={(customer) => {
        try {
          sessionStorage.setItem("lastCreatedCustomer", JSON.stringify({ id: customer?.id, name: customer?.name, at: Date.now() }));
        } catch { /* ignore unavailable storage */ }
        goBack();
      }}
    />
  );
}

export default function AddCustomerPage() {
  return (
    <Suspense fallback={null}>
      <AddCustomerPageInner />
    </Suspense>
  );
}
