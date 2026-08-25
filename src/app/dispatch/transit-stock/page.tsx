"use client";

import { useState, useEffect } from "react";
import { Truck, Search, CheckCircle, Clock } from "lucide-react";
import { clsx } from "clsx";
import { salesApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/utils";

interface TransitItem {
  id: string;
  challanId: string;
  challanNumber: string;
  dispatchDate: string;
  source: string;
  destination: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  status: string;
}

export default function TransitStockPage() {
  const [items, setItems] = useState<TransitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { showToast } = useToast();

  const fetchTransitStock = async () => {
    setLoading(true);
    try {
      const res = await salesApi.getDeliveryChallans({ status: "IN_TRANSIT" });
      const challans = (res as any).data || [];

      const flatItems: TransitItem[] = [];
      challans.forEach((dc: any) => {
        const destName = dc.customer?.name || dc.franchiseId || "Customer/Franchise";
        const srcName = dc.sourceFranchiseId === "hq-001" ? "HQ / Main Warehouse" : (dc.sourceFranchiseId || "HQ / Main Warehouse");
        
        if (dc.items && Array.isArray(dc.items)) {
          dc.items.forEach((it: any) => {
            flatItems.push({
              id: it.id,
              challanId: dc.id,
              challanNumber: dc.challanNumber || dc.challanNo || dc.id.substring(0, 8),
              dispatchDate: dc.challanDate || dc.createdAt,
              source: srcName,
              destination: destName,
              productName: it.productName,
              batchNumber: it.batchNumber || "N/A",
              quantity: it.quantity,
              unit: it.unit || "NONE",
              status: dc.status,
            });
          });
        }
      });
      setItems(flatItems);
    } catch (e: any) {
      console.error(e);
      showToast("Failed to fetch transit stock", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransitStock();
  }, []);

  const handleMarkDelivered = async (challanId: string) => {
    if (!window.confirm("Mark this entire dispatch as Delivered? This will move stock to the destination.")) return;
    
    try {
      await salesApi.updateDeliveryChallan(challanId, { status: "CLOSED" });
      showToast("Delivery completed successfully", "success");
      fetchTransitStock();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Error marking as delivered", "error");
    }
  };

  const filteredItems = items.filter(it => 
    !search || 
    it.challanNumber.toLowerCase().includes(search.toLowerCase()) ||
    it.productName.toLowerCase().includes(search.toLowerCase()) ||
    it.destination.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50">
      <div className="px-6 py-5 border-b border-gray-200 bg-white shrink-0">


        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Challan, Product or Destination..."
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>
          <button 
            onClick={fetchTransitStock} 
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
            title="Refresh"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48 text-gray-400 text-sm">Loading Transit Stock...</div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48 text-gray-400">
              <Truck size={32} className="mb-2 opacity-50" />
              <div className="text-sm">No items currently in transit</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Dispatch Ref</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Date</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Source</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Destination</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Product</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Batch</th>
                    <th className="px-5 py-3 font-medium text-right whitespace-nowrap">Qty</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 font-medium text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-orange-600">#{item.challanNumber}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {formatDate(item.dispatchDate)}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700">{item.source}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 font-medium">{item.destination}</td>
                      <td className="px-5 py-3 text-sm text-gray-800">{item.productName}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-600">{item.batchNumber}</td>
                      <td className="px-5 py-3 text-sm font-medium text-right">
                        {item.quantity} <span className="text-xs text-gray-500 font-normal">{item.unit}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-600 border border-blue-200">
                          {item.status === 'IN_TRANSIT' || item.status === 'OPEN' ? 'IN TRANSIT' : item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleMarkDelivered(item.challanId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-semibold transition-colors border border-emerald-200 shadow-sm"
                        >
                          <CheckCircle size={14} /> Delivered
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
