"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle, ChefHat, BarChart2, Sliders
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

  const [costModifier, setCostModifier] = useState<number>(0);
  const [customSalePrice, setCustomSalePrice] = useState<number>(0);
  const [productSalePrice, setProductSalePrice] = useState<number>(0);

  useEffect(() => {
    async function loadRecipes() {
      try {
        const res = await recipesApi.getAll();
        setRecipes(res.data || []);
        if (res.data?.length > 0) {
          setSelectedRecipeId(res.data[0].id);
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
        const salePrice = product?.customerPrice || product?.basePrice || 100;
        setProductSalePrice(salePrice);
        setCustomSalePrice(salePrice);
        setCostModifier(0);
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

  const factor = 1 + (costModifier / 100);
  const simulatedTotalCost = costData ? costData.totalCost * factor : 0;
  const simulatedCostPerUnit = costData && costData.yieldQty > 0 ? simulatedTotalCost / costData.yieldQty : 0;

  const grossMargin = customSalePrice > 0
    ? ((customSalePrice - simulatedCostPerUnit) / customSalePrice) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Recipe selector */}
      <div className="flex justify-between items-center bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Select Recipe to Cost</h3>
          <p className="text-xs text-gray-500">Analyze ingredient costs, simulate price changes and profit margin</p>
        </div>
        <select
          value={selectedRecipeId}
          onChange={(e) => setSelectedRecipeId(e.target.value)}
          className="bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none min-w-[200px]"
        >
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
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
        <div className="space-y-6 md:space-y-8">

          {/* Cost Rollup metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-5 space-y-2 relative overflow-hidden">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Cost per Yield</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{costData.costPerYieldUnit.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">/ {costData.yieldUnit || 'unit'}</span>
              </div>
              <p className="text-[9px] text-slate-500 font-semibold uppercase">Recipe Yield: {costData.yieldQty} {costData.yieldUnit || 'units'}</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-5 space-y-2 relative overflow-hidden">
              <span className="text-[9px] font-black text-[#F97316] uppercase tracking-widest">Simulated Unit Cost</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[#F97316]">₹{simulatedCostPerUnit.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">/ {costData.yieldUnit || 'unit'}</span>
              </div>
              <p className="text-[9px] text-slate-500 font-semibold uppercase">Includes modifier: {costModifier > 0 ? `+${costModifier}%` : `${costModifier}%`}</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-5 space-y-2 relative overflow-hidden">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sale Price</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{customSalePrice.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">/ {costData.yieldUnit || 'unit'}</span>
              </div>
              <p className="text-[9px] text-slate-500 font-semibold uppercase">Base default: ₹{productSalePrice.toFixed(2)}</p>
            </div>

            <div className={`border rounded-3xl p-5 space-y-2 relative overflow-hidden ${grossMargin > 40 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : grossMargin > 20 ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

            {/* Simulation controls */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Sliders size={16} className="text-[#F97316]" />
                  Cost Simulator
                </h3>

                {/* Slider for Commodity Price spikes */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500 uppercase">Commodity Cost Change</span>
                    <span className={`font-mono font-bold ${costModifier > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {costModifier > 0 ? `+${costModifier}%` : `${costModifier}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    value={costModifier}
                    onChange={(e) => setCostModifier(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#F97316]"
                  />
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>-50% Drop</span>
                    <span>No Change</span>
                    <span>100% Spike</span>
                  </div>
                </div>

                {/* Sale Price input */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500 uppercase">Model Retail Price</span>
                    <span className="text-slate-900 dark:text-white font-mono font-bold">₹{customSalePrice}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={customSalePrice || ""}
                      onChange={(e) => setCustomSalePrice(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 text-[10px] leading-relaxed text-slate-500 font-semibold uppercase">
                  <div className="flex gap-2">
                    <AlertTriangle size={14} className="text-[#F97316] shrink-0" />
                    <span>Modelling simulates inflation and supply shortages across all ingredients in the recipe.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Rollup Breakdown table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <BarChart2 size={16} className="text-[#F97316]" />
                    Ingredient Cost Breakdown
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/50">
                        <th className="py-4 px-6">Ingredient</th>
                        <th className="py-4 px-4 text-right">Recipe Quantity</th>
                        <th className="py-4 px-4 text-right">Standard Rate</th>
                        <th className="py-4 px-4 text-right">Simulated Rate</th>
                        <th className="py-4 px-6 text-right text-slate-800 dark:text-slate-200">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {costData.breakdown.map((item, idx) => {
                        const standardRate = item.unitCost;
                        const simulatedRate = standardRate * factor;
                        const lineTotal = item.qty * simulatedRate;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all">
                            <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                              {item.name}
                            </td>
                            <td className="py-4 px-4 text-right text-slate-500">
                              {item.qty.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                            </td>
                            <td className="py-4 px-4 text-right text-slate-500 font-mono">
                              ₹{standardRate.toFixed(2)}
                            </td>
                            <td className="py-4 px-4 text-right text-[#F97316] font-mono">
                              ₹{simulatedRate.toFixed(2)}
                            </td>
                            <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white font-mono">
                              ₹{lineTotal.toFixed(2)}
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

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800">No Cost Breakdown Data Available</p>
          <p className="text-xs text-gray-500 mt-1">Select a recipe from the list above to view itemized costs and profit margin.</p>
        </div>
      )}
    </div>
  );
}
