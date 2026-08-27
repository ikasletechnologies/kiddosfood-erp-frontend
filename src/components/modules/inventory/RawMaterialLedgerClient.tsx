"use client";

import { useState, useEffect, useCallback } from "react";
import { X,
  Search, RefreshCw, Database,
  Download, FileText, BarChart3, ArrowDownRight, ArrowUpRight
} from "lucide-react";
import { clsx } from "clsx";
import { inventoryApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "All Items" },
  { value: "RAW_MATERIAL", label: "Raw Materials" },
  { value: "FINISHED_GOOD", label: "Finished Goods" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "SEMI_FINISHED", label: "Other Material" },
];

export default function RawMaterialLedgerClient() {
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const { user } = useAuth();

  const fetchItemsList = useCallback(async () => {
    try {
      const res = await inventoryApi.getRawMaterialStockSummary(undefined, undefined, category);
      setItemsList(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch item stock list:", e);
    }
  }, [category]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getInventoryLedger(
        selectedItemId === "ALL" ? undefined : selectedItemId,
        user?.franchiseId,
        category === "ALL" ? undefined : category
      );
      setLedgerEntries(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch ledger entries:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedItemId, user?.franchiseId, category]);

  useEffect(() => {
    // Item dropdown depends on category — reset the item selection so a
    // stale item from a different category can't stay selected.
    setSelectedItemId("ALL");
    fetchItemsList();
  }, [fetchItemsList]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const downloadCSV = () => {
    const headers = ["Date", "Item Name", "SKU", "Category", "Transaction Type", "Inward Qty", "Outward Qty", "Unit", "Running Balance", "Operator", "Reference", "Batch ID", "Warehouse", "Unit Cost", "Description"];
    const rows = filteredEntries.map(entry => [
      formatDate(entry.date),
      entry.itemName || "",
      entry.sku || "",
      entry.category || "",
      entry.transactionType || "",
      entry.inwardQty.toFixed(2),
      entry.outwardQty.toFixed(2),
      entry.unit || "",
      entry.runningBalance.toFixed(2),
      entry.actor || "",
      entry.reference || "",
      entry.batchNumber || entry.batchId || "",
      entry.warehouseName || "",
      (entry.unitCost || 0).toFixed(2),
      entry.notes || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-ledger-${selectedItemId === "ALL" ? "all" : selectedItemId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Search is scoped to Item Name / SKU only — it narrows *within* the
  // selected category, it must not also match on notes/reference/actor text
  // (e.g. searching "organic" inside Raw Materials should show only organic
  // items, not any transaction whose note happens to mention "organic").
  const filteredEntries = ledgerEntries.filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      it.itemName?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q)
    );
  });

  // Calculate opening, inward, outward, closing for item summary card
  const selectedItemInfo = selectedItemId !== "ALL" ? itemsList.find(i => i.id === selectedItemId) : null;
  
  // To compute Opening Stock for the selected item:
  // Since ledger entries are sorted in descending order:
  // The first chronological transaction (last in array) had runningBalance = opening + adjustment.
  // We can also calculate: Opening = Closing - Total Inward + Total Outward
  const closingStock = selectedItemInfo ? selectedItemInfo.availableStock : 0;
  const totalInward = filteredEntries.reduce((acc, entry) => acc + entry.inwardQty, 0);
  const totalOutward = filteredEntries.reduce((acc, entry) => acc + entry.outwardQty, 0);
  const openingStock = Math.max(0, closingStock - totalInward + totalOutward);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 shrink-0">
              <FileText size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Inventory Ledger <span className="text-slate-400 font-medium ml-1 italic">& Statement</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={12} className="text-orange-500" /> Chronological movement ledger & running balance
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl hover:border-emerald-300 hover:text-emerald-600 transition-all shadow-sm text-slate-500"
            title="Download CSV"
          >
            <Download size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
          </button>
          <button onClick={fetchLedger} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl hover:border-slate-300 transition-all shadow-sm">
            <RefreshCw size={16} className={clsx("text-slate-400", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* Filter and Item selection header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-[2rem] border border-slate-100 dark:border-white/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Category:</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none cursor-pointer w-full sm:w-44"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Filter Item:</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none cursor-pointer w-full sm:w-80"
            >
              <option value="ALL">Show All Items</option>
              {itemsList.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="relative group w-full md:w-80 px-2">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search item name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border-none rounded-xl outline-none text-xs font-bold shadow-sm"
          />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
        </div>
      </div>

      {/* Selected Item Statement Summary Card */}
      {selectedItemInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl border border-slate-800 animate-in fade-in duration-300">
          <div className="space-y-2 border-b border-slate-800 sm:border-none pb-4 sm:pb-0">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Material Spec</p>
            <h3 className="text-lg font-black uppercase tracking-tight">{selectedItemInfo.name}</h3>
            <p className="text-xs font-bold text-slate-400 tracking-wider">SKU: {selectedItemInfo.sku}</p>
          </div>
          <div className="space-y-2 border-b border-slate-800 sm:border-none pb-4 sm:pb-0">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Formula Balance</p>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">
                Opening Stock: <span className="text-white font-extrabold">{openingStock.toFixed(2)}</span>
              </p>
              <p className="text-xs font-medium text-slate-400">
                Total Inward (+): <span className="text-emerald-400 font-extrabold">+{totalInward.toFixed(2)}</span>
              </p>
              <p className="text-xs font-medium text-slate-400">
                Total Outward (-): <span className="text-orange-400 font-extrabold">-{totalOutward.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Current Stock</p>
            <h3 className="text-3xl font-black text-emerald-400 tracking-tight">
              {closingStock.toFixed(2)}
              <span className="text-sm font-bold text-white ml-1.5 uppercase">{selectedItemInfo.unit}</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Validated via movement ledger</p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Unit Cost Value</p>
            <h3 className="text-3xl font-black text-blue-400 tracking-tight">
              ₹{(closingStock * selectedItemInfo.costPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cost Price: ₹{selectedItemInfo.costPrice.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white dark:bg-card/40 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
              <tr className="text-slate-400">
                <th className="w-[9%] px-8 py-4 text-[9px] font-black uppercase tracking-widest">Date</th>
                {selectedItemId === "ALL" && (
                  <th className="w-[15%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Item</th>
                )}
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Transaction Type</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">Inward (+)</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">Outward (-)</th>
                <th className="w-[11%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">Running Balance</th>
                <th className="w-[11%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Batch / Warehouse</th>
                <th className="w-[8%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">Unit Cost</th>
                <th className="w-[14%] px-8 py-4 text-[9px] font-black uppercase tracking-widest">Operator / Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                  <td className="px-8 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                    {formatDate(entry.date)}
                  </td>
                  {selectedItemId === "ALL" && (
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-[12px] truncate leading-none mb-1">{entry.itemName}</p>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{entry.sku}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-200">
                      {entry.inwardQty > 0 ? (
                        <ArrowUpRight size={14} className="text-emerald-500" />
                      ) : (
                        <ArrowDownRight size={14} className="text-orange-500" />
                      )}
                      {entry.transactionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {entry.inwardQty > 0 ? (
                      <span className="text-sm font-extrabold text-emerald-600">
                        +{entry.inwardQty.toFixed(2)}
                        <span className="ml-0.5 text-[10px] text-slate-400 font-bold uppercase">{entry.unit}</span>
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {entry.outwardQty > 0 ? (
                      <span className="text-sm font-extrabold text-orange-600">
                        -{entry.outwardQty.toFixed(2)}
                        <span className="ml-0.5 text-[10px] text-slate-400 font-bold uppercase">{entry.unit}</span>
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white text-sm">
                    {entry.runningBalance.toFixed(2)}
                    <span className="ml-1 text-[10px] text-slate-400 font-bold uppercase">{entry.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <p className="font-bold text-slate-700 dark:text-slate-300 truncate leading-none mb-1">{entry.batchNumber || entry.batchId || "—"}</p>
                    <span className="text-[9px] text-slate-400 truncate block">{entry.warehouseName || "Unassigned"}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                    {entry.unitCost ? `₹${entry.unitCost.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-8 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <p className="font-bold text-slate-700 dark:text-slate-300 leading-none mb-1">{entry.actor}</p>
                    {entry.reference && (
                      <span className="inline-block text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded mb-1">
                        {entry.reference}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-400 block truncate" title={entry.notes || undefined}>{entry.notes || "N/A"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 bg-slate-50 dark:bg-white/5 rounded-full mb-2"><Database size={40} className="text-slate-200" /></div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No ledger records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
