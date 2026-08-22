"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package, Search, RefreshCw, Send, Building2,
  Clock, Truck, CheckCircle2, AlertTriangle, ExternalLink,
  Layers, Filter, Eye, LayoutGrid, List, ArrowRight, ShieldCheck
} from "lucide-react";
import { clsx } from "clsx";
import {
  productsFullApi, productBatchesApi, franchiseProductRequestsApi,
  franchiseOrdersApi, franchiseApi, InventoryDemandItem
} from "@/lib/api";
import { toast } from "react-hot-toast";
import InventoryMetricCard from "./InventoryMetricCard";
import ProductDemandDrawer from "./ProductDemandDrawer";
import BranchStockDrawer from "./BranchStockDrawer";

export default function FinishedGoodsStockClient() {
  const [demandItems, setDemandItems] = useState<InventoryDemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [demandFilter, setDemandFilter] = useState<"ALL" | "HAS_DEMAND" | "RESERVED" | "IN_TRANSIT">("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("TABLE");

  // Drawer States
  const [selectedDemandProduct, setSelectedDemandProduct] = useState<InventoryDemandItem | null>(null);
  const [selectedBranchProduct, setSelectedBranchProduct] = useState<InventoryDemandItem | null>(null);

  const fetchDemandData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes, fprRes, foRes, frRes] = await Promise.all([
        productsFullApi.getAll().catch(() => ({ data: [] })),
        productBatchesApi.getAll().catch(() => ({ data: [] })),
        franchiseProductRequestsApi.getAll().catch(() => ({ data: [] })),
        franchiseOrdersApi.getAll().catch(() => ({ data: [] })),
        franchiseApi.getAll().catch(() => ({ data: [] })),
      ]);

      const rawProducts: any[] = Array.isArray(pRes?.data) ? pRes.data : [];
      const batches: any[] = Array.isArray(bRes?.data) ? bRes.data : [];
      const fprs: any[] = Array.isArray(fprRes?.data) ? fprRes.data : [];
      const fos: any[] = Array.isArray(foRes?.data) ? foRes.data : [];
      const franchises: any[] = Array.isArray(frRes?.data) ? frRes.data : frRes?.data?.franchises || [];

      // Filter for finished goods
      const finishedProducts = rawProducts.filter(
        (p) => p.category === "FINISHED_GOOD" || p.category === "FINISHED_PRODUCT" || p.category === "FINISHED" || !p.category?.startsWith("RAW_")
      );

      // Build unified demand items matching strictly on Product Master ID
      const items: InventoryDemandItem[] = finishedProducts.map((prod) => {
        const pid = prod.id;

        // 1. Physical Batches
        const prodBatches = batches.filter((b: any) => b.productId === pid);
        const totalBranchAvailable = prodBatches
          .filter((b: any) => (b.expiryStatus ?? "VALID") !== "EXPIRED")
          .reduce((acc: number, b: any) => acc + Number(b.quantity || 0), 0);
        const totalBranchDamaged = prodBatches
          .filter((b: any) => b.expiryStatus === "EXPIRED")
          .reduce((acc: number, b: any) => acc + Number(b.quantity || 0), 0);

        // Branch breakdown
        const branchMap = new Map<string, { franchiseId: string; franchiseName: string; availableQuantity: number; damagedQuantity: number }>();
        prodBatches.forEach((b: any) => {
          const fid = b.franchiseId || "MAIN_BRANCH";
          const fName = franchises.find((f: any) => f.id === fid)?.name || b.franchise?.name || "Downtown Branch";
          const existing = branchMap.get(fid) || {
            franchiseId: fid,
            franchiseName: fName,
            availableQuantity: 0,
            damagedQuantity: 0,
          };
          if (b.expiryStatus === "EXPIRED") {
            existing.damagedQuantity += Number(b.quantity || 0);
          } else {
            existing.availableQuantity += Number(b.quantity || 0);
          }
          branchMap.set(fid, existing);
        });

        // 2. Product Requests (FPR)
        const prodFprs = fprs.filter((r: any) => {
          const prods = r.products ?? (r.details as any)?.products ?? [];
          return prods.some((p: any) => p.productId === pid || p.productName?.toLowerCase() === prod.name?.toLowerCase());
        });

        // 3. Supply Orders (FO)
        const prodFos = fos.filter((o: any) => {
          const itemsList = o.items ?? [];
          return itemsList.some((it: any) => it.productId === pid || it.product?.name?.toLowerCase() === prod.name?.toLowerCase());
        });

        // Calculate Demand Buckets without double-counting (using sourceRequestId link)
        let pendingDemandQty = 0;
        let pendingReqCount = 0;
        let approvedDemandQty = 0;
        let approvedOrderCount = 0;
        let reservedStockQty = 0;
        let inTransitStockQty = 0;

        const demandRecords: InventoryDemandItem["demandRecords"] = [];

        // FPR records
        prodFprs.forEach((fpr: any) => {
          const prods = fpr.products ?? (fpr.details as any)?.products ?? [];
          const match = prods.find((p: any) => p.productId === pid || p.productName?.toLowerCase() === prod.name?.toLowerCase());
          if (!match) return;

          const reqQty = Number(match.requestedQuantity || 0);
          const appQty = match.approvedQuantity !== undefined ? Number(match.approvedQuantity) : undefined;
          const reqNum = fpr.requestNumber || `FPR-${String(fpr.id).slice(0, 4).toUpperCase()}`;
          const fName = fpr.franchise?.name || franchises.find((f: any) => f.id === fpr.franchiseId)?.name || "Branch";

          if (fpr.status === "PENDING") {
            pendingDemandQty += reqQty;
            pendingReqCount += 1;
            demandRecords.push({
              recordType: "PRODUCT_REQUEST",
              id: fpr.id,
              referenceNumber: reqNum,
              franchiseId: fpr.franchiseId || "",
              franchiseName: fName,
              quantity: reqQty,
              approvedQuantity: appQty,
              requiredBy: fpr.requiredByDate || fpr.requiredBy || undefined,
              status: fpr.status,
              createdAt: fpr.createdAt || new Date().toISOString(),
            });
          }
        });

        // FO records (Execution / Supply orders)
        prodFos.forEach((fo: any) => {
          const itemsList = fo.items ?? [];
          const match = itemsList.find((it: any) => it.productId === pid || it.product?.name?.toLowerCase() === prod.name?.toLowerCase());
          if (!match) return;

          const qty = Number(match.quantity || 0);
          const foNum = fo.orderNumber || `FO-${String(fo.id).slice(0, 4).toUpperCase()}`;
          const fName = fo.franchise?.name || franchises.find((f: any) => f.id === fo.franchiseId)?.name || "Branch";

          // If independent FO (without sourceRequestId) and PENDING, add to pending demand
          if (fo.status === "PENDING" && !fo.sourceRequestId) {
            pendingDemandQty += qty;
            pendingReqCount += 1;
          } else if (fo.status === "APPROVED") {
            approvedDemandQty += qty;
            approvedOrderCount += 1;
          } else if (fo.status === "PROCESSING" || fo.status === "IN_PRODUCTION") {
            reservedStockQty += qty;
          } else if (fo.status === "DISPATCHED") {
            inTransitStockQty += qty;
          }

          if (["PENDING", "APPROVED", "PROCESSING", "IN_PRODUCTION", "DISPATCHED", "DELIVERY_ISSUE"].includes(fo.status)) {
            demandRecords.push({
              recordType: "SUPPLY_ORDER",
              id: fo.id,
              referenceNumber: foNum,
              franchiseId: fo.franchiseId || "",
              franchiseName: fName,
              quantity: qty,
              requiredBy: fo.expectedDispatchDate || fo.requiredBy || undefined,
              status: fo.status,
              createdAt: fo.createdAt || new Date().toISOString(),
            });
          }
        });

        // HQ available balance (physical current stock stored on product record)
        const hqAvailable = Number(prod.currentStock || prod.stock || 0);

        return {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku || "",
          unit: prod.unit || "KG",
          hqAvailableStock: hqAvailable,
          hqReservedStock: reservedStockQty,
          inTransitStock: inTransitStockQty,
          totalFranchiseAvailableStock: totalBranchAvailable,
          totalFranchiseDamagedStock: totalBranchDamaged,
          pendingDemandQuantity: pendingDemandQty,
          pendingRequestCount: pendingReqCount,
          approvedDemandQuantity: approvedDemandQty,
          approvedOrderCount: approvedOrderCount,
          branchStockBreakdown: Array.from(branchMap.values()),
          demandRecords: demandRecords,
        };
      });

      setDemandItems(items);
    } catch (e) {
      console.error("Failed to load finished goods demand data:", e);
      toast.error("Failed to sync finished goods demand");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemandData();
  }, [fetchDemandData]);

  // Real-time refresh listeners for instant updates
  useEffect(() => {
    const handleRefresh = () => fetchDemandData();
    window.addEventListener("erp:refresh-product-requests", handleRefresh);
    window.addEventListener("erp:refresh-franchise-orders", handleRefresh);
    return () => {
      window.removeEventListener("erp:refresh-product-requests", handleRefresh);
      window.removeEventListener("erp:refresh-franchise-orders", handleRefresh);
    };
  }, [fetchDemandData]);

  // Filters
  const filtered = demandItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      item.productName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q);

    let matchDemand = true;
    if (demandFilter === "HAS_DEMAND") {
      matchDemand = item.pendingDemandQuantity > 0 || item.approvedDemandQuantity > 0;
    } else if (demandFilter === "RESERVED") {
      matchDemand = item.hqReservedStock > 0;
    } else if (demandFilter === "IN_TRANSIT") {
      matchDemand = item.inTransitStock > 0;
    }

    return matchSearch && matchDemand;
  });

  // Aggregated Stats for Strip
  const stats = {
    totalProducts: demandItems.length,
    totalHqAvailable: demandItems.reduce((a, b) => a + b.hqAvailableStock, 0),
    totalReserved: demandItems.reduce((a, b) => a + b.hqReservedStock, 0),
    totalInTransit: demandItems.reduce((a, b) => a + b.inTransitStock, 0),
    totalPendingDemand: demandItems.reduce((a, b) => a + b.pendingDemandQuantity, 0),
    totalApprovedDemand: demandItems.reduce((a, b) => a + b.approvedDemandQuantity, 0),
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── Top Metric Cards Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <InventoryMetricCard
          label="Total Finished Products"
          value={stats.totalProducts}
          subtext="Catalog items"
          icon={Package}
          colorTheme="slate"
        />
        <InventoryMetricCard
          label="HQ Available Stock"
          value={stats.totalHqAvailable.toLocaleString()}
          subtext="Ready in warehouse"
          icon={Layers}
          colorTheme="emerald"
        />
        <InventoryMetricCard
          label="HQ Reserved Stock"
          value={stats.totalReserved.toLocaleString()}
          subtext="Locked for processing"
          icon={Clock}
          colorTheme="purple"
        />
        <InventoryMetricCard
          label="In-Transit Stock"
          value={stats.totalInTransit.toLocaleString()}
          subtext="On road to branches"
          icon={Truck}
          colorTheme="indigo"
        />
        <InventoryMetricCard
          label="Pending Demand"
          value={stats.totalPendingDemand.toLocaleString()}
          subtext="Awaiting HQ approval"
          icon={Send}
          colorTheme="amber"
          badge={stats.totalPendingDemand > 0 ? "Active Demand" : undefined}
        />
        <InventoryMetricCard
          label="Approved Orders"
          value={stats.totalApprovedDemand.toLocaleString()}
          subtext="Ready for processing"
          icon={CheckCircle2}
          colorTheme="blue"
        />
      </div>

      {/* ── Toolbar: Search, Filters & View Toggle ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0A0D14] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full md:w-80 shadow-sm">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Product Name or SKU..."
            className="bg-transparent text-xs font-medium text-slate-700 dark:text-zinc-300 outline-none w-full placeholder:text-slate-400"
          />
        </div>

        {/* Demand Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {[
              { id: "ALL", label: "All Finished Goods" },
              { id: "HAS_DEMAND", label: "Has Pending Demand" },
              { id: "RESERVED", label: "Reserved" },
              { id: "IN_TRANSIT", label: "In Transit" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDemandFilter(f.id as any)}
                className={clsx(
                  "px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all",
                  demandFilter === f.id
                    ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                    : "text-slate-450 hover:text-slate-805 dark:hover:text-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode("GRID")}
              className={clsx(
                "p-2 rounded-md text-slate-400 transition-all",
                viewMode === "GRID" ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "hover:text-slate-650"
              )}
              title="Grid Cards View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={clsx(
                "p-2 rounded-md text-slate-400 transition-all",
                viewMode === "TABLE" ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "hover:text-slate-650"
              )}
              title="Dense Ledger Table View"
            >
              <List size={16} />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDemandData}
            className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-gray-400 hover:text-orange-500 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin text-orange-500")} />
          </button>
        </div>
      </div>

      {/* ── View 1: Super Admin Finished Goods Product Cards (Exact User Requirement) ── */}
      {viewMode === "GRID" && (
        <div>
          {loading ? (
            <div className="py-24 text-center text-slate-400 font-bold text-xs animate-pulse">
              Syncing Finished Goods Demand & Inventory Hub...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-8 space-y-3">
              <Package size={48} strokeWidth={1} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching finished goods found</p>
              <p className="text-xs text-slate-400">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item) => {
                const hasPending = item.pendingDemandQuantity > 0;
                const hasReserved = item.hqReservedStock > 0;
                const hasInTransit = item.inTransitStock > 0;
                const firstPendingRecord = item.demandRecords.find((r) => r.status === "PENDING");

                return (
                  <div
                    key={item.productId}
                    className="bg-white dark:bg-[#0A0D14] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-xl shrink-0">
                          <Package size={28} />
                        </div>
                        <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 tracking-wider">
                          AUTOMATED SYNC
                        </span>
                      </div>

                      {/* Product Name & SKU */}
                      <div>
                        <h3 className="text-base font-bold text-slate-905 dark:text-white leading-tight">
                          {item.productName}
                        </h3>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
                          SKU: {item.sku || "N/A"} · UNIT: <strong>{item.unit}</strong>
                        </p>
                      </div>

                      {/* Stock Summary Matrix */}
                      <div className="mt-5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-white/[0.03]">
                          <span className="text-slate-400 font-bold">Current Branch Stock:</span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {item.totalFranchiseAvailableStock} {item.unit}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                          <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-[9px] font-semibold text-slate-500 uppercase">HQ Available</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                              {item.hqAvailableStock}
                            </p>
                          </div>

                          <div className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900/30">
                            <p className="text-[9px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Reserved</p>
                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                              {item.hqReservedStock}
                            </p>
                          </div>

                          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                            <p className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">In-Transit</p>
                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {item.inTransitStock}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Live Pending Demand Banner */}
                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Send size={13} className="text-amber-500" /> Pending Franchise Demand:
                          </span>
                          <span className={clsx("text-xs font-black px-2.5 py-0.5 rounded-lg", hasPending ? "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40" : "text-slate-400")}>
                            {item.pendingDemandQuantity} {item.unit}
                          </span>
                        </div>

                        {/* Active Request Details Preview */}
                        {firstPendingRecord ? (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-white">
                              <span>{firstPendingRecord.referenceNumber}</span>
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">
                                {firstPendingRecord.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{firstPendingRecord.franchiseName}</span>
                              <span>{firstPendingRecord.quantity} {item.unit}</span>
                            </div>
                            {firstPendingRecord.requiredBy && (
                              <p className="text-[10px] text-slate-400">
                                Required By: <strong>{firstPendingRecord.requiredBy}</strong>
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No pending requests awaiting review.</p>
                        )}
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedDemandProduct(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Send size={14} /> Review Request ({item.demandRecords.length})
                        </button>

                        <button
                          onClick={() => setSelectedBranchProduct(item)}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                          title="View Multi-Branch Stock Holdings"
                        >
                          <Building2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View 2: Dense Ledger Table View ── */}
      {viewMode === "TABLE" && (
        <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="w-[26%] px-6 py-4">Finished Product Specification</th>
                  <th className="w-[14%] px-6 py-4 text-center">HQ Available</th>
                  <th className="w-[14%] px-6 py-4 text-center">HQ Reserved</th>
                  <th className="w-[14%] px-6 py-4 text-center">In-Transit</th>
                  <th className="w-[16%] px-6 py-4 text-center">Branch Holdings</th>
                  <th className="w-[16%] px-6 py-4 text-right">Franchise Demand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((item) => (
                  <tr key={item.productId} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs shrink-0">
                          <Package size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-white uppercase truncate">
                            {item.productName}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            SKU: {item.sku || "N/A"} · Unit: {item.unit}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-slate-800 dark:text-white">
                      {item.hqAvailableStock} <span className="text-[10px] text-slate-450 font-normal">{item.unit}</span>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-purple-650 dark:text-purple-400">
                      {item.hqReservedStock} <span className="text-[10px] font-normal">{item.unit}</span>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-indigo-650 dark:text-indigo-400">
                      {item.inTransitStock} <span className="text-[10px] font-normal">{item.unit}</span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedBranchProduct(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-55 dark:bg-white/5 hover:bg-slate-100 rounded-lg text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                      >
                        <Building2 size={13} className="text-slate-400" />
                        {item.totalFranchiseAvailableStock} {item.unit}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {item.pendingDemandQuantity > 0 ? (
                        <button
                          onClick={() => setSelectedDemandProduct(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-600 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs font-semibold transition-all shadow-sm"
                        >
                          <Send size={13} /> {item.pendingDemandQuantity} {item.unit} ({item.pendingRequestCount})
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedDemandProduct(item)}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-650"
                        >
                          View Demand ({item.demandRecords.length})
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Demand Drawer Modal ── */}
      <ProductDemandDrawer
        item={selectedDemandProduct}
        onClose={() => setSelectedDemandProduct(null)}
      />

      {/* ── Branch Stock Holdings Drawer Modal ── */}
      <BranchStockDrawer
        item={selectedBranchProduct}
        onClose={() => setSelectedBranchProduct(null)}
      />
    </div>
  );
}
