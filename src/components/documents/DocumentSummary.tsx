"use client";

import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { Info, Tag, Truck, ArrowRight, ShieldCheck, Banknote } from "lucide-react";
import { clsx } from "clsx";
import { formatCurrency } from "@/lib/utils";

export default function DocumentSummary() {
  const { 
    totals, 
    useAdvance, 
    setUseAdvance, 
    selectedVendor,
    discountAmount, setDiscountAmount,
    freightCost, setFreightCost
  } = usePurchaseOrder();

  const parsedDiscount = Number(discountAmount);
  const isDiscountInvalid = !Number.isFinite(parsedDiscount) || parsedDiscount < 0 || (parsedDiscount > totals.subtotal && totals.subtotal >= 0);
  const discountErrorMessage = !Number.isFinite(parsedDiscount) || parsedDiscount < 0
    ? "Discount must be a non-negative number."
    : parsedDiscount > totals.subtotal
    ? "Discount cannot exceed subtotal."
    : null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* Financial Header */}
      <div className="bg-slate-50/70 dark:bg-slate-900/50 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wide">
          <ShieldCheck size={16} className="text-[#f58220]" /> Financial Summary
        </h3>
        <span className="text-[10px] font-semibold text-slate-400 font-mono">INR (₹)</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Core Totals */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Subtotal</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono text-sm">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Tax Amount (GST)</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono text-sm">
              {formatCurrency(totals.totalGst)}
            </span>
          </div>

          {/* Dynamic Adjustments */}
          <div className="pt-1">
            <div className="flex justify-between items-center text-xs group">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Tag size={13} className={clsx("transition-colors", isDiscountInvalid ? "text-rose-500" : "text-slate-400 group-hover:text-[#f58220]")} />
                <span className={clsx(isDiscountInvalid && "text-rose-600 dark:text-rose-400 font-semibold")}>Discount</span>
              </div>
              <div className="relative flex items-center w-28">
                <span className={clsx("absolute left-2.5 text-xs font-bold pointer-events-none", isDiscountInvalid ? "text-rose-400" : "text-slate-400")}>₹</span>
                <input 
                  type="number"
                  step="any"
                  min="0"
                  max={totals.subtotal > 0 ? totals.subtotal : undefined}
                  value={discountAmount || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setDiscountAmount(0);
                    } else {
                      const num = parseFloat(val);
                      setDiscountAmount(isNaN(num) ? 0 : num);
                    }
                  }}
                  placeholder="0.00"
                  className={clsx(
                    "w-full pl-6 pr-2 py-1 text-right rounded-lg text-xs font-bold font-mono outline-none transition-all shadow-2xs",
                    isDiscountInvalid
                      ? "bg-rose-50/50 dark:bg-rose-950/20 border border-rose-400 dark:border-rose-600 text-rose-700 dark:text-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30"
                      : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100"
                  )}
                />
              </div>
            </div>
            {discountErrorMessage && (
              <span className="text-[10px] text-rose-500 font-semibold block text-right mt-1">
                {discountErrorMessage}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center text-xs group">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Truck size={13} className="text-slate-400 group-hover:text-[#f58220] transition-colors" />
              <span>Freight / Shipping</span>
            </div>
            <div className="relative flex items-center w-28">
              <span className="absolute left-2.5 text-xs text-slate-400 font-bold pointer-events-none">₹</span>
              <input 
                type="number"
                step="any"
                min="0"
                value={freightCost || ""}
                onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full pl-6 pr-2 py-1 text-right bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold font-mono text-slate-800 dark:text-white outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all shadow-2xs"
              />
            </div>
          </div>

          {Math.abs(totals.roundoff) >= 0.005 && (
            <div className="flex justify-between items-center text-[11px] text-slate-400 italic pt-0.5">
              <span>Roundoff</span>
              <span className="font-mono">{totals.roundoff >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totals.roundoff))}</span>
            </div>
          )}
        </div>

        {/* Tax Breakdown Box */}
        <div className="bg-slate-50/70 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>GST Split</span>
            <Info size={11} className="text-slate-400" />
          </div>
          {totals.igst > 0 ? (
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span>IGST (Integrated Tax)</span>
              <span className="font-mono font-bold">{formatCurrency(totals.igst)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>CGST (Central Tax)</span>
                <span className="font-mono font-bold">{formatCurrency(totals.cgst)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>SGST (State Tax)</span>
                <span className="font-mono font-bold">{formatCurrency(totals.sgst)}</span>
              </div>
            </>
          )}
        </div>

        {/* Settlement Selection */}
        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
              <Banknote size={13} className="text-slate-400" /> Settlement
            </h4>
            {selectedVendor && selectedVendor.advanceBalance > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-200">
                {formatCurrency(selectedVendor.advanceBalance)} Available
              </span>
            )}
          </div>

          <label 
            className={clsx(
              "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
              useAdvance 
                ? "bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 shadow-2xs" 
                : "bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-200"
            )}
          >
            <div className="flex items-center gap-2.5">
              <input 
                type="checkbox"
                checked={useAdvance}
                onChange={(e) => setUseAdvance(e.target.checked)}
                className="w-4 h-4 rounded text-[#f58220] accent-[#f58220] border-slate-300 focus:ring-[#f58220] cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 dark:text-white">Apply Advance</span>
                <span className="text-[10px] text-slate-400">Deduct from vendor credit</span>
              </div>
            </div>
            {useAdvance && (
              <span className="text-xs font-bold font-mono text-[#f58220]">-{formatCurrency(totals.appliedAdvance)}</span>
            )}
          </label>
        </div>

        {/* Grand Total */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grand Total</span>
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCurrency(totals.total)}
            </span>
          </div>
          {useAdvance && (
            <div className="flex justify-between items-center text-xs font-bold text-[#f58220] pt-2 border-t border-dashed border-orange-200 mt-2">
              <span>Balance Due</span>
              <span className="flex items-center gap-1 font-mono font-bold text-sm">
                {formatCurrency(totals.balanceDue)} <ArrowRight size={13} />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Trust Badge */}
      <div className="bg-slate-50/70 dark:bg-slate-900/50 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accounting Ready</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">v2.4</span>
      </div>
    </div>
  );
}
