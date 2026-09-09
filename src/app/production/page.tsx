"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Printer, AlertCircle, AlertTriangle, CheckCircle2,
  RefreshCw, ChefHat, Database, Plus, Warehouse, X, ShoppingCart,
  ClipboardList, Package, ExternalLink
} from "lucide-react";
import { recipesApi, inventoryApi, franchiseApi, productionApi, franchiseOrdersApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { RECIPE_UNITS } from "@/lib/recipe-units";
import { convertUnit } from "@/lib/unitConversion";
import clsx from "clsx";

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
  const [targetYield, setTargetYield] = useState<number>(0);
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

  const recipe = recipes.find((r) => r.id === selectedRecipeId);

  // Helper to select a specific franchise order item and match its recipe
  const applyOrderItemSelection = useCallback(
    (orderItem: LinkedFranchiseOrderItem, recipeList: Recipe[]) => {
      const matched = findMatchingRecipe(recipeList, {
        productId: orderItem.productId,
        productName: orderItem.productName,
      });

      if (matched) {
        setSelectedRecipeId(matched.id);
        setTargetYield(orderItem.quantity || matched.yieldQty || 100);
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
          setSelectedWarehouseId(whList[0].id);
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
            setTargetYield(targetYieldParam ? Number(targetYieldParam) : (matched.yieldQty || 100));
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
            setTargetYield(recipeList[0].yieldQty || 100);
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
  }, [franchiseOrderIdParam, targetProductIdParam, recipeIdParam, recipeCodeParam, productNameParam, targetYieldParam, targetUnitParam, applyOrderItemSelection]);

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
      setTargetYield(found.yieldQty || 100);
      setTargetUnit(found.yieldUnit || "KG");
      setMissingRecipeForProduct(null);
    }
  };

  const handleSwitchOrderItem = (idx: number) => {
    if (!linkedOrder || !linkedOrder.items[idx]) return;
    setActiveOrderItemIndex(idx);
    applyOrderItemSelection(linkedOrder.items[idx], recipes);
  };

  const recipeUnit = recipe?.yieldUnit || "KG";
  const effectiveTargetUnit = targetUnit || recipeUnit;
  const targetYieldInRecipeUnit = convertUnit(targetYield, effectiveTargetUnit, recipeUnit);
  const multiplier = recipe && recipe.yieldQty > 0 ? targetYieldInRecipeUnit / recipe.yieldQty : 1;

  const getAvailableStock = (itemId: string, itemSku: string, itemRecipeUnit: string) => {
    if (!Array.isArray(warehouseStock)) return 0;
    const found = warehouseStock.find((fi: any) => {
      const matchSku = fi.sku && itemSku && fi.sku.trim().toLowerCase() === itemSku.trim().toLowerCase();
      const matchId = fi.inventoryItemId === itemId || fi.id === itemId;
      return matchSku || matchId;
    });
    if (!found) return 0;
    return convertUnit(found.availableStock ?? 0, found.unit, itemRecipeUnit);
  };

  const EPSILON = 0.000001;
  const hasShortage = recipe
    ? recipe.recipeItems.some((item) => {
        const scaledQty = item.quantityRequired * multiplier;
        const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
        return available + EPSILON < scaledQty;
      })
    : false;

  const handleStartProductionDirect = async () => {
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

      sessionStorage.setItem("prefilledPoItems", JSON.stringify(shortageItems));
      router.push("/purchases/new");
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

      // If originated from a Franchise Order in APPROVED state, update order status to IN_PRODUCTION
      if (linkedOrder?.id) {
        try {
          if (linkedOrder.status === "APPROVED") {
            await franchiseOrdersApi.updateStatus(linkedOrder.id, "IN_PRODUCTION");
          }
        } catch (statusErr) {
          console.error("Non-blocking order status update error:", statusErr);
        }
        toast.success(`Production started for ${recipe.name} (Order: ${linkedOrder.orderNumber})`);
      } else {
        toast.success(`Production started for ${recipe.name}`);
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
      const scaledQty = item.quantityRequired * multiplier;
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
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: #ea580c; font-size: 12px; font-family: monospace;">${formatNum(scaledQty)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569; font-weight: 600;">${item.unit || "KG"}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">${formatNum(stock)} ${item.unit || "KG"}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            ${isShort 
              ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; background-color: #fee2e2; color: #dc2626; border: 1px solid #fecaca;">Short: -${formatNum(shortageQty)}</span>` 
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
                <th style="text-align: center; width: 60px;">Unit</th>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 w-full min-w-0 animate-in fade-in duration-300">

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
            {/* Multi-product tabs if order contains >1 item */}
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

      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <ChefHat size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Production Planning &amp; Scaling
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Scale formulation recipes, verify raw material availability, and launch batch runs
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end min-w-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card text-gray-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Print Formulation Recipe"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print Recipe</span>
          </button>

          <button
            onClick={handleStartProductionDirect}
            disabled={launching || multiplier <= 0 || !recipe}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0 disabled:opacity-50 ${
              !recipe || multiplier <= 0
                ? "bg-gray-300 dark:bg-white/10 text-gray-600 dark:text-slate-400"
                : hasShortage
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-[#f58220] hover:bg-[#e0751a] text-white"
            }`}
          >
            {launching ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Launching...</span>
              </>
            ) : !recipe ? (
              <span>Select Recipe First</span>
            ) : multiplier <= 0 ? (
              <span>Enter Batch Yield</span>
            ) : hasShortage ? (
              <>
                <AlertTriangle size={14} />
                <span>Insufficient Stock — Buy Raw Materials</span>
                <ShoppingCart size={14} />
              </>
            ) : (
              <>
                <span>Start Production Run</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Configuration Parameters Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">
        {/* 1. Recipe Selector */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-2xs space-y-1.5 min-w-0">
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
            Formulation Recipe <span className="text-[#f58220]">*</span>
          </label>
          <select
            value={selectedRecipeId}
            onChange={(e) => handleRecipeChange(e.target.value)}
            className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:border-[#f58220] outline-none cursor-pointer"
          >
            <option value="" disabled className="dark:bg-card">Choose Recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id} className="dark:bg-card">
                {r.name} (Yield: {r.yieldQty} {r.yieldUnit})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Target Batch Yield */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-2xs space-y-1.5 min-w-0">
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
            Target Batch Yield <span className="text-[#f58220]">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={targetYield || ""}
              onChange={(e) => setTargetYield(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-[#f58220] outline-none"
              placeholder="e.g. 100"
            />
            <select
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              className="bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl px-2.5 py-2 text-xs font-bold focus:border-[#f58220] outline-none cursor-pointer shrink-0"
            >
              {RECIPE_UNITS.map((u) => (
                <option key={u} value={u} className="dark:bg-card">{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Warehouse Location */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-2xs space-y-1.5 min-w-0">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
              <Warehouse size={13} className="text-[#f58220]" />
              Stock Location / Warehouse
            </label>
            <button
              onClick={() => setShowAddWarehouse(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-[#f58220] hover:bg-orange-100 transition-colors text-[10px] font-bold uppercase cursor-pointer"
            >
              <Plus size={10} /> Add
            </button>
          </div>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:border-[#f58220] outline-none cursor-pointer"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id} className="dark:bg-card">
                {w.name}{w.location ? ` (${w.location})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── No Recipe Warning Alert Card (When product has no recipe configured) ── */}
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
                <>No formulation recipe exists for <strong>{missingRecipeForProduct.name}</strong> in the system yet. Please configure a formulation recipe in Recipe Master or select an existing recipe from the dropdown above.</>
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

      {/* ── Main Formulation & Ingredients Layout ── */}
      {recipe ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">

          {/* Left Column: Yield Scaling Details & Instructions */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6 min-w-0">
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 min-w-0">
              <div className="flex items-center gap-2.5">
                <ChefHat className="text-[#f58220]" size={18} />
                <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{recipe.name}</h3>
              </div>
              <div className="space-y-2 text-xs font-semibold text-gray-600 dark:text-slate-300 divide-y divide-gray-100 dark:divide-white/5">
                <div className="flex justify-between pt-1">
                  <span className="text-gray-400 dark:text-slate-500">Base Yield:</span>
                  <span className="text-gray-800 dark:text-white font-mono">{recipe.yieldQty} {recipe.yieldUnit || ""}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-400 dark:text-slate-500">Scaled Output:</span>
                  <span className="text-[#f58220] font-mono font-bold">{targetYield} {targetUnit || recipe.yieldUnit || ""}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-400 dark:text-slate-500">Batch Multiplier:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{multiplier.toFixed(2)}×</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-2 min-w-0">
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Production Instructions
              </h4>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-300 whitespace-pre-line font-medium">
                {recipe.instructions || "Standard formulation instructions. Ensure QC parameters are recorded during production stages."}
              </p>
            </div>
          </div>

          {/* Right Column: Ingredients Needed Table */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl shadow-2xs overflow-hidden min-w-0">
              
              {/* Table Header */}
              <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.01]">
                <div>
                  <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Database size={15} className="text-[#f58220]" />
                    Raw Material Requirements ({recipe.recipeItems.length})
                  </h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">
                    Quantities needed for {targetYield || 0} {targetUnit || recipe.yieldUnit || ""}
                  </p>
                </div>
                {stockLoading && (
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 flex items-center gap-1.5 uppercase animate-pulse shrink-0">
                    <RefreshCw size={12} className="animate-spin text-[#f58220]" /> Checking Stock...
                  </span>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-200 dark:border-white/5">
                      <th className="py-3 px-5">Ingredient</th>
                      <th className="py-3 px-4 text-right">Required</th>
                      <th className="py-3 px-4 text-right">Stock Available</th>
                      <th className="py-3 px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-semibold text-gray-700 dark:text-slate-300">
                    {recipe.recipeItems.map((item) => {
                      const scaledQty = item.quantityRequired * multiplier;
                      const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
                      const sufficient = available + EPSILON >= scaledQty;
                      const deficit = Math.max(scaledQty - available, 0);

                      return (
                        <tr key={item.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-5 font-bold">
                            <div className="text-gray-900 dark:text-white">{item.inventoryItem?.name}</div>
                            <div className="text-[10px] font-mono text-gray-400 dark:text-slate-500 mt-0.5">{item.inventoryItem?.sku || "SKU-N/A"}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                            {scaledQty.toFixed(3)} <span className="text-[10px] uppercase text-[#f58220]">{item.unit}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-gray-600 dark:text-slate-400">
                            {available.toFixed(3)} <span className="text-[10px] uppercase">{item.unit}</span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            {sufficient ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                <CheckCircle2 size={11} />
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                                  <AlertCircle size={11} />
                                  Shortage
                                </span>
                                <span className="text-[10px] font-mono text-rose-500 dark:text-rose-400 font-bold">
                                  {deficit.toFixed(3)} {item.unit} Short
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

              {/* Mobile Cards View (< 640px) */}
              <div className="sm:hidden divide-y divide-gray-100 dark:divide-white/5">
                {recipe.recipeItems.map((item) => {
                  const scaledQty = item.quantityRequired * multiplier;
                  const available = getAvailableStock(item.inventoryItemId, item.inventoryItem?.sku, item.unit);
                  const sufficient = available + EPSILON >= scaledQty;
                  const deficit = Math.max(scaledQty - available, 0);

                  return (
                    <div key={item.id} className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-xs">{item.inventoryItem?.name}</p>
                          <p className="text-[10px] font-mono text-gray-400">{item.inventoryItem?.sku || "SKU-N/A"}</p>
                        </div>
                        {sufficient ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            Shortage
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-white/[0.02] p-2 rounded-xl">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400">Required</span>
                          <p className="font-mono font-bold text-gray-800 dark:text-white mt-0.5">
                            {scaledQty.toFixed(3)} {item.unit}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-400">In Stock</span>
                          <p className="font-mono text-gray-600 dark:text-slate-400 mt-0.5">
                            {available.toFixed(3)} {item.unit}
                          </p>
                        </div>
                      </div>

                      {!sufficient && (
                        <p className="text-[10px] font-mono font-bold text-rose-500 text-right">
                          Deficit: {deficit.toFixed(3)} {item.unit}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
      ) : !missingRecipeForProduct ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 text-center p-6">
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-[#f58220] mb-3">
            <ChefHat size={28} />
          </div>
          <p className="text-sm font-bold text-gray-800 dark:text-white">Select a Formula to Begin Scaling Calculations</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Choose a recipe above and enter a target batch yield to calculate ingredient needs.</p>
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
