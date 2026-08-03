"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, Plus, Trash2, CheckCircle, AlertTriangle, 
  RefreshCw, ChefHat, Play, ShoppingCart, Info, Sparkles 
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api/base";
import { recipesApi, franchiseApi, inventoryApi, productionApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface PlannedItem {
  id: string; // Unique temporary run id
  recipeId: string;
  recipeName: string;
  quantity: number; // Multiplier/runs
  yieldQty: number;
  yieldUnit: string;
  recipeItems: any[];
  operatorId?: string;
  estimatedDurationMinutes?: number | null;
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ProductionPlanningPage() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [plannedQueue, setPlannedQueue] = useState<PlannedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [franchiseInventory, setFranchiseInventory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  // Selected recipe to add
  const [activeRecipeId, setActiveRecipeId] = useState<string>("");
  const [inputMode, setInputMode] = useState<"RUNS" | "QUANTITY">("RUNS");
  const [activeQty, setActiveQty] = useState<number>(1);
  const [targetQuantity, setTargetQuantity] = useState<number>(0);
  const [activeOperatorId, setActiveOperatorId] = useState<string>("");

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId);
  const computedRuns = inputMode === "QUANTITY"
    ? Math.max(1, Math.ceil((targetQuantity || 0) / (activeRecipe?.yieldQty || 1)))
    : Math.max(1, activeQty || 1);

  useEffect(() => {
    async function loadData() {
      try {
        const [rRes, fRes, eRes] = await Promise.all([
          recipesApi.getAll(),
          franchiseApi.getAll(),
          api.get("/api/employees").catch(() => ({ data: [] }))
        ]);
        setRecipes(rRes.data || []);
        setFranchises(fRes.data || []);
        setEmployees(eRes.data || []);
        if (rRes.data?.length > 0) {
          setActiveRecipeId(rRes.data[0].id);
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
    loadData();
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

  const addToQueue = () => {
    if (!activeRecipeId) return;
    const foundRecipe = recipes.find((r) => r.id === activeRecipeId);
    if (!foundRecipe) return;

    setError(null); // Clear error on changes
    const runs = computedRuns;

    // Check if recipe is already in the queue, if so increment
    const exists = plannedQueue.find((item) => item.recipeId === activeRecipeId);
    if (exists) {
      setPlannedQueue(
        plannedQueue.map((item) =>
          item.recipeId === activeRecipeId
            ? { ...item, quantity: item.quantity + runs }
            : item
        )
      );
    } else {
      setPlannedQueue([
        ...plannedQueue,
        {
          id: Math.random().toString(),
          recipeId: foundRecipe.id,
          recipeName: foundRecipe.name,
          quantity: runs,
          yieldQty: foundRecipe.yieldQty,
          yieldUnit: foundRecipe.yieldUnit || "KG",
          recipeItems: foundRecipe.recipeItems || [],
          operatorId: activeOperatorId || undefined,
          estimatedDurationMinutes: foundRecipe.estimatedDurationMinutes,
        }
      ]);
    }
    setActiveOperatorId("");
    setTargetQuantity(0);
    toast.success(`${foundRecipe.name} added to schedule`);
  };

  const removeFromQueue = (id: string) => {
    setError(null);
    setPlannedQueue(plannedQueue.filter((item) => item.id !== id));
  };

  // Aggregate raw material requirements
  const getAggregatedMaterials = () => {
    const rawMap: Record<string, { 
      name: string; 
      sku: string; 
      required: number; 
      unit: string; 
    }> = {};

    plannedQueue.forEach((item) => {
      item.recipeItems.forEach((ri) => {
        const requiredQty = ri.quantityRequired * item.quantity;
        const itemId = ri.inventoryItemId;
        const itemName = ri.inventoryItem?.name || "Unknown";
        const itemSku = ri.inventoryItem?.sku || "";

        if (rawMap[itemId]) {
          rawMap[itemId].required += requiredQty;
        } else {
          rawMap[itemId] = {
            name: itemName,
            sku: itemSku,
            required: requiredQty,
            unit: ri.unit
          };
        }
      });
    });

    return Object.entries(rawMap).map(([id, val]) => {
      // Find stock available
      const stockItem = franchiseInventory.find((fi) => {
        const matchSku = fi.sku && val.sku && fi.sku.trim().toLowerCase() === val.sku.trim().toLowerCase();
        const matchId = fi.id === id;
        return matchSku || matchId;
      });
      const available = stockItem ? stockItem.currentStock : 0;
      return {
        id,
        ...val,
        available,
        sufficient: available >= val.required
      };
    });
  };

  const aggregatedMaterials = getAggregatedMaterials();
  const allSufficient = aggregatedMaterials.every((m) => m.sufficient);

  const handleLaunchProduction = async () => {
    if (plannedQueue.length === 0) return;
    if (!selectedFranchiseId) {
      toast.error("Please select a target franchise");
      return;
    }

    setSubmitting(true);
    try {
      // Loop over queue and launch each
      for (const item of plannedQueue) {
        // Expiry is set to standard 7 days from now
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        await productionApi.startBatch({
          recipeId: item.recipeId,
          franchiseId: selectedFranchiseId,
          quantity: item.quantity,
          expiryDate: expiryDate.toISOString().split("T")[0],
          productionType: "FINISHED_GOOD",
          operatorId: item.operatorId || undefined,
        });
      }
      toast.success("All production schedules initialized!");
      setPlannedQueue([]);
      
      // Redirect to batch manufacturing tracking page
      window.location.href = "/production/batches?tab=ACTIVE_RUNS";
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || "Failed to launch schedules. Verify ingredients stock.";
      toast.error(errMsg);
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Planning Scheduler Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#F97316] rounded-xl shadow-lg shadow-orange-600/20 text-white">
              <Calendar size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Production <span className="text-[#F97316]">Planning</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-semibold tracking-wider uppercase">
                Schedule upcoming runs and audit raw material readiness
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedFranchiseId}
            onChange={(e) => setSelectedFranchiseId(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider focus:outline-none"
          >
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Error Banner for Insufficient Stock */}
      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-100 dark:border-rose-500/20 animate-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-white dark:bg-rose-500/20 rounded-xl shrink-0">
              <AlertTriangle size={20} className="text-rose-500" />
            </div>
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">Production Launch Failed</h4>
              <p className="text-[10px] font-bold text-rose-600/80 dark:text-rose-300/80 mt-0.5 leading-tight">{error}</p>
            </div>
          </div>
          {(error.toLowerCase().includes("insufficient stock") || error.toLowerCase().includes("stock")) && (
            <Link 
              href="/purchases/orders" 
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shrink-0 whitespace-nowrap shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
            >
              <ShoppingCart size={14} /> Go to Purchase Orders
            </Link>
          )}
        </div>
      )}

      {/* Select Recipe Scheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Run Schedule Planner Queue */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 space-y-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles size={16} className="text-[#F97316]" />
              Schedule Run
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Formula</label>
                <select
                  value={activeRecipeId}
                  onChange={(e) => setActiveRecipeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Production Requirement</label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                    {(["QUANTITY", "RUNS"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setInputMode(mode)}
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                          inputMode === mode ? "bg-white dark:bg-slate-950 text-[#F97316] shadow-sm" : "text-slate-400"
                        }`}
                      >
                        {mode === "QUANTITY" ? "Quantity" : "Runs"}
                      </button>
                    ))}
                  </div>
                </div>

                {inputMode === "QUANTITY" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder={`e.g. 500`}
                        value={targetQuantity || ""}
                        onChange={(e) => setTargetQuantity(Math.max(0, Number(e.target.value)))}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none"
                      />
                      <span className="flex items-center px-3 text-[10px] font-black text-slate-400 uppercase">
                        {activeRecipe?.yieldUnit || "KG"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2">
                      <span className="uppercase tracking-wider">Recipe Yield: {activeRecipe?.yieldQty || 1} {activeRecipe?.yieldUnit || "KG"}</span>
                      <span className="text-[#F97316] uppercase tracking-wider">Runs Required: {computedRuns}</span>
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={activeQty || ""}
                    onChange={(e) => setActiveQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Operator (Optional)</label>
                <select
                  value={activeOperatorId}
                  onChange={(e) => setActiveOperatorId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none"
                >
                  <option value="">Not Assigned</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.user?.fullName || e.employeeCode}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={addToQueue}
                className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add to run Queue
              </button>
            </div>
          </div>

          {/* Planned Schedule list */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
              Planned Run Queue ({plannedQueue.length})
            </h3>

            {plannedQueue.length === 0 ? (
              <p className="text-[10px] text-slate-400 font-semibold uppercase italic py-4">No schedules planned yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[360px] overflow-y-auto pr-1">
                {plannedQueue.map((item, idx) => {
                  const operator = employees.find((e: any) => e.id === item.operatorId);
                  return (
                    <div key={item.id} className="flex justify-between items-start py-3 gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-black text-[#F97316] uppercase tracking-wider">
                            PENDING-{String(idx + 1).padStart(3, "0")}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.recipeName}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-semibold text-slate-500 uppercase">
                          <span>Yield: {(item.quantity * item.yieldQty).toFixed(1)} {item.yieldUnit} ({item.quantity} runs)</span>
                          <span>Expected: {formatDuration(item.estimatedDurationMinutes)}</span>
                          <span className="col-span-2">
                            Operator: <span className={operator ? "text-slate-700 dark:text-slate-300" : "text-slate-400 italic"}>
                              {operator ? (operator.user?.fullName || operator.employeeCode) : "Not Assigned"}
                            </span>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Aggregated Materials & Availability Checklist */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ShoppingCart size={16} className="text-[#F97316]" />
                Aggregated Ingredient Audit
              </h3>
              {stockLoading && (
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase animate-pulse">
                  <RefreshCw size={12} className="animate-spin" /> Verifying...
                </span>
              )}
            </div>

            {plannedQueue.length === 0 ? (
              <div className="py-20 text-center text-slate-400 uppercase text-[10px] font-bold flex flex-col items-center gap-3">
                <Info size={28} className="text-slate-300 dark:text-slate-700" />
                <span>Add formulas to the run queue to run material audits</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/50">
                        <th className="py-4 px-6">Ingredient</th>
                        <th className="py-4 px-4 text-right">Required quantity</th>
                        <th className="py-4 px-4 text-right">Stock Available</th>
                        <th className="py-4 px-6 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {aggregatedMaterials.map((mat) => {
                        const deficit = mat.required - mat.available;

                        return (
                          <tr key={mat.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                            <td className="py-4 px-6 font-bold">
                              <div>{mat.name}</div>
                              <div className="text-[9px] font-mono text-slate-400 mt-0.5">{mat.sku}</div>
                            </td>
                            <td className="py-4 px-4 text-right font-black text-slate-900 dark:text-white">
                              {mat.required.toFixed(2)} <span className="text-[10px] font-bold uppercase">{mat.unit}</span>
                            </td>
                            <td className="py-4 px-4 text-right text-slate-500">
                              {mat.available.toFixed(2)} <span className="text-[10px] font-bold uppercase">{mat.unit}</span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              {mat.sufficient ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                                  In Stock
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                                    Deficit
                                  </span>
                                  <span className="text-[9px] font-mono text-rose-500 font-bold mt-0.5">
                                    -{deficit.toFixed(2)} {mat.unit}
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

                <div className="p-6 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {allSufficient ? (
                      <CheckCircle className="text-emerald-500" size={24} />
                    ) : (
                      <AlertTriangle className="text-[#F97316]" size={24} />
                    )}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        {allSufficient ? 'Stock Validation Successful' : 'Ingredients Shortfall Detected'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">
                        {allSufficient 
                          ? 'All required quantities are present in selected franchise stock.' 
                          : 'Some ingredients are missing. Launching runs might fail or cause negative stock.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {!allSufficient && (
                      <Link 
                        href="/purchases/orders"
                        className="w-full sm:w-auto px-6 py-3.5 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      >
                        <ShoppingCart size={14} /> Buy Stock
                      </Link>
                    )}
                    <button
                      onClick={handleLaunchProduction}
                      disabled={plannedQueue.length === 0 || submitting}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#F97316] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-600/15 hover:shadow-xl hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:scale-100 disabled:translate-y-0 flex items-center justify-center gap-2"
                    >
                      {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play size={14} fill="currentColor" />}
                      Launch production run
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
