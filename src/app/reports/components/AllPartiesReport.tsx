"use client";

import { useState, useEffect } from "react";
import { X,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  ChevronDown as ChevronDownIcon,
  Filter as FilterIcon,
  Search as SearchIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";
import * as XLSX from "xlsx";

interface PartyRow {
  id: string;
  partyName: string;
  email: string | null;
  phoneNo: string;
  receivableBalance: number | null;
  payableBalance: number | null;
  creditLimit: number | null;
}

export default function CentralAllPartiesReport({
  reportData,
  loading: externalLoading,
  filterType,
}: {
  reportData: any;
  loading: boolean;
  filterType?: "receivables" | "payables";
}) {
  const [dateFilter, setDateFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Real data state
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Ideally this goes to getAllParties
    reportsApi.getAllParties().then((res: any) => {
      if (!res.data || res.data.length === 0) {
        setRows([]);
      } else {
        const parsed = res.data.map((c: any) => ({
          id: c.id,
          partyName: c.name,
          email: c.email || null,
          phoneNo: c.phone || "—",
          receivableBalance: c.currentBalance > 0 ? c.currentBalance : null,
          payableBalance: c.currentBalance < 0 ? Math.abs(c.currentBalance) : null,
          creditLimit: c.creditLimit || null
        }));
        setRows(parsed);
      }
    }).catch(() => {
      setRows([]);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  let filtered = rows.filter((r) =>
    r.partyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filterType === "receivables") {
    filtered = filtered
      .map(r => ({ ...r, payableBalance: null }))
      .filter(r => r.receivableBalance !== null && r.receivableBalance > 0);
  } else if (filterType === "payables") {
    filtered = filtered
      .map(r => ({ ...r, receivableBalance: null }))
      .filter(r => r.payableBalance !== null && r.payableBalance > 0);
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExcel = () => {
    try {
      const rowsToExport = selectedIds.length > 0
        ? filtered.filter(r => selectedIds.includes(r.id))
        : filtered;

      if (!rowsToExport || rowsToExport.length === 0) {
        toast.error("No parties to export");
        return;
      }

      const aoa: any[][] = [];
      aoa.push(["ALL PARTIES REPORT"]);
      aoa.push(["Generated Date:", new Date().toLocaleDateString()]);
      if (filterType) aoa.push(["Filter Type:", filterType.toUpperCase()]);
      if (selectedIds.length > 0) aoa.push(["Selected Parties Count:", selectedIds.length]);
      aoa.push([]);

      // Table Header
      aoa.push([
        "#",
        "Party Name",
        "Email",
        "Phone No",
        "Receivable Balance (Rs)",
        "Payable Balance (Rs)",
        "Credit Limit (Rs)"
      ]);

      // Data Rows
      rowsToExport.forEach((r, idx) => {
        aoa.push([
          idx + 1,
          r.partyName || "",
          r.email || "—",
          r.phoneNo || "—",
          r.receivableBalance !== null ? Number(r.receivableBalance) : 0,
          r.payableBalance !== null ? Number(r.payableBalance) : 0,
          r.creditLimit !== null ? Number(r.creditLimit) : 0
        ]);
      });

      aoa.push([]);
      aoa.push([
        "TOTALS",
        "",
        "",
        "",
        rowsToExport.reduce((s, r) => s + (r.receivableBalance || 0), 0),
        rowsToExport.reduce((s, r) => s + (r.payableBalance || 0), 0),
        ""
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Parties");

      const filename = `All_Parties_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(selectedIds.length > 0 ? `Exported ${selectedIds.length} selected parties to Excel!` : "All Parties report exported to Excel!");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel file");
    }
  };

  const fmt = (val: number | null) => val !== null ? `₹ ${val.toFixed(2)}` : "—";

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const totalReceivable = filtered.reduce((s, r) => s + (r.receivableBalance || 0), 0);
  const totalPayable = filtered.reduce((s, r) => s + (r.payableBalance || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] space-y-4 p-6 overflow-hidden">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={dateFilter}
              onChange={(e) => setDateFilter(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="text-sm font-black text-slate-700 dark:text-slate-200">Date Filter</span>
          </label>
          
          <div className="relative">
            <select className="px-3 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none min-w-[140px]">
              <option>All parties</option>
            </select>
            <ChevronDownIcon size={14} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={handleExcel} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
            <ExcelIcon size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Excel Report</span>
          </button>
          <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
            <PrinterIcon size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Print</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col flex-1 overflow-hidden relative">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#090a0f] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/40 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 w-12">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">#</span>
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PARTY NAME</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">EMAIL</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHONE NO.</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 text-right">
                  <div className="flex items-center justify-end group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RECEIVABLE BALANCE</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 text-right">
                  <div className="flex items-center justify-end group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PAYABLE BALANCE</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CREDIT LIMIT</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {loading || externalLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-32 text-center h-full">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-40 text-center h-full align-middle">
                    <div className="text-slate-600 dark:text-slate-400 font-medium">
                      No records to show
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleOne(row.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center">{idx + 1}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-white">{row.partyName}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.email || "—"}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-right">{row.phoneNo}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-right font-medium text-emerald-500">{fmt(row.receivableBalance)}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-right font-medium">{fmt(row.payableBalance)}</td>
                      <td className="px-4 py-4 text-right font-medium">{fmt(row.creditLimit)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-[#12141c] border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 flex justify-between items-center text-[11px] font-semibold tracking-wide">
          <div className="text-slate-600 dark:text-slate-400">
            Total Receivable: <span className="text-emerald-500 ml-1">{fmt(totalReceivable)}</span>
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            Total Payable: <span className="text-emerald-500 ml-1">{fmt(totalPayable)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
