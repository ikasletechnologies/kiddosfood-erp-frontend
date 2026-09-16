"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  X, Package, RefreshCw, Clock,
  Plus, Search, Truck, ArrowRight, Send,
  Layers, CheckCircle2, AlertTriangle, LayoutGrid, List
} from "lucide-react";
import { clsx } from "clsx";
import {
  productBatchesApi, productsFullApi,
  franchiseProductRequestsApi, franchiseOrdersApi,
  inventoryApi, salesApi
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";
import InventoryMetricCard from "@/components/modules/inventory/InventoryMetricCard";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

function formatPackSize(packSize: any, sku?: string): string | undefined {
  if (packSize) {
    if (typeof packSize === "string") return packSize;
    if (typeof packSize === "object") {
      const qty = packSize.qty ?? packSize.quantity ?? "";
      const unit = packSize.unit ?? "";
      const res = `${qty}${unit}`.trim();
      if (res) return res;
    }
  }
  if (sku && sku.includes("-")) {
    const part = sku.split("-").pop()?.trim();
    if (part && !["APPAM", "FG", "RM"].includes(part.toUpperCase())) {
      return part;
    }
  }
  return undefined;
}

function formatUnit(unit: any): string {
  if (!unit) return "PC";
  if (typeof unit === "string") return unit;
  if (typeof unit === "object") {
    return unit.unit || unit.name || unit.symbol || "PC";
  }
  return String(unit);
}

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: "ALL",           label: "All"          },
  { key: "VALID",         label: "Safe"         },
  { key: "EXPIRING_SOON", label: "Expiring Soon"},
  { key: "EXPIRED",       label: "Expired"      },
];

export interface UnifiedFranchiseProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  packSize?: string;
  availableStock: number;
  reservedStock: number;
  inTransitStock: number;
  pendingDemand: number;
  minimumStock: number;
  rawProduct: any | null;
  inventoryItem: any | null;
}

export default function FranchiseStockPage() {
  const { user } = useAuth();
  const branchId = user?.franchiseId;

  const [viewTab, setViewTab] = useState<"CATALOG" | "BATCHES">("CATALOG");
  const [viewMode, setViewMode] = useState<"TABLE" | "GRID">("TABLE");

  const [batches, setBatches] = useState<any[]>([]);
  const [unifiedProducts, setUnifiedProducts] = useState<UnifiedFranchiseProduct[]>([]);
  const [branchOrders, setBranchOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_TRANSIT" | "PENDING_DEMAND"
  >("ALL");

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

      const [invRes, pRes, ordRes, reqRes, soRes, bRes] = await Promise.all([
        inventoryApi.getInventory(effectiveBranchId, "FINISHED_GOOD").catch(() => ({ data: [] })),
        productsFullApi.getAll(effectiveBranchId ? { franchiseId: effectiveBranchId } : {}).catch(() => ({ data: [] })),
        franchiseOrdersApi.getAll(effectiveBranchId ? { franchiseId: effectiveBranchId } : {}).catch(() => ({ data: [] })),
        franchiseProductRequestsApi.getAll(effectiveBranchId ? { franchiseId: effectiveBranchId } : {}).catch(() => ({ data: [] })),
        salesApi.getSalesOrders(effectiveBranchId ? { franchiseId: effectiveBranchId } : {}).catch(() => ({ data: [] })),
        productBatchesApi.getAll({ productId: pid || undefined }).catch(() => ({ data: [] })),
      ]);

      const invItems: any[] = Array.isArray(invRes?.data) ? invRes.data : [];
      const catProducts: any[] = Array.isArray(pRes?.data) ? pRes.data : Array.isArray(pRes?.data?.data) ? pRes.data.data : [];
      const ordData: any[] = Array.isArray(ordRes?.data) ? ordRes.data : Array.isArray(ordRes?.data?.data) ? ordRes.data.data : [];
      const reqData: any[] = Array.isArray(reqRes?.data) ? reqRes.data : [];
      const soData: any[] = Array.isArray(soRes?.data) ? soRes.data : [];
      const allBatches: any[] = Array.isArray(bRes?.data) ? bRes.data : Array.isArray(bRes?.data?.data) ? bRes.data.data : [];

      const scopedBatches = effectiveBranchId
        ? allBatches.filter((b) => b.franchiseId === effectiveBranchId)
        : allBatches;

      // Filter catalog for finished goods
      const finishedCatProducts = catProducts.filter(
        (p: any) =>
          p.category === "FINISHED_GOOD" ||
          p.category === "FINISHED_PRODUCT" ||
          p.category === "FINISHED" ||
          !p.category?.startsWith("RAW_")
      );

      // Build unified franchise finished goods strictly by SKU
      const matchedSkuSet = new Set<string>();

      const catalogItems: UnifiedFranchiseProduct[] = finishedCatProducts.map((p: any) => {
        const skuNorm = (p.sku || "").trim().toUpperCase();
        if (skuNorm) matchedSkuSet.add(skuNorm);

        // Match inventory item strictly by SKU to keep variants (e.g. 450G vs 900G) strictly independent
        const inv = skuNorm
          ? invItems.find((i) => (i.sku || "").trim().toUpperCase() === skuNorm)
          : invItems.find((i) => (i.name || "").trim().toLowerCase() === (p.name || "").trim().toLowerCase());

        const availableStock = inv ? Number(inv.currentStock || 0) : Number(p.currentStock || 0);
        const unit = formatUnit(inv?.unit || p.unit);
        const minimumStock = inv?.minimumStock ?? 10;
        const packSize = formatPackSize(p.packSize || p.size, skuNorm);

        // In-transit stock heading to this branch (orders with status DISPATCHED)
        let inTransitStock = 0;
        ordData.forEach((o: any) => {
          if (o.status === "DISPATCHED") {
            const items = o.items ?? [];
            items.forEach((it: any) => {
              const itSku = (it.product?.sku || it.sku || "").trim().toUpperCase();
              if (
                it.productId === p.id ||
                (itSku && itSku === skuNorm) ||
                (!skuNorm && it.product?.name?.toLowerCase() === p.name?.toLowerCase())
              ) {
                inTransitStock += Number(it.quantity || it.dispatchedQuantity || 0);
              }
            });
          }
        });

        // Pending demand awaiting fulfillment from HQ
        let pendingDemand = 0;
        ordData.forEach((o: any) => {
          if (o.status === "PENDING" || o.status === "APPROVED") {
            const items = o.items ?? [];
            items.forEach((it: any) => {
              const itSku = (it.product?.sku || it.sku || "").trim().toUpperCase();
              if (
                it.productId === p.id ||
                (itSku && itSku === skuNorm) ||
                (!skuNorm && it.product?.name?.toLowerCase() === p.name?.toLowerCase())
              ) {
                pendingDemand += Number(it.quantity || 0);
              }
            });
          }
        });
        reqData.forEach((r: any) => {
          if (r.status === "PENDING") {
            const prods = r.products ?? (r.details as any)?.products ?? [];
            prods.forEach((it: any) => {
              if (it.productId === p.id || it.productName?.toLowerCase() === p.name?.toLowerCase()) {
                pendingDemand += Number(it.requestedQuantity || 0);
              }
            });
          }
        });

        // Reserved stock for confirmed/processing customer/dealer orders
        let reservedStock = 0;
        soData.forEach((so: any) => {
          if (["CONFIRMED", "PROCESSING", "PENDING"].includes(so.status)) {
            const items = so.items ?? so.orderItems ?? [];
            items.forEach((it: any) => {
              const itSku = (it.sku || "").trim().toUpperCase();
              if (
                it.productId === p.id ||
                (itSku && itSku === skuNorm) ||
                (!skuNorm && it.productName?.toLowerCase() === p.name?.toLowerCase())
              ) {
                reservedStock += Number(it.quantity || 0);
              }
            });
          }
        });

        return {
          id: p.id,
          name: p.name,
          sku: p.sku || "N/A",
          category: p.category || "Finished Good",
          unit,
          packSize,
          availableStock,
          reservedStock,
          inTransitStock,
          pendingDemand,
          minimumStock,
          rawProduct: p,
          inventoryItem: inv || null,
        };
      });

      // Unclaimed InventoryItems at this branch that have no matching Product catalog row
      const unclaimedInvItems: UnifiedFranchiseProduct[] = invItems
        .filter((it) => it.sku && !matchedSkuSet.has(it.sku.trim().toUpperCase()))
        .map((it) => {
          const skuNorm = (it.sku || "").trim().toUpperCase();
          let inTransitStock = 0;
          ordData.forEach((o: any) => {
            if (o.status === "DISPATCHED") {
              const items = o.items ?? [];
              items.forEach((item: any) => {
                const itSku = (item.product?.sku || item.sku || "").trim().toUpperCase();
                if (itSku === skuNorm) {
                  inTransitStock += Number(item.quantity || item.dispatchedQuantity || 0);
                }
              });
            }
          });

          return {
            id: `inv:${it.id}`,
            name: it.name,
            sku: it.sku,
            category: "Finished Good",
            unit: formatUnit(it.unit),
            packSize: formatPackSize(it.packSize, skuNorm),
            availableStock: Number(it.currentStock || 0),
            reservedStock: 0,
            inTransitStock,
            pendingDemand: 0,
            minimumStock: it.minimumStock ?? 10,
            rawProduct: null,
            inventoryItem: it,
          };
        });

      setBatches(scopedBatches);
      setUnifiedProducts([...catalogItems, ...unclaimedInvItems]);
      setBranchOrders(ordData);
    } catch (e) {
      console.error("Failed to load franchise stock data:", e);
      toast.error("Failed to load franchise inventory");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time event listeners for seamless sync
  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener("erp:refresh-product-requests", handleRefresh);
    window.addEventListener("erp:refresh-franchise-orders", handleRefresh);
    window.addEventListener("erp:refresh-inventory", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener("erp:refresh-product-requests", handleRefresh);
      window.removeEventListener("erp:refresh-franchise-orders", handleRefresh);
      window.removeEventListener("erp:refresh-inventory", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [fetchData]);

  const handleProductFilter = (pid: string) => {
    setProductFilter(pid);
    fetchData(pid || undefined);
  };

  // ── Multi-Unit Calculations ──────────────────────────────────────────
  // Accurately aggregates per-unit buckets (e.g. "27 PC" and "196 PKT")
  // without blindly combining different units together into a single number.
  const sumByUnit = (getQty: (item: UnifiedFranchiseProduct) => number): Map<string, number> => {
    const map = new Map<string, number>();
    unifiedProducts.forEach((item) => {
      const qty = getQty(item);
      if (!qty || qty <= 0) return;
      const unit = formatUnit(item.unit).toUpperCase();
      map.set(unit, (map.get(unit) || 0) + qty);
    });
    return map;
  };

  const renderByUnit = (map: Map<string, number>): React.ReactNode => {
    if (map.size === 0) return <span className="text-xl font-bold">0</span>;
    const stacked = map.size > 1;
    return (
      <div className="space-y-0.5">
        {Array.from(map.entries()).map(([unit, qty]) => (
          <div key={unit} className={clsx("font-bold", stacked ? "text-base leading-tight" : "text-2xl")}>
            {qty.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-semibold opacity-70 uppercase">{unit}</span>
          </div>
        ))}
      </div>
    );
  };

  // Filtered Products for Catalog View
  const filteredProducts = useMemo(() => {
    return unifiedProducts.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      let matchStock = true;
      if (stockFilter === "IN_STOCK") {
        matchStock = p.availableStock > 0;
      } else if (stockFilter === "OUT_OF_STOCK") {
        matchStock = p.availableStock <= 0;
      } else if (stockFilter === "LOW_STOCK") {
        matchStock = p.availableStock > 0 && p.availableStock <= p.minimumStock;
      } else if (stockFilter === "IN_TRANSIT") {
        matchStock = p.inTransitStock > 0;
      } else if (stockFilter === "PENDING_DEMAND") {
        matchStock = p.pendingDemand > 0;
      }

      return matchSearch && matchStock;
    });
  }, [unifiedProducts, searchTerm, stockFilter]);

  // Filtered Batches for Expiry Ledger View
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const status = b.expiryStatus ?? "VALID";
      const matchExpiry = expiryFilter === "ALL" || status === expiryFilter;
      const matchSearch =
        !searchTerm || (b.product?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchExpiry && matchSearch;
    });
  }, [batches, expiryFilter, searchTerm]);

  // ── Dashboard Metrics Stats ──────────────────────────────────────────
  const inStockSkus = unifiedProducts.filter((p) => p.availableStock > 0).length;
  const lowOrOutSkus = unifiedProducts.filter((p) => p.availableStock <= p.minimumStock).length;
  const deliveredOrdersCount = branchOrders.filter((o) => o.status === "DELIVERED").length;
  const pendingOrdersCount = branchOrders.filter((o) => o.status === "PENDING" || o.status === "APPROVED").length;

  const availableByUnit = sumByUnit((i) => i.availableStock);
  const reservedByUnit = sumByUnit((i) => i.reservedStock);
  const inTransitByUnit = sumByUnit((i) => i.inTransitStock);
  const pendingDemandByUnit = sumByUnit((i) => i.pendingDemand);

  const stats = {
    totalProducts: unifiedProducts.length,
    inStockSkus,
    lowOrOutSkus,
    availableStockNode: renderByUnit(availableByUnit),
    reservedStockNode: renderByUnit(reservedByUnit),
    inTransitStockNode: renderByUnit(inTransitByUnit),
    pendingDemandNode: renderByUnit(pendingDemandByUnit),
    hasPendingDemand: pendingDemandByUnit.size > 0 || pendingOrdersCount > 0,
    deliveredOrdersCount,
    pendingOrdersCount,
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
            unit: requestModalProduct.unit || "PC",
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
                unit: requestModalProduct.unit || "PC",
              },
            ],
          },
        })
      );

      toast.success(`Request for ${requestQty} ${requestModalProduct.unit || "PC"} submitted to Central HQ!`);
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
    <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 py-6 px-4 sm:px-6 lg:px-8">
      
      {/* ── Top Section Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 pb-2 w-full min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
            Product Inventory
          </h1>
        </div>

        {/* Quick Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0 min-w-0">
          <button
            onClick={() => fetchData(productFilter || undefined)}
            className="p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-400 hover:text-orange-500 hover:border-orange-500/30 transition-all shrink-0 shadow-sm"
            title="Refresh Inventory Data"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin text-orange-500")} />
          </button>

          <Link
            href="/purchases/inward"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border border-slate-200 dark:border-white/10 shadow-sm"
          >
            <Plus size={14} className="text-orange-500" />
            <span>Receive Stock</span>
          </Link>

          <Link
            href="/franchise-orders"
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 whitespace-nowrap"
          >
            <Truck size={14} />
            <span>Incoming Orders</span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-bold">
              {branchOrders.length}
            </span>
          </Link>
        </div>
      </div>

      {/* ── Summary Metric Cards Strip (6 Franchise-Scoped Cards) ── */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 w-full min-w-0">
        <InventoryMetricCard
          label="Total Products"
          value={`${stats.totalProducts} SKU${stats.totalProducts === 1 ? "" : "s"}`}
          subtext={`${stats.inStockSkus} in stock · ${stats.lowOrOutSkus} low/out`}
          icon={Package}
          colorTheme="slate"
        />
        <InventoryMetricCard
          label="Available Stock"
          value={stats.availableStockNode}
          subtext={`${stats.inStockSkus} SKUs ready to sell`}
          icon={Layers}
          colorTheme="emerald"
        />
        <InventoryMetricCard
          label="Reserved Stock"
          value={stats.reservedStockNode}
          subtext="Allocated for customer orders"
          icon={Clock}
          colorTheme="purple"
        />
        <InventoryMetricCard
          label="In-Transit Stock"
          value={stats.inTransitStockNode}
          subtext="Dispatched from HQ"
          icon={Truck}
          colorTheme="indigo"
        />
        <InventoryMetricCard
          label="Pending Demand"
          value={stats.pendingDemandNode}
          subtext={`${stats.pendingOrdersCount} orders awaiting HQ`}
          icon={Send}
          colorTheme="amber"
          badge={stats.hasPendingDemand ? "Active Demand" : undefined}
        />
        <InventoryMetricCard
          label="Received Orders"
          value={`${stats.deliveredOrdersCount} Orders`}
          subtext="Inwarded to branch stock"
          icon={CheckCircle2}
          colorTheme="blue"
        />
      </div>

      {/* ── View Switcher, Search & Filter Toolbar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-[#0A0D14] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full min-w-0">
        {/* Left: Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
          <button
            onClick={() => setViewTab("CATALOG")}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap",
              viewTab === "CATALOG"
                ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Package size={14} /> Finished Goods ({unifiedProducts.length})
          </button>
          <button
            onClick={() => setViewTab("BATCHES")}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap",
              viewTab === "BATCHES"
                ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Clock size={14} /> Batch Expiry Ledger ({batches.length})
          </button>
        </div>

        {/* Right: Search, Filter chips, and View toggle */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1 justify-end min-w-0">
          {/* Search Bar */}
          <div className="relative flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full sm:w-64 md:w-72 shadow-sm">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product, SKU..."
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-zinc-300 outline-none w-full placeholder:text-slate-400"
            />
            {searchTerm && (
              <X
                size={14}
                className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                onClick={() => setSearchTerm("")}
              />
            )}
          </div>

          {viewTab === "CATALOG" && (
            <>
              {/* Demand / Status Filter Pills */}
              <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar max-w-full">
                {[
                  { id: "ALL", label: "All" },
                  { id: "IN_STOCK", label: "In Stock" },
                  { id: "LOW_STOCK", label: "Low Stock" },
                  { id: "OUT_OF_STOCK", label: "Out of Stock" },
                  { id: "IN_TRANSIT", label: "In Transit" },
                  { id: "PENDING_DEMAND", label: "Pending" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStockFilter(f.id as any)}
                    className={clsx(
                      "px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0",
                      stockFilter === f.id
                        ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* View Mode Switcher (Grid vs Table) */}
              <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setViewMode("TABLE")}
                  className={clsx(
                    "p-1.5 rounded-md transition-all",
                    viewMode === "TABLE" ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                  title="Dense Ledger Table View"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode("GRID")}
                  className={clsx(
                    "p-1.5 rounded-md transition-all",
                    viewMode === "GRID" ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                  title="Cards Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </>
          )}

          {viewTab === "BATCHES" && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={productFilter}
                onChange={(e) => handleProductFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-zinc-400 outline-none shadow-sm"
              >
                <option value="">All Products</option>
                {unifiedProducts.map((p) => (
                  <option key={p.sku || p.id} value={p.id}>{p.name} {p.sku && p.sku !== "N/A" ? `(${p.sku})` : ""}</option>
                ))}
              </select>

              <div className="flex gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setExpiryFilter(t.key)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
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
      </div>

      {/* ── View 1: Catalog View (Dense Table or Cards Grid) ── */}
      {viewTab === "CATALOG" && (
        <div className="space-y-6">
          {loading ? (
            <div className="py-24 text-center text-slate-400 font-bold text-xs animate-pulse">
              Syncing Branch Finished Goods Inventory...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 space-y-3 shadow-sm">
              <Package size={48} strokeWidth={1} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-gray-700 dark:text-slate-300">No products found matching filters</p>
              <p className="text-xs text-gray-400">Products inwarded by your branch or available in the catalog will appear here.</p>
              {(searchTerm || stockFilter !== "ALL") && (
                <button
                  onClick={() => { setSearchTerm(""); setStockFilter("ALL"); }}
                  className="mt-2 text-xs font-bold text-orange-500 underline uppercase tracking-wider"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : viewMode === "TABLE" ? (
            /* ── DENSE LEDGER TABLE VIEW ── */
            <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full min-w-0">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-left table-auto min-w-[800px]">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">
                    <tr>
                      <th className="px-5 py-3.5">Finished Product Specification</th>
                      <th className="px-4 py-3.5 text-center">Available Stock</th>
                      <th className="px-4 py-3.5 text-center">Reserved</th>
                      <th className="px-4 py-3.5 text-center">In-Transit</th>
                      <th className="px-4 py-3.5 text-center">Pending Demand</th>
                      <th className="px-4 py-3.5 text-center">Stock Status</th>
                      <th className="w-[140px] px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {filteredProducts.map((item) => {
                      const isOutOfStock = item.availableStock <= 0;
                      const isLowStock = item.availableStock > 0 && item.availableStock <= item.minimumStock;
                      const isInTransitOnly = isOutOfStock && item.inTransitStock > 0;

                      return (
                        <tr key={item.id} className="group hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-all">
                          {/* Product Spec */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs shrink-0">
                                <Package size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                                  {item.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                                    SKU: {item.sku}
                                  </span>
                                  {item.packSize && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-slate-500 uppercase">
                                      {item.packSize}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    · Unit: {item.unit}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Available Stock */}
                          <td className="px-4 py-4 text-center font-bold">
                            <span className={clsx(
                              "text-sm font-black",
                              item.availableStock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                            )}>
                              {item.availableStock}{" "}
                              <span className="text-[10px] font-semibold opacity-70 uppercase">{item.unit}</span>
                            </span>
                          </td>

                          {/* Reserved */}
                          <td className="px-4 py-4 text-center">
                            <span className={clsx(
                              "font-bold text-xs",
                              item.reservedStock > 0 ? "text-purple-600 dark:text-purple-400" : "text-slate-400"
                            )}>
                              {item.reservedStock}{" "}
                              <span className="text-[10px] font-normal opacity-70 uppercase">{item.unit}</span>
                            </span>
                          </td>

                          {/* In-Transit */}
                          <td className="px-4 py-4 text-center">
                            <span className={clsx(
                              "font-bold text-xs",
                              item.inTransitStock > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                            )}>
                              {item.inTransitStock}{" "}
                              <span className="text-[10px] font-normal opacity-70 uppercase">{item.unit}</span>
                            </span>
                          </td>

                          {/* Pending Demand */}
                          <td className="px-4 py-4 text-center">
                            <span className={clsx(
                              "font-bold text-xs",
                              item.pendingDemand > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                            )}>
                              {item.pendingDemand}{" "}
                              <span className="text-[10px] font-normal opacity-70 uppercase">{item.unit}</span>
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-4 text-center">
                            {isInTransitOnly ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
                                In Transit
                              </span>
                            ) : isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10">
                                Out of Stock
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                                In Stock
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => {
                                setRequestModalProduct(item.rawProduct || item);
                                setRequestQty(10);
                                setRequestRequiredBy("");
                                setRequestNote("");
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-orange-500/20 transition-all active:scale-95 whitespace-nowrap"
                            >
                              <Plus size={13} strokeWidth={2.5} /> Request HQ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── GRID CARDS VIEW ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredProducts.map((prod) => {
                const isOutOfStock = prod.availableStock <= 0;
                const isLowStock = prod.availableStock > 0 && prod.availableStock <= prod.minimumStock;

                return (
                  <div
                    key={prod.id}
                    className="group bg-white dark:bg-card border border-slate-200/80 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                  >
                    <div>
                      {/* Product Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-13 h-13 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-lg shrink-0">
                          <Package size={24} />
                        </div>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                          {prod.category || "Finished Good"}
                        </span>
                      </div>

                      {/* Product Name & SKU */}
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                          {prod.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
                          SKU: {prod.sku} · Unit: <strong>{prod.unit}</strong>
                          {prod.packSize && ` · ${prod.packSize}`}
                        </p>
                      </div>

                      {/* Stock Breakdown */}
                      <div className="mt-5 space-y-2 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-slate-400 font-bold">Branch Available Stock:</span>
                          <span className={clsx(
                            "font-black text-sm",
                            prod.availableStock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                          )}>
                            {prod.availableStock} {prod.unit}
                          </span>
                        </div>

                        {prod.reservedStock > 0 && (
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-purple-500 font-bold">Reserved for Orders:</span>
                            <span className="font-black text-purple-600 dark:text-purple-400">
                              {prod.reservedStock} {prod.unit}
                            </span>
                          </div>
                        )}

                        {prod.inTransitStock > 0 && (
                          <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-center">
                            <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase">In-Transit Supply from HQ</p>
                            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {prod.inTransitStock} {prod.unit}
                            </p>
                          </div>
                        )}

                        {prod.pendingDemand > 0 && (
                          <div className="flex items-center justify-between text-xs py-1">
                            <span className="text-amber-500 font-bold">Pending HQ Demand:</span>
                            <span className="font-black text-amber-600 dark:text-amber-400">
                              {prod.pendingDemand} {prod.unit}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                      <button
                        onClick={() => {
                          setRequestModalProduct(prod.rawProduct || prod);
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
                          <span className="text-[10px] font-bold text-slate-400 ml-1.5 uppercase">{formatUnit(batch.product?.unit)}</span>
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
                Unit: {formatUnit(requestModalProduct.unit)}
              </span>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                Required Quantity ({formatUnit(requestModalProduct.unit)}) *
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
