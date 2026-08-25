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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
              <Package size={22} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Main Warehouse & Fulfillment
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Inventory & Stock Hub
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Manage finished goods demand, track reservations, dispatch stock, and monitor raw material buffers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setActiveTab("FINISHED")}
              className={clsx(
                "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                activeTab === "FINISHED"
                  ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Package size={15} /> Finished Goods & Demand
            </button>
            <button
              onClick={() => setActiveTab("RAW")}
              className={clsx(
                "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                activeTab === "RAW"
                  ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Layers size={15} /> Raw Materials & Assets
            </button>
          </div>
          
          <Link
            href="/inventory/stock/add"
            className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-sm"
          >
            <Plus size={16} />
            Create Item
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
