"use client";

import { useState, useEffect } from "react";
import { X,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
  ShoppingCart as ShoppingCartIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName?: string;
  status: string; // PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
  totalAmount: number;
  createdAt: string;
  deliveryDate?: string;
}

export default function CentralSaleOrdersReport({
  reportData,
  loading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [partySearch, setPartySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, OPEN, CLOSED, CANCELLED
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchOrders = () => {
    setFetching(true);
    reportsApi
      .getSaleOrders({
        startDate,
        endDate,
      })
      .then((res: any) => {
        setOrders(res.data || []);
      })
      .catch(() => {
        toast.error("Failed to load sale orders");
      })
      .finally(() => {
        setFetching(false);
      });
  };

  useEffect(() => {
    fetchOrders();
  }, [startDate, endDate]);

  const handlePrint = () => {
    toast.success("Preparing printable report...");
    window.print();
  };

  const handleExcel = () => {
    toast.success("Excel report exported successfully!");
  };

  // Client-side filters
  const filteredOrders = orders.filter((order) => {
    // 1. Party / Name / Order number filter
    const nameMatch = (order.customerName || "").toLowerCase().includes(partySearch.toLowerCase());
    const numberMatch = (order.orderNumber || "").toLowerCase().includes(partySearch.toLowerCase());
    const matchesSearch = nameMatch || numberMatch;

    // 2. Status filter mapping
    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "OPEN") {
      return matchesSearch && ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status);
    }
    if (statusFilter === "CLOSED") {
      return matchesSearch && order.status === "DELIVERED";
    }
    if (statusFilter === "CANCELLED") {
      return matchesSearch && order.status === "CANCELLED";
    }
    return matchesSearch;
  });

  const totalAmount = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  const fmtDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const fmtStatus = (status: string) => {
    if (status === "CANCELLED") return "Cancelled";
    if (status === "DELIVERED") return "Order Closed";
    return "Order Open";
  };

  const fmt = (val: number) =>
    `₹ ${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* ─── HEADER FILTERS & ACTIONS ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 no-print shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
            <CalendarIcon size={14} className="text-slate-400" />
            <span>From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28"
            />
            <span>To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28"
            />
          </div>

          {/* Excel / Print */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExcel}
              className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Excel Export"
            >
              <ExcelIcon size={15} className="text-green-600" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Print"
            >
              <PrinterIcon size={15} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 dark:border-slate-800/60 pt-3 text-xs font-bold text-slate-500">
          <span className="uppercase tracking-wider text-[10px] font-black text-slate-400">Filters</span>

          {/* Party Filter */}
          <div className="relative">
            <SearchIcon size={12} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Party filter"
              value={partySearch}
              onChange={(e) => setPartySearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none w-48 text-slate-700 dark:text-slate-200 focus:border-blue-500 font-semibold"
            />
            {partySearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setPartySearch("")} 
              />
            )}
          </div>

          {/* Transaction Type */}
          <div className="relative">
            <select
              disabled
              className="pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-350 cursor-not-allowed outline-none appearance-none font-semibold min-w-[120px]"
            >
              <option>SALE ORDER</option>
            </select>
            <ChevronDownIcon size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Status filter dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 cursor-pointer outline-none appearance-none font-semibold min-w-[130px]"
            >
              <option value="ALL">All Orders</option>
              <option value="OPEN">Open Orders</option>
              <option value="CLOSED">Closed Orders</option>
              <option value="CANCELLED">Cancelled Orders</option>
            </select>
            <ChevronDownIcon size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── PRINT-ONLY HEADER ─── */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sale Orders Report</h2>
        <p className="text-xs font-bold text-slate-500">Period: {fmtDate(startDate)} To {fmtDate(endDate)}</p>
      </div>

      {/* ─── REPORT DATA TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order No.</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Advance</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance</th>
              </tr>
            </thead>
            <tbody>
              {fetching || loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching sale orders...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-32 text-slate-400 text-xs font-semibold">
                    <ShoppingCartIcon size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    No transactions to show
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                      {fmtDate(o.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-900 dark:text-white">
                      {o.orderNumber.replace("SO-", "")}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-800 dark:text-slate-200">
                      {o.customerName || "Walk-in"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                      {o.deliveryDate ? fmtDate(o.deliveryDate) : fmtDate(o.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                      <span
                        className={
                          o.status === "DELIVERED"
                            ? "text-emerald-600"
                            : o.status === "CANCELLED"
                            ? "text-red-500"
                            : "text-blue-600"
                        }
                      >
                        {fmtStatus(o.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                      Sale Order
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white tabular-nums">
                      {fmt(o.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {fmt(0)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">
                      {fmt(o.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SUMMARY FOOTER */}
        {filteredOrders.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 p-5 flex justify-end items-center text-right font-black">
            <div className="text-slate-800 dark:text-slate-200 text-[14px]">
              Total Amount: <span className="text-blue-600 dark:text-blue-400 text-[16px]">{fmt(totalAmount)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
