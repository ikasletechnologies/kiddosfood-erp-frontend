"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Printer, AlertCircle, AlertTriangle, CheckCircle2,
  RefreshCw, ChefHat, Database, Pencil, Check, Plus, Warehouse, X, ShoppingCart,
  Calendar, Sparkles, Trash2, Info, Play
} from "lucide-react";
import { recipesApi, inventoryApi, franchiseApi, productionApi } from "@/lib/api";
import api from "@/lib/api/base";
import { toast } from "react-hot-toast";
import Link from "next/link";

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
  estimatedDurationMinutes?: number | null;
}

interface PlannedItem {
  id: string;
  recipeId: string;
  recipeName: string;
  quantity: number; // Scaled multiplier
  yieldQty: number;
  yieldUnit: string;
  recipeItems: RecipeItem[];
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
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeOperatorId, setActiveOperatorId] = useState<string>("");

  // Planned Run Queue
  const [plannedQueue, setPlannedQueue] = useState<PlannedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add Warehouse modal
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [newWhLocation, setNewWhLocation] = useState("");
  const [savingWh, setSavingWh] = useState(false);

  const recipe = recipes.find((r) => r.id === selectedRecipeId);

  useEffect(() => {
    async function initData() {
      try {
        const [rRes, wRes, fRes, eRes] = await Promise.all([
          recipesApi.getAll(),
          inventoryApi.getWarehouses(),
          franchiseApi.getAll(),
          api.get("/api/employees").catch(() => ({ data: [] }))
        ]);
        setRecipes(rRes.data || []);
        const whList = wRes.data || [];
        setWarehouses(whList);
        setEmployees(eRes.data || []);
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
        toast.error("Failed to load recipes, employees, or warehouses");
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
        const res = await inventoryApi.getRawMaterialStockSummary(selectedWarehouseId, undefined, 'ALL');
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

  const multiplier = recipe && recipe.yieldQty > 0 ? targetYield / recipe.yieldQty : 1;

  const getAvailableStock = (itemId: string, itemSku: string) => {
    if (!Array.isArray(warehouseStock)) return 0;
    const found = warehouseStock.find((fi: any) => {
      const matchSku = fi.sku && itemSku && fi.sku.trim().toLowerCase() === itemSku.trim().toLowerCase();
      const matchId = fi.inventoryItemId === itemId || fi.id === itemId;
      return matchSku || matchId;
    });
    return found ? (found.availableStock ?? 0) : 0;
  };

  // Check if current selected recipe has a shortage
  const hasShortage = recipe
    ? recipe.recipeItems.some((item) => {
        const scaledQty = item.quantityRequired * multiplier;
        return getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku) < scaledQty;
      })
    : false;

  // Add current selected recipe to queue
  const addToQueue = () => {
    if (!selectedRecipeId || !recipe) return;
    setError(null);

    if (multiplier <= 0) {
      toast.error("Target batch yield must be greater than 0");
      return;
    }

    const exists = plannedQueue.find((item) => item.recipeId === selectedRecipeId);
    if (exists) {
      setPlannedQueue(
        plannedQueue.map((item) =>
          item.recipeId === selectedRecipeId
            ? { ...item, quantity: item.quantity + multiplier }
            : item
        )
      );
    } else {
      setPlannedQueue([
        ...plannedQueue,
        {
          id: Math.random().toString(),
          recipeId: recipe.id,
          recipeName: recipe.name,
          quantity: multiplier,
          yieldQty: recipe.yieldQty,
          yieldUnit: recipe.yieldUnit || "KG",
          recipeItems: recipe.recipeItems || [],
          operatorId: activeOperatorId || undefined,
          estimatedDurationMinutes: recipe.estimatedDurationMinutes,
        }
      ]);
    }
    setActiveOperatorId("");
    toast.success(`${recipe.name} added to schedule queue`);
  };

  const removeFromQueue = (id: string) => {
    setError(null);
    setPlannedQueue(plannedQueue.filter((item) => item.id !== id));
  };

  // Get aggregated requirements for the whole queue
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
      const available = getAvailableStock(id, val.sku);
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

  // Launch all batches in the queue
  const handleLaunchProduction = async () => {
    if (plannedQueue.length === 0) return;
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse / stock location");
      return;
    }

    setLaunching(true);
    setError(null);
    try {
      for (const item of plannedQueue) {
        const expiryDate = new Date();
        const shelfLife = item.estimatedDurationMinutes ? 30 : 7; // placeholder
        expiryDate.setDate(expiryDate.getDate() + shelfLife);

        await productionApi.startBatch({
          recipeId: item.recipeId,
          franchiseId,
          warehouseId: selectedWarehouseId,
          quantity: item.quantity,
          productionType: "FINISHED_GOOD",
          operatorId: item.operatorId || undefined,
          expiryDate: expiryDate.toISOString().split("T")[0],
        });
      }
      toast.success("All production schedules initialized!");
      setPlannedQueue([]);
      router.push("/production/batches?tab=ACTIVE_RUNS");
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || "Failed to launch schedules. Verify ingredients stock.";
      toast.error(errMsg);
      setError(errMsg);
    } finally {
      setLaunching(false);
    }
  };

  // Launch a single batch directly (Formula Scaling workflow)
  const handleStartProductionSingle = async () => {
    if (!recipe) return;
    if (hasShortage) {
      const shortageItems = recipe.recipeItems
        .map((item) => {
          const required = item.quantityRequired * multiplier;
          const stock = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku);
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
        operatorId: activeOperatorId || undefined,
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#f58220] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Planning Scheduler Loading...</p>
      </div>
    );
  }

  const isQueueEmpty = plannedQueue.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 space-y-6">

      {/* ── Page Header ── */}
      <header className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#f58220]" />
            Production Planning & Scaling
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Scale recipes, assign operators, audit aggregate stock availability, and launch runs
          </p>
        </div>
        
        {/* Header Action Buttons */}
        {recipe && (
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:border-gray-300 transition-all active:scale-[0.98]"
            >
              <Printer size={16} />
              Print Recipe
            </button>
            {isQueueEmpty ? (
              <button
                onClick={handleStartProductionSingle}
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
            ) : (
              <button
                onClick={handleLaunchProduction}
                disabled={launching || !allSufficient}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:shadow-xl hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none ${
                  !allSufficient ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                }`}
              >
                {launching ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Launching...
                  </>
                ) : !allSufficient ? (
                  <>
                    <AlertTriangle size={16} />
                    Insufficient Stock — Buy Now
                    <ShoppingCart size={16} />
                  </>
                ) : (
                  <>
                    Launch Run Queue
                    <Play size={14} fill="currentColor" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </header>

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
          <Link 
            href="/purchases/orders" 
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 whitespace-nowrap shadow-sm flex items-center justify-center gap-2"
          >
            <ShoppingCart size={14} /> Purchase Orders
          </Link>
        </div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500">
            Select Recipe
          </label>
          <select
            value={selectedRecipeId}
            onChange={(e) => handleRecipeChange(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
          >
            <option value="" disabled>Choose Recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (Yield: {r.yieldQty} {r.yieldUnit})
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-500">
            Target Batch Yield
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={targetYield || ""}
                onChange={(e) => setTargetYield(Number(e.target.value))}
                placeholder="Enter yield quantity"
                className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg pl-3 pr-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
              />
            </div>
            {isEditingUnit ? (
              <div className="flex items-center gap-1">
                <input
                  ref={unitInputRef}
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnitConfirm()}
                  className="w-16 border border-[#f58220] rounded-md px-2 py-1.5 text-xs font-bold text-center text-gray-800 focus:outline-none"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-50 border border-orange-200 text-[#F97316] hover:bg-orange-100 transition-colors group"
              >
                <span className="text-xs font-bold uppercase">{targetUnit || recipe?.yieldUnit || "Unit"}</span>
                <Pencil size={10} className="opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <Warehouse size={12} className="text-[#f58220]" />
              Warehouse / Stock Location
            </label>
            <button
              onClick={() => setShowAddWarehouse(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 border border-orange-200 text-[#F97316] hover:bg-orange-100 transition-colors text-[10px] font-bold uppercase tracking-wide"
            >
              <Plus size={10} /> Add
            </button>
          </div>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#f58220] focus:outline-none"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}{w.location ? ` (${w.location})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-500">Operator (Optional)</label>
            <select
              value={activeOperatorId}
              onChange={(e) => setActiveOperatorId(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-1.5 text-xs font-medium focus:border-[#f58220] focus:outline-none"
            >
              <option value="">Not Assigned</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.user?.fullName || e.employeeCode}</option>
              ))}
            </select>
          </div>
          <button
            onClick={addToQueue}
            className="w-full py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm mt-2"
          >
            <Plus size={14} /> Add to Queue
          </button>
        </div>
      </div>

      {/* Two-Column Layout */}
      {recipe ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Queue List (if items exist) OR Recipe Summary (if empty) */}
          <div className="lg:col-span-1 space-y-6">
            {!isQueueEmpty ? (
              /* Queue Panel */
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Planned Run Queue ({plannedQueue.length})
                  </h3>
                  <button
                    onClick={() => setPlannedQueue([])}
                    className="text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700"
                  >
                    Clear Queue
                  </button>
                </div>
                <div className="divide-y divide-gray-150 max-h-[380px] overflow-y-auto pr-1">
                  {plannedQueue.map((item, idx) => {
                    const operator = employees.find((e: any) => e.id === item.operatorId);
                    return (
                      <div key={item.id} className="flex justify-between items-start py-3 gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#f58220]">
                              RUN-{String(idx + 1).padStart(3, "0")}
                            </span>
                            <h4 className="text-xs font-bold text-gray-800">{item.recipeName}</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                            <span>Yield: {(item.quantity * item.yieldQty).toFixed(1)} {item.yieldUnit}</span>
                            <span>Scale: {item.quantity.toFixed(2)}x</span>
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
              </div>
            ) : (
              /* Single Recipe Details */
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <ChefHat className="text-[#F97316]" size={18} />
                  <h3 className="text-sm font-bold text-gray-800">{recipe.name}</h3>
                </div>
                <div className="space-y-2.5 text-xs font-semibold text-gray-600">
                  <div className="flex justify-between border-b border-gray-100 pb-2.5">
                    <span className="uppercase text-gray-400">Recipe Yield:</span>
                    <span className="text-gray-800">{recipe.yieldQty} {recipe.yieldUnit || ""}</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="uppercase text-gray-400">Scaled Yield:</span>
                    <span className="text-[#F97316] font-black">{targetYield} {targetUnit || recipe.yieldUnit || ""}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Always show Instructions */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Production Instructions
              </h4>
              <p className="text-xs leading-relaxed text-gray-600 whitespace-pre-line font-medium">
                {recipe.instructions || "No specific instructions loaded for this recipe."}
              </p>
            </div>
          </div>

          {/* Right Column: Ingredients Table (Recipe specific vs Aggregated) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Database size={16} className="text-[#F97316]" />
                    {isQueueEmpty ? "Ingredients Needed" : "Aggregated Ingredient Audit"}
                  </h3>
                  <p className="text-[11px] text-gray-450 font-semibold mt-1">
                    {isQueueEmpty 
                      ? `Comparing quantities needed for ${targetYield || 0} ${targetUnit || recipe.yieldUnit || ""}`
                      : `Consolidated list of raw materials required to process planned queue`}
                  </p>
                </div>
                {stockLoading && (
                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5 uppercase animate-pulse shrink-0">
                    <RefreshCw size={12} className="animate-spin" /> Checking Stock...
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-200">
                      <th className="py-3 px-6">Ingredient</th>
                      <th className="py-3 px-4 text-right">
                        {isQueueEmpty ? "Recipe Qty" : "Required Qty"}
                      </th>
                      <th className="py-3 px-4 text-right">Stock Available</th>
                      <th className="py-3 px-6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                    {isQueueEmpty ? (
                      /* Recipe Specific Table */
                      recipe.recipeItems.map((item) => {
                        const scaledQty = item.quantityRequired * multiplier;
                        const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku);
                        const sufficient = available >= scaledQty;
                        const deficit = scaledQty - available;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-6 font-bold">
                              <div className="text-gray-800">{item.inventoryItem?.name}</div>
                              <div className="text-[9px] font-mono text-gray-400 mt-0.5">{item.inventoryItem?.sku || "N/A"}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                              {scaledQty.toFixed(3)} <span className="text-[10px] font-bold uppercase text-[#F97316]">{item.unit}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-500">
                              {available.toFixed(3)} <span className="text-[10px] font-bold uppercase">{item.unit}</span>
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              {sufficient ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  <CheckCircle2 size={10} />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
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
                      })
                    ) : (
                      /* Queue Aggregated Table */
                      aggregatedMaterials.map((mat) => {
                        const deficit = mat.required - mat.available;

                        return (
                          <tr key={mat.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-6 font-bold">
                              <div className="text-gray-800">{mat.name}</div>
                              <div className="text-[9px] font-mono text-gray-400 mt-0.5">{mat.sku}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                              {mat.required.toFixed(3)} <span className="text-[10px] font-bold uppercase text-[#F97316]">{mat.unit}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-500">
                              {mat.available.toFixed(3)} <span className="text-[10px] font-bold uppercase">{mat.unit}</span>
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              {mat.sufficient ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  <CheckCircle2 size={10} />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                                    <AlertCircle size={10} />
                                    SHORT
                                  </span>
                                  <span className="text-[9px] font-mono text-rose-500 font-bold mt-0.5">
                                    -{deficit.toFixed(2)} {mat.unit}
                                  </span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Aggregated Footer actions */}
              {!isQueueEmpty && (
                <div className="p-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    {allSufficient ? (
                      <CheckCircle2 className="text-emerald-500" size={24} />
                    ) : (
                      <AlertTriangle className="text-[#f58220]" size={24} />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 uppercase">
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
                      disabled={launching || !allSufficient}
                      className="w-full sm:w-auto px-6 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {launching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play size={14} fill="currentColor" />}
                      Launch Production Run
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800">Select a Formula to Begin Scaling Calculations</p>
          <p className="text-xs text-gray-500 mt-1">Choose a recipe above and enter a target batch yield.</p>
        </div>
      )}

      {/* Add Warehouse Modal */}
      {showAddWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <Warehouse size={16} className="text-[#F97316]" />
                Add New Warehouse
              </h3>
              <button onClick={() => setShowAddWarehouse(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  placeholder="e.g. Main Store, Cold Storage"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#f58220] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Location / Address</label>
                <input
                  type="text"
                  value={newWhLocation}
                  onChange={(e) => setNewWhLocation(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#f58220] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowAddWarehouse(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWarehouse}
                disabled={savingWh}
                className="flex-1 py-2 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {savingWh ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                {savingWh ? "Saving..." : "Add Warehouse"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
