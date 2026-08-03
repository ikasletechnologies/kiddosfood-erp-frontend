"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight, Printer, AlertCircle, CheckCircle2,
  RefreshCw, ChefHat, Database
} from "lucide-react";
import { recipesApi, inventoryApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";

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
  instructions?: string;
  productId: string;
  recipeItems: RecipeItem[];
}

export default function FormulaScalingTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [targetYield, setTargetYield] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [franchiseInventory, setFranchiseInventory] = useState<any[]>([]);

  const recipe = recipes.find((r) => r.id === selectedRecipeId);

  useEffect(() => {
    async function initData() {
      try {
        const [rRes, fRes] = await Promise.all([
          recipesApi.getAll(),
          franchiseApi.getAll()
        ]);
        setRecipes(rRes.data || []);
        setFranchises(fRes.data || []);
        if (rRes.data?.length > 0) {
          setSelectedRecipeId(rRes.data[0].id);
          setTargetYield(rRes.data[0].yieldQty || 100);
        }
        if (fRes.data?.length > 0) {
          setSelectedFranchiseId(fRes.data[0].id);
        }
      } catch (err) {
        toast.error("Failed to load recipes and franchises");
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  useEffect(() => {
    if (!selectedFranchiseId) return;
    async function loadStock() {
      setStockLoading(true);
      try {
        const res = await inventoryApi.getInventory(selectedFranchiseId);
        setFranchiseInventory(res.data || []);
      } catch (err) {
        console.error("Stock load error:", err);
      } finally {
        setStockLoading(false);
      }
    }
    loadStock();
  }, [selectedFranchiseId]);

  const handleRecipeChange = (id: string) => {
    setSelectedRecipeId(id);
    const found = recipes.find((r) => r.id === id);
    if (found) {
      setTargetYield(found.yieldQty || 100);
    }
  };

  const multiplier = recipe && recipe.yieldQty > 0 ? targetYield / recipe.yieldQty : 1;

  const getAvailableStock = (itemId: string, itemSku: string) => {
    const found = franchiseInventory.find((fi) => {
      const matchSku = fi.sku && itemSku && fi.sku.trim().toLowerCase() === itemSku.trim().toLowerCase();
      const matchId = fi.id === itemId;
      return matchSku || matchId;
    });
    return found ? found.currentStock : 0;
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
    <div className="space-y-6 print:bg-white">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500">
            Select Formula / Recipe
          </label>
          <select
            value={selectedRecipeId}
            onChange={(e) => handleRecipeChange(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
          >
            <option value="" disabled>Choose Recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (Yield: {r.yieldQty})
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500">
            Target Batch Yield
          </label>
          <div className="relative">
            <input
              type="number"
              value={targetYield || ""}
              onChange={(e) => setTargetYield(Number(e.target.value))}
              placeholder="Enter yield quantity"
              className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg pl-3 pr-12 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
              {recipe?.recipeItems?.[0]?.unit || "Units"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500">
            Simulation Franchise / Stock Location
          </label>
          <select
            value={selectedFranchiseId}
            onChange={(e) => setSelectedFranchiseId(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
          >
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {recipe ? (
        <>
          <div className="flex justify-end gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider hover:border-slate-300 dark:hover:border-slate-700 transition-all active:scale-[0.98]"
            >
              <Printer size={16} />
              Print recipe
            </button>
            <a
              href={`/production?recipeId=${recipe.id}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:shadow-xl hover:translate-y-[-1px] transition-all active:translate-y-0"
            >
              Start Production
              <ArrowRight size={16} />
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Instructions and Summary Card */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gradient-to-br from-[#F97316]/5 to-[#F97316]/10 border border-[#F97316]/10 dark:border-orange-500/10 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#F97316]/5 rounded-bl-[100px] pointer-events-none" />
                <div className="flex items-center gap-3 mb-4">
                  <ChefHat className="text-[#F97316]" size={24} />
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {recipe.name}
                  </h3>
                </div>

                <div className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                    <span className="uppercase text-slate-400">Base Yield:</span>
                    <span>{recipe.yieldQty} {recipe.recipeItems?.[0]?.unit || ""}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                    <span className="uppercase text-slate-400">Scaled Yield:</span>
                    <span className="text-[#F97316] font-black">{targetYield} {recipe.recipeItems?.[0]?.unit || ""}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                    <span className="uppercase text-slate-400">Scaling Multiplier:</span>
                    <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-mono">
                      {multiplier.toFixed(2)}x
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Production Instructions
                </h4>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-line font-medium">
                  {recipe.instructions || "No specific instructions loaded for this recipe."}
                </p>
              </div>
            </div>

            {/* Scaled Ingredients Table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center print:border-b-2 print:pb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Database size={16} className="text-[#F97316]" />
                    Scaled Ingredient Ratios
                  </h3>
                  {stockLoading && (
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase animate-pulse">
                      <RefreshCw size={12} className="animate-spin" /> Checking Stock...
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/50">
                        <th className="py-4 px-6">Ingredient</th>
                        <th className="py-4 px-4 text-right">Standard Qty</th>
                        <th className="py-4 px-4 text-right text-[#F97316]">Scaled Qty</th>
                        <th className="py-4 px-4 text-right print:hidden">Stock Available</th>
                        <th className="py-4 px-6 text-center print:hidden">Sufficiency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {recipe.recipeItems.map((item) => {
                        const scaledQty = item.quantityRequired * multiplier;
                        const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku);
                        const sufficient = available >= scaledQty;
                        const deficit = scaledQty - available;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                            <td className="py-4 px-6 font-bold">
                              <div>{item.inventoryItem?.name}</div>
                              <div className="text-[9px] font-mono text-slate-400 mt-0.5">{item.inventoryItem?.sku || "N/A"}</div>
                            </td>
                            <td className="py-4 px-4 text-right text-slate-500">
                              {item.quantityRequired.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                            </td>
                            <td className="py-4 px-4 text-right font-black text-slate-900 dark:text-white">
                              {scaledQty.toFixed(3)} <span className="text-[10px] font-bold uppercase text-[#F97316]">{item.unit}</span>
                            </td>
                            <td className="py-4 px-4 text-right text-slate-500 print:hidden">
                              {available.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                            </td>
                            <td className="py-4 px-6 text-center print:hidden">
                              {sufficient ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                  <CheckCircle2 size={10} />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                                    <AlertCircle size={10} />
                                    SHORT
                                  </span>
                                  <span className="text-[9px] font-mono text-rose-500 font-bold mt-0.5">
                                    -{deficit.toFixed(2)} {item.unit}
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
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800">Select a Formula to Begin Scaling Calculations</p>
          <p className="text-xs text-gray-500 mt-1">Choose a recipe above and enter a target batch yield.</p>
        </div>
      )}
    </div>
  );
}
