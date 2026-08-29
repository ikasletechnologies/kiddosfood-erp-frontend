"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Printer, AlertCircle, AlertTriangle, CheckCircle2,
  RefreshCw, ChefHat, Database, Pencil, Check, Plus, Warehouse, X, ShoppingCart
} from "lucide-react";
import { recipesApi, inventoryApi, franchiseApi, productionApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { convertUnit } from "@/lib/unitConversion";

interface RecipeItem {
  id: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: string;
  inventoryItem: {
    name: string;
    sku: string;
    currentStock: number;
  };
}

interface Recipe {
  id: string;
  name: string;
  yieldQty: number;
  yieldUnit: string;
  instructions?: string;
  productId: string;
  recipeItems: RecipeItem[];
}

export default function FormulaScalingTab() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [targetYield, setTargetYield] = useState<number>(0);
  const [targetUnit, setTargetUnit] = useState<string>("");
  const [isEditingUnit, setIsEditingUnit] = useState(false);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [franchiseId, setFranchiseId] = useState<string>("");
  const [launching, setLaunching] = useState(false);

  // Add Warehouse modal
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [newWhLocation, setNewWhLocation] = useState("");
  const [savingWh, setSavingWh] = useState(false);

  const recipe = recipes.find((r) => r.id === selectedRecipeId);

  useEffect(() => {
    async function initData() {
      try {
        const [rRes, wRes, fRes] = await Promise.all([
          recipesApi.getAll(),
          inventoryApi.getWarehouses(),
          franchiseApi.getAll()
        ]);
        setRecipes(rRes.data || []);
        const whList = wRes.data || [];
        setWarehouses(whList);
        if (rRes.data?.length > 0) {
          setSelectedRecipeId(rRes.data[0].id);
          setTargetYield(rRes.data[0].yieldQty || 100);
          setTargetUnit(rRes.data[0].yieldUnit || "kg");
        }
        if (whList.length > 0) {
          setSelectedWarehouseId(whList[0].id);
        }
        const franchiseList = fRes.data || [];
        if (franchiseList.length > 0) {
          setFranchiseId(franchiseList[0].id);
        }
      } catch (err) {
        toast.error("Failed to load recipes or warehouses");
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    async function loadStock() {
      setStockLoading(true);
      try {
        // Same endpoint the Raw Material Stock page uses — previously this
        // called a separate warehouse-report endpoint with its own (buggier,
        // more restrictive) candidate-item logic, so the two pages could
        // disagree on stock for the exact same warehouse+item.
        const res = await inventoryApi.getRawMaterialStockSummary(selectedWarehouseId);
        setWarehouseStock(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Warehouse stock load error:", err);
        setWarehouseStock([]);
      } finally {
        setStockLoading(false);
      }
    }
    loadStock();
  }, [selectedWarehouseId]);

  const handleRecipeChange = (id: string) => {
    setSelectedRecipeId(id);
    const found = recipes.find((r) => r.id === id);
    if (found) {
      setTargetYield(found.yieldQty || 100);
      setTargetUnit(found.yieldUnit || "kg");
      setIsEditingUnit(false);
    }
  };

  const handleUnitEditToggle = () => {
    setIsEditingUnit(true);
    setTimeout(() => unitInputRef.current?.focus(), 50);
  };

  const handleUnitConfirm = () => {
    setIsEditingUnit(false);
  };

  const recipeUnit = recipe?.yieldUnit || "KG";
  const effectiveTargetUnit = targetUnit || recipeUnit;
  const targetYieldInRecipeUnit = convertUnit(targetYield, effectiveTargetUnit, recipeUnit);
  const multiplier = recipe && recipe.yieldQty > 0 ? targetYieldInRecipeUnit / recipe.yieldQty : 1;

  // Stock is stored and reported in the inventory item's own unit (e.g. KG),
  // while the recipe's requirement is expressed in the recipe item's unit
  // (e.g. g) — those are two independent fields with no guarantee they
  // match. Converting the raw stock figure into the recipe's unit here is
  // what makes every comparison/display below apples-to-apples; without it,
  // 8 KG of stock reads as "8" against a 500 g requirement and looks short.
  const getAvailableStock = (itemId: string, itemSku: string, recipeUnit: string) => {
    if (!Array.isArray(warehouseStock)) return 0;
    const found = warehouseStock.find((fi: any) => {
      const matchSku = fi.sku && itemSku && fi.sku.trim().toLowerCase() === itemSku.trim().toLowerCase();
      const matchId = fi.inventoryItemId === itemId || fi.id === itemId;
      return matchSku || matchId;
    });
    if (!found) return 0;
    return convertUnit(found.availableStock ?? 0, found.unit, recipeUnit);
  };

  // True if the selected warehouse doesn't have enough of at least one
  // ingredient for the scaled batch — used to send "Start Production" to
  // Purchase Orders instead of a run that would just fail on insufficient stock.
  const EPSILON = 0.000001;
  const hasShortage = recipe
    ? recipe.recipeItems.some((item) => {
        const scaledQty = item.quantityRequired * multiplier;
        const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
        return available + EPSILON < scaledQty;
      })
    : false;

  const handleStartProduction = async () => {
    if (!recipe) return;
    if (hasShortage) {
      const shortageItems = recipe.recipeItems
        .map((item) => {
          const required = item.quantityRequired * multiplier;
          const stock = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
          const shortage = required - stock;
          return {
            materialId: item.inventoryItemId,
            name: item.inventoryItem?.name || "",
            required,
            stock,
            shortage,
            unit: item.unit || "KG",
          };
        })
        .filter((item) => item.shortage > 0);

      sessionStorage.setItem('prefilledPoItems', JSON.stringify(shortageItems));
      router.push('/purchases/new');
      return;
    }
    if (!selectedWarehouseId) {
      toast.error("Select a warehouse / stock location first.");
      return;
    }
    if (multiplier <= 0) {
      toast.error("Target batch yield must be greater than 0.");
      return;
    }

    setLaunching(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      await productionApi.startBatch({
        recipeId: recipe.id,
        franchiseId,
        warehouseId: selectedWarehouseId,
        quantity: multiplier,
        expiryDate: expiryDate.toISOString().split("T")[0],
        productionType: "FINISHED_GOOD",
      });
      toast.success(`Production started for ${recipe.name}`);
      router.push('/production/batches?tab=ACTIVE_RUNS');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to start production. Verify ingredient stock.");
    } finally {
      setLaunching(false);
    }
  };

  const handleAddWarehouse = async () => {
    if (!newWhName.trim()) { toast.error("Warehouse name is required"); return; }
    setSavingWh(true);
    try {
      const res = await inventoryApi.createWarehouse({ name: newWhName.trim(), location: newWhLocation.trim() || undefined });
      const created = res.data;
      setWarehouses((prev) => [...prev, created]);
      setSelectedWarehouseId(created.id);
      setShowAddWarehouse(false);
      setNewWhName("");
      setNewWhLocation("");
      toast.success(`Warehouse "${created.name}" added`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create warehouse");
    } finally {
      setSavingWh(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scaling Calculator Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 print:bg-white text-gray-800 dark:text-slate-100 w-full min-w-0">
      {recipe && (
        <div className="flex flex-wrap justify-end gap-2 print:hidden w-full min-w-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:border-gray-300 dark:hover:border-white/20 transition-all active:scale-[0.98]"
          >
            <Printer size={16} />
            Print recipe
          </button>
          <button
            onClick={handleStartProduction}
            disabled={launching}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:shadow-xl hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none ${
              hasShortage ? "bg-rose-600 text-white" : "bg-[#F97316] text-white"
            }`}
          >
            {launching ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Starting...
              </>
            ) : hasShortage ? (
              <>
                <AlertTriangle size={16} />
                Insufficient Stock — Buy Now
                <ShoppingCart size={16} />
              </>
            ) : (
              <>
                Start Production
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 print:hidden w-full min-w-0">
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-4 space-y-1.5 shadow-sm min-w-0">
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400">
            Select Recipe
          </label>
          <select
            value={selectedRecipeId}
            onChange={(e) => handleRecipeChange(e.target.value)}
            className="w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
          >
            <option value="" disabled className="dark:bg-card">Choose Recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id} className="dark:bg-card">
                {r.name} (Yield: {r.yieldQty} {r.yieldUnit})
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg p-4 space-y-1.5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400">
            Target Batch Yield
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={targetYield || ""}
                onChange={(e) => setTargetYield(Number(e.target.value))}
                placeholder="Enter yield quantity"
                className="w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg pl-3 pr-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>
            {/* Unit badge — read-only or editable */}
            {isEditingUnit ? (
              <div className="flex items-center gap-1">
                <input
                  ref={unitInputRef}
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnitConfirm()}
                  className="w-16 border border-[#f58220] rounded-md px-2 py-1.5 text-xs font-bold text-center text-gray-800 dark:text-white bg-white dark:bg-[#13151f] focus:outline-none"
                />
                <button
                  onClick={handleUnitConfirm}
                  title="Confirm unit"
                  className="p-1.5 rounded-md bg-[#F97316] text-white hover:bg-orange-600 transition-colors"
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleUnitEditToggle}
                title="Edit unit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-[#F97316] hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors group"
              >
                <span className="text-xs font-bold uppercase">{targetUnit || recipe?.yieldUnit || "Unit"}</span>
                <Pencil size={10} className="opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
          {recipe?.yieldUnit && targetUnit !== recipe.yieldUnit && (
            <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
              ⚠ Recipe unit is <span className="font-black">{recipe.yieldUnit}</span>; using custom unit.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
              <Warehouse size={12} className="text-[#f58220]" />
              Warehouse / Stock Location
            </label>
            <button
              onClick={() => setShowAddWarehouse(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-[#F97316] hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors text-[10px] font-bold uppercase tracking-wide"
            >
              <Plus size={10} /> Add
            </button>
          </div>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
          >
            {warehouses.length === 0 && (
              <option value="" disabled className="dark:bg-card">No warehouses found — add one</option>
            )}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id} className="dark:bg-card">
                {w.name}{w.location ? ` (${w.location})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Add Warehouse Modal */}
        {showAddWarehouse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <Warehouse size={16} className="text-[#F97316]" />
                  Add New Warehouse
                </h3>
                <button onClick={() => setShowAddWarehouse(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Warehouse Name *</label>
                  <input
                    type="text"
                    value={newWhName}
                    onChange={(e) => setNewWhName(e.target.value)}
                    placeholder="e.g. Main Store, Cold Storage"
                    className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 dark:text-white bg-white dark:bg-[#13151f] focus:border-[#f58220] focus:outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Location / Address</label>
                  <input
                    type="text"
                    value={newWhLocation}
                    onChange={(e) => setNewWhLocation(e.target.value)}
                    placeholder="Optional"
                    className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 dark:text-white bg-white dark:bg-[#13151f] focus:border-[#f58220] focus:outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowAddWarehouse(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWarehouse}
                  disabled={savingWh}
                  className="flex-1 py-2 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
                >
                  {savingWh ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  {savingWh ? "Saving..." : "Add Warehouse"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

        {recipe ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
            {/* Instructions and Summary Card */}
            <div className="lg:col-span-1 space-y-4 sm:space-y-6 min-w-0">
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-4 shadow-sm min-w-0">
                <div className="flex items-center gap-2.5 mb-3">
                  <ChefHat className="text-[#F97316]" size={18} />
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">
                    {recipe.name}
                  </h3>
                </div>
                <div className="space-y-2.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                  <div className="flex justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
                    <span className="uppercase text-gray-400 dark:text-slate-500">Base Recipe Yield:</span>
                    <span className="text-gray-800 dark:text-white">{recipe.yieldQty} {recipe.yieldUnit || "Units"}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
                    <span className="uppercase text-gray-400 dark:text-slate-500">Target Batch Yield:</span>
                    <span className="text-[#F97316] font-black">{targetYield} {targetUnit || recipe.yieldUnit || ""}</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="uppercase text-gray-400 dark:text-slate-500">Scaling Factor:</span>
                    <span className="text-gray-800 dark:text-white">{multiplier.toFixed(2)}x</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-4 shadow-sm space-y-2 min-w-0">
                <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Production Instructions
                </h4>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-300 whitespace-pre-line font-medium">
                  {recipe.instructions || "No specific instructions loaded for this recipe."}
                </p>
              </div>
            </div>

            {/* Scaled Ingredients Table */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl shadow-sm overflow-hidden min-w-0">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center print:border-b-2 print:pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      <Database size={16} className="text-[#F97316]" />
                      Ingredients Needed
                    </h3>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium mt-1 ml-6">
                      Comparing the recipe's own quantities against what you need for {targetYield || 0} {targetUnit || recipe.yieldUnit || ""}
                    </p>
                  </div>
                  {stockLoading && (
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 flex items-center gap-1.5 uppercase animate-pulse shrink-0">
                      <RefreshCw size={12} className="animate-spin" /> Checking Stock...
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-200 dark:border-white/5">
                        <th className="py-3 px-6">Ingredient</th>
                        <th className="py-3 px-4 text-right">Recipe Qty<br /><span className="normal-case font-medium text-gray-400 dark:text-slate-500">(for {recipe.yieldQty} {recipe.yieldUnit})</span></th>
                        <th className="py-3 px-4 text-right text-[#F97316]">Qty You Need<br /><span className="normal-case font-medium text-orange-300">(for {targetYield || 0} {targetUnit || recipe.yieldUnit || ""})</span></th>
                        <th className="py-3 px-4 text-right print:hidden">In Stock</th>
                        <th className="py-3 px-6 text-center print:hidden">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-semibold text-gray-700 dark:text-slate-300">
                      {recipe.recipeItems.map((item) => {
                        const scaledQty = item.quantityRequired * multiplier;
                        const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
                        const sufficient = available + EPSILON >= scaledQty;
                        const deficit = Math.max(scaledQty - available, 0);

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-6 font-bold">
                              <div className="text-gray-800 dark:text-white">{item.inventoryItem?.name}</div>
                              <div className="text-[9px] font-mono text-gray-400 dark:text-slate-500 mt-0.5">{item.inventoryItem?.sku || "N/A"}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-500 dark:text-slate-400">
                              {item.quantityRequired.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-gray-900 dark:text-white">
                              {scaledQty.toFixed(3)} <span className="text-[10px] font-bold uppercase text-[#F97316]">{item.unit}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-500 dark:text-slate-400 print:hidden">
                              {available.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                            </td>
                            <td className="py-3.5 px-6 text-center print:hidden">
                              {sufficient ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                  <CheckCircle2 size={10} />
                                  AVAILABLE
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                                    <AlertCircle size={10} />
                                    SHORT
                                  </span>
                                  <span className="text-[9px] font-mono text-rose-500 dark:text-rose-400 font-bold mt-0.5">
                                    {deficit.toFixed(3)} {item.unit} SHORT
                                  </span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-500 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Select a Formula to Begin Scaling Calculations</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Choose a recipe above and enter a target batch yield.</p>
        </div>
      )}
    </div>
  );
}
