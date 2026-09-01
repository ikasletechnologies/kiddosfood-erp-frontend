"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Search, Package, IndianRupee, Zap, Info, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { rawMaterialsApi } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";
import AddMaterialDrawer from "@/components/modules/inventory/AddMaterialDrawer";

import { convertMeasurement, ValidUnit } from "@businessgroupikasle/erp-units";

// Paired units a line item's quantity can be entered in — kg/g and l/ml
// convert into each other; anything else (pcs, unit, ...) has no smaller/
// larger pair and is shown as-is. item.quantity is always stored in the
// material's own base unit (item.unit) — these only affect how the operator
// enters/reads the quantity; the stored value, price-per-base-unit, and the
// line total math are untouched by which entry unit is currently selected.
function getUnitOptions(baseUnit: string): string[] {
  const u = (baseUnit || "").trim().toUpperCase();
  if (u === "KG" || u === "G" || u === "MG") return ["KG", "G", "MG"];
  if (u === "L" || u === "ML") return ["L", "ML"];
  return [u || "UNIT"];
}

function convertQty(qty: number, fromUnit: string, toUnit: string): number {
  if (!qty || fromUnit === toUnit) return qty;
  try {
    return convertMeasurement(qty, fromUnit as ValidUnit, toUnit as ValidUnit).toNumber();
  } catch (e) {
    return qty;
  }
}

// Trims float noise from a conversion (e.g. 0.1 + 0.2 back-conversions)
// without rounding away real precision a user typed.
function roundForDisplay(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export default function LineItemsTable() {
  const { items, addItem, removeItem, updateItem, getVendorPrice, selectedVendor, autoFilledIds, setAutoFilledIds } = usePurchaseOrder();
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  // Per-line "which unit is the operator currently entering/reading the
  // quantity in" — defaults to the material's base unit (item.unit) and is
  // reset whenever a row's material changes.
  const [entryUnits, setEntryUnits] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const prevActiveSearchId = useRef<string | null>(null);
  const [showAddMaterialDrawer, setShowAddMaterialDrawer] = useState(false);
  const [prefilledMaterialName, setPrefilledMaterialName] = useState("");
  const [targetDrawerItemId, setTargetDrawerItemId] = useState<string | null>(null);

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
        const response = await rawMaterialsApi.getAll(false, undefined, 'FINISHED_GOOD');
        setMaterials(response.data || []);
      } catch (error) {
        console.error('Failed to fetch materials', error);
      } finally {
        setLoadingMaterials(false);
      }
    };
    fetchMaterials();
  }, [materialRefreshKey]);

  // In Add Material Drawer success, trigger refresh and auto-select
  const handleAddMaterialSuccess = (createdMaterial?: any) => {
    setMaterialRefreshKey(prev => prev + 1);
    setShowAddMaterialDrawer(false);
    if (createdMaterial && targetDrawerItemId) {
      updateItem(targetDrawerItemId, {
        materialId: createdMaterial.id,
        name: createdMaterial.name,
        unit: createdMaterial.unit || "KG",
        price: createdMaterial.price || 0,
        gstRate: createdMaterial.gstRate || 5
      });
      setEntryUnits(prev => ({ ...prev, [targetDrawerItemId]: createdMaterial.unit || "KG" }));
      setActiveSearchId(null);
    }
  };

  // Auto-sync item name if material is present in inventory materials
  useEffect(() => {
    if (materials.length > 0) {
      items.forEach(i => {
        if (i.materialId && (!i.name || i.name === "Material" || i.name === "Unknown Material")) {
          const m = materials.find(mat => mat.id === i.materialId);
          if (m?.name) {
            updateItem(i.id, { name: m.name, unit: i.unit || m.unit || "KG", gstRate: i.gstRate || m.gstRate || 5 });
          }
        }
      });
    }
  }, [materials]);

  const openAddMaterialManually = (itemId: string, defaultName: string = "") => {
    setTargetDrawerItemId(itemId);
    setPrefilledMaterialName(defaultName);
    setShowAddMaterialDrawer(true);
    setActiveSearchId(null);
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

  // Get all material IDs selected in OTHER rows in the table to prevent duplicate selection
  const otherSelectedMaterialIds = new Set(
    items.filter(item => item.id !== activeSearchId).map(item => item.materialId).filter(Boolean)
  );

  const filteredMaterials = materials.filter(m => {
    // Exclude materials already added to OTHER rows
    if (otherSelectedMaterialIds.has(m.id)) return false;
    
    if (!searchQuery.trim()) return true;
    return m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.sku?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-full min-w-0">
      {/* Desktop Table View (>= 768px) */}
      <div className={clsx(
        "hidden md:block w-full max-w-full transition-all overflow-x-auto custom-scrollbar",
        activeSearchId ? "min-h-[460px] pb-80" : ""
      )}>
        <table className="w-full text-left border-collapse table-auto min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-3 w-12 text-center">#</th>
                <th className="px-3 py-3 min-w-[240px]">Material / Item Detail</th>
                <th className="px-3 py-3 w-32 text-center">SKU</th>
                <th className="px-3 py-3 w-24 text-center">Qty</th>
                <th className="px-2 py-3 w-20 text-center">Unit</th>
                <th className="px-3 py-3 w-36 min-w-[130px] text-center">Unit Price</th>
                <th className="px-2 py-3 w-20 text-center">GST %</th>
                <th className="px-3 py-3 w-36 text-right">Line Total</th>
                <th className="px-2 py-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, index) => {
                const amount = item.quantity * item.price;
                const totalWithGst = amount + (amount * (item.gstRate / 100));
                const material = materials.find(m => m.id === item.materialId);
                const resolvedName = item.name && item.name !== "Material" && item.name !== "Unknown Material"
                  ? item.name
                  : (material?.name || item.name || "");

                return (
                  <tr key={item.id} className={clsx(
                    "group hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-all relative",
                    activeSearchId === item.id ? "z-50" : "z-0"
                  )}>
                    <td className="px-3 py-3.5 align-middle text-[11px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-orange-500 transition-colors text-center">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-3.5 align-middle relative">
                      <div
                        className={clsx(
                          "material-selector-container flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-text relative min-w-0",
                          activeSearchId === item.id ? "z-[100]" : "z-10",
                          !item.materialId 
                            ? "bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-orange-300 focus-within:border-orange-400 focus-within:bg-white" 
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 shadow-2xs"
                        )}
                        onClick={() => setActiveSearchId(item.id)}
                      >
                        <Package size={15} className={clsx("shrink-0", item.materialId ? "text-[#f58220]" : "text-slate-400 dark:text-slate-500")} />
                        <div className="flex flex-col flex-1 min-w-0 relative">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Search Material..."
                              className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal uppercase tracking-tight truncate pr-4"
                              value={activeSearchId === item.id ? searchQuery : resolvedName}
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
                            {(activeSearchId === item.id ? searchQuery : resolvedName) && (
                              <button
                                type="button"
                                className="absolute right-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchQuery("");
                                  updateItem(item.id, { materialId: "", name: "" });
                                  setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                                }}
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                          {material && (
                            <div className="flex items-center flex-wrap gap-1.5 mt-1">
                               <div className={clsx(
                                 "flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap",
                                 material.currentStock <= (material.minimumStock || 10) 
                                   ? "bg-rose-50 text-rose-600 border-rose-200" 
                                   : "bg-emerald-50 text-emerald-600 border-emerald-200"
                               )}>
                                 {material.currentStock <= (material.minimumStock || 10) ? <AlertTriangle size={9} /> : <CheckCircle2 size={9} />}
                                 Stock: {material.currentStock} {item.unit || "KG"}
                               </div>
                              <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap">HSN: {material.hsnCode || "N/A"}</span>
                            </div>
                          )}
                        </div>

                        {!item.materialId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddMaterialManually(item.id, searchQuery || "");
                            }}
                            className="shrink-0 text-[10px] font-bold text-[#f58220] hover:text-[#e8740e] bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800/40 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 uppercase tracking-wide cursor-pointer"
                            title="Add material manually"
                          >
                            <Plus size={11} /> Add
                          </button>
                        )}

                        <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />

                        {activeSearchId === item.id && (
                          <div className="absolute top-[calc(100%+8px)] left-0 w-full max-w-[calc(100vw-2.5rem)] sm:w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[999] overflow-hidden" ref={searchRef}>
                            {/* Dropdown Header */}
                            <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inventory Materials</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddMaterialManually(item.id, searchQuery || "");
                                }}
                                className="text-[10px] font-bold text-[#f58220] hover:text-[#e8740e] flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                              >
                                <Plus size={12} /> Add Material Manually
                              </button>
                            </div>

                          {/* Quick Add row when user typed search query */}
                          {searchQuery.trim().length > 0 && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddMaterialManually(item.id, searchQuery.trim());
                              }}
                              className="p-3 bg-orange-50/70 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900/30 hover:bg-orange-100/70 dark:hover:bg-orange-900/30 cursor-pointer flex items-center justify-between transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="p-1.5 bg-[#f58220] text-white rounded-lg shadow-2xs shrink-0">
                                  <Plus size={13} />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                                    Add &quot;<span className="text-[#f58220]">{searchQuery.trim()}</span>&quot; manually
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">Create new item master</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-[#f58220] uppercase tracking-wider bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-orange-200 shadow-2xs shrink-0">
                                Add Now
                              </span>
                            </div>
                          )}

                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
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
                                        setEntryUnits(prev => ({ ...prev, [item.id]: m.unit || "KG" }));
                                        if (vendorPrice !== null) {
                                          setAutoFilledIds(prev => new Set(prev).add(item.id));
                                        } else {
                                          setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                                        }
                                        setActiveSearchId(null);
                                      }}
                                      className="p-3 hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center"
                                    >
                                       <div className="flex flex-col gap-0.5 min-w-0 pr-3">
                                          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">{m.name}</span>
                                          <div className="flex items-center gap-2">
                                             <span className="text-[10px] font-mono text-slate-400">{m.sku}</span>
                                             {isLow && <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">CRITICAL STOCK</span>}
                                          </div>
                                       </div>
                                       <div className="flex flex-col items-end gap-0.5 shrink-0">
                                          <div className="flex items-center gap-1.5">
                                            {vendorPrice !== null && (
                                              <span className="text-[8px] font-bold text-[#f58220] bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-orange-200 uppercase tracking-tight">
                                                <Zap size={8} /> Vendor Rate
                                              </span>
                                            )}
                                            <span className={`text-xs font-bold ${vendorPrice !== null ? "text-[#f58220]" : "text-slate-900 dark:text-white"}`}>
                                              ₹{displayPrice}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-slate-400">Stock: {m.currentStock} {m.unit}</span>
                                       </div>
                                    </div>
                                  );
                                })}
                                </>
                            ) : (
                                <div className="p-8 text-center space-y-3">
                                   <Package size={28} className="mx-auto text-slate-300" />
                                   <p className="text-xs text-slate-500 font-medium">
                                      {searchQuery ? `No materials found for "${searchQuery}"` : "No materials found in inventory"}
                                   </p>
                                   <button 
                                     type="button"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       openAddMaterialManually(item.id, searchQuery || "");
                                     }} 
                                     className="inline-flex items-center gap-2 px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                                   >
                                      <Plus size={14} /> Add Material Manually
                                   </button>
                                </div>
                            )}
                         </div>

                         {/* Dropdown Sticky Bottom Action */}
                         <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex justify-center">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddMaterialManually(item.id, searchQuery || "");
                              }} 
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 text-[#f58220] border border-orange-200 dark:border-orange-800/40 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                               <Plus size={14} /> Add Material Manually
                            </button>
                         </div>
                       </div>
                    )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 align-middle text-center">
                     <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md whitespace-nowrap">
                        {material?.sku || "---"}
                     </span>
                  </td>
                  <td className="px-3 py-3.5 align-middle">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      className="w-full py-2 px-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none text-xs font-bold text-center border border-slate-200 dark:border-slate-800 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={item.quantity === 0 ? "" : item.quantity}
                      onChange={(e) => {
                        const entered = parseFloat(e.target.value) || 0;
                        updateItem(item.id, { quantity: entered });
                      }}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                    />
                  </td>
                  <td className="px-2 py-3.5 align-middle text-center">
                    {(() => {
                      const baseUnit = item.unit || "KG";
                      const options = getUnitOptions(baseUnit);
                      return (
                        <select
                          className="w-full py-1.5 px-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg outline-none text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center border border-transparent focus:border-orange-400 transition-all cursor-pointer appearance-none disabled:cursor-not-allowed"
                          style={{ textAlignLast: 'center' }}
                          value={item.unit}
                          disabled={options.length < 2}
                          title={options.length < 2 ? "This item has no alternate unit to convert to" : "Change the unit this quantity is entered in"}
                          onChange={(e) => {
                            const newUnit = e.target.value;
                            const newQty = convertQty(item.quantity, item.unit, newUnit);
                            updateItem(item.id, { unit: newUnit, quantity: roundForDisplay(newQty) });
                          }}
                        >
                          {options.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3.5 align-middle">
                    <div className="relative group/price min-w-[110px]">
                      <div className={clsx(
                        "flex items-center rounded-xl border transition-all overflow-hidden",
                        autoFilledIds.has(item.id)
                          ? "bg-orange-50/50 border-orange-300 text-[#f58220] focus-within:bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-within:border-orange-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-100"
                      )}>
                        <span className="pl-2.5 pr-1 text-xs font-bold text-slate-400 dark:text-slate-500 select-none">₹</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          className="w-full py-2 pr-2.5 bg-transparent outline-none text-xs font-bold text-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={item.price === 0 ? "" : item.price}
                          onChange={(e) => {
                            updateItem(item.id, { price: parseFloat(e.target.value) || 0 });
                            setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                          }}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                        />
                      </div>
                      {autoFilledIds.has(item.id) && (
                        <div className="absolute -top-3 left-1 flex items-center gap-0.5 text-[8px] font-bold text-orange-600 bg-orange-50 px-1 py-0.2 rounded border border-orange-200 uppercase tracking-tight whitespace-nowrap">
                          <Zap size={7} /> Auto Rate
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3.5 align-middle text-center">
                    <select
                      className="w-full py-2 px-1.5 bg-purple-50/80 dark:bg-purple-900/20 rounded-xl outline-none text-xs font-bold text-purple-700 dark:text-purple-300 text-center border border-purple-200 dark:border-purple-800/40 focus:border-purple-400 transition-all cursor-pointer appearance-none text-center-last"
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
                  <td className="px-3 py-3.5 align-middle text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                       <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                         ₹{totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </span>
                       <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                         Tax: ₹{(totalWithGst - amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </span>
                    </div>
                  </td>
                  <td className="px-2 py-3.5 align-middle text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      title="Remove line item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Item Cards View (< 768px) */}
      <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
        {items.map((item, index) => {
          const amount = item.quantity * item.price;
          const totalWithGst = amount + (amount * (item.gstRate / 100));
          const material = materials.find(m => m.id === item.materialId);
          const resolvedName = item.name && item.name !== "Material" && item.name !== "Unknown Material"
            ? item.name
            : (material?.name || item.name || "");
          const baseUnit = item.unit || "KG";
          const options = getUnitOptions(baseUnit);

          return (
            <div key={item.id} className="bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-0.5 rounded-full">
                    Item #{String(index + 1).padStart(2, '0')}
                  </span>
                  {material?.sku && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {material.sku}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>

              {/* Material Search Field */}
              <div className="space-y-1 relative">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Material / Raw Material <span className="text-rose-500">*</span>
                </label>
                <div
                  className={clsx(
                    "material-selector-container flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-text relative min-w-0",
                    activeSearchId === item.id ? "z-[100]" : "z-10",
                    !item.materialId 
                      ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 focus-within:border-orange-400" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 shadow-2xs"
                  )}
                  onClick={() => setActiveSearchId(item.id)}
                >
                  <Package size={15} className={clsx("shrink-0", item.materialId ? "text-[#f58220]" : "text-slate-400 dark:text-slate-500")} />
                  <div className="flex flex-col flex-1 min-w-0 relative">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Search Material..."
                        className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal uppercase tracking-tight truncate pr-4"
                        value={activeSearchId === item.id ? searchQuery : resolvedName}
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
                      />
                      {(activeSearchId === item.id ? searchQuery : resolvedName) && (
                        <button
                          type="button"
                          className="absolute right-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery("");
                            updateItem(item.id, { materialId: "", name: "" });
                            setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />

                  {/* Dropdown in Mobile Card */}
                  {activeSearchId === item.id && (
                    <div className="absolute top-[calc(100%+6px)] left-0 w-full max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[999] overflow-hidden" ref={searchRef}>
                      <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inventory Materials</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddMaterialManually(item.id, searchQuery || "");
                          }}
                          className="text-[10px] font-bold text-[#f58220] hover:text-[#e8740e] flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                        >
                          <Plus size={12} /> Add New
                        </button>
                      </div>

                      {searchQuery.trim().length > 0 && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddMaterialManually(item.id, searchQuery.trim());
                          }}
                          className="p-3 bg-orange-50/70 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900/30 hover:bg-orange-100/70 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <Plus size={13} className="text-[#f58220] shrink-0" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              Add &quot;{searchQuery.trim()}&quot;
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-[#f58220] uppercase bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-orange-200 shrink-0">
                            Add
                          </span>
                        </div>
                      )}

                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMaterials.length > 0 ? (
                          filteredMaterials.map(m => {
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
                                  setEntryUnits(prev => ({ ...prev, [item.id]: m.unit || "KG" }));
                                  if (vendorPrice !== null) {
                                    setAutoFilledIds(prev => new Set(prev).add(item.id));
                                  } else {
                                    setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                                  }
                                  setActiveSearchId(null);
                                }}
                                className="p-3 hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center"
                              >
                                 <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">{m.name}</span>
                                    <div className="flex items-center gap-1.5">
                                       <span className="text-[10px] font-mono text-slate-400">{m.sku}</span>
                                       {isLow && <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded">LOW STOCK</span>}
                                    </div>
                                 </div>
                                 <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    <span className="text-xs font-bold text-orange-500 font-mono">₹{displayPrice}</span>
                                    <span className="text-[10px] text-slate-400">Stock: {m.currentStock} {m.unit}</span>
                                 </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-500">No materials matched</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {material && (
                  <div className="flex items-center flex-wrap gap-1.5 pt-1">
                     <div className={clsx(
                       "flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap",
                       material.currentStock <= (material.minimumStock || 10) 
                         ? "bg-rose-50 text-rose-600 border-rose-200" 
                         : "bg-emerald-50 text-emerald-600 border-emerald-200"
                     )}>
                       {material.currentStock <= (material.minimumStock || 10) ? <AlertTriangle size={9} /> : <CheckCircle2 size={9} />}
                       Stock: {material.currentStock} {item.unit || "KG"}
                     </div>
                    <span className="text-[9px] font-medium text-slate-400">HSN: {material.hsnCode || "N/A"}</span>
                  </div>
                )}
              </div>

              {/* Quantity & Unit Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    className="w-full py-2 px-2.5 bg-white dark:bg-slate-900 rounded-xl outline-none text-xs font-bold text-center border border-slate-200 dark:border-slate-800 focus:border-orange-400"
                    value={item.quantity === 0 ? "" : item.quantity}
                    onChange={(e) => {
                      const entered = parseFloat(e.target.value) || 0;
                      updateItem(item.id, { quantity: entered });
                    }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Unit</label>
                  <select
                    className="w-full py-2 px-2 bg-white dark:bg-slate-900 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center border border-slate-200 dark:border-slate-800 focus:border-orange-400"
                    value={item.unit}
                    disabled={options.length < 2}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const newQty = convertQty(item.quantity, item.unit, newUnit);
                      updateItem(item.id, { unit: newUnit, quantity: roundForDisplay(newQty) });
                    }}
                  >
                    {options.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Price & GST Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Price</label>
                    {autoFilledIds.has(item.id) && (
                      <span className="text-[8px] font-bold text-orange-600 bg-orange-50 px-1 py-0.2 rounded border border-orange-200 uppercase">
                        Auto
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 focus-within:border-orange-400">
                    <span className="pl-2.5 text-xs font-bold text-slate-400 select-none">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      className="w-full py-2 pl-1 pr-2 bg-transparent outline-none text-xs font-bold font-mono text-slate-800 dark:text-white"
                      value={item.price === 0 ? "" : item.price}
                      onChange={(e) => {
                        updateItem(item.id, { price: parseFloat(e.target.value) || 0 });
                        setAutoFilledIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">GST %</label>
                  <select
                    className="w-full py-2 px-2 bg-purple-50/80 dark:bg-purple-900/20 rounded-xl outline-none text-xs font-bold text-purple-700 dark:text-purple-300 text-center border border-purple-200 dark:border-purple-800/40 focus:border-purple-400"
                    value={item.gstRate}
                    onChange={(e) => updateItem(item.id, { gstRate: parseFloat(e.target.value) || 0 })}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* Card Footer: Total Amount */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium">Line Total (incl. Tax):</span>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    ₹{totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="text-[9px] text-slate-400 font-medium">
                    Tax: ₹{(totalWithGst - amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={addItem}
        className="w-full py-3.5 sm:py-4 mt-3 sm:mt-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white hover:border-orange-400 hover:text-orange-500 transition-all group cursor-pointer active:scale-95"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-sm border border-slate-100 group-hover:border-orange-400 group-hover:bg-[#f58220] group-hover:text-white flex items-center justify-center transition-all">
          <Plus size={15} />
        </div>
        Add New Line Item
      </button>

      <AddMaterialDrawer 
        isOpen={showAddMaterialDrawer} 
        onClose={() => setShowAddMaterialDrawer(false)} 
        onSuccess={handleAddMaterialSuccess} 
        initialName={prefilledMaterialName}
      />
    </div>
  );
}
