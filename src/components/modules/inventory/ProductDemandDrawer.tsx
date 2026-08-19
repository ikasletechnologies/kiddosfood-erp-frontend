"use client";

import React from "react";
import Link from "next/link";
import {
  X, Send, Package, Clock, CheckCircle2,
  Truck, ArrowRight, ShieldAlert, Building2,
  Calendar, Layers, FileText, ExternalLink
} from "lucide-react";
import { clsx } from "clsx";
import { InventoryDemandItem } from "@/lib/api/franchise.api";

interface ProductDemandDrawerProps {
  item: InventoryDemandItem | null;
  onClose: () => void;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/40",
    label: "PENDING REVIEW",
  },
  APPROVED: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/40",
    label: "APPROVED (AWAITING PROCESSING)",
  },
  PROCESSING: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800/40",
    label: "PROCESSING (STOCK RESERVED)",
  },
  DISPATCHED: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800/40",
    label: "DISPATCHED (IN-TRANSIT)",
  },
  DELIVERY_ISSUE: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800/40",
    label: "DELIVERY ISSUE (DISCREPANCY)",
  },
  DELIVERED: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/40",
    label: "DELIVERED & INWARDED",
  },
};

export default function ProductDemandDrawer({ item, onClose }: ProductDemandDrawerProps) {
  if (!item) return null;

  const totalDemandQty = item.pendingDemandQuantity + item.approvedDemandQuantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] shadow-2xl w-full max-w-2xl border border-slate-100 dark:border-white/10 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <Send size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {item.productName}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  SKU: {item.sku || "N/A"}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Unit: <strong>{item.unit}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stock & Demand Metrics Bar */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/30 dark:bg-white/[0.01]">
          <div className="p-3.5 bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">HQ Available</p>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {item.hqAvailableStock} <span className="text-[10px] font-bold text-slate-400">{item.unit}</span>
            </p>
          </div>

          <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/30">
            <p className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">HQ Reserved</p>
            <p className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">
              {item.hqReservedStock} <span className="text-[10px] font-bold">{item.unit}</span>
            </p>
          </div>

          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">In-Transit</p>
            <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {item.inTransitStock} <span className="text-[10px] font-bold">{item.unit}</span>
            </p>
          </div>

          <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Demand</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {item.pendingDemandQuantity} <span className="text-[10px] font-bold">{item.unit}</span>
            </p>
          </div>
        </div>

        {/* Demand Records List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <FileText size={14} /> Active Demand Records ({item.demandRecords.length})
            </h3>
            <span className="text-xs font-black text-slate-600 dark:text-slate-300">
              Total Demand: {totalDemandQty} {item.unit}
            </span>
          </div>

          {item.demandRecords.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-dashed border-slate-200 dark:border-white/5">
              <Package size={36} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-500">No active franchise requests or orders for this product.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {item.demandRecords.map((record) => {
                const badge = STATUS_BADGES[record.status] || STATUS_BADGES.PENDING;
                const isSupplyOrder = record.recordType === "SUPPLY_ORDER" || record.referenceNumber?.startsWith("FO-");
                const reviewLink = isSupplyOrder
                  ? `/franchise-orders?id=${record.id}`
                  : `/franchise/requests?id=${record.id}`;

                return (
                  <div
                    key={`${record.recordType}-${record.id}`}
                    className="p-5 bg-white dark:bg-card rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Building2 size={15} className="text-slate-400" /> {record.franchiseName}
                          </span>
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                            {record.referenceNumber}
                          </span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400">
                            {isSupplyOrder ? "Supply Order (FO)" : "Product Request (FPR)"}
                          </span>
                        </div>

                        {record.requiredBy && (
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Calendar size={12} /> Required By: <strong>{record.requiredBy}</strong>
                          </p>
                        )}
                      </div>

                      <span className={clsx("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border", badge.bg, badge.text, badge.border)}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Quantity & Action */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                      <div className="text-xs">
                        <span className="text-slate-400 font-bold">Requested:</span>{" "}
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {record.quantity} {item.unit}
                        </span>
                        {record.approvedQuantity !== undefined && record.approvedQuantity !== record.quantity && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-2">
                            (Approved: {record.approvedQuantity} {item.unit})
                          </span>
                        )}
                      </div>

                      <Link
                        href={reviewLink}
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Review Request <ExternalLink size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
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
