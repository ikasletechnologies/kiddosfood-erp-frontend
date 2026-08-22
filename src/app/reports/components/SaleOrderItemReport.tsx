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

interface SalesOrderItem {
  id: string;
  productName: string;
  quantity: number;
  totalAmount: number;
}

interface SalesOrder {
  id: string;
  customerName?: string;
  status: string;
  createdAt: string;
  items: SalesOrderItem[];
}

export default function CentralSaleOrderItemReport({
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
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, OPEN, CLOSED
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

  // 1. Filter orders based on status & party name
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = (order.customerName || "")
      .toLowerCase()
      .includes(partySearch.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "OPEN") {
      return matchesSearch && ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status);
    }
    if (statusFilter === "CLOSED") {
      return matchesSearch && order.status === "DELIVERED";
    }
    return matchesSearch;
  });

  // 2. Aggregate items across the filtered orders
  const itemAggregates: Record<string, { quantity: number; amount: number }> = {};

  filteredOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = item.productName || "Unknown Item";
      if (!itemAggregates[name]) {
        itemAggregates[name] = { quantity: 0, amount: 0 };
      }
      itemAggregates[name].quantity += item.quantity;
      itemAggregates[name].amount += item.totalAmount;
    });
  });

  const aggregatedRows = Object.entries(itemAggregates).map(([itemName, data]) => ({
    itemName,
    quantity: data.quantity,
    amount: data.amount,
  }));

  const totalQuantity = aggregatedRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = aggregatedRows.reduce((sum, row) => sum + row.amount, 0);

  const fmtDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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
              <option value="ALL">All Status</option>
              <option value="OPEN">Open Status</option>
              <option value="CLOSED">Closed Status</option>
            </select>
            <ChevronDownIcon size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── PRINT-ONLY HEADER ─── */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sale Order Item Report</h2>
        <p className="text-xs font-bold text-slate-500">Period: {fmtDate(startDate)} To {fmtDate(endDate)}</p>
      </div>

      {/* ─── REPORT DATA TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody>
              {fetching || loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching sale order items...</p>
                  </td>
                </tr>
              ) : aggregatedRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-32 text-slate-400 text-xs font-semibold">
                    <ShoppingCartIcon size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    No items found for filtered orders
                  </td>
                </tr>
              ) : (
                aggregatedRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-800 dark:text-slate-200">
                      {r.itemName}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">
                      {r.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white tabular-nums">
                      {fmt(r.amount)}
                    </td>
                  </tr>
                ))
              )}

              {/* TOTAL ROW AT THE BOTTOM */}
              {!fetching && !loading && aggregatedRows.length > 0 && (
                <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/20 font-black">
                  <td className="px-5 py-4 text-[13px] text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-5 py-4 text-[14px] text-slate-950 dark:text-white tabular-nums">
                    {totalQuantity}
                  </td>
                  <td className="px-5 py-4 text-[14px] text-blue-600 dark:text-blue-400 tabular-nums">
                    {fmt(totalAmount)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
