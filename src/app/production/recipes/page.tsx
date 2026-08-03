"use client";

import { useState } from "react";
import { Layers, ChefHat, Scale, IndianRupee } from "lucide-react";
import { clsx } from "clsx";
import RecipeMasterTab from "@/components/modules/production/RecipeMasterTab";
import FormulaScalingTab from "@/components/modules/production/FormulaScalingTab";
import RecipeCostingTab from "@/components/modules/production/RecipeCostingTab";

const TABS = [
  { id: "master", label: "Recipe Master", icon: ChefHat },
  { id: "scaling", label: "Formula Scaling", icon: Scale },
  { id: "costing", label: "Recipe Costing", icon: IndianRupee },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function RecipesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("master");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 space-y-6">
      {/* ── Clean Header ── */}
      <header className="bg-white p-4 rounded-lg border border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">Recipe Management</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Define formulas, scale batches & analyze cost — all in one place
        </p>
      </header>

      {/* ── Clean Tabs ── */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all",
                isActive
                  ? "border-[#f58220] text-[#f58220]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="pt-2">
        {activeTab === "master" && <RecipeMasterTab />}
        {activeTab === "scaling" && <FormulaScalingTab />}
        {activeTab === "costing" && <RecipeCostingTab />}
      </div>
    </div>
  );
}
