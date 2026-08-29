"use client";

import RefrensEmptyState from "@/components/ui/RefrensEmptyState";

export default function DayBookPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617] p-4 sm:p-8 w-full min-w-0">
      <div className="w-full min-w-0">
        <RefrensEmptyState 
          title="Monitor Daily Transactions with Day Book Report"
          description="Gain full visibility into your business's daily activities with organized and detailed Day Book Reports."
          type="illustration"
          primaryAction={{
            label: "Enable Advanced Accounting",
            onAction: () => console.log("Enable")
          }}
          secondaryAction={{
            label: "Learn More",
            onAction: () => console.log("Learn More")
          }}
        />
      </div>
    </div>
  );
}
