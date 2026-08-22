"use client";

import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { Info, Tag, Truck, ArrowRight, ShieldCheck, Banknote } from "lucide-react";
import { clsx } from "clsx";

export default function DocumentSummary() {
  const { 
    totals, 
    useAdvance, 
    setUseAdvance, 
    selectedVendor,
    discountAmount, setDiscountAmount,
    freightCost, setFreightCost
  } = usePurchaseOrder();

  return (
    <div className="bg-white dark:bg-[#0B0D14] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Financial Header */}
      <div className="bg-slate-50/50 dark:bg-slate-900/30 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-200 flex items-center gap-2">
          <ShieldCheck size={16} className="text-orange-500" /> Financial Summary
        </h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Core Totals */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm text-slate-500">
            <span>Subtotal</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">₹{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm text-slate-500">
            <span>Tax Amount (GST)</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">₹{totals.totalGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          {/* Dynamic Adjustments */}
          <div className="flex justify-between items-center text-sm text-slate-500 group">
             <div className="flex items-center gap-2">
                <Tag size={14} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                <span>Discount</span>
             </div>
             <input 
               type="number"
               value={discountAmount || ""}
               onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
               placeholder="0.00"
               className="w-24 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-sm outline-none font-medium text-slate-850 dark:text-white focus:border-orange-500 transition-colors shadow-sm"
             />
          </div>

          <div className="flex justify-between items-center text-sm text-slate-500 group">
             <div className="flex items-center gap-2">
                <Truck size={14} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                <span>Freight / Shipping</span>
             </div>
             <input 
               type="number"
               value={freightCost || ""}
               onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
               placeholder="0.00"
               className="w-24 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-sm outline-none font-medium text-slate-850 dark:text-white focus:border-orange-500 transition-colors shadow-sm"
             />
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 italic">
            <span>Roundoff</span>
            <span>{totals.roundoff >= 0 ? "+" : ""}{totals.roundoff.toFixed(2)}</span>
          </div>
        </div>

        {/* Tax Breakdown */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2">
           <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>GST Split</span>
              <Info size={12} className="text-slate-400" />
           </div>
           <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>CGST (Central Tax)</span>
              <span>₹{totals.cgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
           </div>
           <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>SGST (State Tax)</span>
              <span>₹{totals.sgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
           </div>
        </div>

        {/* Settlement Selection */}
        <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
             <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
               <Banknote size={14} className="text-slate-400" /> Settlement
             </h4>
             {selectedVendor && selectedVendor.advanceBalance > 0 && (
               <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded border border-green-100 dark:border-green-900/30">
                  ₹{selectedVendor.advanceBalance.toLocaleString()} Available
               </span>
             )}
          </div>

          <label 
            className={clsx(
              "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group",
              useAdvance 
                ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900/50" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-350"
            )}
          >
            <div className="flex items-center gap-2.5">
              <input 
                type="checkbox"
                checked={useAdvance}
                onChange={(e) => setUseAdvance(e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-850 dark:text-white">Apply Advance</span>
                <span className="text-[10px] text-slate-400">Deduct from vendor credit</span>
              </div>
            </div>
            {useAdvance && (
              <span className="text-xs font-semibold text-orange-650">-₹{totals.appliedAdvance.toLocaleString()}</span>
            )}
          </label>
        </div>

        {/* Grand Total */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
           <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-500">Grand Total</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">₹{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
           </div>
           {useAdvance && (
             <div className="flex justify-between items-center text-sm font-semibold text-orange-650 pt-2 border-t border-dashed border-slate-200 mt-2">
               <span>Balance Due</span>
               <span className="flex items-center gap-1 font-bold">
                  ₹{totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <ArrowRight size={14} />
               </span>
             </div>
           )}
        </div>
      </div>

      {/* Trust Badge */}
      <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
         <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Accounting Ready</span>
         </div>
         <span className="text-[11px] font-semibold text-slate-400">v2.0</span>
      </div>
    </div>
  );
}
