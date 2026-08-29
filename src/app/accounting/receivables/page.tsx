"use client";

import CentralAllPartiesReport from "@/app/reports/components/AllPartiesReport";

export default function ReceivablesPage() {
  return (
    <div className="min-h-screen md:h-[calc(100vh-60px)] p-4 sm:p-6 w-full min-w-0">
      <CentralAllPartiesReport reportData={[]} loading={false} filterType="receivables" />
    </div>
  );
}
