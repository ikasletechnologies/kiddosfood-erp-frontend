"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, Plus, Trash2, CheckCircle, AlertTriangle, 
  RefreshCw, ChefHat, Play, ShoppingCart, Info, Sparkles 
} from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
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
  // franchiseId is still sent to the backend (required by the schema) but is
  // auto-picked and never shown — stock is scoped by warehouse now, not
  // franchise, so warehouse is the only location concept the user deals with.
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [plannedQueue, setPlannedQueue] = useState<PlannedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  // Selected recipe to add
  const [activeRecipeId, setActiveRecipeId] = useState<string>("");
  const [inputMode, setInputMode] = useState<"RUNS" | "QUANTITY">("RUNS");
  const [activeQty, setActiveQty] = useState<number>(1);
  const [targetQuantity, setTargetQuantity] = useState<number>(0);
  const [activeOperatorId, setActiveOperatorId] = useState<string>("");

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId);
  // QUANTITY mode scales the recipe proportionally to hit the exact target
  // output (e.g. 80 out of a 100-unit recipe = 0.8x every ingredient) instead
  // of rounding up to a whole extra batch — a partial run is a real, valid
  // production run, not an error. RUNS mode is the opposite: whole multiples
  // of a full batch, on purpose (activeQty is always a whole run count).
  const computedRuns = inputMode === "QUANTITY"
    ? (activeRecipe?.yieldQty ? (targetQuantity || 0) / activeRecipe.yieldQty : 0)
    : Math.max(1, activeQty || 1);

  useEffect(() => {
    async function loadData() {
      try {
        const [rRes, fRes, eRes, wRes] = await Promise.all([
          recipesApi.getAll(),
          franchiseApi.getAll(),
          api.get("/api/employees").catch(() => ({ data: [] })),
          inventoryApi.getWarehouses()
        ]);
        setRecipes(rRes.data || []);
        setFranchises(fRes.data || []);
        setEmployees(eRes.data || []);
        setWarehouses(wRes.data || []);
        if (rRes.data?.length > 0) {
          setActiveRecipeId(rRes.data[0].id);
        }
        if (fRes.data?.length > 0) {
          setSelectedFranchiseId(fRes.data[0].id);
        }
        if (wRes.data?.length > 0) {
          setSelectedWarehouseId(wRes.data[0].id);
        }
      } catch (err) {
        toast.error("Failed to load recipes and warehouses");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    async function loadStock() {
      setStockLoading(true);
      try {
        const res = await inventoryApi.getRawMaterialStockSummary(selectedWarehouseId);
        setWarehouseStock(res.data || []);
      } catch (err) {
        console.error("Stock load error:", err);
      } finally {
        setStockLoading(false);
      }
    }
    loadStock();
  }, [selectedWarehouseId]);

  const addToQueue = () => {
    if (!activeRecipeId) return;
    const foundRecipe = recipes.find((r) => r.id === activeRecipeId);
    if (!foundRecipe) return;

    setError(null); // Clear error on changes
    const runs = computedRuns;

    if (runs <= 0) {
      toast.error(inputMode === "QUANTITY" ? "Enter a target quantity greater than 0" : "Enter a run count greater than 0");
      return;
    }

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
      // Find stock available in the selected warehouse
      const stockItem = warehouseStock.find((fi) => {
        const matchSku = fi.sku && val.sku && fi.sku.trim().toLowerCase() === val.sku.trim().toLowerCase();
        const matchId = fi.id === id;
        return matchSku || matchId;
      });
      const available = stockItem ? stockItem.availableStock : 0;
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
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse / stock location");
      return;
    }

    setSubmitting(true);
    try {
      // Loop over queue and launch each. Expiry is derived server-side from
      // the linked product's configured shelf life (Production Date + Shelf
      // Life Days) — not computed here, so it stays correct per-product.
      for (const item of plannedQueue) {
        await productionApi.startBatch({
          recipeId: item.recipeId,
          franchiseId: selectedFranchiseId,
          warehouseId: selectedWarehouseId,
          quantity: item.quantity,
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#f58220] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Planning Scheduler Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#f58220]" />
          Production Planning
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
          >
            {warehouses.length === 0 && <option value="">No warehouses found</option>}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}{w.location ? ` (${w.location})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* Error Banner for Insufficient Stock */}
        {error && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-rose-50 rounded-lg border border-rose-200 animate-in slide-in-from-top-2">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-white rounded-lg shrink-0">
                <AlertTriangle size={20} className="text-rose-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-700">Production Launch Failed</h4>
                <p className="text-xs text-rose-600 mt-0.5 leading-tight">{error}</p>
              </div>
            </div>
            {(error.toLowerCase().includes("insufficient stock") || error.toLowerCase().includes("stock")) && (
              <Link 
                href="/purchases/orders" 
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 whitespace-nowrap shadow-sm flex items-center justify-center gap-2"
              >
                <ShoppingCart size={14} /> Purchase Orders
              </Link>
            )}
          </div>
        )}

        {/* Select Recipe Scheduler */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Run Schedule Planner Queue */}
          <div className="lg:col-span-1 space-y-5">
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                <Sparkles size={16} className="text-[#f58220]" />
                Schedule Run
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Select Formula</label>
                  <select
                    value={activeRecipeId}
                    onChange={(e) => setActiveRecipeId(e.target.value)}
                    className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#f58220]"
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-500 block">Production Requirement</label>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                      {(["QUANTITY", "RUNS"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setInputMode(mode)}
                          className={clsx(
                            "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                            inputMode === mode ? "bg-white text-[#f58220] shadow-sm" : "text-gray-400"
                          )}
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
                          placeholder="e.g. 500"
                          value={targetQuantity || ""}
                          onChange={(e) => setTargetQuantity(Math.max(0, Number(e.target.value)))}
                          className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#f58220]"
                        />
                        <span className="flex items-center px-2 text-xs font-bold text-gray-400">
                          {activeRecipe?.yieldUnit || "KG"}
                        </span>
                      </div>
                      <div className="space-y-1.5 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
                          <span>Standard Recipe Yield: {activeRecipe?.yieldQty || 1} {activeRecipe?.yieldUnit || "KG"}</span>
                          <span className="text-[#f58220]">Scale Factor: {computedRuns.toFixed(2)}x</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-gray-400">Actual Output (exact)</span>
                          <span className="text-gray-800">
                            {(targetQuantity || 0).toFixed(1)} {activeRecipe?.yieldUnit || "KG"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={activeQty || ""}
                      onChange={(e) => setActiveQty(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#f58220]"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 block">Operator (Optional)</label>
                  <select
                    value={activeOperatorId}
                    onChange={(e) => setActiveOperatorId(e.target.value)}
                    className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#f58220]"
                  >
                    <option value="">Not Assigned</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.user?.fullName || e.employeeCode}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={addToQueue}
                  className="w-full py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={16} />
                  Add to run Queue
                </button>
              </div>
            </div>

            {/* Planned Schedule list */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-700 uppercase">
                Planned Run Queue ({plannedQueue.length})
              </h3>

              {plannedQueue.length === 0 ? (
                <p className="text-xs text-gray-400 font-medium italic py-4">No schedules planned yet.</p>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto pr-1">
                  {plannedQueue.map((item, idx) => {
                    const operator = employees.find((e: any) => e.id === item.operatorId);
                    return (
                      <div key={item.id} className="flex justify-between items-start py-3 gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#f58220]">
                              PENDING-{String(idx + 1).padStart(3, "0")}
                            </span>
                            <h4 className="text-xs font-bold text-gray-800">{item.recipeName}</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                            <span>Yield: {(item.quantity * item.yieldQty).toFixed(1)} {item.yieldUnit} ({item.quantity.toFixed(2)}x scale)</span>
                            <span>Expected: {formatDuration(item.estimatedDurationMinutes)}</span>
                            <span className="col-span-2">
                              Operator: <span className={operator ? "text-gray-700 font-semibold" : "text-gray-400 italic"}>
                                {operator ? (operator.user?.fullName || operator.employeeCode) : "Not Assigned"}
                              </span>
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
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
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-2">
                  <ShoppingCart size={16} className="text-[#f58220]" />
                  Aggregated Ingredient Audit
                </h3>
                {stockLoading && (
                  <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 uppercase animate-pulse">
                    <RefreshCw size={12} className="animate-spin" /> Verifying...
                  </span>
                )}
              </div>

              {plannedQueue.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-xs font-medium flex flex-col items-center gap-3">
                  <Info size={28} className="text-gray-300" />
                  <span>Add formulas to the run queue to run material audits</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-250">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
                          <th className="py-3 px-4">Ingredient</th>
                          <th className="py-3 px-4 text-right">Required quantity</th>
                          <th className="py-3 px-4 text-right">Stock Available</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {aggregatedMaterials.map((mat) => {
                          const deficit = mat.required - mat.available;

                          return (
                            <tr key={mat.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 font-medium">
                                <div>{mat.name}</div>
                                <div className="text-xs text-gray-400 mt-0.5 font-mono">{mat.sku}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-800">
                                {mat.required.toFixed(2)} <span className="text-xs text-gray-400">{mat.unit}</span>
                              </td>
                              <td className="py-3 px-4 text-right text-gray-500">
                                {mat.available.toFixed(2)} <span className="text-xs text-gray-400">{mat.unit}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {mat.sufficient ? (
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border text-emerald-600 bg-emerald-50 border-emerald-200">
                                    In Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex flex-col items-center">
                                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border text-rose-600 bg-rose-50 border-rose-200">
                                      Deficit
                                    </span>
                                    <span className="text-xs font-mono text-rose-500 font-semibold mt-0.5">
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

                  <div className="p-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      {allSufficient ? (
                        <CheckCircle className="text-emerald-500" size={24} />
                      ) : (
                        <AlertTriangle className="text-[#f58220]" size={24} />
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-gray-850 uppercase">
                          {allSufficient ? 'Stock Validation Successful' : 'Ingredients Shortfall Detected'}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {allSufficient 
                            ? 'All required quantities are present in the selected warehouse.' 
                            : 'Some ingredients are missing. Launching runs might fail or cause negative stock.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                      {!allSufficient && (
                        <Link 
                          href="/purchases/orders"
                          className="w-full sm:w-auto px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-rose-200"
                        >
                          <ShoppingCart size={14} /> Buy Stock
                        </Link>
                      )}
                      <button
                        onClick={handleLaunchProduction}
                        disabled={plannedQueue.length === 0 || submitting}
                        className="w-full sm:w-auto px-6 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
    </div>
  );
}
