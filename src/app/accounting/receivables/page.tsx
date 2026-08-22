"use client";

import CentralAllPartiesReport from "@/app/reports/components/AllPartiesReport";

export default function ReceivablesPage() {
  return (
    <div className="h-[calc(100vh-60px)]">
      <CentralAllPartiesReport reportData={[]} loading={false} filterType="receivables" />
    </div>
  );
}
