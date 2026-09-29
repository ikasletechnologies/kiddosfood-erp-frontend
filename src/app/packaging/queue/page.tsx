"use client";

import { useState, useEffect } from "react";
import {
  X,
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
  const [plans, setPlans] = useState<any[]>([]);
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
  const formWeightNeeded = packetSize && quantityPackets > 0 ? quantityPackets * unitMultiplier : 0;
  
  // IMPORTANT: approvedQty is the ceiling for packaging — never total produced quantity.
  // This ensures rejected QC quantities never become packagable.
  const pendingWeight = (selectedBatch?.packagings || [])
    .filter((p: any) => p.status === 'AWAITING_CONFIRMATION')
    .reduce((sum: number, p: any) => sum + (p.totalWeight || 0), 0);
  const totalAvailableBulk = selectedBatch
    ? Math.max(0, (selectedBatch.approvedQty ?? 0) - (selectedBatch.packagedQty || 0) - pendingWeight)
    : 0;

  const queuedWeight = plans.reduce((sum, p) => sum + p.totalWeightNeeded, 0);
  const remainingAfterQueue = totalAvailableBulk - queuedWeight;
  const maxPackets = unitMultiplier > 0 ? Math.floor(remainingAfterQueue / unitMultiplier) : 0;
  
  const handleAddPlan = () => {
    if (!packetSize) {
      toast.error("Select a target pack size first");
      return;
    }
    if (quantityPackets <= 0) {
      toast.error("Packet quantity must be greater than zero");
      return;
    }
    if (productMode === "existing" && !selectedProductId) {
      toast.error("Please select a finished good from the list, or switch to Create New Good");
      return;
    }
    if (productMode === "create_new" && !newProductName.trim()) {
      toast.error("Please enter a name for the new finished good product");
      return;
    }
    if (formWeightNeeded > remainingAfterQueue) {
      toast.error("Insufficient bulk stock to add this configuration to queue");
      return;
    }
    
    setPlans([...plans, {
      id: Date.now().toString(),
      packetSize,
      quantityPackets,
      unitMultiplier,
      totalWeightNeeded: formWeightNeeded,
      productMode,
      selectedProductId,
      newProductName,
      newProductSku,
      newProductPrice,
      productNameDisplay: productMode === "existing" 
        ? products.find(p => p.id === selectedProductId)?.name || "Unknown Product"
        : newProductName
    }]);
    
    // reset form fields
    setPacketSize("");
    setSizeValue("");
    setQuantityPackets(10);
  };

  const handlePackageRun = async () => {
    if (!selectedBatch) return;
    if (plans.length === 0) {
      toast.error("Please add at least one configuration to the queue first.");
      return;
    }

    setSubmitting(true);
    try {
      // Create an AWAITING_CONFIRMATION ticket for each queued plan
      for (const plan of plans) {
        await productionApi.packageBatch(selectedBatch.id, {
          packetSize: plan.packetSize,
          quantityPackets: plan.quantityPackets,
          productId: plan.productMode === "existing" ? (plan.selectedProductId || undefined) : undefined,
          newProduct: plan.productMode === "create_new" ? {
            name: plan.newProductName.trim(),
            sku: plan.newProductSku.trim() || undefined,
            basePrice: Number(plan.newProductPrice) || 0,
          } : undefined,
        });
      }
      toast.success(`Packaging started for ${plans.length} configuration(s).`);
      setSelectedBatch(null);
      setPlans([]);
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
    (b.product?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelectedBatchRecalled = selectedBatch?.recall?.status === 'IN_PROGRESS';
  const selectedBatchApprovedQty = selectedBatch?.approvedQty ?? 0;
  const selectedBatchPackagedQty = selectedBatch?.packagedQty ?? 0;
  const selectedBatchRemaining = selectedBatchApprovedQty - selectedBatchPackagedQty;
  const isFormEligible = Boolean(selectedBatch && !isSelectedBatchRecalled && selectedBatchRemaining > 0.001);

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Conversion form panel */}
          <div className="lg:col-span-7">
            {isFormEligible ? (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start mb-1 px-1">
                  <div>
                    <span className="text-[10px] font-bold text-[#f58220] uppercase tracking-wider">Retail Conversion</span>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mt-0.5">
                      {selectedBatch?.product?.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBatch(null);
                      setPacketSize("");
                      setSizeValue("");
                    }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Step 1: Product Selection */}
                <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gray-300 dark:bg-gray-600" />
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-white mb-5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs">1</span>
                    FINISHED GOOD PRODUCT
                  </div>

                  <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-lg text-sm font-semibold mb-5">
                    <button
                      type="button"
                      onClick={() => setProductMode("existing")}
                      className={clsx(
                        "py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        productMode === "existing"
                          ? "bg-white dark:bg-card text-gray-800 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-900"
                      )}
                    >
                      <span>Link Existing</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductMode("create_new")}
                      className={clsx(
                        "py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        productMode === "create_new"
                          ? "bg-white dark:bg-card text-gray-800 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-900"
                      )}
                    >
                      <span>Create New Good</span>
                    </button>
                  </div>

                  {productMode === "existing" ? (
                    <div>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium text-gray-800 dark:text-white outline-none focus:border-gray-400 bg-white dark:bg-[#13151f]"
                      >
                        <option value="" className="dark:bg-card"> Select Finished Good</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} className="dark:bg-card">
                            {p.name} {p.sku ? `(${p.sku})` : ""} {p.basePrice ? `· ₹${p.basePrice}` : ""}
                          </option>
                        ))}
                      </select>
                      {products.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          No products found in catalogue. Switch to &quot;Create New Good&quot; above to create one automatically.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 p-5 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">
                          New Product Name
                        </label>
                        <input
                          type="text"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="e.g. Dosa Batter (1KG)"
                          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-gray-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">
                            SKU Code
                          </label>
                          <input
                            type="text"
                            value={newProductSku}
                            onChange={(e) => setNewProductSku(e.target.value)}
                            placeholder="Auto-generated"
                            className="w-full font-mono border border-gray-200 dark:border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">
                            Selling Price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={newProductPrice || ""}
                            onChange={(e) => setNewProductPrice(Number(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full font-mono border border-gray-200 dark:border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-gray-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Target Pack */}
                <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#f58220]" />
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-white">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f58220]/10 text-[#f58220] text-xs">2</span>
                      PACK SIZE & QUANTITY
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-100 dark:border-emerald-500/20">
                      Available: {totalAvailableBulk} {selectedBatch?.production?.recipe?.yieldUnit || 'KG'}
                    </span>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Target Pack Size</label>
                        {packetSize && (
                          <span className="text-xs font-bold text-[#f58220] bg-orange-50 dark:bg-orange-500/10 px-2.5 py-0.5 rounded border border-orange-200 dark:border-orange-500/20">
                            {sizeValue} {sizeUnit.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Quick Preset Buttons */}
                      <div className="flex flex-wrap gap-2 mb-3">
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
                                "px-3 py-1.5 text-[13px] font-semibold rounded-md border transition-all active:scale-95",
                                isSelected
                                  ? "bg-[#f58220] text-white border-[#f58220] shadow-sm"
                                  : "bg-gray-50 dark:bg-[#13151f] text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
                              )}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Number Input + Unit Selector */}
                      <div className="flex gap-2.5">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            placeholder="Enter size (e.g. 250)"
                            value={sizeValue}
                            onChange={(e) => handleSizeValueChange(e.target.value)}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] font-medium"
                          />
                        </div>
                        <select
                          value={sizeUnit}
                          onChange={(e) => handleSizeUnitChange(e.target.value)}
                          className="w-32 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] font-semibold cursor-pointer"
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
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Quantity of Packets</label>
                        <button
                          type="button"
                          onClick={() => setQuantityPackets(Math.max(1, maxPackets))}
                          className="text-xs font-bold text-[#f58220] hover:text-[#e8740e] bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded"
                        >
                          Use All Bulk ({maxPackets})
                        </button>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={quantityPackets || ""}
                        onChange={(e) => setQuantityPackets(Math.max(1, Number(e.target.value)))}
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleAddPlan}
                      disabled={!packetSize || formWeightNeeded > remainingAfterQueue}
                      className="w-full py-3.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-white rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border border-gray-200 dark:border-white/10 mt-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Configuration to Queue
                    </button>

                    {!packetSize && (
                      <div className="flex gap-2 text-sm text-amber-600 dark:text-amber-400 font-medium p-3.5 border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>Select a target pack size to continue.</span>
                      </div>
                    )}
                    {packetSize && formWeightNeeded > remainingAfterQueue && (
                      <div className="flex gap-2 text-sm text-rose-600 dark:text-rose-400 font-medium p-3.5 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>Insufficient bulk stock for this configuration.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Packaging Queue */}
                {plans.length > 0 && (
                  <div className="bg-white dark:bg-card rounded-xl border-2 border-[#f58220] p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#f58220]" />
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-white mb-5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f58220] text-white text-xs">3</span>
                      PACKAGING QUEUE ({plans.length})
                    </div>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-5">
                      {plans.map((p, i) => (
                        <div key={p.id} className="bg-orange-50/70 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 p-4 rounded-xl flex justify-between items-center relative group shadow-sm">
                          <div>
                            <div className="font-bold text-base text-gray-900 dark:text-white">
                              {p.quantityPackets}x <span className="text-[#f58220]">{p.packetSize}</span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-slate-400 max-w-[250px] truncate mt-1" title={p.productNameDisplay}>
                              {p.productNameDisplay} {p.productMode === 'create_new' ? '(New)' : ''}
                            </div>
                          </div>
                          <div className="text-right pr-2">
                            <div className="font-bold text-base text-gray-800 dark:text-slate-200">
                              -{p.totalWeightNeeded.toFixed(2)} <span className="text-xs font-normal text-gray-500">{selectedBatch?.production?.recipe?.yieldUnit || "KG"}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setPlans(plans.filter((plan: any) => plan.id !== p.id))}
                            className="absolute -top-2 -right-2 h-7 w-7 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/20 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-xl p-5 space-y-3 text-sm mb-5">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-slate-400 font-medium">Total Bulk to Deduct</span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold text-lg">{queuedWeight.toFixed(2)} <span className="text-sm font-medium">{selectedBatch?.production?.recipe?.yieldUnit || "KG"}</span></span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-white/10">
                        <span className="text-gray-800 dark:text-slate-300 font-bold">Remaining Balance</span>
                        <span className="text-gray-900 dark:text-white font-black text-xl">{remainingAfterQueue.toFixed(2)} <span className="text-sm font-medium">{selectedBatch?.production?.recipe?.yieldUnit || "KG"}</span></span>
                      </div>
                    </div>

                    <button
                      onClick={handlePackageRun}
                      disabled={submitting || plans.length === 0}
                      className="w-full py-4 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl font-black text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wide"
                    >
                      {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" fill="currentColor" />}
                      START PACKAGING ALL & PRINT
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-32 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-center p-8 bg-white dark:bg-card">
                <Box className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-400 dark:text-slate-400 mb-1">Select a Batch</h3>
                <p className="text-sm text-gray-400 dark:text-slate-500 max-w-xs">Choose a production batch from the list on the right to configure retail conversions.</p>
              </div>
            )}
          </div>

          {/* Right Column: Batches list (Card format) */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-140px)]">
              <div className="p-5 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] shrink-0">
                <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-4">
                  <Layers className="h-4 w-4 text-[#f58220]" />
                  Awaiting Conversion
                </h3>

                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search batches or products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 font-medium transition-colors"
                  />
                  {searchQuery && (
                    <X
                      size={16}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      onClick={() => setSearchQuery("")}
                    />
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex-1 flex justify-center items-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredBatches.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                    <Box className="h-6 w-6 text-gray-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                    No production batches available for packaging.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                  {filteredBatches.map((batch) => {
                    const badge = getPackagingBadge(batch);
                    const isRecalled = batch.recall?.status === 'IN_PROGRESS';
                    const isEligibleQcStatus = batch.qcStatus === 'APPROVED' || batch.qcStatus === 'PARTIALLY_APPROVED';
                    // Use approvedQty as the ceiling — rejected quantity must never be exposed
                    const approvedQty = batch.approvedQty ?? 0;
                    const packagedQty = batch.packagedQty ?? 0;
                    
                    const batchPendingWeight = (batch.packagings || [])
                      .filter((p: any) => p.status === 'AWAITING_CONFIRMATION')
                      .reduce((sum: number, p: any) => sum + (p.totalWeight || 0), 0);
                    
                    const isSelectedBatchList = selectedBatch?.id === batch.id;
                    const localQueued = isSelectedBatchList ? queuedWeight : 0;
                    
                    const effectivePackaged = packagedQty + batchPendingWeight + localQueued;
                    const balanceQty = Math.max(0, approvedQty - effectivePackaged);
                    const isFullyPackaged = batch.packagingStatus === 'PACKAGED' || (isEligibleQcStatus && balanceQty <= 0.001);
                    const canPackage = isEligibleQcStatus && !isRecalled && !isFullyPackaged;
                    
                    const isSelected = selectedBatch?.id === batch.id;

                    return (
                      <div 
                        key={batch.id} 
                        className={clsx(
                          "border rounded-xl p-4 flex flex-col gap-3 transition-all",
                          isSelected 
                            ? "bg-orange-50/30 dark:bg-orange-500/5 border-[#f58220] shadow-sm"
                            : "bg-white dark:bg-[#13151f] border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 shadow-sm"
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-gray-900 dark:text-white truncate" title={batch.product?.name}>{batch.product?.name}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mt-1">
                              <span>Batch: <span className="font-semibold text-gray-700 dark:text-slate-300">{batch.batchCode}</span></span>
                              <span className="text-[10px]">•</span>
                              <span>Exp: <span className="font-semibold text-gray-700 dark:text-slate-300">{batch.expiryDate ? format(new Date(batch.expiryDate), 'dd/MM/yyyy') : 'N/A'}</span></span>
                            </div>
                          </div>
                          <span className={clsx("shrink-0 px-2 py-1 rounded text-[10px] font-bold border", badge.color, badge.bg, badge.border)}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-2 border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mb-0.5">YIELD</span>
                            <div className="font-bold text-gray-800 dark:text-white">{approvedQty} <span className="font-normal text-[10px] text-gray-500">{batch.production?.recipe?.yieldUnit || 'KG'}</span></div>
                          </div>
                          <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-2 border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mb-0.5">PACKAGED</span>
                            <div className="font-bold text-gray-800 dark:text-white">{effectivePackaged > 0 ? effectivePackaged.toFixed(2) : 0} <span className="font-normal text-[10px] text-gray-500">{batch.production?.recipe?.yieldUnit || 'KG'}</span></div>
                          </div>
                          <div className={clsx(
                            "rounded-lg p-2 border flex flex-col items-center justify-center text-center",
                            balanceQty > 0 
                              ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30"
                              : "bg-gray-50 dark:bg-white/[0.02] border-gray-100 dark:border-white/5"
                          )}>
                            <span className={clsx("text-[10px] font-bold mb-0.5", balanceQty > 0 ? "text-[#f58220]" : "text-gray-500 dark:text-slate-400")}>BALANCE</span>
                            <div className="font-black text-gray-900 dark:text-white">{balanceQty.toFixed(2)} <span className="font-medium text-[10px] text-gray-500">{batch.production?.recipe?.yieldUnit || 'KG'}</span></div>
                          </div>
                        </div>

                        <div className="pt-1">
                          {isFullyPackaged ? (
                            <div className="w-full text-center py-2.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                              Completed
                            </div>
                          ) : isRecalled ? (
                            <div className="w-full text-center py-2.5 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                              Recalled
                            </div>
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
                                setPlans([]);
                                updateProductMapping(batch, initialSize, products);
                              }}
                              className={clsx(
                                "w-full py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all border",
                                isSelected 
                                  ? "bg-white dark:bg-[#13151f] text-[#f58220] border-[#f58220]"
                                  : "bg-[#f58220] hover:bg-[#e8740e] text-white border-transparent disabled:opacity-30 disabled:hover:bg-[#f58220]"
                              )}
                            >
                              {isSelected ? "Currently Configuring" : "Configure Conversion"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
