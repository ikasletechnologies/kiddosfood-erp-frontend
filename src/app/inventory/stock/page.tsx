"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Layers, Sparkles, Plus } from "lucide-react";
import { clsx } from "clsx";
import FinishedGoodsStockClient from "@/components/modules/inventory/FinishedGoodsStockClient";
import RawMaterialStockClient from "@/components/modules/inventory/RawMaterialStockClient";

export default function StockInventoryPage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  
  const [activeTab, setActiveTab] = useState<"FINISHED" | "RAW">("FINISHED");

  useEffect(() => {
    if (typeParam) {
      const t = typeParam.toUpperCase();
      if (t === "RAW" || t === "RAW_MATERIAL" || t === "PACKAGING" || t === "ASSETS") {
        setActiveTab("RAW");
      } else if (t === "FINISHED" || t === "FINISHED_GOOD") {
        setActiveTab("FINISHED");
      }
    }
  }, [typeParam]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      {/* ── Page Header & Top Tab Switcher ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 pb-2 w-full min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
              <Package size={22} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">
              Main Warehouse & Fulfillment
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
            Inventory & Stock Hub
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
            Manage finished goods demand, track reservations, dispatch stock, and monitor raw material buffers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0 min-w-0">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 w-full sm:w-auto overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab("FINISHED")}
              className={clsx(
                "flex-1 sm:flex-initial px-3.5 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                activeTab === "FINISHED"
                  ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Package size={15} className="shrink-0" />
              <span>Finished Goods</span>
            </button>
            <button
              onClick={() => setActiveTab("RAW")}
              className={clsx(
                "flex-1 sm:flex-initial px-3.5 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                activeTab === "RAW"
                  ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Layers size={15} className="shrink-0" />
              <span>Raw Materials</span>
            </button>
          </div>
          
          <Link
            href="/inventory/stock/add"
            className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 sm:py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-sm whitespace-nowrap text-center"
          >
            <Plus size={16} className="shrink-0" />
            <span>Create Item</span>
          </Link>
        </div>
      </div>

      {/* ── Active Module Content ── */}
      {activeTab === "FINISHED" ? (
        <FinishedGoodsStockClient />
      ) : (
        <RawMaterialStockClient />
      )}
    </div>
  );
}
