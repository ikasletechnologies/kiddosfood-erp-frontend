"use client";

import { useState, useEffect } from "react";
import { 
  ChevronRight, 
  ChevronDown,
  Download,
  Info,
  Package,
  IndianRupee,
  Columns,
  Loader2
} from "lucide-react";
import { clsx } from "clsx";
import { reportsApi } from "@/lib/api";

export default function StockValueReport() {
  const [activeTab, setActiveTab] = useState("Reports & More");
  const [hideZeroStock, setHideZeroStock] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getInventoryValue();
      setData(res.data);
    } catch (error) {
      console.error("Failed to fetch inventory value:", error);
    } finally {
      setLoading(false);
    }
  };

  const headers = [
    "Item Name", "SKU", "HSN", "Unit", "Stock in Hand", 
    "Unit Cost", "Stock Value", "Share of Total Value(%)"
  ];

  const filteredItems = data?.items?.filter((item: any) => 
    hideZeroStock ? item.stockInHand > 0 : true
  ) || [];

  return (
    <div className="min-h-full bg-[#FAF9FA]/50 dark:bg-[#020617] rounded-3xl overflow-hidden border border-orange-100 dark:border-white/5 shadow-sm font-sans">
      
      <div className="p-8 space-y-6">

        {/* Primary Tabs */}
        <div className="flex items-center gap-8 border-b border-[#F0EAF0] dark:border-slate-800">
          {["All Items", "Warehouses", "Reports & More"].map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={clsx(
                 "pb-3 text-[13px] font-bold transition-all relative flex items-center gap-2",
                 activeTab === tab 
                  ? "text-[#F97316]" 
                  : "text-[#666] dark:text-slate-500 hover:text-[#1A1A1A] dark:hover:text-white"
               )}
            >
              {tab}
              {tab === "Reports & More" && <ChevronRight size={12} />}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F97316]" />
              )}
            </button>
          ))}
        </div>


        {/* Filter Section */}
        <div className="bg-[#FAF9FA] dark:bg-slate-800/30 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl p-6 space-y-4">
           <h3 className="text-[12px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider">Filters</h3>
           <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="hideZero"
                checked={hideZeroStock}
                onChange={() => setHideZeroStock(!hideZeroStock)}
                className="w-4 h-4 accent-[#F97316] rounded"
              />
              <label htmlFor="hideZero" className="text-[13px] font-medium text-[#444] dark:text-slate-300">Hide Zero - stock Products</label>
           </div>
        </div>

        {/* Summary Cards */}
        <div className="bg-[#FAF9FA] dark:bg-slate-800/30 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl p-6 space-y-4">
           <h3 className="text-[12px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider">Summary</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-blue-500">
                    <Package size={24} />
                 </div>
                 <div>
                    <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#666]">
                       No. of items <Info size={14} className="opacity-40" />
                    </div>
                    <p className="text-xl font-black text-[#1A1A1A] dark:text-white">
                      {loading ? "..." : (data?.summary?.totalItemsCount ?? 0)}
                    </p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-500">
                    <IndianRupee size={24} />
                 </div>
                 <div>
                    <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#666]">
                       Total Stock Value <Info size={14} className="opacity-40" />
                    </div>
                    <p className="text-xl font-black text-[#1A1A1A] dark:text-white">
                      {loading ? "..." : `₹${(data?.summary?.totalStockValue ?? 0).toLocaleString('en-IN')}`}
                    </p>
                 </div>
              </div>
           </div>
        </div>

        {/* Valuation Insights */}
        <div className="bg-[#F97316]/5 dark:bg-[#F97316]/10 border border-[#F97316]/10 dark:border-white/5 rounded-2xl p-6">
           <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-[#F97316]/10 text-[#F97316]">
                 <Info size={16} />
              </div>
              <h3 className="text-[12px] font-black text-[#F97316] uppercase tracking-widest">Why Valuation Matters</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Capital Assets", text: "Track money 'tied up' in stock (e.g. 100kg batter at ₹40/kg = ₹4,000 value)." },
                { title: "Profit Strategy", text: "Compare Unit Cost vs Selling Price to plan healthy business margins." },
                { title: "Tax & Compliance", text: "Essential for financial balance sheets and year-end inventory audits." },
                { title: "Stock Balance", text: "Identify high-value items using 'Share of Total Value %' to optimize capital." }
              ].map((item) => (
                <div key={item.title}>
                   <p className="text-[11px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight mb-1">{item.title}</p>
                   <p className="text-[11px] text-[#666] dark:text-slate-400 leading-relaxed font-medium">{item.text}</p>
                </div>
              ))}
           </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between">
           <span className="text-[12px] font-bold text-[#666]">
            {loading ? "Loading items..." : `${filteredItems.length} items found`}
           </span>
           <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-[#F0EAF0] dark:border-slate-800 rounded-lg text-[12px] font-bold text-[#666] hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                 <Download size={14} />
                 Download CSV
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 border border-[#F0EAF0] dark:border-slate-800 rounded-md text-[11px] font-bold text-[#666] hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                 <Columns size={14} />
                 Show/Hide Columns
              </button>
           </div>
        </div>

        {/* Valuation Table */}
        <div className="bg-white dark:bg-slate-900 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-[#FAF9FA] dark:bg-slate-800/50 border-b border-[#F0EAF0] dark:border-slate-800">
                  <th className="p-4 w-10 sticky left-0 bg-[#FAF9FA] dark:bg-slate-800 z-10">
                     <div className="w-4 h-4 rounded border border-[#DDD] dark:border-slate-600" />
                  </th>
                  {headers.map((head) => (
                    <th key={head} className="p-4 text-[11px] font-bold text-[#999] dark:text-slate-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2 italic">
                        {head} <ChevronDown size={10} className="opacity-40" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EAF0] dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <Loader2 className="animate-spin text-[#F97316]" size={24} />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Fetching Valuation Data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-32">
                       <div className="flex flex-col items-center justify-center space-y-6">
                         <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center opacity-30">
                            <Package size={40} className="text-slate-400" />
                         </div>
                         <p className="text-[12px] font-black uppercase tracking-widest text-[#999]">No Valuation Data Found</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/30">
                        <div className="w-4 h-4 rounded border border-[#DDD] dark:border-slate-600" />
                      </td>
                      <td className="p-4 text-[13px] font-bold text-[#1A1A1A] dark:text-white uppercase tracking-tight">{item.name}</td>
                      <td className="p-4 text-[13px] font-medium text-[#666] dark:text-slate-400">{item.sku}</td>
                      <td className="p-4 text-[13px] font-medium text-[#666] dark:text-slate-400">{item.hsn || "-"}</td>
                      <td className="p-4 text-[13px] font-black text-[#1A1A1A] dark:text-white">
                        {item.stockInHand.toLocaleString()} <span className="text-[10px] text-[#999] font-bold uppercase ml-1">{item.unit}</span>
                      </td>
                      <td className="p-4 text-[13px] font-bold text-[#666] dark:text-slate-400">₹{item.unitCost.toLocaleString()}</td>
                      <td className="p-4 text-[13px] font-black text-[#F97316]">₹{item.stockValue.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-orange-500 rounded-full" 
                              style={{ width: `${Math.min(100, item.shareOfTotalValue)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-[#1A1A1A] dark:text-white">
                            {item.shareOfTotalValue.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {!loading && (
            <div className="p-4 bg-[#FAF9FA] dark:bg-slate-800/50 border-t border-[#F0EAF0] dark:border-slate-800 text-[12px] font-black text-[#F97316] uppercase tracking-widest flex justify-between">
               <span>Total Valuation</span>
               <span>₹{data?.summary?.totalStockValue?.toLocaleString('en-IN') ?? 0}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
