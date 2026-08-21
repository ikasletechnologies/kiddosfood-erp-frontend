"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Search, Package, IndianRupee, Zap, Info, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { rawMaterialsApi } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";
import AddMaterialDrawer from "@/components/modules/inventory/AddMaterialDrawer";

export default function LineItemsTable() {
  const { items, addItem, removeItem, updateItem, getVendorPrice, selectedVendor, autoFilledIds, setAutoFilledIds } = usePurchaseOrder();
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const prevActiveSearchId = useRef<string | null>(null);
  const [showAddMaterialDrawer, setShowAddMaterialDrawer] = useState(false);

  // Reset search query when switching items
  useEffect(() => {
    if (activeSearchId !== prevActiveSearchId.current) {
      setSearchQuery("");
      prevActiveSearchId.current = activeSearchId;
    }
  }, [activeSearchId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the click is on the input or its container, we don't want to close it here,
      // because the input's own click/focus handlers will manage it.
      // We check if the click target is within a .material-selector-container
      const target = event.target as Element;
      if (target.closest('.material-selector-container')) {
        return;
      }
      
      if (searchRef.current && !searchRef.current.contains(target as Node)) {
        setActiveSearchId(null);
      }
    };

    if (activeSearchId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeSearchId]);

  const [materialRefreshKey, setMaterialRefreshKey] = useState(0);

  // Fetch materials (including filter) – refresh when key changes
  useEffect(() => {
    const fetchMaterials = async () => {
      setLoadingMaterials(true);
      try {
        const response = await rawMaterialsApi.getAll();
        console.log('Fetched raw materials (filtered):', response.data);
        setMaterials(response.data);
      } catch (error) {
        console.error('Failed to fetch materials', error);
      } finally {
        setLoadingMaterials(false);
      }
    };
    fetchMaterials();
  }, [materialRefreshKey]);

  // In Add Material Drawer success, trigger refresh
  const handleAddMaterialSuccess = () => {
    setMaterialRefreshKey(prev => prev + 1);
    setShowAddMaterialDrawer(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === "Enter" && !activeSearchId) {
      e.preventDefault();
      addItem();
    }
    if (e.key === " " && (e.target as HTMLInputElement).placeholder.includes("Material")) {
      e.preventDefault();
      setActiveSearchId(itemId);
      setSearchQuery("");
    }
  };

  // Get all material IDs currently selected in the table to prevent duplicate selection
  const selectedMaterialIds = new Set(
    items.map(item => item.materialId).filter(Boolean)
  );

  const filteredMaterials = materials.filter(m => {
    // Exclude materials already added to the table
    if (selectedMaterialIds.has(m.id)) return false;
    
    return m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.sku?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-full">
      <div className="w-full">
        <table className="w-full text-left border-collapse table-auto">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 w-10 text-center">#</th>
              <th className="px-4 py-3">Material / Item Detail</th>
              <th className="px-4 py-3 w-32 hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 w-24">Qty</th>
              <th className="px-4 py-3 w-20 hidden sm:table-cell">Unit</th>
              <th className="px-4 py-3 w-32">Unit Price</th>
              <th className="px-4 py-3 w-20 text-center hidden sm:table-cell">GST %</th>
              <th className="px-4 py-3 w-28 text-right">Line Total</th>
              <th className="px-4 py-3 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-50 dark:divide-slate-800">
            {items.map((item, index) => {
              const amount = item.quantity * item.price;
              const totalWithGst = amount + (amount * (item.gstRate / 100));
              const material = materials.find(m => m.id === item.materialId);

              return (
                <tr key={item.id} className={clsx(
                  "group hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-all relative",
                  activeSearchId === item.id ? "z-50" : "z-0"
                )}>
                  <td className="px-6 py-4 align-middle text-[10px] font-black text-slate-400 dark:text-slate-500 group-hover:text-orange-500 transition-colors text-center">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-4 align-top relative">
                    <div
                      className={clsx(
                        "material-selector-container flex items-center gap-3 p-2 rounded-xl border transition-all cursor-text relative",
                        activeSearchId === item.id ? "z-[100]" : "z-10",
                        !item.materialId 
                          ? "bg-slate-50/50 dark:bg-slate-950/50 border-transparent focus-within:border-orange-100" 
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 shadow-sm"
                      )}
                      onClick={() => setActiveSearchId(item.id)}
                    >
                      <Package size={14} className={item.materialId ? "text-orange-500" : "text-slate-400 dark:text-slate-500"} />
                        <div className="flex flex-col flex-1 relative">
                          <input
                            type="text"
                            placeholder="Search Material..."
                            className="w-full bg-transparent outline-none text-xs font-black text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-bold uppercase tracking-tight"
                            value={activeSearchId === item.id ? searchQuery : item.name}
                            readOnly={false}
                            onChange={(e) => {
                               setSearchQuery(e.target.value);
                               if (item.materialId) {
                                  updateItem(item.id, { materialId: "", name: "" });
                                  setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                               }
                               if (activeSearchId !== item.id) setActiveSearchId(item.id);
                            }}
                            onFocus={() => {
                               setActiveSearchId(item.id);
                               setSearchQuery("");
                            }}
                            onKeyDown={(e) => handleKeyDown(e, item.id)}
                          />
            {activeSearchId === item.id ? searchQuery : item.name && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
                          {material && (
                            <div className="flex items-center gap-2 mt-1">
                               <div className={clsx(
                                 "flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border",
                                 material.currentStock <= (material.minimumStock || 10) 
                                   ? "bg-red-50 text-red-500 border-red-100" 
                                   : "bg-green-50 text-green-600 border-green-100"
                               )}>
                                 {material.currentStock <= (material.minimumStock || 10) ? <AlertTriangle size={8} /> : <CheckCircle2 size={8} />}
                                 Stock: {material.currentStock} {item.unit}
                               </div>
                              <span className="text-[8px] font-bold text-slate-400">HSN: {material.hsnCode || "N/A"}</span>
                            </div>
                          )}
                        </div>
                        <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 mr-1" />

                        {activeSearchId === item.id && (
                          <div className="absolute top-[calc(100%+8px)] left-0 w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[100] overflow-hidden" ref={searchRef}>
                             <div className="max-h-60 overflow-y-auto">
                            {filteredMaterials.length > 0 ? (
                                <>
                                  {filteredMaterials.map(m => {
                                    const vendorPrice = getVendorPrice(m.id);
                                  const displayPrice = vendorPrice !== null ? vendorPrice : (m.price || 0);
                                  const isLow = m.currentStock <= (m.minimumStock || 10);

                                  return (
                                    <div
                                      key={m.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateItem(item.id, {
                                          materialId: m.id,
                                          name: m.name,
                                          unit: m.unit || "KG",
                                          price: displayPrice,
                                          gstRate: m.gstRate || 5
                                        });
                                        if (vendorPrice !== null) {
                                          setAutoFilledIds(prev => new Set(prev).add(item.id));
                                        } else {
                                          setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                                        }
                                        setActiveSearchId(null);
                                      }}
                                      className="p-3 hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center"
                                    >
                                       <div className="flex flex-col gap-0.5">
                                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{m.name}</span>
                                          <div className="flex items-center gap-2">
                                             <span className="text-[9px] font-bold text-slate-400">{m.sku}</span>
                                             {isLow && <span className="text-[8px] font-black text-red-500 bg-red-50 px-1 py-0.5 rounded">CRITICAL STOCK</span>}
                                          </div>
                                       </div>
                                       <div className="flex flex-col items-end gap-1">
                                          <div className="flex items-center gap-2">
                                            {vendorPrice !== null && (
                                              <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-orange-100 uppercase tracking-tighter">
                                                <Zap size={8} /> Vendor Rate
                                              </span>
                                            )}
                                            <span className={`text-[10px] font-black ${vendorPrice !== null ? "text-orange-500" : "text-slate-900"}`}>
                                              ₹{displayPrice}
                                            </span>
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-400">Stock: {m.currentStock} {m.unit}</span>
                                       </div>
                                    </div>
                                  );
                                })}
                                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 sticky bottom-0 flex justify-center">
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setShowAddMaterialDrawer(true);
                                     }} 
                                     className="inline-flex items-center gap-2 px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
                                   >
                                      <Plus size={14} /> Add New Material
                                   </button>
                                </div>
                                </>
                            ) : (
                                <div className="p-10 text-center space-y-4">
                                   <Package size={32} className="mx-auto text-slate-100" />
                                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                      {!selectedVendor ? "Please select a vendor first" : "No materials found"}
                                   </p>
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setShowAddMaterialDrawer(true);
                                     }} 
                                     className="inline-flex items-center gap-2 px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm mt-2"
                                   >
                                      <Plus size={14} /> Add New Material
                                   </button>
                                </div>
                            )}
                         </div>
                       </div>
                    )}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top hidden md:table-cell">
                     <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-50 px-2 py-1 rounded dark:bg-slate-800 whitespace-nowrap">
                        {material?.sku || "---"}
                     </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <input
                      type="number"
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-black text-center border border-slate-200 dark:border-slate-800 focus:border-orange-300 focus:bg-white transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={item.quantity === 0 ? "" : item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                    />
                  </td>
                  <td className="px-4 py-4 align-top hidden sm:table-cell">
                    <div className="p-2 text-[10px] font-black text-slate-500 dark:text-slate-400 text-center uppercase tracking-widest bg-slate-50/30 rounded-lg border border-slate-100 dark:border-slate-800">
                       {item.unit}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="relative group/price">
                      <IndianRupee size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="number"
                        className={clsx(
                          "w-full pl-7 p-2 rounded-xl outline-none text-xs font-black border transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          autoFilledIds.has(item.id)
                            ? "bg-orange-50/50 border-orange-200 text-orange-500 focus:bg-white focus:border-orange-400"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:border-orange-300 focus:bg-white"
                        )}
                        value={item.price === 0 ? "" : item.price}
                        onChange={(e) => {
                          updateItem(item.id, { price: parseFloat(e.target.value) || 0 });
                          setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                        }}
                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                      />
                      {autoFilledIds.has(item.id) && (
                        <div className="absolute -top-3.5 left-0 flex items-center gap-1 text-[8px] font-black text-orange-500 uppercase tracking-tighter">
                          <Zap size={8} /> Auto Vendor Rate
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-4 align-top text-center">
                    <select
                      className="w-full p-2 bg-purple-50/50 dark:bg-purple-900/20 rounded-xl outline-none text-xs font-black text-purple-600 text-center border-2 border-transparent focus:border-purple-200 transition-all cursor-pointer appearance-none text-center-last"
                      style={{ textAlignLast: 'center' }}
                      value={item.gstRate}
                      onChange={(e) => updateItem(item.id, { gstRate: parseFloat(e.target.value) || 0 })}
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="px-4 py-4 align-top text-right">
                    <div className="flex flex-col items-end">
                       <span className="text-sm font-black text-slate-900 dark:text-white">
                         ₹{totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </span>
                       <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                         Tax: ₹{(totalWithGst - amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle text-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={addItem}
        className="w-full py-4 mt-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white hover:border-orange-400 hover:text-orange-500 transition-all group"
      >
        <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 group-hover:border-orange-400 group-hover:bg-[#f58220] group-hover:text-white flex items-center justify-center transition-all">
          <Plus size={16} />
        </div>
        Add New Line Item
      </button>

      <AddMaterialDrawer 
        isOpen={showAddMaterialDrawer} 
        onClose={() => setShowAddMaterialDrawer(false)} 
        onSuccess={handleAddMaterialSuccess} 
      />
    </div>
  );
}
