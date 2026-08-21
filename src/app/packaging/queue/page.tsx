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
  approvedQty: number;
  packagedQty: number;
  qcStatus: string;
  packagingStatus: string;
  expiryDate: string;
  product: {
    name: string;
    sku: string;
    unit: string;
  };
}

const QC_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  APPROVED: { label: "Pass", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  REJECTED: { label: "Fail", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
};
const DEFAULT_QC_BADGE = { label: "Hold (QC)", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };

export default function PackagingQueuePage() {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<ProductBatch | null>(null);

  // Form states
  const [packetSize, setPacketSize] = useState("500g");
  const [quantityPackets, setQuantityPackets] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function initData() {
      try {
        const fRes = await franchiseApi.getAll();
        setFranchises(fRes.data || []);
        if (fRes.data?.length > 0) {
          setSelectedFranchiseId(fRes.data[0].id);
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
  const parseWeight = (size: string): number => {
    const match = size.match(/^(\d+(\.\d+)?)\s*(g|kg|l|ml|pcs|unit)$/i);
    if (!match) return 1.0;
    const val = parseFloat(match[1]);
    const unit = match[3].toLowerCase();

    if (unit === 'g' || unit === 'ml') return val / 1000;
    return val;
  };

  const unitMultiplier = parseWeight(packetSize);
  const totalWeightNeeded = quantityPackets * unitMultiplier;

  const handlePackageRun = async () => {
    if (!selectedBatch) return;
    if (quantityPackets <= 0) {
      toast.error("Packet quantity must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      await productionApi.packageBatch(selectedBatch.id, {
        packetSize,
        quantityPackets
      });
      toast.success("Packaging conversion successful!");
      setSelectedBatch(null);
      loadBatches();
      // Redirect to label view to print
      window.location.href = "/packaging/labels";
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Error executing packaging run. Verify bulk stock.");
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
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Package className="h-5 w-5 text-[#f58220]" />
          Packaging Queue
        </h1>

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
                        <th className="text-center px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredBatches.map((batch) => {
                        const isApproved = batch.qcStatus === "APPROVED";
                        const badge = QC_BADGE[batch.qcStatus] || DEFAULT_QC_BADGE;

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
                              {batch.quantity} <span className="text-xs text-gray-400">{batch.product?.unit || "KG"}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {batch.packagedQty || 0} <span className="text-xs text-gray-400">{batch.product?.unit || "KG"}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                disabled={!isApproved}
                                onClick={() => setSelectedBatch(batch)}
                                className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-30 disabled:hover:bg-[#f58220]"
                              >
                                Package
                              </button>
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
            {selectedBatch ? (
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-[#f58220]">Retail Conversion</span>
                    <h3 className="text-sm font-bold text-gray-800 mt-0.5">
                      {selectedBatch.product?.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedBatch(null)}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Available approved bulk</span>
                    <span className="text-gray-800 font-semibold">{selectedBatch.quantity - (selectedBatch.packagedQty || 0)} {selectedBatch.product?.unit || "KG"}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Target Pack Size</label>
                    <select
                      value={packetSize}
                      onChange={(e) => setPacketSize(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    >
                      <option value="250g">250 G Packet</option>
                      <option value="500g">500 G Packet</option>
                      <option value="1kg">1.0 KG Packet</option>
                      <option value="200ml">200 ML Bottle</option>
                      <option value="500ml">500 ML Bottle</option>
                      <option value="1l">1.0 L Bottle</option>
                      <option value="1unit">1 Unit Box</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Quantity of Packets</label>
                    <input
                      type="number"
                      min="1"
                      value={quantityPackets || ""}
                      onChange={(e) => setQuantityPackets(Math.max(1, Number(e.target.value)))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    />
                  </div>

                  {/* Simulated conversions */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-500 border-b border-gray-200 pb-2">
                      <span>Audit Simulation</span>
                      <Scale className="h-3.5 w-3.5 text-[#f58220]" />
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Bulk Stock Deduct</span>
                        <span className="text-rose-600 font-semibold">-{totalWeightNeeded.toFixed(2)} {selectedBatch.product?.unit || "KG"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Retail Stock Added</span>
                        <span className="text-emerald-600 font-semibold">+{quantityPackets} packets</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePackageRun}
                    disabled={submitting || totalWeightNeeded > (selectedBatch.quantity - (selectedBatch.packagedQty || 0))}
                    className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
                    Package & Generate Labels
                  </button>

                  {totalWeightNeeded > (selectedBatch.quantity - (selectedBatch.packagedQty || 0)) && (
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
