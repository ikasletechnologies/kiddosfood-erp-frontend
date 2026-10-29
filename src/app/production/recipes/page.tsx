"use client";

import { useState } from "react";
import { ChefHat, IndianRupee } from "lucide-react";
import { clsx } from "clsx";
import RecipeMasterTab from "@/components/modules/production/RecipeMasterTab";
import RecipeCostingTab from "@/components/modules/production/RecipeCostingTab";

const TABS = [
  { id: "master", label: "Recipe Master", icon: ChefHat },
  { id: "costing", label: "Recipe Costing", icon: IndianRupee },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function RecipesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("master");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-6 space-y-4 sm:space-y-6 w-full min-w-0">
      {/* ── Clean Header ── */}
      <header className="bg-white dark:bg-card p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-white/5">
        <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Recipe Management</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          Define formulas, scale batches & analyze cost — all in one place
        </p>
      </header>

      {/* ── Clean Tabs ── */}
      <div className="w-full max-w-full overflow-x-auto custom-scrollbar flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all whitespace-nowrap shrink-0",
                isActive
                  ? "border-[#f58220] text-[#f58220]"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="pt-2 w-full min-w-0">
        {activeTab === "master" && <RecipeMasterTab />}
        {activeTab === "costing" && <RecipeCostingTab />}
      </div>
    </div>
  );
}
