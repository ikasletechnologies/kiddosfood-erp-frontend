"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Package, Search, RefreshCw, Send, Building2,
  Clock, Truck, CheckCircle2, AlertTriangle, ExternalLink,
  Layers, Filter, Eye, LayoutGrid, List, ArrowRight, ShieldCheck,
  Upload, Download, Edit2, UploadCloud, Loader2, Maximize2, X
} from "lucide-react";
import { clsx } from "clsx";
import api, {
  productsFullApi, franchiseProductRequestsApi,
  franchiseOrdersApi, franchiseApi, rawMaterialsApi, InventoryDemandItem
} from "@/lib/api";
import { toast } from "react-hot-toast";
import InventoryMetricCard from "./InventoryMetricCard";
import ProductDemandDrawer from "./ProductDemandDrawer";
import BranchStockDrawer from "./BranchStockDrawer";
import MinimizedImportWidget from "./MinimizedImportWidget";
import { Modal } from "@/components/ui/Modal";
import { generateSKU } from "@/lib/utils/erp";

// HQ is now the explicit Franchise.isHQ field, not an id/name guess — a
// franchise named anything (e.g. "Default") is HQ iff isHQ is true.
// A null/undefined franchiseId is the backend's own convention for an
// HQ-scoped item (see InventoryService.createItem: "no franchiseId given
// at all — historically treated as an HQ-scoped item"), so it must count
// as HQ here too — otherwise HQ-scoped stock falls into the "branch" bucket
// and shows up as Branch Holdings instead of HQ Available.
const isHqFranchise = (franchiseId: string | undefined | null, franchises: any[]) =>
  !franchiseId || !!franchises.find((f) => f.id === franchiseId)?.isHQ;

// Product (the recipe/catalog master) and InventoryItem (the actual stock
// ledger, credited by packaging/production) aren't linked by a foreign key.
// Matching is intentionally exact (not a SKU/name prefix match): a packaged
// retail variant's SKU is derived from the master's SKU with a pack-size
// suffix appended, so a prefix match would fold a differently-unit'd
// variant's stock (e.g. 10 packets) into the master's own total (e.g. KG),
// producing a number that looks plausible but mixes two units together.
// Net effect: a packaged variant that has no Product catalog row of its own
// (the normal case today) won't appear on this screen at all — that's a
// real gap, not silently patched over here.
function matchesProduct(item: { sku?: string; name?: string }, prod: { sku?: string; name?: string }): boolean {
  const itemSku = item.sku?.toUpperCase() || "";
  const itemName = item.name?.toUpperCase() || "";
  const prodSku = prod.sku?.toUpperCase() || "";
  const prodName = prod.name?.toUpperCase() || "";
  // Once a product has a SKU, match by SKU only — falling back to name
  // would bleed two same-named weight variants (e.g. 500G/250G, distinct
  // SKUs) onto whichever InventoryItem happens to share the name, which is
  // exactly what silently broke the Edit link for bulk-imported variants.
  // Name-only matching stays for the legacy case of a product with no SKU.
  if (prodSku) return itemSku === prodSku;
  if (prodName) return itemName === prodName;
  return false;
}

// Splits one SKU's InventoryItem rows (one per franchise) into HQ vs branch
// holdings. Shared by both Product-backed rows and the InventoryItem-only
// rows below, so a packaged retail variant with no Product catalog entry
// gets the exact same HQ/branch/unit accounting as one that does.
function summarizeStock(matchedItems: any[], franchises: any[]) {
  const hqItems = matchedItems.filter((it) => isHqFranchise(it.franchiseId, franchises));
  const branchItems = matchedItems.filter((it) => !isHqFranchise(it.franchiseId, franchises));
  const hqAvailable = hqItems.reduce((acc: number, it: any) => acc + Number(it.currentStock || 0), 0);
  const totalBranchAvailable = branchItems.reduce((acc: number, it: any) => acc + Number(it.currentStock || 0), 0);

  const branchMap = new Map<string, { franchiseId: string; franchiseName: string; availableQuantity: number; damagedQuantity: number }>();
  branchItems.forEach((it: any) => {
    const fid = it.franchiseId || "UNASSIGNED";
    const fName = franchises.find((f: any) => f.id === fid)?.name || it.franchise?.name || "Unassigned Branch";
    const existing = branchMap.get(fid) || { franchiseId: fid, franchiseName: fName, availableQuantity: 0, damagedQuantity: 0 };
    existing.availableQuantity += Number(it.currentStock || 0);
    branchMap.set(fid, existing);
  });

  return {
    hqAvailable,
    totalBranchAvailable,
    branchStockBreakdown: Array.from(branchMap.values()),
    hqItemId: hqItems[0]?.id as string | undefined,
    hqMinimumStock: hqItems[0]?.minimumStock as number | undefined,
  };
}

export default function FinishedGoodsStockClient() {
  const router = useRouter();
  // Finished Goods edit through the Inventory Item Master editor
  // (/inventory/stock/edit -> EditItemForm -> rawMaterialsApi.update), the
  // same full item-master screen Raw Materials uses — not the standalone
  // Product catalog form. hqInventoryItemId is only unset when
  // matchesProduct() (see above) can't find this product's own
  // correctly-scoped InventoryItem yet.
  //
  // That's the normal, expected state for a just-bulk-imported Finished
  // Good: bulk import only creates the Product catalog row (name/SKU/unit/
  // category/tax) — it deliberately never creates stock (see the import
  // comment above), so there's no InventoryItem to open yet. Previously
  // this just refused to edit anything ("no HQ inventory record"), which
  // meant a bulk-imported row could never be corrected before its first
  // production run. Fall back to the Product catalog editor in that case —
  // the one place SKU/name/unit/tax actually live pre-stock. The `inv:`
  // prefix marks a synthetic row with no real Product (see
  // inventoryOnlyItems below); that case has no catalog entry to edit
  // either, so it keeps the original error.
  // A row is editable if it's backed by a Product catalog entry (bulk
  // import always creates one) OR already has an HQ InventoryItem. Only a
  // synthetic `inv:`-prefixed row (an InventoryItem with no Product behind
  // it — see inventoryOnlyItems below) has neither and stays uneditable.
  const isEditable = (item: InventoryDemandItem) =>
    !!item.hqInventoryItemId || (!!item.productId && !item.productId.startsWith("inv:"));

  // Product exists (real catalog row) + InventoryItem exists -> sellable in
  // POS (POS reads Product, and checkout requires a real productId).
  // InventoryItem exists but no Product row -> "inv:"-prefixed synthetic id
  // (see inventoryOnlyItems below) -> real stock, but nothing for POS to
  // sell. Same signal isEditable already relies on, named for what it means
  // here rather than re-deriving the classification a second way.
  const isUncatalogued = (item: InventoryDemandItem) => item.productId.startsWith("inv:");

  const [creatingItemId, setCreatingItemId] = useState<string | null>(null);

  // Finished Goods edit through the same Item Master screen
  // (/inventory/stock/edit -> EditItemForm -> rawMaterialsApi.update) Raw
  // Materials already uses — a separate Product-catalog form here would be
  // an inconsistent second editor for the same kind of record. A
  // bulk-imported product has no InventoryItem yet (bulk import only
  // creates the catalog row — see the import comment above), so the first
  // Edit click creates one (0 stock, HQ-scoped, same SKU/name/unit) via the
  // exact endpoint Raw Material creation already uses, then opens it in
  // the real editor — instead of either failing or bouncing to a
  // differently-designed screen.
  const openEditPage = async (item: InventoryDemandItem) => {
    if (item.hqInventoryItemId) {
      router.push(`/inventory/stock/edit?id=${item.hqInventoryItemId}`);
      return;
    }
    if (!item.productId || item.productId.startsWith("inv:")) {
      toast.error("This product has no HQ inventory record yet to edit.");
      return;
    }
    setCreatingItemId(item.productId);
    try {
      const res = await rawMaterialsApi.create({
        name: item.productName,
        sku: item.sku,
        unit: item.unit,
        category: "FINISHED_GOOD",
        initialStock: 0,
      });
      router.push(`/inventory/stock/edit?id=${res.data.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to create the inventory record for this product.");
    } finally {
      setCreatingItemId(null);
    }
  };

  // Reuses the existing Add Product screen/API (productsFullApi.create via
  // AddProductClient) rather than a second creation flow — the sku/name/
  // unit query params tell that screen to lock the SKU to this exact
  // InventoryItem's SKU instead of auto-generating a new one. A locked,
  // matching SKU is what makes ProductService.create's sync (SKU-first
  // match) attach to this existing InventoryItem instead of creating a
  // duplicate — see AddProductClient's lockedSku handling.
  const goToCreateProduct = (item: InventoryDemandItem) => {
    const params = new URLSearchParams({ sku: item.sku, name: item.productName, unit: item.unit });
    router.push(`/products/add?${params.toString()}`);
  };

  const [linkItem, setLinkItem] = useState<InventoryDemandItem | null>(null);
  const [productListForLink, setProductListForLink] = useState<any[]>([]);
  const [selectedLinkProductId, setSelectedLinkProductId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const openLinkModal = async (item: InventoryDemandItem) => {
    setLinkItem(item);
    setSelectedLinkProductId("");
    try {
      const res = await productsFullApi.getAll();
      const list = Array.isArray(res?.data) ? res.data : [];
      setProductListForLink(list);
    } catch (e) {
      toast.error("Failed to load catalog products");
    }
  };

  const handleConfirmLink = async () => {
    if (!linkItem || !selectedLinkProductId) {
      toast.error("Please select a Product to link");
      return;
    }
    const prod = productListForLink.find(p => p.id === selectedLinkProductId);
    if (prod && prod.sku && linkItem.sku && prod.sku.toUpperCase() !== linkItem.sku.toUpperCase()) {
      toast.error(`Cannot link these products because their SKUs are different.\nInventory SKU: ${linkItem.sku}\nProduct SKU: ${prod.sku}\nCreate a Product using the existing inventory SKU (${linkItem.sku}) instead, or select a Product with the same SKU.`, { duration: 6000 });
      return;
    }
    const hqItemId = linkItem.hqInventoryItemId;
    if (!hqItemId) {
      toast.error("HQ inventory record not found for this item");
      return;
    }
    setLinking(true);
    try {
      await api.post("/api/products/link", {
        inventoryItemId: hqItemId,
        productId: selectedLinkProductId,
      });
      toast.success("Successfully linked Product to Inventory Item!");
      setLinkItem(null);
      fetchDemandData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to link product");
    } finally {
      setLinking(false);
    }
  };

  const [demandItems, setDemandItems] = useState<InventoryDemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [demandFilter, setDemandFilter] = useState<
    "ALL" | "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK" | "RESERVED" | "IN_TRANSIT" | "PENDING_DEMAND"
  >("ALL");
  const [catalogFilter, setCatalogFilter] = useState<"ALL" | "SELLABLE">("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("TABLE");

  // Drawer States
  const [selectedDemandProduct, setSelectedDemandProduct] = useState<InventoryDemandItem | null>(null);
  const [selectedBranchProduct, setSelectedBranchProduct] = useState<InventoryDemandItem | null>(null);

  // Excel Bulk Import — goes through the Product catalog (POST
  // /api/products/bulk-import -> ProductService.bulkCreateFinishedGoods),
  // not the Inventory Item Master. That's what natively supports two rows
  // with the same product Name but different Size/Unit as distinct SKUs
  // (FG-IDLI-150G vs FG-IDLI-250G), and it never creates STOCK — this only
  // builds the Finished Good master/catalog (currentStock stays 0; actual
  // stock still only enters via production -> QC -> packaging, or PO ->
  // GRN). Selling Price is a separate concept from stock and IS captured
  // here — it sets Product.basePrice, the only thing POS reads for price;
  // omitting it imports the product at ₹0 (sellable, priced later via the
  // Inventory Item Master editor).
  const importFileRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImportMinimized, setIsImportMinimized] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ category: string; name: string; size: string; unit: string; gstPercent: string; sellingPrice: string; error?: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number }>({ current: 0, total: 0, percent: 0 });
  const [importResult, setImportResult] = useState<{ success: number; duplicates: number; invalid: number } | null>(null);
  const [importDuplicates, setImportDuplicates] = useState<Array<{ name: string; sku: string; reason: string }>>([]);
  const [importInvalid, setImportInvalid] = useState<Array<{ name: string; reason: string }>>([]);

  const IMPORT_TEMPLATE_HEADERS = ["Category", "Name", "Size", "Unit", "GST %", "Selling Price"];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      IMPORT_TEMPLATE_HEADERS,
      ["SPICE BLENDS", "IDLI PODI", "150", "G", "5", "80"],
      ["SPICE BLENDS", "IDLI PODI", "250", "G", "5", "130"],
      ["COLD PRESSED OILS", "GROUNDNUT OIL", "500", "ML", "5", "180"],
      ["COLD PRESSED OILS", "GROUNDNUT OIL", "1", "L", "5", "340"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finished Goods");
    XLSX.writeFile(wb, "finished_goods_import_template.xlsx");
  };

  const pickField = (row: Record<string, any>, ...keys: string[]) => {
    for (const key of Object.keys(row)) {
      if (keys.some(k => k.toLowerCase() === key.trim().toLowerCase())) {
        const val = row[key];
        return val === undefined || val === null ? "" : String(val).trim();
      }
    }
    return "";
  };

  // Mirrors ProductService.bulkCreateFinishedGoods on the backend, which
  // generates the authoritative SKU with the same generateSKU() — this is
  // only for the live preview so what's shown here matches what gets created.
  const previewSku = (name: string, size: string, unit: string) =>
    generateSKU("FINISHED_GOOD", name, size ? `${size}${unit}` : undefined);

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (rows.length === 0) {
        toast.error("No rows found in the file");
        return;
      }

      const parsed = rows.map(row => {
        const name = pickField(row, "name", "item name", "product name");
        const rowData = {
          name,
          category: pickField(row, "category"),
          size: pickField(row, "size", "weight", "quantity"),
          unit: pickField(row, "unit").toUpperCase(),
          gstPercent: pickField(row, "gst %", "gst", "gst percent", "tax"),
          sellingPrice: pickField(row, "selling price", "price", "mrp", "rate"),
        };
        let error: string | undefined;
        if (!rowData.name) error = "Missing name";
        return { ...rowData, error };
      });

      setImportRows(parsed);
      setImportResult(null);
      setImportDuplicates([]);
      setImportInvalid([]);
      setShowImportModal(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not read that file — expected .xlsx or .csv");
    }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => !r.error);
    if (validRows.length === 0) return;

    setImporting(true);
    const total = validRows.length;
    setImportProgress({ current: 0, total, percent: 0 });

    const BATCH_SIZE = 15;
    let totalSuccess = 0;
    let allDuplicates: Array<{ name: string; sku: string; reason: string }> = [];
    let allInvalid: Array<{ name: string; reason: string }> = [];

    try {
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        const res = await productsFullApi.bulkImport(
          batch.map(row => ({
            category: row.category || undefined,
            name: row.name,
            size: row.size || undefined,
            unit: row.unit || undefined,
            gstPercent: row.gstPercent ? Number(row.gstPercent) : undefined,
            sellingPrice: row.sellingPrice ? Number(row.sellingPrice) : undefined,
          }))
        );
        const data = res.data as { success: number; duplicates: Array<{ name: string; sku: string; reason: string }>; invalid: Array<{ name: string; reason: string }> };
        totalSuccess += data.success;
        allDuplicates = [...allDuplicates, ...(data.duplicates || [])];
        allInvalid = [...allInvalid, ...(data.invalid || [])];

        const current = Math.min(i + batch.length, total);
        const percent = Math.round((current / total) * 100);
        setImportProgress({ current, total, percent });
      }

      setImportResult({ success: totalSuccess, duplicates: allDuplicates.length, invalid: allInvalid.length });
      setImportDuplicates(allDuplicates);
      setImportInvalid(allInvalid);
      fetchDemandData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Bulk import failed");
    } finally {
      setImporting(false);
    }
  };

  const fetchDemandData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, fprRes, foRes, frRes, iRes] = await Promise.all([
        // stockSource: 'GLOBAL' — Stock Hub needs the full finished-goods
        // catalog regardless of which franchise (if any) stocks each product;
        // without it, a Super Admin's default /api/products call is narrowed
        // to one franchise's inventory and silently drops branch-only items.
        // The backend only honors this for SUPER_ADMIN (checked server-side);
        // per-franchise stock numbers still come entirely from the
        // rawMaterialsApi call below, not from this catalog fetch.
        productsFullApi.getAll({ stockSource: "GLOBAL" }).catch(() => ({ data: [] })),
        franchiseProductRequestsApi.getAll().catch(() => ({ data: [] })),
        franchiseOrdersApi.getAll().catch(() => ({ data: [] })),
        franchiseApi.getAll().catch(() => ({ data: [] })),
        // Real stock ledger (credited by packaging/production) — Product is
        // a catalog/recipe record and does NOT reflect live stock; see
        // matchesProduct() for how these link up.
        rawMaterialsApi.getAll(false, undefined, undefined).catch(() => ({ data: [] })),
      ]);

      const rawProducts: any[] = Array.isArray(pRes?.data) ? pRes.data : [];
      const fprs: any[] = Array.isArray(fprRes?.data) ? fprRes.data : [];
      const fos: any[] = Array.isArray(foRes?.data) ? foRes.data : [];
      const franchises: any[] = Array.isArray(frRes?.data) ? frRes.data : frRes?.data?.franchises || [];
      const allInventoryItems: any[] = Array.isArray(iRes?.data) ? iRes.data : [];
      const inventoryItems = allInventoryItems.filter((it) => it.category === "FINISHED_GOOD");

      // Filter for finished goods
      const finishedProducts = rawProducts.filter(
        (p) => p.category === "FINISHED_GOOD" || p.category === "FINISHED_PRODUCT" || p.category === "FINISHED" || !p.category?.startsWith("RAW_")
      );

      // Build unified demand items matching strictly on Product Master ID
      const items: InventoryDemandItem[] = finishedProducts.map((prod) => {
        const pid = prod.id;

        // 1. Real stock — every InventoryItem row (one per franchise) that
        // matches this product, split into HQ vs branch holdings. This
        // replaces the old logic that summed ProductBatch.quantity (total
        // ever *produced*, not netted against what's since been packaged
        // or shipped) and mislabeled HQ's own production batches as
        // "Branch Holdings" even when nothing was ever transferred out.
        const matchedItems = inventoryItems.filter((it) => matchesProduct(it, prod));
        const { hqAvailable, totalBranchAvailable, branchStockBreakdown, hqItemId, hqMinimumStock } = summarizeStock(matchedItems, franchises);

        // InventoryItem doesn't carry a per-row damaged/expired flag the way
        // ProductBatch did — damaged/expired retail stock would need a
        // per-batch lookup (Expiry Tracking), out of scope for this fix.
        const totalBranchDamaged = 0;

        // 2. Product Requests (FPR)
        const prodFprs = fprs.filter((r: any) => {
          const prods = r.products ?? (r.details as any)?.products ?? [];
          return prods.some((p: any) => p.productId === pid || p.productName?.toLowerCase() === prod.name?.toLowerCase());
        });

        // 3. Supply Orders (FO)
        const prodFos = fos.filter((o: any) => {
          const itemsList = o.items ?? [];
          return itemsList.some((it: any) => it.productId === pid || it.product?.name?.toLowerCase() === prod.name?.toLowerCase());
        });

        // Calculate Demand Buckets without double-counting (using sourceRequestId link)
        let pendingDemandQty = 0;
        let pendingReqCount = 0;
        let approvedDemandQty = 0;
        let approvedOrderCount = 0;
        let reservedStockQty = 0;
        let inTransitStockQty = 0;

        const demandRecords: InventoryDemandItem["demandRecords"] = [];

        // FPR records
        prodFprs.forEach((fpr: any) => {
          const prods = fpr.products ?? (fpr.details as any)?.products ?? [];
          const match = prods.find((p: any) => p.productId === pid || p.productName?.toLowerCase() === prod.name?.toLowerCase());
          if (!match) return;

          const reqQty = Number(match.requestedQuantity || 0);
          const appQty = match.approvedQuantity !== undefined ? Number(match.approvedQuantity) : undefined;
          const reqNum = fpr.requestNumber || `FPR-${String(fpr.id).slice(0, 4).toUpperCase()}`;
          const fName = fpr.franchise?.name || franchises.find((f: any) => f.id === fpr.franchiseId)?.name || "Branch";

          if (fpr.status === "PENDING") {
            pendingDemandQty += reqQty;
            pendingReqCount += 1;
            demandRecords.push({
              recordType: "PRODUCT_REQUEST",
              id: fpr.id,
              referenceNumber: reqNum,
              franchiseId: fpr.franchiseId || "",
              franchiseName: fName,
              quantity: reqQty,
              approvedQuantity: appQty,
              requiredBy: fpr.requiredByDate || fpr.requiredBy || undefined,
              status: fpr.status,
              createdAt: fpr.createdAt || new Date().toISOString(),
            });
          }
        });

        // FO records (Execution / Supply orders)
        prodFos.forEach((fo: any) => {
          const itemsList = fo.items ?? [];
          const match = itemsList.find((it: any) => it.productId === pid || it.product?.name?.toLowerCase() === prod.name?.toLowerCase());
          if (!match) return;

          const qty = Number(match.quantity || 0);
          const foNum = fo.orderNumber || `FO-${String(fo.id).slice(0, 4).toUpperCase()}`;
          const fName = fo.franchise?.name || franchises.find((f: any) => f.id === fo.franchiseId)?.name || "Branch";

          // If independent FO (without sourceRequestId) and PENDING, add to pending demand
          if (fo.status === "PENDING" && !fo.sourceRequestId) {
            pendingDemandQty += qty;
            pendingReqCount += 1;
          } else if (fo.status === "APPROVED") {
            approvedDemandQty += qty;
            approvedOrderCount += 1;
          } else if (fo.status === "PROCESSING" || fo.status === "IN_PRODUCTION") {
            reservedStockQty += qty;
          } else if (fo.status === "DISPATCHED") {
            inTransitStockQty += qty;
          }

          if (["PENDING", "APPROVED", "PROCESSING", "IN_PRODUCTION", "DISPATCHED", "DELIVERY_ISSUE"].includes(fo.status)) {
            demandRecords.push({
              recordType: "SUPPLY_ORDER",
              id: fo.id,
              referenceNumber: foNum,
              franchiseId: fo.franchiseId || "",
              franchiseName: fName,
              quantity: qty,
              requiredBy: fo.expectedDispatchDate || fo.requiredBy || undefined,
              status: fo.status,
              createdAt: fo.createdAt || new Date().toISOString(),
            });
          }
        });

        // HQ available balance — Product has no currentStock field at all
        // (it's a catalog/recipe record, not a stock record), so this used
        // to always evaluate to 0 regardless of real stock.
        return {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku || "",
          unit: matchedItems[0]?.unit || "KG",
          hqInventoryItemId: hqItemId,
          hqAvailableStock: hqAvailable,
          hqMinimumStock,
          hqReservedStock: reservedStockQty,
          inTransitStock: inTransitStockQty,
          totalFranchiseAvailableStock: totalBranchAvailable,
          totalFranchiseDamagedStock: totalBranchDamaged,
          pendingDemandQuantity: pendingDemandQty,
          pendingRequestCount: pendingReqCount,
          approvedDemandQuantity: approvedDemandQty,
          approvedOrderCount: approvedOrderCount,
          branchStockBreakdown: branchStockBreakdown,
          demandRecords: demandRecords,
        };
      });

      // InventoryItem-only rows: packaged/retail SKUs that have real stock
      // but no matching Product catalog entry (see matchesProduct — this is
      // the normal case for a packaging-created variant). Grouped by exact
      // SKU so KG and PCS never mix, and never merged into any Product row.
      const claimedItemIds = new Set(
        inventoryItems.filter((it) => finishedProducts.some((p) => matchesProduct(it, p))).map((it) => it.id)
      );
      const unclaimedItems = inventoryItems.filter((it) => it.sku && !claimedItemIds.has(it.id));
      const bySku = new Map<string, any[]>();
      unclaimedItems.forEach((it) => {
        const sku = it.sku as string;
        bySku.set(sku, [...(bySku.get(sku) || []), it]);
      });
      const inventoryOnlyItems: InventoryDemandItem[] = Array.from(bySku.entries()).map(([sku, group]) => {
        const { hqAvailable, totalBranchAvailable, branchStockBreakdown, hqItemId } = summarizeStock(group, franchises);
        return {
          productId: `inv:${sku}`,
          productName: group[0].name,
          sku,
          unit: group[0].unit || "KG",
          hqInventoryItemId: hqItemId,
          hqAvailableStock: hqAvailable,
          hqReservedStock: 0,
          inTransitStock: 0,
          totalFranchiseAvailableStock: totalBranchAvailable,
          totalFranchiseDamagedStock: 0,
          pendingDemandQuantity: 0,
          pendingRequestCount: 0,
          approvedDemandQuantity: 0,
          approvedOrderCount: 0,
          branchStockBreakdown,
          demandRecords: [],
        };
      });

      setDemandItems([...items, ...inventoryOnlyItems]);
    } catch (e) {
      console.error("Failed to load finished goods demand data:", e);
      toast.error("Failed to sync finished goods demand");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemandData();
  }, [fetchDemandData]);

  // Real-time refresh listeners for instant updates
  useEffect(() => {
    const handleRefresh = () => fetchDemandData();
    window.addEventListener("erp:refresh-product-requests", handleRefresh);
    window.addEventListener("erp:refresh-franchise-orders", handleRefresh);
    window.addEventListener("erp:refresh-inventory", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener("erp:refresh-product-requests", handleRefresh);
      window.removeEventListener("erp:refresh-franchise-orders", handleRefresh);
      window.removeEventListener("erp:refresh-inventory", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [fetchDemandData]);

  // Filters
  const filtered = demandItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      item.productName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q);

    let matchDemand = true;
    if (demandFilter === "IN_STOCK") {
      matchDemand = item.hqAvailableStock > 0;
    } else if (demandFilter === "OUT_OF_STOCK") {
      matchDemand = item.hqAvailableStock <= 0;
    } else if (demandFilter === "LOW_STOCK") {
      // Unknown threshold (no HQ item matched yet) is treated as "not low" —
      // there's nothing to compare against, so it shouldn't false-alarm.
      matchDemand = item.hqMinimumStock !== undefined && item.hqAvailableStock > 0 && item.hqAvailableStock <= item.hqMinimumStock;
    } else if (demandFilter === "RESERVED") {
      matchDemand = item.hqReservedStock > 0;
    } else if (demandFilter === "IN_TRANSIT") {
      matchDemand = item.inTransitStock > 0;
    } else if (demandFilter === "PENDING_DEMAND") {
      matchDemand = item.pendingDemandQuantity > 0;
    }

    const matchCatalog = catalogFilter === "SELLABLE" ? !isUncatalogued(item) : true;

    return matchSearch && matchDemand && matchCatalog;
  });

  // Aggregated Stats for Strip — different finished goods are tracked in
  // different units (KG, PACKET, ...), so a plain sum across all products
  // (e.g. "97 KG" + "10 PACKET" = a meaningless "107") is wrong, and even
  // joining them into one string ("97 KG + 10 PACKET") reads as a single
  // combined value. Each total is kept as a per-unit breakdown and rendered
  // as separate stacked lines instead.
  const sumByUnit = (getQty: (item: InventoryDemandItem) => number): Map<string, number> => {
    const map = new Map<string, number>();
    demandItems.forEach((item) => {
      const qty = getQty(item);
      if (!qty) return;
      const unit = (item.unit || "UNIT").toUpperCase();
      map.set(unit, (map.get(unit) || 0) + qty);
    });
    return map;
  };
  const renderByUnit = (map: Map<string, number>): React.ReactNode => {
    if (map.size === 0) return "0";
    const stacked = map.size > 1;
    return (
      <div className="space-y-0.5">
        {Array.from(map.entries()).map(([unit, qty]) => (
          <div key={unit} className={stacked ? "text-lg leading-tight" : undefined}>
            {qty.toLocaleString()}{" "}
            <span className="text-xs font-semibold opacity-70">{unit}</span>
          </div>
        ))}
      </div>
    );
  };

  const hqAvailableByUnit = sumByUnit((i) => i.hqAvailableStock);
  const pendingByUnit = sumByUnit((i) => i.pendingDemandQuantity);
  const readySkuCount = demandItems.filter((i) => i.hqAvailableStock > 0).length;

  // There are no branches yet — Stock Hub stays HQ-focused until a real
  // branch/stock-transfer scenario actually produces branch stock. Keyed off
  // real data (not a franchise count or a manual flag) so this self-reveals
  // the moment a transfer lands, with no further code change needed.
  const hasAnyBranchHoldings = demandItems.some((i) => i.totalFranchiseAvailableStock > 0);
  const stats = {
    totalProducts: demandItems.length,
    hqAvailableNode: renderByUnit(hqAvailableByUnit),
    reservedNode: renderByUnit(sumByUnit((i) => i.hqReservedStock)),
    inTransitNode: renderByUnit(sumByUnit((i) => i.inTransitStock)),
    pendingNode: renderByUnit(pendingByUnit),
    approvedNode: renderByUnit(sumByUnit((i) => i.approvedDemandQuantity)),
    hasPendingDemand: pendingByUnit.size > 0,
    readySkuCount,
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 w-full min-w-0">
      {/* Top Metric Cards Strip */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 w-full min-w-0">
        <InventoryMetricCard
          label="Total Finished Goods"
          value={`${stats.totalProducts} SKU${stats.totalProducts === 1 ? "" : "s"}`}
          subtext="Catalog + packaged variants"
          icon={Package}
          colorTheme="slate"
        />
        <InventoryMetricCard
          label="HQ Available Stock"
          value={stats.hqAvailableNode}
          subtext={`${stats.readySkuCount} SKU${stats.readySkuCount === 1 ? "" : "s"} ready`}
          icon={Layers}
          colorTheme="emerald"
        />
        <InventoryMetricCard
          label="HQ Reserved Stock"
          value={stats.reservedNode}
          subtext="Locked for processing"
          icon={Clock}
          colorTheme="purple"
        />
        <InventoryMetricCard
          label="In-Transit Stock"
          value={stats.inTransitNode}
          subtext="On road to branches"
          icon={Truck}
          colorTheme="indigo"
        />
        <InventoryMetricCard
          label="Pending Demand"
          value={stats.pendingNode}
          subtext="Awaiting HQ approval"
          icon={Send}
          colorTheme="amber"
          badge={stats.hasPendingDemand ? "Active Demand" : undefined}
        />
        <InventoryMetricCard
          label="Approved Orders"
          value={stats.approvedNode}
          subtext="Ready for processing"
          icon={CheckCircle2}
          colorTheme="blue"
        />
      </div>

      {/* ── Toolbar: Search, Filters & View Toggle ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-[#0A0D14] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full min-w-0">
        {/* Search */}
        <div className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full lg:w-80 shadow-sm">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Product Name or SKU..."
            className="bg-transparent text-xs font-medium text-slate-700 dark:text-zinc-300 outline-none w-full placeholder:text-slate-400"
          />
            {searchTerm && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchTerm("")} 
              />
            )}
        </div>

        {/* Demand Filter Buttons & View Switcher */}
        <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end w-full lg:w-auto min-w-0">
          <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            {[
              { id: "ALL", label: "All" },
              { id: "SELLABLE", label: "Sellable" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCatalogFilter(f.id as any)}
                className={clsx(
                  "px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap",
                  catalogFilter === f.id
                    ? "bg-white dark:bg-card text-orange-500 shadow-sm font-black"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar max-w-full">
            {[
              { id: "ALL", label: "All Finished Goods" },
              { id: "IN_STOCK", label: "In Stock" },
              { id: "OUT_OF_STOCK", label: "Out of Stock" },
              { id: "LOW_STOCK", label: "Low Stock" },
              { id: "RESERVED", label: "Reserved" },
              { id: "IN_TRANSIT", label: "In Transit" },
              { id: "PENDING_DEMAND", label: "Pending Demand" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDemandFilter(f.id as any)}
                className={clsx(
                  "px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap shrink-0",
                  demandFilter === f.id
                    ? "bg-white dark:bg-card text-orange-500 shadow-sm"
                    : "text-slate-450 hover:text-slate-805 dark:hover:text-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode("GRID")}
                className={clsx(
                  "p-2 rounded-md text-slate-400 transition-all",
                  viewMode === "GRID" ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "hover:text-slate-650"
                )}
                title="Grid Cards View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("TABLE")}
                className={clsx(
                  "p-2 rounded-md text-slate-400 transition-all",
                  viewMode === "TABLE" ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "hover:text-slate-650"
                )}
                title="Dense Ledger Table View"
              >
                <List size={16} />
              </button>
            </div>

            {/* Bulk Import */}
            <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFileSelect} />
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-orange-500 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload size={14} className="shrink-0" />
              <span className="hidden sm:inline">Bulk Import (Excel)</span>
              <span className="sm:hidden">Import</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchDemandData}
              className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-gray-400 hover:text-orange-500 transition-colors shrink-0"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={clsx(loading && "animate-spin text-orange-500")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── View 1: Super Admin Finished Goods Product Cards (Exact User Requirement) ── */}
      {viewMode === "GRID" && (
        <div>
          {loading ? (
            <div className="py-24 text-center text-slate-400 font-bold text-xs animate-pulse">
              Syncing Finished Goods Demand & Inventory Hub...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-8 space-y-3">
              <Package size={48} strokeWidth={1} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching finished goods found</p>
              <p className="text-xs text-slate-400">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item) => {
                const hasPending = item.pendingDemandQuantity > 0;
                const firstPendingRecord = item.demandRecords.find((r) => r.status === "PENDING");
                return (
                  <div
                    key={item.productId}
                    className="bg-white dark:bg-[#0A0D14] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className={clsx(
                          "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0",
                          isUncatalogued(item) ? "bg-amber-500/10 text-amber-500" : "bg-orange-500/10 text-orange-500"
                        )}>
                          <Package size={28} />
                        </div>
                        {isUncatalogued(item) ? (
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 tracking-wider">
                            Needs Catalog Setup
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 tracking-wider">
                            AUTOMATED SYNC
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-905 dark:text-white leading-tight">
                          {item.productName}
                        </h3>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-wider">
                          SKU: {item.sku || "N/A"} · UNIT: <strong>{item.unit}</strong>
                        </p>
                      </div>
                      <div className="mt-5 space-y-2.5">
                        {hasAnyBranchHoldings && (
                          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-white/[0.03]">
                            <span className="text-slate-400 font-bold">Current Branch Stock:</span>
                            <span className="font-black text-slate-900 dark:text-white">
                              {item.totalFranchiseAvailableStock} {item.unit}
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                          <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-[9px] font-semibold text-slate-500 uppercase">HQ Available</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
                              {item.hqAvailableStock}
                            </p>
                          </div>
                          <div className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900/30">
                            <p className="text-[9px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Reserved</p>
                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                              {item.hqReservedStock}
                            </p>
                          </div>
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                            <p className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">In-Transit</p>
                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {item.inTransitStock}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Send size={13} className="text-amber-500" /> Pending Franchise Demand:
                          </span>
                          <span className={clsx("text-xs font-black px-2.5 py-0.5 rounded-lg", hasPending ? "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40" : "text-slate-400")}>
                            {item.pendingDemandQuantity} {item.unit}
                          </span>
                        </div>
                        {firstPendingRecord ? (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-white">
                              <span>{firstPendingRecord.referenceNumber}</span>
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">
                                {firstPendingRecord.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{firstPendingRecord.franchiseName}</span>
                              <span>{firstPendingRecord.quantity} {item.unit}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No pending requests awaiting review.</p>
                        )}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedDemandProduct(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Send size={14} /> Review Request ({item.demandRecords.length})
                        </button>
                        {hasAnyBranchHoldings && (
                          <button
                            onClick={() => setSelectedBranchProduct(item)}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                            title="View Multi-Branch Stock Holdings"
                          >
                            <Building2 size={15} />
                          </button>
                        )}
                        {isUncatalogued(item) ? (
                          <>
                            <button
                              onClick={() => openLinkModal(item)}
                              className="px-2.5 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                              title="Link this inventory item to an existing Product catalog entry with matching SKU"
                            >
                              Link Existing
                            </button>
                            <button
                              onClick={() => goToCreateProduct(item)}
                              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors"
                              title="Add this inventory item to the Product catalog so it becomes sellable in POS"
                            >
                              Create Product
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openEditPage(item)}
                            disabled={!isEditable(item) || creatingItemId === item.productId}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {creatingItemId === item.productId ? <RefreshCw size={15} className="animate-spin" /> : <Edit2 size={15} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View 2: Dense Ledger Table View ── */}
      {viewMode === "TABLE" && (
        <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full min-w-0">
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-left table-auto min-w-[760px]">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Finished Product Specification</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">HQ Available</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">HQ Reserved</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">In-Transit</th>
                  {hasAnyBranchHoldings && <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">Branch Holdings</th>}
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-right">Franchise Demand</th>
                  <th className="w-[70px] px-4 sm:px-6 py-3.5 sm:py-4 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filtered.map((item) => (
                  <tr key={item.productId} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                          isUncatalogued(item) ? "bg-amber-500/10 text-amber-500" : "bg-orange-500/10 text-orange-500"
                        )}>
                          <Package size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-white uppercase truncate">
                              {item.productName}
                            </p>
                            {isUncatalogued(item) && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                                Needs Catalog Setup
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            SKU: {item.sku || "N/A"} · Unit: {item.unit}
                          </p>
                          {isUncatalogued(item) && (
                            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                              Not available in POS — no Product catalog entry
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-slate-800 dark:text-white">
                      {item.hqAvailableStock} <span className="text-[10px] text-slate-450 font-normal">{item.unit}</span>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-purple-650 dark:text-purple-400">
                      {item.hqReservedStock} <span className="text-[10px] font-normal">{item.unit}</span>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-indigo-650 dark:text-indigo-400">
                      {item.inTransitStock} <span className="text-[10px] font-normal">{item.unit}</span>
                    </td>

                    {hasAnyBranchHoldings && (
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedBranchProduct(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-55 dark:bg-white/5 hover:bg-slate-100 rounded-lg text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                        >
                          <Building2 size={13} className="text-slate-400" />
                          {item.totalFranchiseAvailableStock} {item.unit}
                        </button>
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      {item.pendingDemandQuantity > 0 ? (
                        <button
                          onClick={() => setSelectedDemandProduct(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-600 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs font-semibold transition-all shadow-sm"
                        >
                          <Send size={13} /> {item.pendingDemandQuantity} {item.unit} ({item.pendingRequestCount})
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedDemandProduct(item)}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-650"
                        >
                          View Demand ({item.demandRecords.length})
                        </button>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {isUncatalogued(item) ? (
                        <button
                          onClick={() => goToCreateProduct(item)}
                          title="Add this inventory item to the Product catalog so it becomes sellable in POS"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-semibold text-[11px] uppercase tracking-wide transition-colors"
                        >
                          Create Product
                        </button>
                      ) : (
                        <button
                          onClick={() => openEditPage(item)}
                          disabled={!isEditable(item) || creatingItemId === item.productId}
                          title={item.hqInventoryItemId ? "Edit Item" : isEditable(item) ? "Edit Item Master (creates the stock record)" : "No HQ inventory record to edit"}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-600 dark:text-slate-300 font-semibold transition-colors"
                        >
                          {creatingItemId === item.productId ? <RefreshCw size={12} className="animate-spin" /> : <Edit2 size={12} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Demand Drawer Modal ── */}
      <ProductDemandDrawer
        item={selectedDemandProduct}
        onClose={() => setSelectedDemandProduct(null)}
      />

      {/* ── Branch Stock Holdings Drawer Modal ── */}
      <BranchStockDrawer
        item={selectedBranchProduct}
        onClose={() => setSelectedBranchProduct(null)}
      />

      {/* ── Bulk Import from Excel ── */}
      <Modal
        isOpen={showImportModal && !isImportMinimized}
        onClose={() => { setShowImportModal(false); setIsImportMinimized(false); setImportRows([]); setImportResult(null); setImportDuplicates([]); setImportInvalid([]); }}
        onMinimize={() => setIsImportMinimized(true)}
        title="IMPORT FINISHED GOODS FROM EXCEL"
        size="xl"
        footer={
          importing ? (
            <div className="flex items-center justify-between w-full text-xs font-bold text-slate-500 px-2">
              <span className="flex items-center gap-2 text-[#f58220]">
                <Loader2 size={15} className="animate-spin" />
                Importing {importProgress.current} of {importProgress.total} items... ({importProgress.percent}%)
              </span>
              <button
                type="button"
                disabled
                className="px-7 py-3 bg-[#e2e8f0] dark:bg-slate-800 text-[#94a3b8] dark:text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed"
              >
                Importing...
              </button>
            </div>
          ) : importResult ? (
            <button
              type="button"
              onClick={() => { setShowImportModal(false); setIsImportMinimized(false); setImportRows([]); setImportResult(null); setImportDuplicates([]); setImportInvalid([]); }}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors"
            >
              Done
            </button>
          ) : (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setIsImportMinimized(false); setImportRows([]); }}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || importRows.filter(r => !r.error).length === 0}
                className={clsx(
                  "px-8 py-3 text-sm font-bold rounded-xl transition-all shadow-2xs cursor-pointer",
                  importRows.filter(r => !r.error).length > 0 && !importing
                    ? "bg-[#f58220] hover:bg-[#e8740e] text-white hover:shadow-md"
                    : "bg-[#e2e8f0] dark:bg-slate-800 text-[#94a3b8] dark:text-slate-500 cursor-not-allowed"
                )}
              >
                {`Import ${importRows.filter(r => !r.error).length} Items`}
              </button>
            </div>
          )
        }
      >
        {importing ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Animated Ring Spinner & Icon */}
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-orange-100 dark:border-orange-950/40" />
              <div className="absolute inset-0 rounded-full border-4 border-[#f58220] border-t-transparent animate-spin" />
              <div className="w-16 h-16 rounded-full bg-orange-500/10 text-[#f58220] flex items-center justify-center shadow-inner">
                <UploadCloud size={30} className="animate-bounce" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Importing Finished Goods...
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Please wait while we validate and process your catalog items into the database.
              </p>
            </div>

            {/* Real-time Progress Bar & Counters */}
            <div className="w-full max-w-lg space-y-3 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#f58220]" />
                  <span>{importProgress.current} of {importProgress.total} items imported</span>
                </span>
                <span className="text-[#f58220] font-black text-sm font-mono">
                  {importProgress.percent}%
                </span>
              </div>

              {/* Progress Track & Fill Bar */}
              <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#f58220] to-[#ff9838] rounded-full transition-all duration-300 ease-out shadow-sm relative overflow-hidden"
                  style={{ width: `${importProgress.percent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium pt-0.5">
                <span>Processing batch records...</span>
                <span>Total: {importProgress.total} items</span>
              </div>
            </div>
          </div>
        ) : importResult ? (
          <div className="py-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-white">
                {importResult.success + importResult.duplicates + importResult.invalid} rows processed
              </p>
              <div className="flex items-center justify-center gap-4 text-sm font-semibold">
                <span className="text-emerald-600">{importResult.success} Imported</span>
                {importResult.duplicates > 0 && <span className="text-amber-600">{importResult.duplicates} Already exist</span>}
                {importResult.invalid > 0 && <span className="text-rose-600">{importResult.invalid} Invalid</span>}
              </div>
            </div>

            {importDuplicates.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1.5">Already Exist</p>
                <div className="border border-amber-100 rounded-xl overflow-hidden max-h-[25vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-amber-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-amber-700">Name</th>
                        <th className="px-3 py-2 text-left font-bold text-amber-700">SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importDuplicates.map((f, i) => (
                        <tr key={i} className="border-t border-amber-50">
                          <td className="px-3 py-2 font-semibold text-slate-800">{f.name}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{f.sku}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importInvalid.length > 0 && (
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1.5">Invalid</p>
                <div className="border border-rose-100 rounded-xl overflow-hidden max-h-[25vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-rose-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-rose-600">Name</th>
                        <th className="px-3 py-2 text-left font-bold text-rose-600">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importInvalid.map((f, i) => (
                        <tr key={i} className="border-t border-rose-50">
                          <td className="px-3 py-2 font-semibold text-slate-800">{f.name}</td>
                          <td className="px-3 py-2 text-rose-600">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {importRows.length > 0 ? (
                  <>{importRows.length} rows found · {importRows.filter(r => r.error).length} with errors will be skipped.</>
                ) : (
                  <>Select an Excel file (.xlsx, .csv) to preview finished goods before importing.</>
                )}
              </p>
              <button 
                type="button"
                onClick={handleDownloadTemplate} 
                className="flex items-center gap-1.5 text-sm font-bold text-[#f58220] hover:underline cursor-pointer"
              >
                <Download size={15} /> Download Template
              </button>
            </div>

            {importRows.length === 0 ? (
              <div 
                onClick={() => importFileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#f58220] rounded-2xl p-10 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-orange-50/20 transition-all cursor-pointer group"
              >
                <UploadCloud size={44} className="mx-auto text-slate-400 group-hover:text-[#f58220] transition-colors mb-3" />
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">Click to select or drag & drop an Excel file</p>
                <p className="text-xs text-slate-400 mb-4">Supported formats: .xlsx, .xls, .csv</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); importFileRef.current?.click(); }}
                  className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold rounded-xl shadow-2xs transition-all"
                >
                  Browse File
                </button>
              </div>
            ) : (
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[50vh] overflow-y-auto shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 text-left font-bold text-slate-500">Category</th>
                      <th className="py-3 px-3 text-left font-bold text-slate-500">Name</th>
                      <th className="py-3 px-3 text-left font-bold text-slate-500">Size</th>
                      <th className="py-3 px-3 text-left font-bold text-slate-500">Unit</th>
                      <th className="py-3 px-3 text-left font-bold text-slate-500">GST %</th>
                      <th className="py-3 px-3 text-left font-bold text-slate-500">Selling Price</th>
                      <th className="py-3 px-3 text-left font-bold text-slate-500">Auto SKU</th>
                      <th className="py-3 px-4 text-left font-bold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                    {importRows.map((row, i) => (
                      <tr key={i} className={clsx(row.error && "bg-rose-50/40 dark:bg-rose-950/20")}>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{row.category || "—"}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{row.name || "—"}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.size || "—"}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.unit || "—"}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.gstPercent ? `${row.gstPercent}%` : "5 (default)"}</td>
                        <td className="py-3 px-3">
                          {row.sellingPrice ? (
                            <span className="text-slate-700 dark:text-slate-300 font-medium">₹{row.sellingPrice}</span>
                          ) : (
                            <span className="text-[#f58220] font-bold">₹0 (no price set)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono">{row.name ? previewSku(row.name, row.size, row.unit) : "—"}</td>
                        <td className="py-3 px-4">
                          {row.error ? (
                            <span className="text-rose-500 dark:text-rose-400 font-bold">{row.error}</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Minimized Floating Import Widget ── */}
      {showImportModal && isImportMinimized && (
        <MinimizedImportWidget
          title="Import Finished Goods"
          importing={importing}
          importProgress={importProgress}
          importResult={importResult}
          importRowsCount={importRows.length}
          onRestore={() => setIsImportMinimized(false)}
          onClose={() => {
            setShowImportModal(false);
            setIsImportMinimized(false);
            setImportRows([]);
            setImportResult(null);
            setImportDuplicates([]);
            setImportInvalid([]);
          }}
        />
      )}

      {/* ── Link Existing Product Modal ── */}
      {linkItem && (
        <Modal
          isOpen={!!linkItem}
          onClose={() => setLinkItem(null)}
          title={`Link Existing Product for ${linkItem.productName}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p>Inventory Item SKU: <strong className="font-mono">{linkItem.sku}</strong></p>
              <p>Current HQ Stock: <strong>{linkItem.hqAvailableStock} {linkItem.unit}</strong></p>
              <p className="text-[11px] opacity-90 mt-1">
                Linking requires an exact SKU match to preserve stock integrity. If SKUs differ, a validation error will prevent invalid links.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Existing Catalog Product</label>
              <select
                value={selectedLinkProductId}
                onChange={(e) => setSelectedLinkProductId(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 rounded-lg text-xs font-medium outline-none text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Choose Matching Catalog Product --</option>
                {productListForLink.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(SKU: ${p.sku})` : ""} {p.basePrice ? `· ₹${p.basePrice}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setLinkItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLink}
                disabled={linking || !selectedLinkProductId}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {linking ? "Linking..." : "Confirm Link"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
