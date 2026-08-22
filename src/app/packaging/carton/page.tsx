"use client";

import { useState, useEffect, useCallback } from "react";
import { X,
  Package, Search, CheckCircle2, Box, Layers,
  Barcode, ArrowRight, Printer, Plus
} from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api/base";
import { cartonApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

interface Batch {
  id: string;
  batchCode: string;
  productName: string;
  remainingQty: number;
  unit: string;
  productionDate: string;
  franchiseId?: string;
}

interface CartonLot {
  id: string;
  cartonCode: string;
  totalUnits: number;
  unitsPerCarton: number;
  cartonCount: number;
  createdAt: string;
  batch?: { batchCode?: string };
}

export default function CartonPackingPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [cartonConfig, setCartonConfig] = useState({
    cartonSize: "Large (48 units)",
    unitsPerCarton: 48,
    cartonCount: 1,
    weightPerCarton: 12.5,
  });
  const [isPacking, setIsPacking] = useState(false);
  const [packedLog, setPackedLog] = useState<CartonLot[]>([]);
  const { showToast } = useToast();

  const fetchBatches = useCallback(async () => {
    try {
      const res = await api.get("/api/production/batches");
      const data = (res.data || [])
        .filter((b: any) => b.qcStatus === "APPROVED" && b.status === "COMPLETED")
        .map((b: any) => ({
          id: b.id,
          batchCode: b.batchCode || b.id?.slice(-6),
          productName: b.product?.name || b.recipe?.name || "Unknown Product",
          remainingQty: Math.max(0, (b.approvedQty || 0) - (b.cartonedQty || 0)),
          unit: b.product?.unit || "units",
          productionDate: b.createdAt,
          franchiseId: b.franchiseId,
        }))
        // Only show batches that still have something left to carton
        .filter((b: Batch) => b.remainingQty > 0);
      setBatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCartons = useCallback(async () => {
    try {
      const res = await cartonApi.getAll();
      setPackedLog(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    fetchCartons();
  }, [fetchBatches, fetchCartons]);

  const filtered = batches.filter(
    (b) =>
      b.batchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerateCarton = async () => {
    if (!selectedBatch) return;
    setIsPacking(true);
    try {
      const res = await cartonApi.create({
        batchId: selectedBatch.id,
        cartonSize: cartonConfig.cartonSize,
        unitsPerCarton: cartonConfig.unitsPerCarton,
        cartonCount: cartonConfig.cartonCount,
        weightPerCarton: cartonConfig.weightPerCarton,
        franchiseId: selectedBatch.franchiseId,
      });
      setPackedLog((prev) => [res.data, ...prev]);
      showToast(`Carton ${res.data.cartonCode} generated and sealed successfully`, "success");
      await fetchBatches();
      setSelectedBatch(null);
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to generate carton", "error");
    } finally {
      setIsPacking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Packing Queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#F97316] rounded-2xl shadow-lg shadow-[#F97316]/20 text-white">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
              Carton <span className="text-[#F97316]">Packing</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Consolidate Approved Batches & Assign Lot Numbers
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search approved batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 transition-all"
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Side: Pending Batches */}
        <div className="xl:col-span-5 bg-white dark:bg-[#12141c] rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02]">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Layers size={14} className="text-[#F97316]" /> Ready for Packaging
            </h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">QC Approved Stock ({filtered.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-white/[0.02] custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 size={32} className="text-emerald-500/50 mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">All Batches Packed</p>
              </div>
            ) : (
              filtered.map((batch) => (
                <div
                  key={batch.id}
                  onClick={() => setSelectedBatch(batch)}
                  className={clsx(
                    "p-4 cursor-pointer transition-all flex items-center justify-between",
                    selectedBatch?.id === batch.id
                      ? "bg-orange-500/10 dark:bg-[#F97316]/10 border-l-4 border-[#F97316]"
                      : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      {batch.batchCode}
                      <span className="bg-emerald-500/10 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded uppercase">QC Pass</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold">{batch.productName}</p>
                    <p className="text-[9px] text-slate-400 font-medium">
                      Available: {batch.remainingQty} {batch.unit}
                    </p>
                  </div>
                  <ArrowRight size={14} className={selectedBatch?.id === batch.id ? "text-[#F97316]" : "text-slate-300"} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Carton Config */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {selectedBatch ? (
            <div className="bg-white dark:bg-[#12141c] rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedBatch.productName}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Batch: {selectedBatch.batchCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Remaining to Pack</p>
                    <p className="text-xl font-black text-[#F97316]">{selectedBatch.remainingQty} <span className="text-xs text-slate-500">{selectedBatch.unit}</span></p>
                  </div>
                </div>

                {/* Carton Specification */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Carton Size</label>
                    <select
                      value={cartonConfig.cartonSize}
                      onChange={(e) => {
                        const units = e.target.value.includes('48') ? 48 : e.target.value.includes('24') ? 24 : 12;
                        setCartonConfig({...cartonConfig, cartonSize: e.target.value, unitsPerCarton: units});
                      }}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-[#F97316]"
                    >
                      <option>Small (12 units)</option>
                      <option>Medium (24 units)</option>
                      <option>Large (48 units)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Count</label>
                    <input
                      type="number"
                      value={cartonConfig.cartonCount}
                      onChange={(e) => setCartonConfig({...cartonConfig, cartonCount: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Weight (KG)</label>
                    <input
                      type="number"
                      value={cartonConfig.weightPerCarton}
                      onChange={(e) => setCartonConfig({...cartonConfig, weightPerCarton: Number(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <button
                      onClick={handleGenerateCarton}
                      disabled={isPacking || cartonConfig.unitsPerCarton * cartonConfig.cartonCount > selectedBatch.remainingQty}
                      className="w-full h-[38px] bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#F97316]/20 disabled:opacity-50"
                    >
                      {isPacking ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
                      Pack Carton
                    </button>
                  </div>
                </div>
                {cartonConfig.unitsPerCarton * cartonConfig.cartonCount > selectedBatch.remainingQty && (
                  <p className="text-[10px] font-bold text-rose-500 mt-2">
                    That's more units than remain in this batch ({selectedBatch.remainingQty} {selectedBatch.unit} left).
                  </p>
                )}
              </div>

              {/* Generated Cartons Grid */}
              <div className="p-6 bg-slate-50 dark:bg-white/[0.02]">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Barcode size={14} /> Generated Carton Lots
                </h4>
                {packedLog.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                    <Box size={24} className="text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase">No cartons generated yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                    {packedLog.map((log) => (
                      <div key={log.id} className="bg-white dark:bg-[#12141c] p-4 rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-sm flex items-center justify-between group">
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase font-mono">{log.cartonCode}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Ref: {log.batch?.batchCode || "—"} • {log.totalUnits} Units</p>
                          <p className="text-[8px] text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                        </div>
                        <button className="w-8 h-8 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-[#F97316] group-hover:border-[#F97316]/30 transition-colors">
                          <Printer size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#12141c] p-12 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm flex flex-col items-center justify-center text-center h-[700px]">
              <Box size={56} className="text-slate-200 dark:text-slate-800 mb-4" />
              <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Select a Batch</h4>
              <p className="text-[11px] text-slate-400 mt-2 max-w-xs leading-relaxed">
                Choose a QC-approved batch from the queue on the left to begin configuring and generating carton lots.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
