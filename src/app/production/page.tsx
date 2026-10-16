"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Printer, AlertCircle, AlertTriangle, CheckCircle2,
  RefreshCw, ChefHat, Database, Plus, Warehouse, X, ShoppingCart,
  ClipboardList, ExternalLink, Search, ChevronDown, Check, Info, Zap, Layers
} from "lucide-react";
import { recipesApi, inventoryApi, franchiseApi, productionApi, franchiseOrdersApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { RECIPE_UNITS } from "@/lib/recipe-units";
import { convertUnit, convertMeasurement } from "@/lib/unitConversion";
import clsx from "clsx";
import ReferenceFormulationPanel, { Formulation, isUsableFormulation } from "@/components/modules/production/ReferenceFormulationPanel";
import IngredientLotPanel from "@/components/modules/production/IngredientLotPanel";
import { estimateManufacturing, isPackaging } from "@/lib/recipe-expenses";
import { Rounding, autoQty, formatQty, maxMultiplierFor, procurementQty, roundRequirement } from "@/lib/qty-display";
import { AllocationDraft, MaterialLots, allocationCost, allocationError, fifoDraft, toPayload } from "@/lib/lot-allocation";

const WAREHOUSE_STORAGE_KEY = "kf.productionPlanning.warehouseId";
const EPSILON = 0.000001;

// Human-friendly quantity: "10" instead of "10.000", "2.5" instead of "2.500".
function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

/** Ingredient quantity in whole g below 1 KG and KG from 1 KG (ml/L likewise); see qty-display. */
function QtyText({ qty, unit, unitClass, rounding }: { qty: number; unit: string; unitClass?: string; rounding?: Rounding }) {
  const d = autoQty(qty, unit, rounding);
  return <>{d.shown.toLocaleString("en-IN", { maximumFractionDigits: 6 })} <span className={unitClass}>{d.unit}</span></>;
}

// Units that can be meaningfully converted into the recipe's yield unit.
// convertUnit() silently returns the input for cross-dimension pairs
// (e.g. BOX -> KG), so offering those units would scale the batch wrongly.
function isUnitCompatible(unit: string, recipeUnit: string): boolean {
  if (unit === recipeUnit) return true;
  try {
    convertMeasurement(1, unit as any, recipeUnit as any);
    return true;
  } catch {
    return false;
  }
}

function cleanInstructionText(text?: string): string {
  return (text || "")
    .replace(/\[unitWeight:[\d.]+\]/g, "")
    .replace(/\[weightUnit:\w+\]/g, "")
    .trim();
}

function defaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

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
  product?: {
    id: string;
    name: string;
  };
  recipeItems: RecipeItem[];
  ingredients?: Array<{ inventoryItemId: string; inventoryItem: any }>;
  // Recipe Master Additional Expenses (see src/lib/recipe-expenses.ts).
  additionalExpenses?: any[];
  activeFormulation?: Formulation | null;
  productionCount?: number;
}

// The saved formulation must cover exactly the recipe's current ingredients.
function sameIngredientSet(recipe: Recipe, f: Formulation): boolean {
  const ing = new Set((recipe.ingredients ?? []).map((i) => i.inventoryItemId));
  const form = new Set((f.items ?? []).map((i) => i.inventoryItemId));
  return ing.size === form.size && Array.from(ing).every((id) => form.has(id));
}

interface LinkedFranchiseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit?: string;
}

interface LinkedFranchiseOrder {
  id: string;
  orderNumber: string;
  franchiseName: string;
  status: string;
  items: LinkedFranchiseOrderItem[];
}

function findMatchingRecipe(
  recipeList: Recipe[],
  criteria: {
    recipeId?: string | null;
    productId?: string | null;
    recipeCode?: string | null;
    productName?: string | null;
  }
): Recipe | undefined {
  if (!recipeList || recipeList.length === 0) return undefined;

  // 1. Direct Recipe ID match
  if (criteria.recipeId) {
    const byId = recipeList.find((r) => r.id === criteria.recipeId);
    if (byId) return byId;
  }

  // 2. Direct Recipe Code match
  if (criteria.recipeCode) {
    const code = criteria.recipeCode.trim().toLowerCase();
    const byCode = recipeList.find(
      (r) => (r as any).recipeCode && (r as any).recipeCode.trim().toLowerCase() === code
    );
    if (byCode) return byCode;
  }

  // 3. Product ID match (r.productId or r.product?.id)
  if (criteria.productId) {
    const byProductId = recipeList.find(
      (r) => r.productId === criteria.productId || r.product?.id === criteria.productId
    );
    if (byProductId) return byProductId;
  }

  // 4. Product Name or Recipe Name exact match
  const searchName = (criteria.productName || criteria.recipeId || criteria.productId || "").trim().toLowerCase();
  if (searchName) {
    const byExactName = recipeList.find(
      (r) =>
        r.name?.trim().toLowerCase() === searchName ||
        r.product?.name?.trim().toLowerCase() === searchName
    );
    if (byExactName) return byExactName;

    // 5. Case-insensitive / partial match as fallback
    const byPartialName = recipeList.find(
      (r) =>
        r.name?.toLowerCase().includes(searchName) ||
        r.product?.name?.toLowerCase().includes(searchName)
    );
    if (byPartialName) return byPartialName;
  }

  return undefined;
}

function ProductionPlanningContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const franchiseOrderIdParam = searchParams.get("franchiseOrderId");
  const targetProductIdParam = searchParams.get("productId") || searchParams.get("product");
  const recipeIdParam = searchParams.get("recipeId") || searchParams.get("recipe");
  const recipeCodeParam = searchParams.get("recipeCode") || searchParams.get("code");
  const productNameParam = searchParams.get("productName");
  const targetYieldParam = searchParams.get("targetYield") || searchParams.get("quantity") || searchParams.get("qty") || searchParams.get("yield");
  const targetUnitParam = searchParams.get("targetUnit") || searchParams.get("unit");

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  // The production target as typed. Empty by default: the operator enters it
  // explicitly (never pre-filled from the reference yield). Only a positive
  // number is a target; until then nothing is scaled, checked or startable.
  const [targetText, setTargetText] = useState<string>("");
  const setTargetYield = useCallback((n: number | null | undefined) => {
    setTargetText(n != null && Number.isFinite(n) && n > 0 ? String(n) : "");
  }, []);
  const targetEntered = targetText.trim() !== "";
  const targetParsed = targetEntered ? Number(targetText) : NaN;
  const targetValid = Number.isFinite(targetParsed) && targetParsed > 0;
  const targetYield = targetValid ? targetParsed : 0;
  const [targetUnit, setTargetUnit] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [franchiseId, setFranchiseId] = useState<string>("");
  const [launching, setLaunching] = useState(false);

  // Franchise Order Link State
  const [linkedOrder, setLinkedOrder] = useState<LinkedFranchiseOrder | null>(null);
  const [activeOrderItemIndex, setActiveOrderItemIndex] = useState<number>(0);
  const [missingRecipeForProduct, setMissingRecipeForProduct] = useState<{
    name: string;
    quantity: number;
    productId: string;
  } | null>(null);

  // Add Warehouse modal
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [newWhLocation, setNewWhLocation] = useState("");
  const [savingWh, setSavingWh] = useState(false);

  // Recipe picker + launch confirmation
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Unsaved formulation being edited in the Reference Formulation panel,
  // tagged with the recipe it belongs to.
  const [formulationDraft, setFormulationDraft] = useState<{ recipeId: string; formulation: Formulation | null } | null>(null);
  // Purchase lots per material in the selected warehouse, and the operator's
  // allocation per material (absent = the oldest-first suggestion).
  const [lotOptions, setLotOptions] = useState<Record<string, MaterialLots> | null>(null);
  const [lotsError, setLotsError] = useState(false);
  const [lotsReload, setLotsReload] = useState(0);
  const [lotDrafts, setLotDrafts] = useState<Record<string, AllocationDraft>>({});
  const [openLots, setOpenLots] = useState<Record<string, boolean>>({});

  // Recipe Master only lists ingredients; quantities and the reference yield
  // come from the saved formulation (or the draft while it's being edited).
  // Everything below scales from `recipe.yieldQty` / `recipe.recipeItems`,
  // so the effective recipe presents the formulation in that shape.
  const baseRecipe = recipes.find((r) => r.id === selectedRecipeId);
  const activeFormulation = isUsableFormulation(baseRecipe?.activeFormulation) ? baseRecipe!.activeFormulation! : null;
  const formulationOutdated = !!baseRecipe && !!activeFormulation && !sameIngredientSet(baseRecipe, activeFormulation);
  const draftForRecipe = formulationDraft?.recipeId === selectedRecipeId ? formulationDraft.formulation : null;
  const editingFormulation = !!draftForRecipe;
  // Requirements are only calculated from a formulation with a valid
  // reference yield; an incomplete draft shows no numbers rather than ×1.
  const candidateFormulation = draftForRecipe ?? (formulationOutdated ? null : activeFormulation);
  const shownFormulation = candidateFormulation && Number.isFinite(candidateFormulation.yieldQty) && candidateFormulation.yieldQty > 0
    ? candidateFormulation
    : null;
  const recipe: Recipe | undefined = baseRecipe && {
    ...baseRecipe,
    yieldQty: shownFormulation && shownFormulation.yieldQty > 0 ? shownFormulation.yieldQty : 0,
    yieldUnit: shownFormulation?.yieldUnit || baseRecipe.yieldUnit || "KG",
    recipeItems: (shownFormulation?.items ?? []).map((i) => ({
      id: i.inventoryItemId,
      inventoryItemId: i.inventoryItemId,
      quantityRequired: i.quantity,
      unit: i.unit,
      inventoryItem: { name: i.inventoryItem?.name, sku: i.inventoryItem?.sku, currentStock: i.inventoryItem?.currentStock ?? 0 },
    })),
  };
  const formulationReady = !!activeFormulation && !formulationOutdated && !editingFormulation;

  // Helper to select a specific franchise order item and match its recipe
  const applyOrderItemSelection = useCallback(
    (orderItem: LinkedFranchiseOrderItem, recipeList: Recipe[]) => {
      const matched = findMatchingRecipe(recipeList, {
        productId: orderItem.productId,
        productName: orderItem.productName,
      });

      if (matched) {
        setSelectedRecipeId(matched.id);
        setTargetYield(orderItem.quantity);
        setTargetUnit(orderItem.unit || matched.yieldUnit || "KG");
        setMissingRecipeForProduct(null);
      } else {
        setSelectedRecipeId("");
        setTargetYield(orderItem.quantity || 1);
        setTargetUnit(orderItem.unit || "KG");
        setMissingRecipeForProduct({
          name: orderItem.productName,
          quantity: orderItem.quantity,
          productId: orderItem.productId,
        });
      }
    },
    []
  );

  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [rRes, wRes, fRes] = await Promise.all([
          recipesApi.getAll(),
          inventoryApi.getWarehouses(),
          franchiseApi.getAll(),
        ]);

        const recipeList: Recipe[] = rRes.data || [];
        setRecipes(recipeList);

        const whList = wRes.data || [];
        setWarehouses(whList);
        if (whList.length > 0) {
          let remembered: string | null = null;
          try {
            remembered = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
          } catch {}
          const rememberedWh = remembered && whList.find((w: any) => w.id === remembered);
          setSelectedWarehouseId(rememberedWh ? rememberedWh.id : whList[0].id);
        }

        const franchiseList = fRes.data || [];
        if (franchiseList.length > 0) {
          const hq = franchiseList.find((f: any) => f.isHQ);
          const fallback = [...franchiseList].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setFranchiseId((hq || fallback).id);
        }

        // 1. Check if opened with a Franchise Order reference
        if (franchiseOrderIdParam) {
          try {
            const foRes = await franchiseOrdersApi.getById(franchiseOrderIdParam);
            const foData = foRes.data;

            if (foData) {
              const items: LinkedFranchiseOrderItem[] = (foData.items || []).map((i: any) => ({
                productId: i.productId || i.product?.id,
                productName: i.product?.name || i.productName || "Product",
                quantity: Number(i.quantity || 1),
                unit: i.product?.unit || i.unit || "KG",
              }));

              const orderObj: LinkedFranchiseOrder = {
                id: foData.id,
                orderNumber: foData.orderNumber || `FO-${foData.id.slice(0, 6)}`,
                franchiseName: foData.franchise?.name || "Franchise",
                status: foData.status,
                items,
              };

              setLinkedOrder(orderObj);

              // Determine initial active item index
              let initialIdx = 0;
              if (targetProductIdParam) {
                const foundIdx = items.findIndex((it) => it.productId === targetProductIdParam);
                if (foundIdx >= 0) initialIdx = foundIdx;
              }
              setActiveOrderItemIndex(initialIdx);

              if (items.length > 0) {
                applyOrderItemSelection(items[initialIdx], recipeList);
              }
            }
          } catch (foErr) {
            console.error("Failed to load originating franchise order:", foErr);
            toast.error("Could not load details for the requested Franchise Order.");
          }
        } 
        // 2. Check if a specific recipe or product was requested via query params
        else if (recipeIdParam || targetProductIdParam || recipeCodeParam || productNameParam) {
          const matched = findMatchingRecipe(recipeList, {
            recipeId: recipeIdParam,
            productId: targetProductIdParam,
            recipeCode: recipeCodeParam,
            productName: productNameParam,
          });

          if (matched) {
            setSelectedRecipeId(matched.id);
            setTargetYield(targetYieldParam ? Number(targetYieldParam) : null);
            setTargetUnit(targetUnitParam || matched.yieldUnit || "KG");
            setMissingRecipeForProduct(null);
          } else {
            // Explicitly requested product/recipe has no formulation configured
            setSelectedRecipeId("");
            const requestedLabel = productNameParam || targetProductIdParam || recipeCodeParam || recipeIdParam || "Selected Product";
            setTargetYield(targetYieldParam ? Number(targetYieldParam) : 1);
            setTargetUnit(targetUnitParam || "KG");
            setMissingRecipeForProduct({
              name: requestedLabel,
              quantity: targetYieldParam ? Number(targetYieldParam) : 1,
              productId: targetProductIdParam || "",
            });
          }
        } 
        // 3. Standard direct manual planning flow (no route params)
        else {
          if (recipeList.length > 0) {
            setSelectedRecipeId(recipeList[0].id);
            setTargetYield(null);
            setTargetUnit(recipeList[0].yieldUnit || "KG");
            setMissingRecipeForProduct(null);
          } else {
            setSelectedRecipeId("");
            setMissingRecipeForProduct(null);
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load recipes or warehouses");
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [franchiseOrderIdParam, targetProductIdParam, recipeIdParam, recipeCodeParam, productNameParam, targetYieldParam, targetUnitParam, applyOrderItemSelection, setTargetYield]);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    async function loadStock() {
      setStockLoading(true);
      try {
        const res = await inventoryApi.getRawMaterialStockSummary(selectedWarehouseId, undefined, "ALL");
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
      setTargetYield(null);
      setTargetUnit(found.yieldUnit || "KG");
      setMissingRecipeForProduct(null);
    }
  };

  const handleSwitchOrderItem = (idx: number) => {
    if (!linkedOrder || !linkedOrder.items[idx]) return;
    setActiveOrderItemIndex(idx);
    applyOrderItemSelection(linkedOrder.items[idx], recipes);
  };

  const handleWarehouseChange = (id: string) => {
    setSelectedWarehouseId(id);
    try {
      localStorage.setItem(WAREHOUSE_STORAGE_KEY, id);
    } catch {}
  };

  const recipeUnit = recipe?.yieldUnit || "KG";
  // Target units must be convertible to the saved formulation's yield unit.
  // With nothing saved yet, the target sets that unit, so any unit the
  // formulation layer supports is offered.
  const unitAnchor = activeFormulation?.yieldUnit || null;
  const compatibleUnits = useMemo(() => {
    if (!unitAnchor) return ["KG", "G", "L", "ML", "PCS", "BOX"];
    const list: string[] = RECIPE_UNITS.filter((u) => isUnitCompatible(u, unitAnchor));
    if (!list.includes(unitAnchor)) list.unshift(unitAnchor);
    return list;
  }, [unitAnchor]);
  const effectiveTargetUnit = targetUnit && compatibleUnits.includes(targetUnit)
    ? targetUnit
    : (compatibleUnits.includes(recipeUnit) ? recipeUnit : compatibleUnits[0]);
  const targetYieldInRecipeUnit = convertUnit(targetYield, effectiveTargetUnit, recipeUnit);
  const multiplier = !targetValid ? 0 : recipe && recipe.yieldQty > 0 ? targetYieldInRecipeUnit / recipe.yieldQty : 1;
  // Requirements, stock and lot checks only mean something once a target is entered.
  const targetReady = !!recipe && targetValid;

  const findStock = (itemId: string, itemSku: string) => {
    if (!Array.isArray(warehouseStock)) return null;
    return warehouseStock.find((fi: any) => {
      const matchSku = fi.sku && itemSku && fi.sku.trim().toLowerCase() === itemSku.trim().toLowerCase();
      const matchId = fi.inventoryItemId === itemId || fi.id === itemId;
      return matchSku || matchId;
    }) || null;
  };
  // Usable stock only: expired (expiry date reached) and held lot stock is
  // never counted, so a shortage shows and can be purchased.
  const getAvailableStock = (itemId: string, itemSku: string, itemRecipeUnit: string) => {
    const found = findStock(itemId, itemSku);
    if (!found) return 0;
    return convertUnit(found.usableStock ?? found.availableStock ?? 0, found.unit, itemRecipeUnit);
  };
  const getExpiredStock = (itemId: string, itemSku: string, itemRecipeUnit: string) => {
    const found = findStock(itemId, itemSku);
    return found?.expiredStock > 0 ? convertUnit(found.expiredStock, found.unit, itemRecipeUnit) : 0;
  };

  const ingredientRows = (recipe?.recipeItems || []).map((item) => {
    // The requirement as the run will consume it (weights below 1 KG up to
    // the next whole gram) — shown, checked, allocated and costed as is.
    const scaledQty = roundRequirement(item.quantityRequired * multiplier, item.unit);
    const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
    const sufficient = available + EPSILON >= scaledQty;
    const deficit = Math.max(scaledQty - available, 0);
    const coverage = scaledQty > 0 ? Math.min(available / scaledQty, 1) : 1;
    // Lot allocation is in the material's stock unit.
    const material = lotOptions?.[item.inventoryItemId];
    const requiredStock = material ? convertUnit(scaledQty, item.unit, material.unit) : 0;
    const lotDraft: AllocationDraft = material ? (lotDrafts[item.inventoryItemId] ?? fifoDraft(material, requiredStock)) : {};
    const lotError = material ? allocationError(material, lotDraft, requiredStock) : null;
    const lotCost = material ? allocationCost(material, lotDraft) : null;
    return { item, scaledQty, available, sufficient, deficit, coverage, material, requiredStock, lotDraft, lotError, lotCost };
  });
  const shortRows = ingredientRows.filter((r) => !r.sufficient);
  const hasShortage = shortRows.length > 0;

  const ingredientIdsKey = (recipe?.recipeItems || []).map((i) => i.inventoryItemId).sort().join(",");
  useEffect(() => {
    setLotDrafts({});
    setOpenLots({});
    setLotOptions(null);
    setLotsError(false);
    if (!selectedWarehouseId || !ingredientIdsKey) return;
    let cancelled = false;
    productionApi.getLotOptions(selectedWarehouseId, ingredientIdsKey.split(","))
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, MaterialLots> = {};
        (Array.isArray(res.data) ? res.data : []).forEach((m: MaterialLots) => { map[m.inventoryItemId] = m; });
        setLotOptions(map);
      })
      .catch(() => { if (!cancelled) setLotsError(true); });
    return () => { cancelled = true; };
  }, [selectedWarehouseId, ingredientIdsKey, lotsReload]);

  const lotsReady = !!lotOptions && ingredientRows.every((r) => !!r.material);
  const lotProblemRows = ingredientRows.filter((r) => r.lotError);
  const materialCostTotal = ingredientRows.reduce((s, r) => s + (r.lotCost ?? 0), 0);
  // The recipe's saved expenses, applied automatically (nothing to enter here).
  const expenseEstimate = estimateManufacturing(recipe?.additionalExpenses, targetYield, effectiveTargetUnit);
  const packagingExpense = (recipe?.additionalExpenses || []).find((e: any) => e?.enabled && isPackaging(e.category));
  const estimatedProductionCost = materialCostTotal + expenseEstimate.total;
  const fmtInr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // Largest batch the selected warehouse can support right now, in the target unit.
  const maxMultiplier = ingredientRows.reduce((min, r) => {
    if (r.item.quantityRequired <= 0) return min;
    return Math.min(min, maxMultiplierFor(r.item.quantityRequired, r.available, r.item.unit));
  }, Infinity);
  const maxPossibleYield =
    recipe && Number.isFinite(maxMultiplier)
      ? Math.floor(convertUnit(maxMultiplier * recipe.yieldQty, recipeUnit, effectiveTargetUnit) * 1000) / 1000
      : 0;

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
  // Typed but not a positive number (an empty field is simply "not entered yet").
  const yieldInvalid = !!recipe && targetEntered && !targetValid;
  const canStart = targetReady && formulationReady && !hasShortage && !!selectedWarehouseId && !stockLoading && ingredientRows.length > 0
    && lotsReady && lotProblemRows.length === 0;

  const handleFormulationSaved = (f: Formulation) => {
    setRecipes((prev) => prev.map((r) => (r.id === selectedRecipeId ? { ...r, activeFormulation: f, yieldQty: f.yieldQty, yieldUnit: f.yieldUnit } : r)));
    setFormulationDraft(null);
  };

  // Disambiguate recipes that share a name (e.g. two "egg curry" entries).
  const nameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach((r) => {
      const k = (r.name || "").trim().toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [recipes]);

  const recipeSubLabel = (r: Recipe) => {
    const parts: string[] = [];
    if (r.product?.name && r.product.name.trim().toLowerCase() !== r.name.trim().toLowerCase()) {
      parts.push(r.product.name);
    }
    parts.push(isUsableFormulation(r.activeFormulation) ? `Ref. ${fmtQty(r.activeFormulation.yieldQty)} ${r.activeFormulation.yieldUnit}` : "Formulation needed");
    const ingCount = r.ingredients?.length ?? r.recipeItems?.length ?? 0;
    parts.push(`${ingCount} ingredient${ingCount === 1 ? "" : "s"}`);
    if (nameCounts[(r.name || "").trim().toLowerCase()] > 1) {
      parts.push((r as any).recipeCode || `#${r.id.slice(-6).toUpperCase()}`);
    }
    return parts.join(" · ");
  };

  const filteredRecipes = useMemo(() => {
    const q = recipeQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.product?.name?.toLowerCase().includes(q) ||
        ((r as any).recipeCode || "").toLowerCase().includes(q)
    );
  }, [recipes, recipeQuery]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const pickRecipe = (id: string) => {
    handleRecipeChange(id);
    setPickerOpen(false);
    setRecipeQuery("");
  };

  const handlePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filteredRecipes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = filteredRecipes[highlightIdx];
      if (r) pickRecipe(r.id);
    } else if (e.key === "Escape") {
      setPickerOpen(false);
    }
  };

  const setYieldByMultiple = (k: number) => {
    if (!recipe) return;
    setTargetUnit(recipeUnit);
    setTargetYield(Math.round(recipe.yieldQty * k * 1000) / 1000);
  };

  const handleBuyShortages = () => {
    if (!recipe) return;
    const shortageItems = shortRows.map((r) => {
      // Same units the screen shows (1.375 KG, 486 g), never understated:
      // weights up to the next whole gram (see procurementQty). The raw
      // recipe unit used to be sent as-is, so a recipe kept in grams opened
      // the PO as "1375.404 G".
      const order = procurementQty(r.deficit, r.item.unit || "KG");
      return {
        materialId: r.item.inventoryItemId,
        name: r.item.inventoryItem?.name || "",
        required: r.scaledQty,
        stock: r.available,
        shortage: order.quantity,
        unit: order.unit,
        // Exact shortfall in the recipe unit, for reference.
        canonicalShortage: r.deficit,
        canonicalUnit: r.item.unit || "KG",
        warehouseId: selectedWarehouseId || undefined,
      };
    });

    sessionStorage.setItem("prefilledPoItems", JSON.stringify(shortageItems));
    // A full navigation, not router.push — the New PO page only reads this
    // sessionStorage flag in its mount effect, and Next's client-side router
    // cache can reuse an already-mounted instance of that page from an
    // earlier visit (well within its default staleTime), silently skipping
    // that read and leaving the page on whatever stale state it already had.
    window.location.href = "/purchases/new";
  };

  const handleStartProductionDirect = async () => {
    if (!recipe) return;
    if (!formulationReady || !activeFormulation?.id) {
      toast.error("Save the reference formulation before starting production.");
      return;
    }
    if (hasShortage) {
      toast.error("Some ingredients are short. Buy raw materials or reduce the batch size first.");
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
    if (!lotsReady || lotProblemRows.length > 0) {
      toast.error(lotProblemRows.length
        ? `Check the purchase lots for ${lotProblemRows[0].item.inventoryItem?.name}: ${lotProblemRows[0].lotError}`
        : "Purchase lots are still loading.");
      return;
    }

    // Same default the old confirmation dialog pre-filled (today + 7 days).
    const expiryDate = defaultExpiryDate();

    setLaunching(true);
    try {
      // The backend resolves the saved formulation, rescales, re-checks
      // warehouse stock and freezes a snapshot before deducting anything.
      const startRes = await productionApi.startPlanned({
        recipeId: recipe.id,
        formulationId: activeFormulation.id,
        targetQty: targetYield,
        targetUnit: effectiveTargetUnit,
        franchiseId,
        warehouseId: selectedWarehouseId,
        expiryDate,
        productionType: "FINISHED_GOOD",
        // Exactly the lots chosen above; the server re-checks each one.
        lotAllocations: Object.fromEntries(ingredientRows.map((r) => [r.item.inventoryItemId, toPayload(r.lotDraft)])),
      });

      // If originated from a Franchise Order in APPROVED state, update order status to IN_PRODUCTION
      if (linkedOrder?.id) {
        try {
          if (linkedOrder.status === "APPROVED") {
            await franchiseOrdersApi.updateStatus(linkedOrder.id, "IN_PRODUCTION");
          }
        } catch (statusErr) {
          console.error("Non-blocking order status update error:", statusErr);
        }
        toast.success(`Production ${startRes.data?.productionBatchCode || ""} started for ${recipe.name} (Order: ${linkedOrder.orderNumber})`);
      } else {
        toast.success(`Production ${startRes.data?.productionBatchCode || ""} started for ${recipe.name}`);
      }

      router.push("/production/batches?tab=ACTIVE_RUNS");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to start production. Verify ingredient stock.");
    } finally {
      setLaunching(false);
    }
  };

  const handleAddWarehouse = async () => {
    if (!newWhName.trim()) {
      toast.error("Warehouse name is required");
      return;
    }
    setSavingWh(true);
    try {
      const res = await inventoryApi.createWarehouse({
        name: newWhName.trim(),
        location: newWhLocation.trim() || undefined,
      });
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
    if (!recipe) {
      toast.error("Please select a formulation recipe before printing.");
      return;
    }
    if (targetYield <= 0) {
      toast.error("Please enter a valid target batch yield before printing.");
      return;
    }

    const selectedWh = warehouses.find((w) => w.id === selectedWarehouseId);
    const whName = selectedWh ? `${selectedWh.name}${selectedWh.location ? ` (${selectedWh.location})` : ""}` : "Default Warehouse";

    const cleanInstructions = (recipe.instructions || "")
      .replace(/\[unitWeight:[\d.]+\]/g, "")
      .replace(/\[weightUnit:\w+\]/g, "")
      .trim();

    const formattedMultiplier = multiplier >= 0.01 
      ? multiplier.toFixed(2) 
      : multiplier.toFixed(4).replace(/\.?0+$/, "");

    const formatNum = (n: number) => {
      if (Number.isInteger(n)) return n.toString();
      return n.toFixed(2).replace(/\.?0+$/, "");
    };

    const tableRows = recipe.recipeItems.map((item, idx) => {
      const scaledQty = roundRequirement(item.quantityRequired * multiplier, item.unit);
      const stock = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
      const isShort = stock + 0.000001 < scaledQty;
      const shortageQty = scaledQty - stock;

      return `
        <tr style="${isShort ? 'background-color: #fff1f2;' : (idx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;')}">
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
            ${item.inventoryItem?.name || (item as any).name || "Raw Material"}
            ${item.inventoryItem?.sku ? `<div style="font-size: 10px; color: #64748b; font-weight: 500; font-family: monospace;">SKU: ${item.inventoryItem.sku}</div>` : ""}
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #64748b; font-family: monospace;">${formatNum(item.quantityRequired)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: #ea580c; font-size: 12px; font-family: monospace;">${formatQty(scaledQty, item.unit)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569; font-weight: 600;">${item.unit || "KG"}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">${formatQty(stock, item.unit, "down")}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            ${isShort 
              ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; background-color: #fee2e2; color: #dc2626; border: 1px solid #fecaca;">Short: -${formatQty(shortageQty, item.unit)}</span>` 
              : `<span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">✓ In Stock</span>`
            }
          </td>
        </tr>
      `;
    }).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups in your browser to print the formulation recipe.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Production Planning - ${recipe.name} (${targetYield} ${effectiveTargetUnit})</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #0f172a; line-height: 1.4; margin: 0; background: #fff; font-size: 12px; }
            .no-print { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
            .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 12px; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; }
            .btn-primary { background: #f97316; color: white; }
            .btn-secondary { background: #f1f5f9; color: #475569; }
            .header-bar { border-bottom: 3px solid #f97316; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .brand-title h1 { font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em; }
            .brand-subtitle { font-size: 11px; font-weight: 700; color: #ea580c; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
            .header-meta { font-size: 10px; color: #64748b; text-align: right; line-height: 1.5; font-weight: 600; }
            .order-banner { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 8px 12px; margin-bottom: 16px; font-size: 11px; color: #3730a3; font-weight: 600; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .stat-card { background: #f8fafc; padding: 10px 12px; border-radius: 10px; border: 1px solid #e2e8f0; }
            .stat-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 3px; letter-spacing: 0.05em; }
            .stat-value { font-size: 14px; font-weight: 900; color: #0f172a; }
            .stat-value.highlight { color: #ea580c; }
            .section-header { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #ea580c; margin: 16px 0 8px 0; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }
            .section-header::after { content: ""; flex: 1; height: 1px; background: #fed7aa; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 11px; }
            th { background: #f8fafc; padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; }
            .instructions-box { background: #fffaf5; padding: 12px 14px; border-radius: 8px; border: 1px solid #fed7aa; margin-bottom: 16px; }
            .instructions-text { white-space: pre-line; line-height: 1.5; font-size: 11px; color: #431407; font-weight: 500; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
            <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save PDF</button>
          </div>

          <div class="header-bar">
            <div class="brand-title">
              <h1>Kiddos Food ERP</h1>
              <div class="brand-subtitle">Production Planning & Formulation Work Order</div>
            </div>
            <div class="header-meta">
              <div><strong>Formulation:</strong> ${recipe.name}</div>
              <div><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</div>
              <div><strong>Warehouse:</strong> ${whName}</div>
            </div>
          </div>

          ${linkedOrder ? `
            <div class="order-banner">
              📋 Producing for Franchise Order: <strong>${linkedOrder.orderNumber}</strong> (${linkedOrder.franchiseName})
            </div>
          ` : ''}

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Formulation Recipe</div>
              <div class="stat-value">${recipe.name}</div>
              ${recipe.product?.name ? `<div style="font-size: 9px; color: #64748b; margin-top: 2px;">Product: ${recipe.product.name}</div>` : ''}
            </div>
            <div class="stat-card">
              <div class="stat-label">Base Recipe Yield</div>
              <div class="stat-value">${recipe.yieldQty} ${recipe.yieldUnit || "Units"}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Target Batch Yield</div>
              <div class="stat-value highlight">${targetYield} ${effectiveTargetUnit}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Batch Multiplier</div>
              <div class="stat-value">${formattedMultiplier}×</div>
            </div>
          </div>

          <div class="section-header">Scaled Raw Material Requirements (${recipe.recipeItems.length} Materials)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">#</th>
                <th style="text-align: left;">Raw Material / Ingredient</th>
                <th style="text-align: right; width: 90px;">Base Formula</th>
                <th style="text-align: right; width: 110px;">Required Qty</th>
                <th style="text-align: center; width: 60px;">Formula Unit</th>
                <th style="text-align: right; width: 100px;">Available Stock</th>
                <th style="text-align: center; width: 110px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 12px; color: #94a3b8;">No ingredients listed in formula</td></tr>'}
            </tbody>
          </table>

          <div class="section-header">Production Methodology &amp; Instructions</div>
          <div class="instructions-box">
            <div class="instructions-text">${cleanInstructions || "Standard formulation procedures apply. Ensure QC parameters are recorded during all production stages."}</div>
          </div>


          <script>
            setTimeout(() => {
              window.focus();
              window.print();
            }, 300);
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          Planning Scheduler Loading...
        </p>
      </div>
    );
  }

  const instructionsText = cleanInstructionText(recipe?.instructions);
  const quickMultiples = [0.5, 1, 2, 5];

  const StepBadge = ({ n, done }: { n: number; done: boolean }) => (
    <span
      className={clsx(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
        done ? "bg-emerald-500 text-white" : "bg-orange-100 dark:bg-orange-500/15 text-[#f58220]"
      )}
    >
      {done ? <Check size={11} strokeWidth={3} /> : n}
    </span>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0 animate-in fade-in duration-300">

      {/* ── Franchise Order Context Banner (When opened from FO) ── */}
      {linkedOrder && (
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Producing for Franchise Order
                </span>
                <span className="font-mono font-bold text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  {linkedOrder.orderNumber}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  · {linkedOrder.franchiseName}
                </span>
              </div>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 font-medium mt-1">
                Product requirements and batch scaling pre-populated from this order.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {linkedOrder.items.length > 1 && (
              <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-x-auto max-w-full">
                {linkedOrder.items.map((it, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSwitchOrderItem(idx)}
                    className={clsx(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                      activeOrderItemIndex === idx
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-indigo-600"
                    )}
                  >
                    {it.productName} × {it.quantity}
                  </button>
                ))}
              </div>
            )}

            <Link
              href="/franchise-orders"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-card hover:bg-indigo-100/50 text-xs font-bold transition-colors"
            >
              Back to Franchise Orders
            </Link>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <ChefHat size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Production Planning
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-0.5">
              Pick what to make, how much, and where to take stock from — we&apos;ll check ingredients for you.
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={!recipe}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card text-gray-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Print a work order for the kitchen"
        >
          <Printer size={15} />
          <span>Print Work Order</span>
        </button>
      </div>

      {/* ── Step-by-step setup ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">

        {/* Step 1 — Recipe picker */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-2xs space-y-2 min-w-0">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-300">
            <StepBadge n={1} done={!!recipe} />
            What do you want to make?
          </label>

          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => {
                setPickerOpen((o) => !o);
                setHighlightIdx(0);
              }}
              className={clsx(
                "w-full flex items-center justify-between gap-2 bg-gray-50 dark:bg-[#13151f] border rounded-xl px-3 py-2 text-left cursor-pointer transition-colors",
                pickerOpen ? "border-[#f58220]" : "border-gray-200 dark:border-white/10 hover:border-orange-300"
              )}
            >
              {recipe ? (
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-gray-900 dark:text-white truncate">{recipe.name}</span>
                  <span className="block text-[10px] font-semibold text-gray-400 dark:text-slate-500 truncate">{recipeSubLabel(recipe)}</span>
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-400">Search or choose a recipe…</span>
              )}
              <ChevronDown size={14} className={clsx("text-gray-400 shrink-0 transition-transform", pickerOpen && "rotate-180")} />
            </button>

            {pickerOpen && (
              <div className="absolute z-30 mt-1.5 w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-150">
                <div className="p-2 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#13151f] rounded-lg px-2.5 py-1.5">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      autoFocus
                      value={recipeQuery}
                      onChange={(e) => {
                        setRecipeQuery(e.target.value);
                        setHighlightIdx(0);
                      }}
                      onKeyDown={handlePickerKeyDown}
                      placeholder="Type recipe or product name…"
                      className="w-full bg-transparent text-xs font-semibold outline-none text-gray-800 dark:text-white placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <ul className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                  {filteredRecipes.length === 0 ? (
                    <li className="px-3 py-4 text-center text-xs text-gray-400 font-semibold">
                      No recipes match &ldquo;{recipeQuery}&rdquo;
                    </li>
                  ) : (
                    filteredRecipes.map((r, idx) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setHighlightIdx(idx)}
                          onClick={() => pickRecipe(r.id)}
                          className={clsx(
                            "w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer",
                            idx === highlightIdx ? "bg-orange-50 dark:bg-orange-500/10" : ""
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-gray-900 dark:text-white truncate">{r.name}</span>
                            <span className="block text-[10px] font-semibold text-gray-400 dark:text-slate-500 truncate">{recipeSubLabel(r)}</span>
                          </span>
                          {r.id === selectedRecipeId && <Check size={14} className="text-[#f58220] shrink-0" />}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <Link
                  href="/production/recipes"
                  className="flex items-center gap-1.5 px-3 py-2 border-t border-gray-100 dark:border-white/5 text-[11px] font-bold text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-500/10"
                >
                  <Plus size={12} /> Create a new recipe
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 — Quantity */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-2xs space-y-2 min-w-0">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-300">
            <StepBadge n={2} done={targetReady} />
            How much to produce?
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              aria-label="Production quantity"
              disabled={!recipe}
              className={clsx(
                "w-full bg-gray-50 dark:bg-[#13151f] border text-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm font-bold focus:border-[#f58220] outline-none disabled:opacity-50",
                yieldInvalid ? "border-rose-400" : "border-gray-200 dark:border-white/10"
              )}
              placeholder="Enter production quantity"
            />
            <select
              value={effectiveTargetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              disabled={!recipe}
              title="Only units that convert to the recipe's unit are shown"
              className="bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl px-2.5 py-2 text-xs font-bold focus:border-[#f58220] outline-none cursor-pointer shrink-0 disabled:opacity-50"
            >
              {compatibleUnits.map((u) => (
                <option key={u} value={u} className="dark:bg-card">{u}</option>
              ))}
            </select>
          </div>
          {yieldInvalid ? (
            <p className="text-[11px] font-semibold text-rose-500">Enter a quantity greater than 0.</p>
          ) : recipe && recipe.yieldQty > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-0.5">Quick:</span>
              {quickMultiples.map((k) => {
                const active = Math.abs(multiplier - k) < 0.0001;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setYieldByMultiple(k)}
                    title={`${fmtQty(recipe.yieldQty * k)} ${recipeUnit}`}
                    className={clsx(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer",
                      active
                        ? "bg-[#f58220] text-white border-[#f58220]"
                        : "bg-white dark:bg-transparent text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-[#f58220] hover:text-[#f58220]"
                    )}
                  >
                    {fmtQty(recipe.yieldQty * k)} {recipeUnit}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Step 3 — Warehouse */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-2xs space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-300">
              <StepBadge n={3} done={!!selectedWarehouseId} />
              Take ingredients from
            </label>
            <button
              onClick={() => setShowAddWarehouse(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-[#f58220] hover:bg-orange-100 transition-colors text-[10px] font-bold uppercase cursor-pointer"
            >
              <Plus size={10} /> New
            </button>
          </div>
          {warehouses.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowAddWarehouse(true)}
              className="w-full border border-dashed border-orange-300 text-[#f58220] rounded-xl px-3 py-2 text-xs font-bold cursor-pointer hover:bg-orange-50"
            >
              No warehouse yet — add one
            </button>
          ) : (
            <select
              value={selectedWarehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:border-[#f58220] outline-none cursor-pointer"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id} className="dark:bg-card">
                  {w.name}{w.location ? ` (${w.location})` : ""}
                </option>
              ))}
            </select>
          )}
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 flex items-center gap-1">
            <Warehouse size={11} /> Stock is checked against this location
          </p>
        </div>
      </div>

      {/* ── No Recipe Warning (product has no recipe configured) ── */}
      {missingRecipeForProduct && !recipe && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center space-y-3 animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">
              No Recipe Configured for &ldquo;{missingRecipeForProduct.name}&rdquo;
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 max-w-lg mx-auto font-medium">
              {linkedOrder ? (
                <>The Franchise Order requested <strong>{missingRecipeForProduct.quantity} units</strong> of &ldquo;{missingRecipeForProduct.name}&rdquo;, but no formulation recipe exists for this product in the system yet.</>
              ) : (
                <>No formulation recipe exists for <strong>{missingRecipeForProduct.name}</strong> in the system yet. Please configure a formulation recipe in Recipe Master or pick an existing recipe above.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={`/production/recipes`}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus size={14} /> Configure Recipe in Recipe Master <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}

      {recipe ? (
        <>
          {/* ── Stock readiness summary ── */}
          {stockLoading ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-card p-4 flex items-center gap-3 text-xs font-bold text-gray-500">
              <RefreshCw size={16} className="animate-spin text-[#f58220]" />
              Checking stock at {selectedWarehouse?.name || "warehouse"}…
            </div>
          ) : (baseRecipe?.ingredients?.length ?? 0) === 0 && ingredientRows.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Info size={18} className="shrink-0" />
                This recipe has no ingredients yet. Add ingredients in Recipe Master before producing it.
              </div>
              <Link href="/production/recipes" className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0 text-center">
                Open Recipe Master
              </Link>
            </div>
          ) : ingredientRows.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <Info size={18} className="shrink-0" />
              Enter the reference formulation below to calculate ingredient requirements.
            </div>
          ) : !targetReady ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-4 flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
              <Info size={18} className="shrink-0 text-gray-400" />
              Enter production quantity to calculate ingredient requirements.
            </div>
          ) : hasShortage ? (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                    Not enough stock — {shortRows.length} of {ingredientRows.length} ingredient{ingredientRows.length === 1 ? "" : "s"} short
                  </p>
                  <p className="text-xs font-medium text-rose-700/80 dark:text-rose-300/70 mt-0.5">
                    {maxPossibleYield > 0 ? (
                      <>With current stock at {selectedWarehouse?.name || "this warehouse"} you can make up to <strong>{fmtQty(maxPossibleYield)} {effectiveTargetUnit}</strong>. Buy the missing items, reduce the quantity, or switch warehouse.</>
                    ) : (
                      <>{selectedWarehouse?.name || "This warehouse"} has none of at least one ingredient. Buy the missing items or switch to another warehouse.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {maxPossibleYield > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetYield(maxPossibleYield)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-card text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100/60 cursor-pointer"
                  >
                    <Zap size={13} /> Make {fmtQty(maxPossibleYield)} {effectiveTargetUnit} instead
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBuyShortages}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-2xs"
                >
                  <ShoppingCart size={13} /> Create Purchase Order
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Ready to produce</p>
                <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/70 mt-0.5">
                  All {ingredientRows.length} ingredient{ingredientRows.length === 1 ? " is" : "s are"} in stock at {selectedWarehouse?.name || "the selected warehouse"}.
                </p>
              </div>
            </div>
          )}

          {/* ── Reference formulation (saved per recipe, versioned) ── */}
          <ReferenceFormulationPanel
            key={`${baseRecipe!.id}:${activeFormulation?.id ?? "none"}`}
            recipe={baseRecipe}
            outdated={formulationOutdated}
            targetQty={targetYield}
            targetUnit={effectiveTargetUnit}
            onDraftChange={(f) => setFormulationDraft(f ? { recipeId: baseRecipe!.id, formulation: f } : null)}
            onSaved={handleFormulationSaved}
          />

          {/* ── Ingredients & instructions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
            <div className="lg:col-span-2 bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl shadow-2xs overflow-hidden min-w-0">
              <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Database size={15} className="text-[#f58220]" />
                  Ingredients needed ({ingredientRows.length})
                </h3>
                {targetReady && <p className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">
                  For {fmtQty(targetYield)} {effectiveTargetUnit} of {recipe.name}
                  {Math.abs(multiplier - 1) > 0.0001 && <> · {fmtQty(multiplier)}× the base recipe ({fmtQty(recipe.yieldQty)} {recipeUnit})</>}
                </p>}
              </div>

              {ingredientRows.length === 0 ? (
                <p className="p-6 text-center text-xs font-semibold text-gray-400">No ingredients listed in this recipe.</p>
              ) : !targetReady ? (
                <p className="p-6 text-center text-xs font-semibold text-gray-400">Enter production quantity to calculate ingredient requirements.</p>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto custom-scrollbar w-full max-w-full">
                    <table className="w-full text-left border-collapse min-w-[780px]">
                      <thead>
                        <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-200 dark:border-white/5">
                          <th className="py-3 px-5">Ingredient</th>
                          <th className="py-3 px-4 text-right">Need</th>
                          <th className="py-3 px-4 text-right">In stock</th>
                          <th className="py-3 px-5 w-[180px]">Status</th>
                          <th className="py-3 px-4">Purchase lots</th>
                          <th className="py-3 px-5 text-right">Material cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-semibold text-gray-700 dark:text-slate-300">
                        {ingredientRows.map(({ item, scaledQty, available, sufficient, deficit, coverage, material, requiredStock, lotDraft, lotError, lotCost }) => (
                          <Fragment key={item.id}>
                          <tr className={clsx("transition-colors", sufficient ? "hover:bg-orange-50/20 dark:hover:bg-white/[0.02]" : "bg-rose-50/40 dark:bg-rose-500/[0.04]")}>
                            <td className="py-3.5 px-5">
                              <div className="font-bold text-gray-900 dark:text-white">{item.inventoryItem?.name}</div>
                              <div className="text-[10px] font-mono text-gray-400 dark:text-slate-500 mt-0.5">{item.inventoryItem?.sku || "SKU-N/A"}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                              <QtyText qty={scaledQty} unit={item.unit} unitClass="text-[10px] text-gray-400" />
                            </td>
                            <td className="py-3.5 px-4 text-right text-gray-600 dark:text-slate-400 whitespace-nowrap">
                              <QtyText qty={available} unit={item.unit} unitClass="text-[10px]" rounding="down" />
                              {getExpiredStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit) > 0 && (
                                <div className="text-[10px] font-bold text-rose-600" title="Expired stock is not counted — purchase fresh material">
                                  {formatQty(getExpiredStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit), item.unit)} expired
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                {sufficient ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={12} /> Enough
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                    <AlertCircle size={12} /> Short by {formatQty(deficit, item.unit)}
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                                <div
                                  className={clsx("h-full rounded-full", sufficient ? "bg-emerald-500" : "bg-rose-500")}
                                  style={{ width: `${Math.max(coverage * 100, sufficient ? 100 : 3)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {material ? (
                                <button
                                  type="button"
                                  onClick={() => setOpenLots((o) => ({ ...o, [item.inventoryItemId]: !o[item.inventoryItemId] }))}
                                  aria-expanded={!!openLots[item.inventoryItemId]}
                                  className={clsx(
                                    "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer whitespace-nowrap",
                                    lotError ? "border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-500/10" : "border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 hover:border-[#f58220]"
                                  )}
                                >
                                  <Layers size={12} />
                                  {lotError ? "Check lots" : `${Object.values(lotDraft).filter((v) => Number(v) > 0).length} lot${Object.values(lotDraft).filter((v) => Number(v) > 0).length === 1 ? "" : "s"}`}
                                  <ChevronDown size={12} className={clsx("transition-transform", openLots[item.inventoryItemId] && "rotate-180")} />
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-400">{lotsError ? "—" : "Loading…"}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              {lotCost != null ? (
                                <>
                                  <div className="font-bold text-gray-900 dark:text-white">{fmtInr(lotCost)}</div>
                                  {requiredStock > 0 && <div className="text-[10px] text-gray-400">{fmtInr(lotCost / requiredStock)}/{material?.unit}</div>}
                                </>
                              ) : "—"}
                            </td>
                          </tr>
                          {material && openLots[item.inventoryItemId] && (
                            <tr>
                              <td colSpan={6} className="p-0">
                                <IngredientLotPanel
                                  material={material}
                                  required={requiredStock}
                                  draft={lotDraft}
                                  edited={!!lotDrafts[item.inventoryItemId]}
                                  onChange={(d) => setLotDrafts((prev) => ({ ...prev, [item.inventoryItemId]: d }))}
                                  onReset={() => setLotDrafts((prev) => { const next = { ...prev }; delete next[item.inventoryItemId]; return next; })}
                                />
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-gray-100 dark:divide-white/5">
                    {ingredientRows.map(({ item, scaledQty, available, sufficient, deficit, coverage, material, requiredStock, lotDraft, lotError, lotCost }) => (
                      <div key={item.id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-xs">{item.inventoryItem?.name}</p>
                            <p className="text-[10px] font-mono text-gray-400">{item.inventoryItem?.sku || "SKU-N/A"}</p>
                          </div>
                          {sufficient ? (
                            <span className="text-[10px] font-bold text-emerald-600">Enough</span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-600">Short by {formatQty(deficit, item.unit)}</span>
                          )}
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Need <strong className="text-gray-900 dark:text-white">{formatQty(scaledQty, item.unit)}</strong></span>
                          <span className="text-gray-500">In stock <strong className="text-gray-700 dark:text-slate-300">{formatQty(available, item.unit, "down")}</strong></span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                          <div
                            className={clsx("h-full rounded-full", sufficient ? "bg-emerald-500" : "bg-rose-500")}
                            style={{ width: `${Math.max(coverage * 100, sufficient ? 100 : 3)}%` }}
                          />
                        </div>
                        {material && (
                          <div className="flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => setOpenLots((o) => ({ ...o, [item.inventoryItemId]: !o[item.inventoryItemId] }))}
                              className={clsx("inline-flex items-center gap-1 font-bold cursor-pointer", lotError ? "text-rose-600" : "text-[#f58220]")}
                            >
                              <Layers size={12} /> {lotError ? "Check lots" : "Purchase lots"}
                              <ChevronDown size={12} className={clsx("transition-transform", openLots[item.inventoryItemId] && "rotate-180")} />
                            </button>
                            <span className="text-gray-500">Cost <strong className="text-gray-900 dark:text-white">{fmtInr(lotCost ?? 0)}</strong></span>
                          </div>
                        )}
                        {material && openLots[item.inventoryItemId] && (
                          <div className="-mx-3.5">
                            <IngredientLotPanel
                              material={material}
                              required={requiredStock}
                              draft={lotDraft}
                              edited={!!lotDrafts[item.inventoryItemId]}
                              onChange={(d) => setLotDrafts((prev) => ({ ...prev, [item.inventoryItemId]: d }))}
                              onReset={() => setLotDrafts((prev) => { const next = { ...prev }; delete next[item.inventoryItemId]; return next; })}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Production material cost summary */}
                  <div className="border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Production material cost</p>
                    {lotsError ? (
                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-2">
                        Couldn&apos;t load purchase lots.
                        <button type="button" onClick={() => setLotsReload((n) => n + 1)} className="underline cursor-pointer">Retry</button>
                      </span>
                    ) : !lotsReady ? (
                      <span className="text-[11px] font-semibold text-gray-400">{selectedWarehouseId ? "Loading purchase lots…" : "Choose a warehouse"}</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-semibold text-gray-600 dark:text-slate-300">
                        <span>Total <strong className="text-gray-900 dark:text-white text-sm">{fmtInr(materialCostTotal)}</strong></span>
                        {targetYield > 0 && (
                          <span>Planned cost <strong className="text-gray-900 dark:text-white">{fmtInr(materialCostTotal / targetYield)}/{effectiveTargetUnit}</strong></span>
                        )}
                        {lotProblemRows.length > 0 && (
                          <span className="text-rose-600 font-bold">{lotProblemRows.length} ingredient{lotProblemRows.length === 1 ? "" : "s"} need lot allocation</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Estimated production cost: materials + the recipe's manufacturing expenses */}
                  {lotsReady && !lotsError && (
                    <div className="border-t border-gray-100 dark:border-white/5 px-4 sm:px-5 py-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Estimated production cost</p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {expenseEstimate.lines.map((l) => (
                            <span key={l.category} title={l.basis === "PER_KG" ? `${fmtInr(l.rate)} per KG × planned output` : "Per batch"}>
                              {l.label} <strong className="text-gray-900 dark:text-white">{fmtInr(l.amount)}</strong>
                            </span>
                          ))}
                          <span>Total <strong className="text-gray-900 dark:text-white text-sm">{fmtInr(estimatedProductionCost)}</strong></span>
                          {targetYield > 0 && (
                            <span>Per {effectiveTargetUnit} <strong className="text-emerald-700 dark:text-emerald-400">{fmtInr(estimatedProductionCost / targetYield)}</strong></span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {expenseEstimate.lines.length || expenseEstimate.deferred.length || packagingExpense
                          ? "Additional expenses come from Recipe Master and are applied automatically. Final cost uses the actual yield at Complete Production."
                          : "No additional expenses set for this recipe in Recipe Master."}
                        {expenseEstimate.deferred.length > 0 && ` ${expenseEstimate.deferred.map((d) => `${d.label} ${fmtInr(d.rate)}/pkt`).join(", ")} charged at packaging.`}
                        {packagingExpense && " Packaging materials are charged at packaging."}
                      </p>
                      {expenseEstimate.error && <p className="text-[11px] font-bold text-rose-600">{expenseEstimate.error} Change its basis in Recipe Master.</p>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-2 min-w-0 h-fit">
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Cooking Instructions
              </h4>
              {instructionsText ? (
                <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-300 whitespace-pre-line font-medium">
                  {instructionsText}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-gray-400 dark:text-slate-500 font-medium italic">
                  No instructions saved for this recipe. Remember to record QC parameters during production.
                </p>
              )}
            </div>
          </div>

          {/* ── Sticky action bar ── */}
          <div className="sticky bottom-0 z-20 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-3 bg-white/95 dark:bg-card/95 backdrop-blur border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-3">
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleStartProductionDirect}
                disabled={!canStart || launching}
                title={
                  !targetValid
                    ? "Enter production quantity first"
                    : !formulationReady
                    ? "Save the reference formulation first"
                    : hasShortage
                    ? "Resolve the ingredient shortage first"
                    : !selectedWarehouseId
                    ? "Choose a warehouse first"
                    : lotProblemRows.length > 0
                    ? "Allocate purchase lots for every ingredient first"
                    : !lotsReady
                    ? "Loading purchase lots"
                    : undefined
                }
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer bg-[#f58220] hover:bg-[#e0751a] text-white disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-white/10 dark:disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {launching ? <RefreshCw size={14} className="animate-spin" /> : null}
                {launching ? "Starting..." : "Start Production"}
                {!launching && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        </>
      ) : !missingRecipeForProduct ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 text-center p-6">
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-[#f58220] mb-3">
            <ChefHat size={28} />
          </div>
          <p className="text-sm font-bold text-gray-800 dark:text-white">
            {recipes.length === 0 ? "No recipes yet" : "Pick a recipe to get started"}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
            {recipes.length === 0
              ? "Create your first recipe in Recipe Master, then come back here to plan production."
              : "Choose what you want to make in step 1 — we'll calculate the ingredients and check stock automatically."}
          </p>
          {recipes.length === 0 ? (
            <Link href="/production/recipes" className="mt-4 px-4 py-2 rounded-xl bg-[#f58220] text-white text-xs font-bold flex items-center gap-1.5">
              <Plus size={14} /> Create Recipe
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#f58220] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Search size={14} /> Choose Recipe
            </button>
          )}
        </div>
      ) : null}

      {/* ── Add Warehouse Modal ── */}
      {showAddWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Warehouse size={16} className="text-[#f58220]" />
                Add New Warehouse
              </h3>
              <button onClick={() => setShowAddWarehouse(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  placeholder="e.g. Central Plant Store, Cold Storage"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-[#13151f] focus:border-[#f58220] outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Location / Address</label>
                <input
                  type="text"
                  value={newWhLocation}
                  onChange={(e) => setNewWhLocation(e.target.value)}
                  placeholder="Optional address details"
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-[#13151f] focus:border-[#f58220] outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddWarehouse(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddWarehouse}
                disabled={savingWh}
                className="flex-1 py-2 rounded-xl bg-[#f58220] text-white text-xs font-bold hover:bg-[#e0751a] transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                {savingWh ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                <span>{savingWh ? "Saving..." : "Add Warehouse"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ProductionPlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Planning Scheduler Loading...
          </p>
        </div>
      }
    >
      <ProductionPlanningContent />
    </Suspense>
  );
}
