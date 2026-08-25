"use client";

import { useState, useEffect } from "react";
import { X,
  Package, AlertTriangle,
  RefreshCw, Scale, Search, Layers, Box, Play
} from "lucide-react";
import { clsx } from "clsx";
import { productionApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

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
  product: {
    name: string;
    sku: string;
    unit: string;
  };
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

  const handleSizeValueChange = (val: string) => {
    setSizeValue(val);
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      setPacketSize(`${val}${sizeUnit}`);
    } else {
      setPacketSize("");
    }
  };

  const handleSizeUnitChange = (unit: string) => {
    setSizeUnit(unit);
    if (sizeValue && !isNaN(Number(sizeValue)) && Number(sizeValue) > 0) {
      setPacketSize(`${sizeValue}${unit}`);
    } else {
      setPacketSize("");
    }
  };

  const handleSelectPreset = (val: string, unit: string) => {
    setSizeValue(val);
    setSizeUnit(unit);
    setPacketSize(`${val}${unit}`);
  };

  useEffect(() => {
    async function initData() {
      try {
        const fRes = await franchiseApi.getAll();
        const list = fRes.data || [];
        setFranchises(list);
        if (list.length > 0) {
          // Deterministic default: open at HQ if one is configured, rather
          // than whichever franchise the DB happened to return first.
          const hq = list.find((f: any) => f.isHQ);
          const fallback = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setSelectedFranchiseId((hq || fallback).id);
        }
      } catch (err) {
        toast.error("Failed to load franchises");
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

  // Compute total bulk stock conversion needed
  const parseWeight = (size: string, baseUnit?: string): number => {
    if (!size) return 0;
    const match = size.trim().match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)?$/i);
    if (!match) return 1.0;
    const val = parseFloat(match[1]);
    if (isNaN(val) || val <= 0) return 0;
    const unit = (match[3] || '').toLowerCase();
    const batchUnit = (baseUnit || '').toLowerCase();

    // If batch base unit is g or ml
    if (batchUnit === 'g' || batchUnit === 'ml') {
      if (unit === 'kg' || unit === 'l') return val * 1000;
      return val;
    }

    if (unit === 'g' || unit === 'ml' || unit === 'gm' || unit === 'gms' || unit === 'gram' || unit === 'grams') {
      return val / 1000;
    }
    return val;
  };

  const unitMultiplier = parseWeight(packetSize, selectedBatch?.product?.unit);
  const totalWeightNeeded = quantityPackets * unitMultiplier;
  // IMPORTANT: approvedQty is the ceiling for packaging — never total produced quantity.
  // This ensures rejected QC quantities never become packagable.
  const availableBulk = selectedBatch
    ? Math.max(0, (selectedBatch.approvedQty ?? 0) - (selectedBatch.packagedQty || 0))
    : 0;
  const maxPackets = unitMultiplier > 0 ? Math.floor(availableBulk / unitMultiplier) : 0;
  const bulkRemaining = availableBulk - totalWeightNeeded;

  const handlePackageRun = async () => {
    if (!selectedBatch) return;
    if (quantityPackets <= 0) {
      toast.error("Packet quantity must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      // This only creates an AWAITING_CONFIRMATION ticket — bulk stock and
      // Finished Goods are untouched until the operator completes physical
      // packaging/labeling and submits Confirm Packaging.
      await productionApi.packageBatch(selectedBatch.id, {
        packetSize,
        quantityPackets
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
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-end gap-3">

        <select
          value={selectedFranchiseId}
          onChange={(e) => setSelectedFranchiseId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 outline-none focus:border-[#f58220]"
        >
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left 2 Columns: Batches list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#f58220]" />
                  Production Outputs Awaiting Conversion
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search batches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                  />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredBatches.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  No production batches available for packaging.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                        <th className="text-left px-4 py-3">Batch Details</th>
                        <th className="text-center px-4 py-3">QC Status</th>
                        <th className="text-right px-4 py-3">Yield Qty</th>
                        <th className="text-right px-4 py-3">Packaged Qty</th>
                        <th className="text-right px-4 py-3">Balance Qty</th>
                        <th className="text-center px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
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
                          <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{batch.product?.name}</div>
                              <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
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
                            <td className="px-4 py-3 text-right text-gray-700">
                              {approvedQty} <span className="text-xs text-gray-400">{batch.product?.unit || 'KG'}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {packagedQty} <span className="text-xs text-gray-400">{batch.product?.unit || 'KG'}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                              {balanceQty.toFixed(2)} <span className="text-xs text-gray-400 font-normal">{batch.product?.unit || 'KG'}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isFullyPackaged ? (
                                <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                  Completed
                                </span>
                              ) : isRecalled ? (
                                <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
                                  Recalled
                                </span>
                              ) : (
                                <button
                                  disabled={!canPackage}
                                  onClick={() => {
                                    setSelectedBatch(batch);
                                    const defaultUnit = (batch.product?.unit || "KG").toUpperCase() === "L" || (batch.product?.unit || "KG").toUpperCase() === "ML" ? "ml" : "g";
                                    setSizeValue("500");
                                    setSizeUnit(defaultUnit);
                                    setPacketSize(`500${defaultUnit}`);
                                    setQuantityPackets(10);
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
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-[#f58220]">Retail Conversion</span>
                    <h3 className="text-sm font-bold text-gray-800 mt-0.5">
                      {selectedBatch.product?.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBatch(null);
                      setPacketSize("");
                      setSizeValue("");
                    }}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Available approved bulk</span>
                    {/* approvedQty minus already packaged — never total produced quantity */}
                    <span className="text-gray-800 font-semibold">{availableBulk} {selectedBatch.product?.unit || 'KG'}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-500">Target Pack Size</label>
                      {packetSize && (
                        <span className="text-[11px] font-semibold text-[#f58220] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
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
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
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
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white font-medium"
                        />
                      </div>
                      <select
                        value={sizeUnit}
                        onChange={(e) => handleSizeUnitChange(e.target.value)}
                        className="w-32 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white font-semibold cursor-pointer"
                      >
                        <option value="g">G (Grams)</option>
                        <option value="kg">KG (Kilograms)</option>
                        <option value="ml">ML (Milliliters)</option>
                        <option value="l">L (Liters)</option>
                        <option value="pcs">PCS (Pieces)</option>
                        <option value="unit">Unit (Box/Pkt)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-500">Quantity of Packets</label>
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
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Maximum possible with available bulk: {maxPackets} packets
                    </p>
                  </div>

                  {/* Planned conversion — nothing here is applied yet. Bulk is only
                      deducted and Finished Goods only created once this run is
                      confirmed on the Confirm Packaging screen. */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-500 border-b border-gray-200 pb-2">
                      <span>Packaging Plan (Pending Confirmation)</span>
                      <Scale className="h-3.5 w-3.5 text-[#f58220]" />
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bulk Stock to Deduct on Confirm</span>
                        <span className="text-rose-600 font-semibold">{totalWeightNeeded.toFixed(2)} {selectedBatch.product?.unit || "KG"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bulk Stock Remaining</span>
                        <span className="text-gray-700 font-semibold">{bulkRemaining.toFixed(2)} {selectedBatch.product?.unit || "KG"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Planned Packets</span>
                        <span className="text-emerald-600 font-semibold">{quantityPackets} packets</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePackageRun}
                    disabled={submitting || !packetSize || totalWeightNeeded > availableBulk}
                    className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
                    Start Packaging &amp; Print Stickers
                  </button>

                  {!packetSize && (
                    <div className="flex gap-2 text-xs text-amber-600 font-medium p-2.5 border border-amber-200 bg-amber-50 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Select a target pack size to continue.</span>
                    </div>
                  )}

                  {packetSize && totalWeightNeeded > availableBulk && (
                    <div className="flex gap-2 text-xs text-rose-600 font-medium p-2.5 border border-rose-200 bg-rose-50 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Insufficient bulk stock to fulfill this quantity of packs.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 rounded-lg text-center p-6 bg-white">
                <Box className="h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">Select a batch to configure conversions</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
