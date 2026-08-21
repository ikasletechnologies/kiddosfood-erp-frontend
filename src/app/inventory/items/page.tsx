"use client";

import { useState } from "react";
import { X, 
  Plus, 
  Search, 
  Download,
  Filter,
  MoreVertical,
  ChevronRight,
  TrendingDown,
  Package,
  AlertTriangle,
  Scale,
  Minus,
  Edit2,
  Trash,
  MoveUp,
  MoveDown
} from "lucide-react";
import { clsx } from "clsx";

interface StockItem {
  id: string;
  name: string;
  sku: string;
  category: "Meat" | "Dairy" | "Pantry" | "Spices" | "Produce";
  currentStock: number;
  minStock: number;
  unit: string;
  avgPrice: number;
  lastStockIn: string;
}

const STOCK_DATA: StockItem[] = [
  { id: "1", name: "Whole Chicken (Cleaned)", sku: "RAW-CHK-001", category: "Meat", currentStock: 45, minStock: 20, unit: "kg", avgPrice: 350, lastStockIn: "2h ago" },
  { id: "2", name: "Fresh Paneer", sku: "RAW-PAN-002", category: "Dairy", currentStock: 12, minStock: 15, unit: "kg", avgPrice: 450, lastStockIn: "Yesterday" },
  { id: "3", name: "Basmati Rice (Extra Long)", sku: "RAW-RIC-005", category: "Pantry", currentStock: 250, minStock: 100, unit: "kg", avgPrice: 65, lastStockIn: "3 days ago" },
  { id: "4", name: "Amul Butter (Gourmet)", sku: "RAW-BUT-010", category: "Dairy", currentStock: 8, minStock: 10, unit: "kg", avgPrice: 600, lastStockIn: "Today" },
  { id: "5", name: "Garam Masala Blend", sku: "RAW-SPI-088", category: "Spices", currentStock: 15, minStock: 5, unit: "kg", avgPrice: 1200, lastStockIn: "1 week ago" },
  { id: "6", name: "Fresh Whole Milk", sku: "RAW-MLK-003", category: "Dairy", currentStock: 40, minStock: 20, unit: "L", avgPrice: 65, lastStockIn: "Today" },
  { id: "7", name: "Red Tomatoes", sku: "RAW-PRO-012", category: "Produce", currentStock: 5, minStock: 25, unit: "kg", avgPrice: 30, lastStockIn: "Yesterday" },
];

export default function InventoryItemsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);

  const categories = ["All", "Meat", "Dairy", "Pantry", "Spices", "Produce"];
  
  const filteredItems = STOCK_DATA.filter(item => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.includes(search.toUpperCase());
    return matchesCategory && matchesSearch;
  });

  const getStockStatus = (item: StockItem) => {
    if (item.currentStock <= 0) return { label: "Out of Stock", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/10", border: "border-red-100 dark:border-red-900/20" };
    if (item.currentStock <= item.minStock) return { label: "Low Level", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/10", border: "border-amber-100 dark:border-amber-900/20" };
    return { label: "In Stock", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/10", border: "border-emerald-100 dark:border-emerald-900/20" };
  };

  const totalValue = STOCK_DATA.reduce((acc, item) => acc + (item.currentStock * item.avgPrice), 0);
  const lowStockCount = STOCK_DATA.filter(i => i.currentStock <= i.minStock).length;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Strategic Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
            Raw Material <span className="text-slate-400 font-medium ml-2 tracking-tighter italic">Stock Intelligence</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Strategic inventory control and <span className="text-orange-500 font-bold">real-time procurement</span> tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:border-slate-300 transition-all shadow-sm">
             <Download size={16} /> Export Sheets
           </button>
           <button className="flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:translate-y-[-2px] transition-all active:translate-y-0 shadow-slate-200 dark:shadow-none">
            <Plus size={20} /> Register Batch
          </button>
        </div>
      </header>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Inventory Equity", value: `₹${(totalValue / 1000).toFixed(1)}K`, icon: Scale, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Critical SKU Count", value: lowStockCount, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Inbound Today", value: "320kg", icon: MoveUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Outbound Today", value: "145kg", icon: MoveDown, color: "text-orange-500", bg: "bg-orange-500/10" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-card/40 backdrop-blur-sm p-6 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-xl shadow-black/[0.02] group">
            <div className="flex items-center justify-between mb-4">
               <div className={clsx("p-3 rounded-2xl transition-transform group-hover:scale-110 duration-500", stat.bg, stat.color)}>
                  <stat.icon size={20} />
               </div>
               <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Live View</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Control Panel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
         <div className="flex p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit border border-slate-200 dark:border-white/5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                  activeCategory === cat 
                    ? "bg-white dark:bg-card text-slate-900 dark:text-white shadow-md" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {cat}
              </button>
            ))}
         </div>

         <div className="relative group min-w-[340px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Filter by SKU, Batch or Item Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white dark:bg-card border-none rounded-3xl outline-none focus:ring-4 ring-orange-500/10 text-sm font-bold shadow-xl shadow-black/[0.02] transition-all"
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

      {/* Main Stock Table */}
      <div className="bg-white dark:bg-card/40 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-[48px] shadow-2xl shadow-black/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400">
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest">Raw Specification</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Category</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">In Stock Balance</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Avg Purchase Cost</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Inventory Value</th>
                <th className="px-10 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {filteredItems.map((item) => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    <td className="px-10 py-6">
                       <div className="flex items-center gap-4">
                          <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs border transition-transform group-hover:scale-110", status.bg, status.color, status.border)}>
                             {item.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                             <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm leading-tight">{item.name}</p>
                             <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">{item.sku}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">
                          {item.category}
                       </span>
                    </td>
                    <td className="px-8 py-6">
                       <div className="space-y-1.5 min-w-[120px]">
                          <div className="flex justify-between items-center px-1">
                             <span className={clsx("text-[13px] font-black", status.color)}>
                                {item.currentStock} <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{item.unit}</span>
                             </span>
                             <span className="text-[9px] font-black text-slate-300">MIN {item.minStock}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                             <div 
                                className={clsx("h-full rounded-full transition-all duration-1000", status.color.replace('text-', 'bg-'))} 
                                style={{ width: `${Math.min(100, (item.currentStock / (item.minStock * 2)) * 100)}%` }} 
                             />
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">₹{item.avgPrice.toFixed(2)}</p>
                       <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Per {item.unit}</p>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-sm font-black text-emerald-500 tracking-tight">₹{(item.currentStock * item.avgPrice).toLocaleString()}</span>
                    </td>
                    <td className="px-10 py-6 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                          <button 
                            onClick={() => { setSelectedItem(item); setShowAdjustModal(true); }}
                            className="p-3 bg-orange-50 dark:bg-orange-500/10 text-orange-600 rounded-2xl hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                          >
                             <Plus size={16} />
                          </button>
                          <button className="p-3 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-2xl hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 transition-all shadow-sm">
                             <Edit2 size={16} />
                          </button>
                          <button className="p-3 bg-red-50 dark:bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                             <Trash size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="w-full py-8 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent text-[10px] font-black tracking-[0.34em] text-slate-400 uppercase hover:text-slate-600 transition-all group">
           Explore Complete Inventory History <ChevronRight size={16} className="inline ml-2 group-hover:translate-x-2 transition-transform" />
        </button>
      </div>

      {/* Stock Adjuster Modal */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowAdjustModal(false)} />
          <div className="relative bg-white dark:bg-card rounded-[48px] shadow-2xl w-full max-w-lg border border-white/20 dark:border-white/5 p-12 overflow-hidden overflow-y-auto">
             <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 rounded-[24px] bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
                   <Package size={32} />
                </div>
                <div>
                   <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Stock Adjustment</h2>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Refining Inventory Equity</p>
                </div>
             </div>

             <div className="bg-slate-50 dark:bg-white/5 rounded-[32px] p-6 mb-10 border border-slate-100 dark:border-white/5">
                <div className="flex justify-between items-start">
                   <div>
                      <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedItem.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">Current Balance: {selectedItem.currentStock} {selectedItem.unit}</p>
                   </div>
                   <span className="text-[10px] font-black bg-white dark:bg-card px-3 py-1 rounded-lg text-slate-400 border border-slate-200 dark:border-white/5 underline decoration-orange-500/30">{selectedItem.sku}</span>
                </div>
             </div>

             <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Daily Count Adjustment</label>
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 p-2 rounded-[24px] border border-slate-100 dark:border-white/5">
                         <button className="w-12 h-12 rounded-2xl bg-white dark:bg-card text-slate-400 hover:text-red-500 transition-all flex items-center justify-center shadow-md active:scale-90"><Minus size={20}/></button>
                         <input type="number" placeholder="0.0" className="flex-1 bg-transparent text-center font-black text-2xl outline-none text-slate-900 dark:text-white" />
                         <button className="w-12 h-12 rounded-2xl bg-white dark:bg-card text-slate-400 hover:text-emerald-500 transition-all flex items-center justify-center shadow-md active:scale-90"><Plus size={20}/></button>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Price Refinement</label>
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-[24px] flex items-center gap-3 border border-slate-100 dark:border-white/5">
                         <span className="font-black text-slate-400 text-lg">₹</span>
                         <input type="number" defaultValue={selectedItem.avgPrice} className="w-full bg-transparent font-black text-xl outline-none text-slate-900 dark:text-white focus:text-orange-500 transition-colors" />
                      </div>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Identification / Note</label>
                   <textarea 
                    rows={2} 
                    placeholder="Describe reason for adjustment (e.g. Spillage, Fresh Batch arrival)..."
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-3xl p-6 text-sm font-bold outline-none focus:ring-4 ring-orange-500/10 italic transition-all resize-none"
                  />
                </div>

                <div className="pt-6 flex gap-4">
                   <button 
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-1 py-6 bg-slate-50 dark:bg-white/5 rounded-3xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all border border-slate-200 dark:border-white/5"
                  >
                    Cancel
                  </button>
                   <button 
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-[2] py-6 bg-orange-500 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-orange-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Apply Stock Refinement
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
