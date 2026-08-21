"use client";

import { useState, useEffect } from "react";
import { X,
  Trash2, Plus, RefreshCw, Calendar,
  Search, ShieldAlert, FileText
} from "lucide-react";
import { clsx } from "clsx";
import { wasteApi, inventoryApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

interface WasteEntry {
  id: string;
  quantity: number;
  reason: string;
  note?: string;
  createdAt: string;
  inventoryItem: {
    name: string;
    sku: string;
    unit: string;
  };
}

const REASON_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  QC_FAIL: { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  EXPIRED: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};
const DEFAULT_REASON_STYLE = { color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };

export default function WastagePage() {
  const [wasteLogs, setWasteLogs] = useState<WasteEntry[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Log Form State
  const [showLogModal, setShowLogModal] = useState(false);
  const [formData, setFormData] = useState({
    itemId: "",
    quantity: 1,
    reason: "SPOILAGE",
    note: ""
  });

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

  const loadData = async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    try {
      const [wRes, iRes] = await Promise.all([
        wasteApi.getAll(),
        inventoryApi.getInventory(selectedFranchiseId)
      ]);
      setWasteLogs(wRes.data || []);
      setInventoryItems(iRes.data || []);
      if (iRes.data?.length > 0) {
        setFormData(prev => ({ ...prev, itemId: iRes.data[0].id }));
      }
    } catch (err) {
      toast.error("Failed to fetch wastage logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFranchiseId]);

  const handleSubmitWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemId || formData.quantity <= 0) {
      toast.error("Please enter a valid item and quantity");
      return;
    }

    setSubmitting(true);
    try {
      await wasteApi.create({
        itemId: formData.itemId,
        quantity: Number(formData.quantity),
        reason: formData.reason,
        note: formData.note,
        franchiseId: selectedFranchiseId
      });
      toast.success("Wastage logged successfully");
      setShowLogModal(false);
      setFormData({
        itemId: inventoryItems[0]?.id || "",
        quantity: 1,
        reason: "SPOILAGE",
        note: ""
      });
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to log wastage");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = wasteLogs.filter(log =>
    log.inventoryItem?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-[#f58220]" />
          Wastage Control
        </h1>

        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Log Spoilage
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left Side: Stats and Log Form */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-[#f58220]" />
                Wastage Statistics
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Total Logged Entries</span>
                  <span className="font-semibold text-gray-800">{wasteLogs.length}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Spoiled / Damaged</span>
                  <span className="font-semibold text-gray-800">
                    {wasteLogs.filter(w => w.reason === 'SPOILAGE' || w.reason === 'DAMAGED').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">QC Failures</span>
                  <span className="font-semibold text-rose-600">
                    {wasteLogs.filter(w => w.reason === 'QC_FAIL').length}
                  </span>
                </div>
              </div>
            </div>

            {showLogModal && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-gray-800">Log Wastage / Spoilage</h3>
                  <button
                    onClick={() => setShowLogModal(false)}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSubmitWaste} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Inventory Item</label>
                    <select
                      value={formData.itemId}
                      onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    >
                      <option value="" disabled>Choose Item...</option>
                      {inventoryItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.quantity || ""}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Wastage Reason</label>
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    >
                      <option value="SPOILAGE">Spoilage & Rotting</option>
                      <option value="DAMAGED">Damaged in House</option>
                      <option value="QC_FAIL">Failed QC Inspection</option>
                      <option value="EXPIRED">Expired Shelf Life</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Remarks / Notes</label>
                    <input
                      type="text"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="Enter reason details..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit Wastage Log"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Side: Wastage History List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#f58220]" />
                  Wastage Audit History
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
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
              ) : filteredLogs.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  No wastage records found for selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                        <th className="text-left px-4 py-3">Item</th>
                        <th className="text-center px-4 py-3">Reason</th>
                        <th className="text-right px-4 py-3">Qty Loss</th>
                        <th className="text-left px-4 py-3">Notes / Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLogs.map((log) => {
                        const style = REASON_STYLES[log.reason] || DEFAULT_REASON_STYLE;

                        return (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{log.inventoryItem?.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">SKU: {log.inventoryItem?.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                                {log.reason}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-600">
                              -{log.quantity} <span className="text-xs text-gray-400">{log.inventoryItem?.unit}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-gray-700">{log.note || 'N/A'}</div>
                              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                              </div>
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

        </div>
      </div>
    </div>
  );
}
