"use client";

import React from "react";
import { X, Building2, Package, AlertTriangle, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import { InventoryDemandItem } from "@/lib/api/franchise.api";

interface BranchStockDrawerProps {
  item: InventoryDemandItem | null;
  onClose: () => void;
}

export default function BranchStockDrawer({ item, onClose }: BranchStockDrawerProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] shadow-2xl w-full max-w-xl border border-slate-100 dark:border-white/10 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {item.productName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Franchise Branch Stock Holdings ({item.sku || "N/A"})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Strip */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5 grid grid-cols-2 gap-3 bg-slate-50/30 dark:bg-white/[0.01]">
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Franchise Available</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {item.totalFranchiseAvailableStock} <span className="text-xs font-bold">{item.unit}</span>
            </p>
          </div>

          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/30">
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Damaged / Quarantine</p>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {item.totalFranchiseDamagedStock} <span className="text-xs font-bold">{item.unit}</span>
            </p>
          </div>
        </div>

        {/* Branch List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Branch Stock Ledger ({item.branchStockBreakdown?.length || 0} Branches)
          </p>

          {(!item.branchStockBreakdown || item.branchStockBreakdown.length === 0) ? (
            <div className="py-12 text-center text-slate-400 text-xs font-bold">
              No branch inventory records found for this product.
            </div>
          ) : (
            <div className="space-y-2.5">
              {item.branchStockBreakdown.map((branch) => (
                <div
                  key={branch.franchiseId}
                  className="p-4 bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 font-bold">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{branch.franchiseName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Branch ID: {branch.franchiseId.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Good Stock</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {branch.availableQuantity} {item.unit}
                      </p>
                    </div>
                    {branch.damagedQuantity > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400">Damaged</p>
                        <p className="text-sm font-black text-rose-500">
                          {branch.damagedQuantity} {item.unit}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-white/5 flex justify-end bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
