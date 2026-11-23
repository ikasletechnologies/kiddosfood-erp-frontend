"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  AlertTriangle, 
  Package, 
  History as HistoryIcon,
  AlertCircle,
  Scale,
  TrendingDown,
  ChevronRight
} from "lucide-react";
import { inventoryApi } from "@/lib/api";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/context/AuthContext";

const getStockInPhysicalUnit = (stock: number, sku: string, category?: string): number => {
  if (!sku || category !== 'FINISHED_GOOD') return stock;
  const parts = sku.split('-');
  const sizePart = parts.length >= 2 ? parts[parts.length - 1] : "";
  const match = sizePart.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
  if (!match) return stock;

  const weightVal = parseFloat(match[1]);
  const weightUnit = match[2].toUpperCase();

  const totalVal = stock * weightVal;
  if (weightUnit === "G" || weightUnit === "ML") {
    return totalVal / 1000;
  }
  return totalVal;
};

export default function InventoryPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();

  const totalValue = useMemo(() => {
    return items.reduce((acc, i) => acc + ((i.currentStock || 0) * (i.costPrice || 0)), 0);
  }, [items]);


  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "RAW_MATERIAL",
    quantity: 0,
    unit: "kg",
    minStockLevel: 5,
    franchiseId: ""
  });

  useEffect(() => {
    fetchInventory();
  }, [user]);


  const fetchInventory = async () => {
    try {
      setLoading(true);
      const franchiseId = user?.franchiseId || "root";
      const response = await inventoryApi.getInventory(franchiseId);
      const mapped = response.data.map((item: any) => {
        const physicalStock = getStockInPhysicalUnit(item.currentStock || 0, item.sku, item.category);
        
        const parts = item.sku ? item.sku.split('-') : [];
        const sizePart = parts.length >= 2 ? parts[parts.length - 1] : "";
        const match = sizePart.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
        const displayUnit = (item.category === 'FINISHED_GOOD' && match) ? match[2].toUpperCase() : item.unit;

        return {
          ...item,
          quantity: physicalStock,
          unit: displayUnit,
          minStockLevel: item.minimumStock
        };
      });
      setItems(mapped);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minStockLevel: item.minStockLevel,
        franchiseId: item.franchiseId || ""
      });
    } else {
      setSelectedItem(null);
      setFormData({
        name: "",
        sku: "",
        category: "RAW_MATERIAL",
        quantity: 0,
        unit: "kg",
        minStockLevel: 5,
        franchiseId: user?.franchiseId || ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedItem) {
        // In a real scenario, you'd have an update endpoint
        // await inventoryApi.update(selectedItem.id, formData);
      } else {
        await inventoryApi.createItem(formData);
      }
      setIsModalOpen(false);
      fetchInventory();
    } catch (error) {
      console.error("Failed to save inventory item:", error);
    }
  };

  const columns = useMemo(() => [
    {
      header: "Item Specification",
      accessor: (item: any) => (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-black text-xs shadow-sm shadow-slate-200 dark:shadow-none border border-slate-200 dark:border-slate-800">
            {item.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xs">{item.name}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{item.sku}</p>
          </div>
        </div>
      )
    },
    {
      header: "Category",
      accessor: (item: any) => (
        <StatusBadge 
          label={item.category.replace('_', ' ')} 
          type={item.category === 'RAW_MATERIAL' ? 'info' : 'warning'} 
        />
      )
    },
    {
      header: "Stock Level",
      accessor: (item: any) => (
        <div className="flex flex-col">
          <span className={`text-sm font-black ${item.quantity <= item.minStockLevel ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            {item.quantity} {item.unit}
          </span>
          {item.quantity <= item.minStockLevel && (
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
              <AlertCircle size={8} /> CRITICAL
            </span>
          )}
        </div>
      )
    },
    {
      header: "Min Alert",
      accessor: (item: any) => (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
          Below {item.minStockLevel} {item.unit}
        </span>
      )
    }
  ], []);

  const filteredItems = useMemo(() => {
    return items.filter((item: any) => {
      const searchStr = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
      return searchStr.includes(searchTerm.trim().toLowerCase());
    });
  }, [items, searchTerm]);

  if (!mounted) return <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617]" />;

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 py-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
            Inventory <span className="text-slate-400 font-medium ml-2 tracking-tighter">Control</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Strategic stock management for <span className="text-[#F58220] font-bold">Kiddos Foods</span> operations.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="hidden md:flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <HistoryIcon size={16} />
            History
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl transition-all active:scale-95 transform shadow-slate-200 dark:shadow-none"
          >
            <Plus size={18} />
            Add New Item
          </button>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Items", value: items.length, icon: Package, color: "bg-blue-500" },
          { label: "Low Stock", value: items.filter(i => i.quantity <= i.minStockLevel).length, icon: AlertTriangle, color: "bg-red-500" },
          { label: "Expiring", value: 0, icon: TrendingDown, color: "bg-amber-500" },
          { label: "Total Value", value: `₹${totalValue.toLocaleString()}`, icon: Scale, color: "bg-green-500" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#020617] p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
            </div>
            <div className={`${stat.color} p-3 rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      <DataTable 
        columns={columns} 
        data={filteredItems} 
        loading={loading}
        onSearch={setSearchTerm}
        onRowClick={handleOpenModal}
        searchPlaceholder="Scan SKU or item name..."
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedItem ? "Modify Stock Record" : "Register Inventory"}
        size="md"
        footer={(
          <>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-200 dark:shadow-none hover:opacity-90 transition-all active:scale-95"
            >
              {selectedItem ? "Save Changes" : "Confirm Entry"}
            </button>
          </>
        )}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Description</label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SKU Identification</label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm uppercase"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Measurement Unit</label>
              <select 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm appearance-none"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
              >
                <option value="kg">kilograms (kg)</option>
                <option value="g">grams (g)</option>
                <option value="l">liters (l)</option>
                <option value="ml">milliliters (ml)</option>
                <option value="pcs">pieces (pcs)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Stock Balance</label>
              <input 
                type="number" 
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Critical Alert Level</label>
              <input 
                type="number" 
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({...formData, minStockLevel: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
