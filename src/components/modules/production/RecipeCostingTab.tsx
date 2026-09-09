"use client";

import { useState, useEffect } from "react";
import {
  ChefHat, BarChart2
} from "lucide-react";
import { recipesApi, productsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface CostBreakdown {
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  lineCost: number;
}

interface CostData {
  recipeId: string;
  recipeName: string;
  yieldQty: number;
  yieldUnit?: string;
  totalCost: number;
  costPerYieldUnit: number;
  breakdown: CostBreakdown[];
}

export default function RecipeCostingTab() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [costLoading, setCostLoading] = useState(false);
  const [costData, setCostData] = useState<CostData | null>(null);

  const [salePrice, setSalePrice] = useState<number>(0);

  useEffect(() => {
    async function loadRecipes() {
      try {
        const res = await recipesApi.getAll();
        const rawList = res.data || [];
        const sortedRecipes = [...rawList].sort((a: any, b: any) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setRecipes(sortedRecipes);
        if (sortedRecipes.length > 0) {
          setSelectedRecipeId(sortedRecipes[0].id);
        }
      } catch (err) {
        toast.error("Failed to load recipes");
      } finally {
        setLoading(false);
      }
    }
    loadRecipes();
  }, []);

  useEffect(() => {
    if (!selectedRecipeId) return;
    async function getCostDetails() {
      setCostLoading(true);
      try {
        const [cRes, pRes] = await Promise.all([
          recipesApi.calculateCost(selectedRecipeId),
          productsApi.getAll()
        ]);
        setCostData(cRes.data);

        const recipe = recipes.find((r) => r.id === selectedRecipeId);
        const product = pRes.data?.find((p: any) => p.id === recipe?.productId);
        setSalePrice(product?.customerPrice || product?.basePrice || 100);
      } catch (err) {
        toast.error("Failed to load cost breakdown");
      } finally {
        setCostLoading(false);
      }
    }
    getCostDetails();
  }, [selectedRecipeId, recipes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Analyzer Loading...</p>
      </div>
    );
  }

  const grossMargin = salePrice > 0 && costData
    ? ((salePrice - costData.costPerYieldUnit) / salePrice) * 100
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6 text-gray-800 dark:text-slate-100 w-full min-w-0">
      {/* Recipe selector */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-4 shadow-sm w-full min-w-0">
        <div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">Select Recipe to Cost</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">Analyze ingredient costs, simulate price changes and profit margin</p>
        </div>
        <select
          value={selectedRecipeId}
          onChange={(e) => setSelectedRecipeId(e.target.value)}
          className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none min-w-[200px]"
        >
          {recipes.map((r) => (
            <option key={r.id} value={r.id} className="dark:bg-card">
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {costLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recalculating rollups...</p>
        </div>
      ) : costData ? (
        <div className="space-y-6 md:space-y-8 w-full min-w-0">

          {/* Cost Rollup metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 space-y-2 relative overflow-hidden min-w-0 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cost per Yield</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{costData.costPerYieldUnit.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">/ {costData.yieldUnit || 'unit'}</span>
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase">Recipe Yield: {costData.yieldQty} {costData.yieldUnit || 'units'}</p>
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 space-y-2 relative overflow-hidden min-w-0 shadow-sm">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sale Price</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{salePrice.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">/ {costData.yieldUnit || 'unit'}</span>
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase">From product pricing</p>
            </div>

            <div className={`border rounded-2xl p-4 sm:p-5 space-y-2 relative overflow-hidden min-w-0 shadow-sm ${grossMargin > 40 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : grossMargin > 20 ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Gross Profit Margin</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{grossMargin.toFixed(1)}%</span>
                <span className="text-[10px] font-bold opacity-80">Margin</span>
              </div>
              <p className="text-[9px] font-semibold uppercase opacity-80">
                {grossMargin > 40 ? 'Highly Profitable' : grossMargin > 20 ? 'Standard Margin' : 'Warning: Thin Margins!'}
              </p>
            </div>

          </div>

          {/* Cost Rollup Breakdown table */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm w-full min-w-0">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <BarChart2 size={16} className="text-[#F97316]" />
                Ingredient Cost Breakdown
              </h3>
            </div>

            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-gray-200 dark:border-white/5">
                    <th className="py-4 px-6">Ingredient</th>
                    <th className="py-4 px-4 text-right">Recipe Quantity</th>
                    <th className="py-4 px-4 text-right">Unit Rate</th>
                    <th className="py-4 px-6 text-right text-slate-800 dark:text-slate-200">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {costData.breakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-4 px-4 text-right text-slate-500 dark:text-slate-400">
                        {item.qty.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                      </td>
                      <td className="py-4 px-4 text-right text-slate-500 dark:text-slate-400 font-mono">
                        ₹{item.unitCost.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white font-mono">
                        ₹{item.lineCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-500 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white">No Cost Breakdown Data Available</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Select a recipe from the list above to view itemized costs and profit margin.</p>
        </div>
      )}
    </div>
  );
}
