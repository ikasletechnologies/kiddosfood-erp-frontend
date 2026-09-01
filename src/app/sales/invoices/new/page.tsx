"use client";

import { Suspense } from "react";
import SalesInvoicesClient from "../SalesInvoicesClient";

export default function NewSalesInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        </div>
      }
    >
      <SalesInvoicesClient initialView="create" />
    </Suspense>
  );
}
