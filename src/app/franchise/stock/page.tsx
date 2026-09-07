"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  X, Package, RefreshCw, Clock,
  Plus, Search, Truck, ArrowRight, Send
} from "lucide-react";
import { clsx } from "clsx";
import {
  productBatchesApi, productsFullApi,
  franchiseProductRequestsApi, franchiseOrdersApi
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: "ALL",           label: "All"          },
  { key: "VALID",         label: "Safe"         },
  { key: "EXPIRING_SOON", label: "Expiring Soon"},
  { key: "EXPIRED",       label: "Expired"      },
];

export default function FranchiseStockPage() {
  const { user } = useAuth();
  const branchId = user?.franchiseId;

  const [viewTab, setViewTab] = useState<"CATALOG" | "BATCHES">("CATALOG");

  const [batches, setBatches]           = useState<any[]>([]);
  const [products, setProducts]         = useState<any[]>([]);
  const [branchOrders, setBranchOrders] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter]   = useState("ALL");
  const [searchTerm, setSearchTerm]       = useState("");

  // Request Stock Modal State
  const [requestModalProduct, setRequestModalProduct] = useState<any | null>(null);
  const [requestQty, setRequestQty] = useState<number>(10);
  const [requestRequiredBy, setRequestRequiredBy] = useState<string>("");
  const [requestNote, setRequestNote] = useState<string>("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchData = useCallback(async (pid?: string) => {
    setLoading(true);
    try {
      const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const effectiveBranchId = branchId || parsedUser?.franchiseId;

      const [bRes, pRes, ordRes] = await Promise.all([
        productBatchesApi.getAll({ productId: pid || undefined }),
        productsFullApi.getAll(effectiveBranchId ? { franchiseId: effectiveBranchId } : {}),
        franchiseOrdersApi.getAll(effectiveBranchId ? { franchiseId: effectiveBranchId } : {}),
      ]);

      const allBatches: any[] = Array.isArray(bRes?.data) ? bRes.data : Array.isArray(bRes?.data?.data) ? bRes.data.data : [];
      // Scope batches strictly to this franchise if franchise user
      const scopedBatches = effectiveBranchId
        ? allBatches.filter((b) => b.franchiseId === effectiveBranchId)
        : allBatches;

      const prodData = Array.isArray(pRes?.data) ? pRes.data : Array.isArray(pRes?.data?.data) ? pRes.data.data : [];
      const ordData = Array.isArray(ordRes?.data) ? ordRes.data : Array.isArray(ordRes?.data?.data) ? ordRes.data.data : [];

      setBatches(scopedBatches);
      setProducts(prodData);
      setBranchOrders(ordData);
    } catch (e) {
      console.error("Failed to load franchise stock data:", e);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProductFilter = (pid: string) => {
    setProductFilter(pid);
    fetchData(pid || undefined);
  };

  const filteredBatches = batches.filter((b) => {
    const status = b.expiryStatus ?? "VALID";
    const matchExpiry  = expiryFilter === "ALL" || status === expiryFilter;
    const matchSearch  = !searchTerm || (b.product?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchExpiry && matchSearch;
  });

  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q)
    );
  });

  // Calculate stats for current branch
  const stats = {
    totalProducts: products.length,
    totalBatches: batches.length,
    safeStockBatches: batches.filter((b) => (b.expiryStatus ?? "VALID") === "VALID").length,
    damagedOrExpired: batches.filter((b) => b.expiryStatus === "EXPIRED").length,
  };

  // Submit Demand Request from Catalog strictly using Product Master ID
  const handleDirectRequestSubmit = async () => {
    if (!requestModalProduct) return;
    if (!requestQty || requestQty <= 0) {
      toast.error("Please enter a valid quantity greater than 0");
      return;
    }

    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const parsedUser = userStr ? JSON.parse(userStr) : null;
    const effectiveBranchId = branchId || parsedUser?.franchiseId;

    if (!effectiveBranchId) {
      toast.error("Your user account is not linked to any franchise branch");
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await franchiseProductRequestsApi.create({
        franchiseId: effectiveBranchId,
        requestNotes: requestNote.trim() || undefined,
        requiredByDate: requestRequiredBy || undefined,
        products: [
          {
            productId: requestModalProduct.id,
            productName: requestModalProduct.name,
            unit: requestModalProduct.unit || "KG",
            requestedQuantity: Number(requestQty),
          },
        ],
      });

      const created = res?.data;
      const reqNum = created?.requestNumber || `FPR-${Date.now().toString().slice(-4)}`;
      const fName = (user as any)?.franchiseName || (user as any)?.franchise?.name || "Branch";

      window.dispatchEvent(
        new CustomEvent("erp:notify-stock-request", {
          detail: {
            franchiseId: effectiveBranchId,
            franchiseName: fName,
            requestNumber: reqNum,
            id: created?.id || "",
            products: [
              {
                productName: requestModalProduct.name,
                requestedQuantity: Number(requestQty),
                unit: requestModalProduct.unit || "KG",
              },
            ],
          },
        })
      );

      toast.success(`Request for ${requestQty} ${requestModalProduct.unit || "KG"} submitted to Central HQ!`);
      setRequestModalProduct(null);
      setRequestQty(10);
      setRequestRequiredBy("");
      setRequestNote("");
      fetchData();
    } catch (e: any) {
      console.error("Failed to submit request:", e);
      toast.error(e?.response?.data?.error ?? "Failed to submit product request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 py-8 px-4">
      {/* ── Header Toolbar ── */}
      <div className="flex items-center justify-end gap-6 pb-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => fetchData(productFilter || undefined)}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-400 hover:text-orange-500"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin text-orange-500")} />
          </button>

          <Link
            href="/franchise-orders"
            className="h-10 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            <Truck size={14} />
            <span>Incoming Orders</span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-bold">
              {branchOrders.length}
            </span>
          </Link>
        </div>
      </div>

      {/* ── View Switcher & Stats Strip ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
          <button
            onClick={() => setViewTab("CATALOG")}
            className={clsx(
              "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              viewTab === "CATALOG"
                ? "bg-white dark:bg-[#1a1d28] text-orange-500 shadow-sm border border-slate-200/60 dark:border-white/10"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Package size={14} /> Finished Product Catalog ({products.length})
          </button>
          <button
            onClick={() => setViewTab("BATCHES")}
            className={clsx(
              "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              viewTab === "BATCHES"
                ? "bg-white dark:bg-[#1a1d28] text-orange-500 shadow-sm border border-slate-200/60 dark:border-white/10"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Clock size={14} /> Branch Batch Expiry Ledger ({batches.length})
          </button>
        </div>

        {/* Branch Mini Stats */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 text-xs">
            <span className="text-gray-400 font-bold">Safe Stock Batches:</span>{" "}
            <span className="font-black text-emerald-600">{stats.safeStockBatches}</span>
          </div>
          <div className="px-4 py-2 bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 text-xs">
            <span className="text-gray-400 font-bold">Damaged / Expired:</span>{" "}
            <span className="font-black text-rose-500">{stats.damagedOrExpired}</span>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-white dark:bg-card border border-slate-100 dark:border-white/5 rounded-[2rem] p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-transparent w-full sm:w-80">
          <Search size={16} className="text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name, SKU, or category..."
            className="bg-transparent text-xs font-bold text-slate-700 dark:text-zinc-300 outline-none w-full placeholder:text-gray-400"
          />
          {searchTerm && (
            <X 
              size={14} 
              className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
              onClick={() => setSearchTerm("")} 
            />
          )}
        </div>

        {viewTab === "BATCHES" && (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={productFilter}
              onChange={(e) => handleProductFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-transparent text-xs font-bold text-slate-600 dark:text-zinc-400 outline-none"
            >
              <option value="">All Products</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="flex gap-1 bg-slate-50 dark:bg-white/5 p-1 rounded-2xl border border-slate-100 dark:border-transparent">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setExpiryFilter(t.key)}
                  className={clsx(
                    "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                    expiryFilter === t.key
                      ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── View 1: Franchise Finished Goods Product Cards ── */}
      {viewTab === "CATALOG" && (
        <div className="space-y-6">
          {loading ? (
            <div className="py-24 text-center text-slate-400 font-bold text-xs animate-pulse">
              Loading Branch Finished Goods Catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 space-y-3">
              <Package size={48} strokeWidth={1} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-gray-700 dark:text-slate-300">No products found in franchise inventory</p>
              <p className="text-xs text-gray-400">Products will appear here once dispatched from HQ and inwarded by your branch.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((prod: any) => {
                // 1. Branch Available & Damaged Stock
                const prodBatches = batches.filter((b) => b.productId === prod.id);
                const batchSum = prodBatches
                  .filter((b) => (b.expiryStatus ?? "VALID") !== "EXPIRED")
                  .reduce((acc, b) => acc + Number(b.quantity || 0), 0);
                const branchDamaged = prodBatches
                  .filter((b) => b.expiryStatus === "EXPIRED")
                  .reduce((acc, b) => acc + Number(b.quantity || 0), 0);

                const branchAvailable = prodBatches.length > 0 ? batchSum : Number(prod.currentStock || 0);

                // 2. In-Transit Quantity heading to this branch
                let inTransitQty = 0;
                branchOrders.forEach((o) => {
                  if (o.status === "DISPATCHED") {
                    const itemsList = o.items ?? [];
                    const m = itemsList.find((it: any) => it.productId === prod.id || it.product?.name?.toLowerCase() === prod.name?.toLowerCase());
                    if (m) inTransitQty += Number(m.quantity || 0);
                  }
                });

                return (
                  <div
                    key={prod.id}
                    className="group bg-white dark:bg-card border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                  >
                    <div>
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-lg shrink-0">
                          <Package size={26} />
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300">
                          {prod.category || "Finished Good"}
                        </span>
                      </div>

                      {/* Product Name & SKU */}
                      <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                          {prod.name}
                        </h3>
                        <p className="text-xs font-mono text-gray-400 mt-1 uppercase tracking-wider">
                          SKU: {prod.sku || "N/A"} · Unit: <strong>{prod.unit || "KG"}</strong>
                        </p>
                      </div>

                      {/* Branch Stock Breakdown */}
                      <div className="mt-5 space-y-2 pt-4 border-t border-gray-100 dark:border-white/5">
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-gray-400 font-bold">Your Branch Available Stock:</span>
                          <span className={clsx("font-black text-sm", branchAvailable > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")}>
                            {branchAvailable} {prod.unit || "KG"}
                          </span>
                        </div>

                        {branchDamaged > 0 && (
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-rose-500 font-bold">Your Branch Damaged Stock:</span>
                            <span className="font-black text-rose-500">
                              {branchDamaged} {prod.unit || "KG"}
                            </span>
                          </div>
                        )}

                        <div className="pt-1 text-center">
                          <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                            <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase">In-Transit Supply from HQ</p>
                            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {inTransitQty} {prod.unit || "KG"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-2">
                      <button
                        onClick={() => {
                          setRequestModalProduct(prod);
                          setRequestQty(10);
                          setRequestRequiredBy("");
                          setRequestNote("");
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-2xl shadow-md shadow-orange-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <Plus size={16} strokeWidth={2.5} /> Request Stock from HQ
                      </button>

                      <Link
                        href="/franchise-orders"
                        className="w-full block text-center py-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-slate-500 transition-colors"
                      >
                        View Incoming Orders / Shipments
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View 2: Branch Batch Expiry Ledger ── */}
      {viewTab === "BATCHES" && (
        <div>
          {loading ? (
            <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs animate-pulse">
              Syncing Batch Records...
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-8 space-y-3">
              <Package size={48} strokeWidth={1} className="mx-auto text-slate-200" />
              <p className="text-slate-500 font-bold">No product batches match your current filters.</p>
              <button
                onClick={() => { setExpiryFilter("ALL"); setSearchTerm(""); setProductFilter(""); fetchData(); }}
                className="text-orange-500 font-black text-xs uppercase underline tracking-widest"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBatches.map((batch: any) => {
                const status = (batch.expiryStatus ?? "VALID") as ExpiryStatus;
                const isLow = batch.quantity < 10;
                const effectiveExpiry = batch.expiryDate || batch.production?.expiryDate;
                const daysLeft = effectiveExpiry
                  ? Math.ceil((new Date(effectiveExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <div
                    key={batch.id}
                    className="group bg-white dark:bg-card border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all space-y-5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-orange-500 transition-colors shadow-sm">
                        <Package size={24} />
                      </div>
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        status === "EXPIRED" ? "bg-red-50 text-red-500 border-red-100" :
                        status === "EXPIRING_SOON" ? "bg-amber-50 text-amber-500 border-amber-100" :
                        "bg-emerald-50 text-emerald-500 border-emerald-100"
                      )}>
                        {status}
                      </span>
                    </div>

                    <div>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-1">
                        {batch.product?.name}
                      </p>
                      <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                        Batch: {batch.batchCode}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-3.5 border border-slate-100 dark:border-transparent">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available</p>
                        <p className={clsx("text-xl font-black tracking-tight", isLow ? "text-amber-500" : "text-slate-900 dark:text-white")}>
                          {batch.quantity}
                          <span className="text-[10px] font-bold text-slate-400 ml-1.5 uppercase">{batch.product?.unit}</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-3.5 border border-slate-100 dark:border-transparent">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expires In</p>
                        {effectiveExpiry ? (
                          <div>
                            <p className={clsx("text-lg font-black tracking-tight", daysLeft !== null && daysLeft <= 7 ? "text-red-500" : "text-slate-900 dark:text-white")}>
                              {daysLeft === null ? "—" : daysLeft <= 0 ? "EXPIRED" : `${daysLeft}d`}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(effectiveExpiry).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</p>
                          </div>
                        ) : (
                          <p className="text-lg font-black text-slate-300">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Request Stock Modal (Product Master ID Locked & Unit Read-Only) ── */}
      {requestModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-gray-100 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <Send size={18} className="text-orange-500" /> Request Stock from HQ
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Demand request will be recorded and sent to Central HQ production
                </p>
              </div>
              <button onClick={() => setRequestModalProduct(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {/* Selected Product Banner (Read-only from Master) */}
            <div className="p-4 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                  <Package size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 dark:text-white">{requestModalProduct.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">SKU: {requestModalProduct.sku || "N/A"}</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-white dark:bg-card rounded-xl border border-orange-200 dark:border-orange-800/40 text-orange-600">
                Unit: {requestModalProduct.unit || "KG"}
              </span>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                Required Quantity ({requestModalProduct.unit || "KG"}) *
              </label>
              <input
                type="number"
                min={1}
                step="any"
                value={requestQty}
                onChange={(e) => setRequestQty(Number(e.target.value))}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="Enter required quantity"
              />
            </div>

            {/* Required By Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                Required By Date
              </label>
              <input
                type="date"
                value={requestRequiredBy}
                onChange={(e) => setRequestRequiredBy(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                Special Instructions / Request Note
              </label>
              <textarea
                rows={2}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="e.g. Urgent demand for weekend replenishment..."
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setRequestModalProduct(null)}
                className="px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDirectRequestSubmit}
                disabled={submittingRequest || !requestQty || requestQty <= 0}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
              >
                {submittingRequest ? "Submitting..." : "Submit Demand Request"}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
