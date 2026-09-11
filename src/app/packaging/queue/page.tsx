"use client";

import { useState, useEffect } from "react";
import { X,
  Package, AlertTriangle,
  RefreshCw, Scale, Search, Layers, Box, Play,
  Link2, Sparkles, Plus, CheckCircle2
} from "lucide-react";
import { clsx } from "clsx";
import { productionApi, franchiseApi, productsApi, productsFullApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { convertUnit } from "@/lib/unitConversion";
import { generateSKU } from "@/lib/utils/erp";

interface ProductBatch {
  id: string;
  batchCode: string;
  quantity: number;
  approvedQty: number | null;
  packagedQty: number | null;
  qcStatus: string;
  packagingStatus: string;
  expiryDate: string;
  recall?: { status: string } | null;
  packagings?: Array<{ id: string; status: string; totalWeight: number }>;
  product: {
    name: string;
    sku: string;
  };
  // The batch's real unit of measure lives on the recipe that produced it
  // (Recipe.yieldUnit), not on Product — Product has no unit field. This is
  // the same field Batch Registry and Complete Production already read.
  production?: {
    recipe?: {
      yieldUnit?: string | null;
    } | null;
  } | null;
}

// Derive a human-readable packaging status label and styling for a batch.
// Priority: recalled > fully packaged > QC not eligible > ready
function getPackagingBadge(batch: ProductBatch): { label: string; color: string; bg: string; border: string } {
  const isRecalled = batch.recall?.status === 'IN_PROGRESS';
  if (isRecalled) {
    return { label: 'Recalled — Packaging Blocked', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  }

  const approvedQty = batch.approvedQty ?? 0;
  const packagedQty = batch.packagedQty ?? 0;
  const remaining = approvedQty - packagedQty;
  const isEligibleQcStatus = batch.qcStatus === 'APPROVED' || batch.qcStatus === 'PARTIALLY_APPROVED';

  if (!isEligibleQcStatus) {
    if (batch.qcStatus === 'REJECTED') {
      return { label: 'QC Rejected', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
    }
    return { label: 'Pending QC', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  }

  if (remaining <= 0.001) {
    return { label: 'Fully Packaged', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
  }

  if (batch.qcStatus === 'PARTIALLY_APPROVED') {
    return { label: 'Partially Approved — Ready to Package', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
  }

  return { label: 'Ready to Package', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
}

export default function PackagingQueuePage() {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<ProductBatch | null>(null);

  // Form states
  const [packetSize, setPacketSize] = useState("");
  const [sizeValue, setSizeValue] = useState("");
  const [sizeUnit, setSizeUnit] = useState("g");
  const [quantityPackets, setQuantityPackets] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  // Finished Good / Sellable Product mapping states
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productMode, setProductMode] = useState<"existing" | "create_new">("existing");
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductPrice, setNewProductPrice] = useState<number>(0);

  const refreshProducts = async () => {
    try {
      const pRes = await productsApi.getAll();
      const pList = pRes.data?.data || pRes.data || [];
      setProducts(Array.isArray(pList) ? pList : []);
      return Array.isArray(pList) ? pList : [];
    } catch {
      return [];
    }
  };

  const updateProductMapping = (batch: ProductBatch | null, sizeStr: string, prodList = products) => {
    if (!batch) return;
    const batchProdName = batch.product?.name || "Product";
    const currentPackSize = sizeStr || "Pack";
    const suggestedName = `${batchProdName} (${currentPackSize})`;
    const generatedSku = generateSKU("FINISHED_GOOD", batchProdName, currentPackSize);

    setNewProductName(suggestedName);
    setNewProductSku(generatedSku);
    setNewProductPrice(0);

    const existingByName = prodList.find((p) => p.name?.toLowerCase() === suggestedName.toLowerCase());
    const existingBySku = prodList.find((p) => p.sku?.toLowerCase() === generatedSku.toLowerCase());

    if (existingByName) {
      setSelectedProductId(existingByName.id);
      setProductMode("existing");
    } else if (existingBySku) {
      setSelectedProductId(existingBySku.id);
      setProductMode("existing");
    } else {
      setSelectedProductId("");
      setProductMode(prodList.length > 0 ? "existing" : "create_new");
    }
  };

  const handleSizeValueChange = (val: string) => {
    setSizeValue(val);
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      const newSize = `${val}${sizeUnit}`;
      setPacketSize(newSize);
      updateProductMapping(selectedBatch, newSize, products);
    } else {
      setPacketSize("");
    }
  };

  const handleSizeUnitChange = (unit: string) => {
    setSizeUnit(unit);
    if (sizeValue && !isNaN(Number(sizeValue)) && Number(sizeValue) > 0) {
      const newSize = `${sizeValue}${unit}`;
      setPacketSize(newSize);
      updateProductMapping(selectedBatch, newSize, products);
    } else {
      setPacketSize("");
    }
  };

  const handleSelectPreset = (val: string, unit: string) => {
    setSizeValue(val);
    setSizeUnit(unit);
    const newSize = `${val}${unit}`;
    setPacketSize(newSize);
    updateProductMapping(selectedBatch, newSize, products);
  };

  useEffect(() => {
    async function initData() {
      try {
        const [fRes, pRes] = await Promise.all([
          franchiseApi.getAll(),
          productsApi.getAll()
        ]);
        const list = fRes.data || [];
        setFranchises(list);
        const pList = pRes.data?.data || pRes.data || [];
        setProducts(Array.isArray(pList) ? pList : []);

        if (list.length > 0) {
          // Deterministic default: open at HQ if one is configured, rather
          // than whichever franchise the DB happened to return first.
          const hq = list.find((f: any) => f.isHQ);
          const fallback = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setSelectedFranchiseId((hq || fallback).id);
        }
      } catch (err) {
        toast.error("Failed to load initial metadata");
      }
    }
    initData();
  }, []);

  const loadBatches = async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    try {
      const res = await productionApi.getAllBatches(selectedFranchiseId);
      setBatches(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch production batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [selectedFranchiseId]);

  // Compute total bulk stock conversion needed — delegates the actual
  // unit-conversion arithmetic to the canonical shared engine
  // (@businessgroupikasle/erp-units via the unitConversion shim) instead of
  // a local kg/g/l/ml table, so this preview always agrees with what the
  // server actually deducts (see production.service.ts's own parseWeight).
  const parseWeight = (size: string, baseUnit?: string): number => {
    if (!size) return 0;
    const match = size.trim().match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)?$/i);
    if (!match) return 1.0;
    const val = parseFloat(match[1]);
    if (isNaN(val) || val <= 0) return 0;
    const unit = match[3] || baseUnit || 'KG';
    return convertUnit(val, unit, baseUnit || 'KG');
  };

  const unitMultiplier = parseWeight(packetSize, selectedBatch?.production?.recipe?.yieldUnit || 'KG');
  const totalWeightNeeded = quantityPackets * unitMultiplier;
  // IMPORTANT: approvedQty is the ceiling for packaging — never total produced quantity.
  // This ensures rejected QC quantities never become packagable.
  const pendingWeight = (selectedBatch?.packagings || [])
    .filter((p: any) => p.status === 'AWAITING_CONFIRMATION')
    .reduce((sum: number, p: any) => sum + (p.totalWeight || 0), 0);
  const availableBulk = selectedBatch
    ? Math.max(0, (selectedBatch.approvedQty ?? 0) - (selectedBatch.packagedQty || 0) - pendingWeight)
    : 0;
  const maxPackets = unitMultiplier > 0 ? Math.floor(availableBulk / unitMultiplier) : 0;
  const bulkRemaining = availableBulk - totalWeightNeeded;

  const handlePackageRun = async () => {
    if (!selectedBatch) return;
    if (quantityPackets <= 0) {
      toast.error("Packet quantity must be greater than zero");
      return;
    }

    if (productMode === "create_new") {
      if (!newProductName.trim()) {
        toast.error("Please enter a name for the new finished good product");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (productMode === "create_new") {
        const createRes = await productsFullApi.create({
          name: newProductName.trim(),
          sku: newProductSku.trim() || undefined,
          basePrice: Number(newProductPrice) || 0,
          category: "FINISHED_GOOD",
          productType: "FINISHED_GOOD",
          is_menu_item: true,
          isVeg: true,
          isActive: true,
        });

        const createdProduct = createRes.data?.data || createRes.data;
        if (createdProduct?.id) {
          toast.success(`Created new finished good: ${newProductName}`);
          await refreshProducts();
        }
      }

      let targetProductId = selectedProductId;
      if (productMode === "create_new") {
        const createRes = await productsFullApi.create({
          name: newProductName.trim(),
          sku: newProductSku.trim() || undefined,
          basePrice: Number(newProductPrice) || 0,
          category: "FINISHED_GOOD",
          productType: "FINISHED_GOOD",
          is_menu_item: true,
          isVeg: true,
          isActive: true,
        });

        const createdProduct = createRes.data?.data || createRes.data;
        if (createdProduct?.id) {
          targetProductId = createdProduct.id;
          toast.success(`Created new finished good: ${newProductName}`);
          await refreshProducts();
        }
      }

      // This creates an AWAITING_CONFIRMATION ticket and reserves bulk stock.
      await productionApi.packageBatch(selectedBatch.id, {
        packetSize,
        quantityPackets,
        productId: targetProductId || undefined,
      });
      toast.success("Packaging started — print stickers, then confirm once packing is complete.");
      setSelectedBatch(null);
      loadBatches();
      // Redirect to label view to print
      window.location.href = "/packaging/labels";
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Error starting packaging run. Verify bulk stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBatches = batches.filter(b =>
    b.batchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      {/* Page Header Toolbar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex flex-col md:flex-row md:items-center justify-end gap-3">

        <select
          value={selectedFranchiseId}
          onChange={(e) => setSelectedFranchiseId(e.target.value)}
          className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#13151f] text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220]"
        >
          {franchises.map((f) => (
            <option key={f.id} value={f.id} className="dark:bg-card">
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left 2 Columns: Batches list */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#f58220]" />
                  Production Outputs Awaiting Conversion
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search batches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
                  {searchQuery && (
                    <X 
                      size={14} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                      onClick={() => setSearchQuery("")} 
                    />
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredBatches.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400 dark:text-slate-500">
                  No production batches available for packaging.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                        <th className="text-left px-4 py-3">Batch Details</th>
                        <th className="text-center px-4 py-3">QC Status</th>
                        <th className="text-right px-4 py-3">Yield Qty</th>
                        <th className="text-right px-4 py-3">Packaged Qty</th>
                        <th className="text-right px-4 py-3">Balance Qty</th>
                        <th className="text-center px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredBatches.map((batch) => {
                        const badge = getPackagingBadge(batch);
                        const isRecalled = batch.recall?.status === 'IN_PROGRESS';
                        const isEligibleQcStatus = batch.qcStatus === 'APPROVED' || batch.qcStatus === 'PARTIALLY_APPROVED';
                        // Use approvedQty as the ceiling — rejected quantity must never be exposed
                        const approvedQty = batch.approvedQty ?? 0;
                        const packagedQty = batch.packagedQty ?? 0;
                        const balanceQty = Math.max(0, approvedQty - packagedQty);
                        const isFullyPackaged = batch.packagingStatus === 'PACKAGED' || balanceQty <= 0.001;
                        const canPackage = isEligibleQcStatus && !isRecalled && !isFullyPackaged;

                        return (
                          <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800 dark:text-white">{batch.product?.name}</div>
                              <div className="flex gap-2 text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                <span>Code: {batch.batchCode}</span>
                                <span>•</span>
                                <span>Exp: {batch.expiryDate ? format(new Date(batch.expiryDate), 'dd/MM/yyyy') : 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", badge.color, badge.bg, badge.border)}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                              {approvedQty} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || 'KG'}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">
                              {packagedQty} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || 'KG'}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-white">
                              {balanceQty.toFixed(2)} <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">{batch.production?.recipe?.yieldUnit || 'KG'}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isFullyPackaged ? (
                                <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                                  Completed
                                </span>
                              ) : isRecalled ? (
                                <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                                  Recalled
                                </span>
                              ) : (
                                <button
                                  disabled={!canPackage}
                                  onClick={() => {
                                    setSelectedBatch(batch);
                                    const batchUnit = batch.production?.recipe?.yieldUnit || "KG";
                                    const defaultUnit = batchUnit.toUpperCase() === "L" || batchUnit.toUpperCase() === "ML" ? "ml" : "g";
                                    setSizeValue("500");
                                    setSizeUnit(defaultUnit);
                                    const initialSize = `500${defaultUnit}`;
                                    setPacketSize(initialSize);
                                    setQuantityPackets(10);
                                    updateProductMapping(batch, initialSize, products);
                                  }}
                                  className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-30 disabled:hover:bg-[#f58220]"
                                >
                                  Package
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Column: Conversion form panel */}
          <div className="lg:col-span-1">
            {selectedBatch && (() => {
              const isRecalled = selectedBatch.recall?.status === 'IN_PROGRESS';
              const approvedQty = selectedBatch.approvedQty ?? 0;
              const packagedQty = selectedBatch.packagedQty ?? 0;
              const remaining = approvedQty - packagedQty;
              const isFormEligible = !isRecalled && remaining > 0.001;
              return isFormEligible;
            })() ? (
              <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-[#f58220]">Retail Conversion</span>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                      {selectedBatch.product?.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBatch(null);
                      setPacketSize("");
                      setSizeValue("");
                    }}
                    className="text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  {/* 1. Finished Good / Sellable Product Mapping Area */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-800 dark:text-white">
                      Finished Good / Sellable Product
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-lg text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setProductMode("existing")}
                        className={clsx(
                          "py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          productMode === "existing"
                            ? "bg-white dark:bg-card text-[#f58220] shadow-xs"
                            : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
                        )}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span>Link Existing</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductMode("create_new")}
                        className={clsx(
                          "py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          productMode === "create_new"
                            ? "bg-white dark:bg-card text-[#f58220] shadow-xs"
                            : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#f58220]" />
                        <span>Create New Good</span>
                      </button>
                    </div>

                    {productMode === "existing" ? (
                      <div>
                        <select
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                        >
                          <option value="" className="dark:bg-card">-- Select Finished Good / SKU --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id} className="dark:bg-card">
                              {p.name} {p.sku ? `(${p.sku})` : ""} {p.basePrice ? `· ₹${p.basePrice}` : ""}
                            </option>
                          ))}
                        </select>
                        {products.length === 0 && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            No products found in catalogue. Switch to &quot;Create New Good&quot; above to create one automatically.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 p-3 bg-orange-50/40 dark:bg-orange-500/5 rounded-lg border border-orange-200 dark:border-orange-500/20">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                            New Product Name *
                          </label>
                          <input
                            type="text"
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            placeholder="e.g. Dosa Batter (1KG)"
                            className="w-full border border-gray-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-xs text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                              SKU Code
                            </label>
                            <input
                              type="text"
                              value={newProductSku}
                              onChange={(e) => setNewProductSku(e.target.value)}
                              placeholder="Auto-generated"
                              className="w-full font-mono border border-gray-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-xs text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                              Selling Price (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={newProductPrice || ""}
                              onChange={(e) => setNewProductPrice(Number(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full font-mono border border-gray-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-xs text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">
                          ✨ Will automatically create this sellable finished good in your catalog for downstream inventory &amp; POS sales.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 2. Retail Conversion Section */}
                  <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 dark:text-white">Retail Conversion</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        Available: <strong className="text-gray-800 dark:text-white">{availableBulk} {selectedBatch.production?.recipe?.yieldUnit || 'KG'}</strong>
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400">Target Pack Size</label>
                        {packetSize && (
                          <span className="text-[11px] font-semibold text-[#f58220] bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-500/20">
                            {sizeValue} {sizeUnit.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Quick Preset Buttons */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {[
                          { label: "250g", val: "250", unit: "g" },
                          { label: "500g", val: "500", unit: "g" },
                          { label: "1kg", val: "1", unit: "kg" },
                          { label: "2kg", val: "2", unit: "kg" },
                          { label: "5kg", val: "5", unit: "kg" },
                          { label: "200ml", val: "200", unit: "ml" },
                          { label: "500ml", val: "500", unit: "ml" },
                          { label: "1L", val: "1", unit: "l" },
                          { label: "1 Unit", val: "1", unit: "unit" },
                        ].map((preset) => {
                          const isSelected = sizeValue === preset.val && sizeUnit.toLowerCase() === preset.unit.toLowerCase();
                          return (
                            <button
                              key={`${preset.val}${preset.unit}`}
                              type="button"
                              onClick={() => handleSelectPreset(preset.val, preset.unit)}
                              className={clsx(
                                "px-2 py-1 text-[11px] font-semibold rounded border transition-all active:scale-95",
                                isSelected
                                  ? "bg-[#f58220] text-white border-[#f58220] shadow-xs"
                                  : "bg-white dark:bg-[#13151f] text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20"
                              )}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Number Input + Unit Selector */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            placeholder="Enter size (e.g. 250)"
                            value={sizeValue}
                            onChange={(e) => handleSizeValueChange(e.target.value)}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] font-medium"
                          />
                        </div>
                        <select
                          value={sizeUnit}
                          onChange={(e) => handleSizeUnitChange(e.target.value)}
                          className="w-32 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] font-semibold cursor-pointer"
                        >
                          <option value="g" className="dark:bg-card">G (Grams)</option>
                          <option value="kg" className="dark:bg-card">KG (Kilograms)</option>
                          <option value="ml" className="dark:bg-card">ML (Milliliters)</option>
                          <option value="l" className="dark:bg-card">L (Liters)</option>
                          <option value="pcs" className="dark:bg-card">PCS (Pieces)</option>
                          <option value="unit" className="dark:bg-card">Unit (Box/Pkt)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400">Quantity of Packets</label>
                        <button
                          type="button"
                          onClick={() => setQuantityPackets(Math.max(1, maxPackets))}
                          className="text-[11px] font-semibold text-[#f58220] hover:text-[#e8740e]"
                        >
                          Use All Bulk ({maxPackets})
                        </button>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={quantityPackets || ""}
                        onChange={(e) => setQuantityPackets(Math.max(1, Number(e.target.value)))}
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                      />
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                        Maximum possible with available bulk: {maxPackets} packets
                      </p>
                    </div>
                  </div>

                  {/* Planned conversion */}
                  <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/5 pb-2">
                      <span>Packaging Plan (Pending Confirmation)</span>
                      <Scale className="h-3.5 w-3.5 text-[#f58220]" />
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Bulk Stock to Deduct on Confirm</span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{totalWeightNeeded.toFixed(2)} {selectedBatch.production?.recipe?.yieldUnit || "KG"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Bulk Stock Remaining</span>
                        <span className="text-gray-700 dark:text-slate-300 font-semibold">{bulkRemaining.toFixed(2)} {selectedBatch.production?.recipe?.yieldUnit || "KG"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Planned Packets</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{quantityPackets} packets</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePackageRun}
                    disabled={submitting || !packetSize || totalWeightNeeded > availableBulk}
                    className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
                    Start Packaging &amp; Print Stickers
                  </button>

                  {!packetSize && (
                    <div className="flex gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium p-2.5 border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Select a target pack size to continue.</span>
                    </div>
                  )}

                  {packetSize && totalWeightNeeded > availableBulk && (
                    <div className="flex gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium p-2.5 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Insufficient bulk stock to fulfill this quantity of packs.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-center p-6 bg-white dark:bg-card">
                <Box className="h-8 w-8 text-gray-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-gray-400 dark:text-slate-500">Select a batch to configure conversions</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
