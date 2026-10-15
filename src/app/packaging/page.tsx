"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Box, CheckCircle2, AlertTriangle, RefreshCw, Search, X, PackageCheck,
  Trash2, Info, Plus,
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { productionApi, franchiseApi, productsApi } from "@/lib/api";
import { convertUnit } from "@/lib/unitConversion";
import { generateSKU } from "@/lib/utils/erp";
import { packagingBlocker, packableQty } from "@/config/production-features";
import { plannedYieldOf } from "@/lib/production-yield";
import { SKU_RE, newVariantProblem, parseSizeText, variantChoices } from "@/lib/packaging-variants";
import ProductionCostPanel, { ExpenseSource, RowCost } from "@/components/modules/production/ProductionCostPanel";

interface Batch {
  id: string;
  batchCode: string;
  quantity: number;
  approvedQty: number | null;
  packagedQty: number | null;
  qcStatus: string | null;
  packagingStatus: string | null;
  expiryDate: string | null;
  createdAt: string;
  expiryStatus?: string | null;
  recall?: { status: string } | null;
  packagings?: Array<{ id: string; status: string; totalWeight: number }>;
  product?: { id?: string | null; name: string; sku?: string | null } | null;
  production?: {
    status?: string | null;
    quantity?: number | null;
    plannedYieldQty?: number | null;
    plannedYieldUnit?: string | null;
    // productLinks: finished-goods variants linked to the recipe (Recipe import / Recipe Master).
    recipe?: { name?: string; yieldQty?: number | null; yieldUnit?: string | null; productLinks?: Array<{ productId: string }> } | null;
  } | null;
}

interface PackRow {
  key: string;
  size: string; // preset like "500g", or "custom"
  customValue: string;
  customUnit: string;
  good: number;
  damaged: number;
  productId: string; // existing finished-goods variant this row is packed into
  createNew: boolean; // create a new variant on confirm instead
  newName: string;
  newSku: string;
  // A same-size product with this product's name but not linked to its
  // recipe: "" = not decided yet, "use" = pack into it, "new" = create anyway.
  nameMatchChoice: "" | "use" | "new";
  matchedFor: string; // pack size the product fields were filled for
}

interface ConfirmedLine {
  goodQty: number;
}

const MAX_ROWS = 20;

function presetsFor(batchUnit: string): string[] {
  const u = batchUnit.toUpperCase();
  if (u === "L" || u === "ML") return ["100ml", "200ml", "500ml", "1l", "2l", "5l"];
  if (u === "KG" || u === "G") return ["100g", "250g", "500g", "1kg", "2kg", "5kg"];
  return [];
}

function customUnitsFor(batchUnit: string): string[] {
  const u = batchUnit.toUpperCase();
  return u === "KG" || u === "G" || u === "L" || u === "ML" ? ["g", "kg", "ml", "l"] : ["pcs", "unit"];
}

const unitDim = (u: string) => {
  const x = u.toUpperCase();
  return x === "G" || x === "KG" ? "W" : x === "ML" || x === "L" ? "V" : "C";
};

/** Free SKU in the Product Master format, keeping the size as the last segment. */
function uniqueSku(base: string, taken: Set<string>): string {
  const split = base.match(/^(.*)-(\d+(?:\.\d+)?(?:KG|G|ML|L|PCS|PC))$/i);
  let sku = base;
  for (let n = 2; taken.has(sku.toUpperCase()); n++) sku = split ? `${split[1]}${n}-${split[2]}` : `${base}-${n}`;
  return sku;
}

const sizeLabel = (s: string) => s.replace(/l$/, "L");

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "0";
}

function rowPacketSize(r: PackRow): string {
  if (r.size !== "custom") return r.size;
  return r.customValue && Number(r.customValue) > 0 ? `${r.customValue}${r.customUnit}` : "";
}

// Weight/volume of one packet in the batch's own unit — preview only; the
// server's parseWeight is authoritative for what is actually deducted.
function packetWeight(size: string, batchUnit: string): number {
  const m = size.trim().match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)$/);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  return val > 0 ? convertUnit(val, m[3], batchUnit) : 0;
}

// Base product name without any master pack size it may already carry.
function baseNameOf(batch: Batch): string {
  const raw = batch.product?.name || batch.production?.recipe?.name || "Product";
  return raw.replace(/\s*\(?\s*\d+(\.\d+)?\s*(kg|g|l|ml|pcs)\.?\s*\)?\s*$/i, "").trim() || raw;
}

const linkedIdsOf = (batch: Batch | null | undefined) =>
  new Set((batch?.production?.recipe?.productLinks || []).map((l) => l.productId));

function newRow(size: string, customUnit: string): PackRow {
  return {
    key: Math.random().toString(36).slice(2),
    size, customValue: "", customUnit,
    good: 0, damaged: 0,
    productId: "", createNew: false, newName: "", newSku: "", nameMatchChoice: "", matchedFor: "",
  };
}

function pendingWeight(b: Batch) {
  return (b.packagings || [])
    .filter((p) => p.status === "AWAITING_CONFIRMATION")
    .reduce((s, p) => s + (p.totalWeight || 0), 0);
}

// Unpacked quantity — for a completed batch still at PENDING this is its full
// produced quantity; the server releases it within the confirm transaction.
function availableBulk(b: Batch) {
  return packableQty(b);
}

function isPackable(b: Batch) {
  return packagingBlocker(b) === null && availableBulk(b) > 0.001;
}

function PackagingContent() {
  const searchParams = useSearchParams();
  const preselectBatchId = searchParams.get("batchId");

  const [franchises, setFranchises] = useState<any[]>([]);
  const [franchiseId, setFranchiseId] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [legacyTicketCount, setLegacyTicketCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const [rows, setRows] = useState<PackRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [wasteTarget, setWasteTarget] = useState<Batch | null>(null);
  const [wasting, setWasting] = useState(false);
  const [costRefresh, setCostRefresh] = useState(0);
  // Server-calculated production cost per row (keyed by row key), from the
  // batch's saved expenses — Packaging never takes expense input.
  const [rowCosts, setRowCosts] = useState<Record<string, RowCost>>({});
  const [costsLoading, setCostsLoading] = useState(false);
  const [expenseSource, setExpenseSource] = useState<ExpenseSource>(null);
  const handleCostsChange = useCallback((byKey: Record<string, RowCost>, loading: boolean, source: ExpenseSource) => {
    setRowCosts(byKey);
    setCostsLoading(loading);
    setExpenseSource(source);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const pRes = await productsApi.getAll();
      const pList = pRes.data?.data || pRes.data || [];
      setProducts(Array.isArray(pList) ? pList : []);
    } catch {
      /* product list is a convenience for matching; the server validates */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const fRes = await franchiseApi.getAll();
        const list = fRes.data || [];
        setFranchises(list);
        if (list.length > 0) {
          const hq = list.find((f: any) => f.isHQ);
          const fallback = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setFranchiseId((hq || fallback).id);
        } else {
          setLoading(false);
        }
      } catch {
        toast.error("Failed to load packaging data");
        setLoading(false);
      }
    })();
    loadProducts();
  }, [loadProducts]);

  const loadBatches = useCallback(async () => {
    if (!franchiseId) return;
    setLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        productionApi.getAllBatches(franchiseId),
        productionApi.getPackagings(franchiseId),
      ]);
      setBatches(bRes.data || []);
      setLegacyTicketCount((tRes.data || []).filter((t: any) => t.status === "AWAITING_CONFIRMATION").length);
    } catch {
      toast.error("Failed to load production batches");
    } finally {
      setLoading(false);
    }
  }, [franchiseId]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Every completed batch that can be packed right now (including ones
  // finished before QC was switched off — no separate Release step).
  const readyBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (b: Batch) =>
      !q || b.batchCode?.toLowerCase().includes(q) || (b.product?.name || "").toLowerCase().includes(q);
    return batches.filter((b) => isPackable(b) && matches(b));
  }, [batches, search]);

  const selected = batches.find((b) => b.id === selectedId) || null;
  const batchUnit = selected?.production?.recipe?.yieldUnit || "KG";
  const presets = presetsFor(batchUnit);
  const customUnits = customUnitsFor(batchUnit);
  const baseName = selected ? baseNameOf(selected) : "";
  const available = selected ? availableBulk(selected) : 0;
  const alreadyPacked = selected ? (selected.packagedQty ?? 0) + pendingWeight(selected) : 0;

  // Finished product for a row's pack size. Only a variant linked to this
  // batch's recipe (a verified relationship) is reused automatically, and
  // only when it is the single one; otherwise the row starts on Create New
  // Variant with a suggested name and SKU. A same-name product that isn't
  // linked is never used without the operator confirming it. Operator
  // choices for the same size are kept.
  const withMatchedProduct = useCallback(
    (r: PackRow): PackRow => {
      const size = rowPacketSize(r);
      if (!size || !selected) return { ...r, productId: "", createNew: false, matchedFor: "" };
      const { linked, nameMatches } = variantChoices(products, baseName, size, linkedIdsOf(selected));
      if (r.matchedFor === size) {
        const allowed = [...linked, ...(r.nameMatchChoice === "use" ? nameMatches : [])];
        if (!r.createNew && r.productId && !allowed.some((x) => x.id === r.productId)) return { ...r, productId: "", createNew: linked.length === 0 };
        return r;
      }
      // Suggestions only — uniqueness is checked against the server before confirming.
      const taken = new Set(products.map((x: any) => (x.sku || "").toUpperCase()).filter(Boolean));
      return {
        ...r,
        matchedFor: size,
        productId: linked.length === 1 ? linked[0].id : "",
        createNew: linked.length === 0,
        nameMatchChoice: "",
        newName: `${baseName} ${sizeLabel(size)}`,
        newSku: uniqueSku(generateSKU("FINISHED_GOOD", baseName, size.toUpperCase()), taken),
      };
    },
    [products, baseName, selected]
  );

  // Server-side SKU uniqueness for Create New Variant rows (debounced; the
  // confirm transaction re-checks). Keyed by SKU.
  const [skuChecks, setSkuChecks] = useState<Record<string, { available: boolean; owner?: string } | "checking" | "failed">>({});
  const newSkus = rows.filter((r) => r.createNew).map((r) => r.newSku.trim().toUpperCase()).filter((x) => SKU_RE.test(x));
  const newSkusKey = Array.from(new Set(newSkus)).sort().join("|");
  useEffect(() => {
    const pending = newSkusKey ? newSkusKey.split("|").filter((x) => !(x in skuChecks) || skuChecks[x] === "failed") : [];
    if (!pending.length) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSkuChecks((prev) => ({ ...prev, ...Object.fromEntries(pending.map((x) => [x, "checking" as const])) }));
      pending.forEach((sku) => {
        productionApi.checkPackagingSku(sku)
          .then((res) => { if (!cancelled) setSkuChecks((prev) => ({ ...prev, [sku]: { available: !!res.data?.available, owner: res.data?.product?.name } })); })
          .catch(() => { if (!cancelled) setSkuChecks((prev) => ({ ...prev, [sku]: "failed" })); });
      });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSkusKey]);
  // A product created by a confirmation takes its SKU: check again next time.
  useEffect(() => { setSkuChecks({}); }, [products]);

  const startRows = useCallback(
    (b: Batch) => {
      const unit = b.production?.recipe?.yieldUnit || "KG";
      const ps = presetsFor(unit);
      const first = newRow(ps.includes("500g") ? "500g" : ps.includes("500ml") ? "500ml" : ps[0] || "custom", customUnitsFor(unit)[0]);
      setRows([first]);
    },
    []
  );

  const selectBatch = useCallback(
    (b: Batch) => {
      setSelectedId(b.id);
      startRows(b);
    },
    [startRows]
  );

  // Re-run matching whenever the batch, product list or row sizes change.
  const sizeSignature = rows.map((r) => `${r.key}:${rowPacketSize(r)}`).join("|");
  useEffect(() => {
    setRows((prev) => prev.map(withMatchedProduct));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeSignature, withMatchedProduct]);

  // Deep link from Production Runs (?batchId=…).
  useEffect(() => {
    if (!preselectBatchId || selectedId || batches.length === 0) return;
    const b = batches.find((x) => x.id === preselectBatchId);
    if (b && isPackable(b)) selectBatch(b);
  }, [preselectBatchId, batches, selectedId, selectBatch]);

  const updateRow = (key: string, patch: Partial<PackRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    const used = new Set(rows.map((r) => r.size));
    const next = presets.find((p) => !used.has(p)) || "custom";
    setRows((prev) => [...prev, newRow(next, customUnits[0])]);
  };

  // ── Live calculation (in the batch's own unit) ──
  const calc = useMemo(() => {
    const seen = new Map<string, number>();
    const seenProduct = new Map<string, number>();
    const batchDim = unitDim(batchUnit);
    const lines = rows.map((r, i) => {
      const size = rowPacketSize(r);
      const per = size ? packetWeight(size, batchUnit) : 0;
      const canon = size ? parseSizeText(size) : null;
      const sig = canon ? `${canon.dim}${canon.amount}` : "";
      const dupOf = sig && seen.has(sig) ? seen.get(sig)! : -1;
      if (sig && dupOf < 0) seen.set(sig, i);
      const choices = size ? variantChoices(products, baseName, size, linkedIdsOf(selected)) : { linked: [], nameMatches: [] };
      const newSku = r.newSku.trim().toUpperCase();
      const productKey = r.createNew ? `new:${newSku}` : r.productId ? `id:${r.productId}` : "";
      const dupProduct = productKey && seenProduct.has(productKey) ? seenProduct.get(productKey)! : -1;
      if (productKey && dupProduct < 0) seenProduct.set(productKey, i);

      let error = "";
      if (r.size === "custom" && unitDim(r.customUnit) !== batchDim) error = `${sizeLabel(r.customUnit)} can't be packed from a ${batchUnit} batch`;
      else if (!size || per <= 0) error = r.size === "custom" ? "Enter a custom size greater than 0" : "Choose a pack size";
      else if (dupOf >= 0) error = `Same size as row ${dupOf + 1} — use one row per size`;
      else if (r.good + r.damaged <= 0) error = "Enter good or damaged packets";
      else if (!r.createNew && !r.productId) error = `Choose which ${sizeLabel(size)} variant to pack into, or create a new variant`;
      else if (r.createNew && choices.nameMatches.length > 0 && r.nameMatchChoice !== "new") error = `"${choices.nameMatches[0].name}" already exists for ${sizeLabel(size)} — use it, or confirm creating a new variant`;
      else if (r.createNew && newVariantProblem({ name: r.newName, sku: r.newSku, packetSize: sizeLabel(size) }, products)) error = newVariantProblem({ name: r.newName, sku: r.newSku, packetSize: sizeLabel(size) }, products)!;
      else if (r.createNew && (skuChecks[newSku] === undefined || skuChecks[newSku] === "checking")) error = `Checking SKU ${newSku}…`;
      else if (r.createNew && skuChecks[newSku] === "failed") error = `Couldn't verify SKU ${newSku} is unique — check your connection and try again`;
      else if (r.createNew && typeof skuChecks[newSku] === "object" && !(skuChecks[newSku] as any).available) error = `SKU ${newSku} already belongs to "${(skuChecks[newSku] as any).owner || "another product"}"`;
      else if (dupProduct >= 0) error = `Same product as row ${dupProduct + 1} — combine them into one row`;
      return { row: r, size, per, choices, goodWeight: r.good * per, damagedWeight: r.damaged * per, error };
    });
    const good = lines.reduce((s, l) => s + l.goodWeight, 0);
    const damaged = lines.reduce((s, l) => s + l.damagedWeight, 0);
    const remaining = available - good - damaged;
    return { lines, good, damaged, allocated: good + damaged, remaining, over: remaining < -0.000001 };
  }, [rows, batchUnit, available, products, baseName, skuChecks, selected]);

  // Rows as the cost preview / confirmation see them (same order and indexes).
  const costRows = calc.lines.map(({ row, size }) => ({
    key: row.key,
    packetSize: size,
    packedQty: row.good,
    damagedQty: row.damaged,
    productId: row.createNew ? undefined : row.productId || undefined,
  }));
  const hasErrors = calc.lines.some((l) => l.error) || calc.over;

  const handleConfirm = async () => {
    if (!selected || submitting) return;
    const firstError = calc.lines.findIndex((l) => l.error);
    if (firstError >= 0) return toast.error(`Row ${firstError + 1}: ${calc.lines[firstError].error}`);
    if (calc.over) return toast.error(`Rows need ${fmt(calc.allocated)} ${batchUnit}, only ${fmt(available)} ${batchUnit} is left`);

    setSubmitting(true);
    try {
      const res = await productionApi.packageAndConfirm(selected.id, {
        expectedPackagedQty: selected.packagedQty || 0,
        rows: calc.lines.map(({ row, size }) => ({
          packetSize: size,
          packedQty: row.good,
          damagedQty: row.damaged,
          // An existing variant (price untouched), or a new one created and
          // linked to this recipe in the same transaction as the stock posting.
          productId: row.createNew ? undefined : row.productId,
          newProduct: row.createNew
            ? { name: row.newName.trim(), sku: row.newSku.trim().toUpperCase() } // created Pricing Pending; price is set in Product Master
            : undefined,
        })),
        // No expense lines: the server applies the batch's saved expenses.
      });
      const lines: ConfirmedLine[] = res.data?.summary || [];
      setCostRefresh((k) => k + 1);
      const pcs = lines.reduce((s, l) => s + (l.goodQty || 0), 0);
      toast.success(`${pcs} packets added to Stock Hub across ${lines.length} SKU${lines.length === 1 ? "" : "s"}`);
      if (calc.lines.some((l) => l.row.createNew)) await loadProducts();
      startRows(selected);
      await loadBatches();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Packaging could not be confirmed");
      await loadBatches();
    } finally {
      setSubmitting(false);
    }
  };

  const handleWasteBalance = async () => {
    if (!wasteTarget) return;
    setWasting(true);
    try {
      await productionApi.wasteBalance(wasteTarget.id, "Remaining balance wasted from Packaging & Confirmation");
      toast.success("Remaining balance moved to wastage");
      if (selectedId === wasteTarget.id) setSelectedId("");
      setWasteTarget(null);
      await loadBatches();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to waste balance");
    } finally {
      setWasting(false);
    }
  };

  // Close the form once the batch has nothing left to pack (the confirmation
  // summary stays visible).
  useEffect(() => {
    if (selectedId && !loading && selected && availableBulk(selected) <= 0.001) setSelectedId("");
  }, [selectedId, selected, loading]);

  const inputCls =
    "w-full border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1";
  const digits = (v: string) => parseInt(v.replace(/[^\d]/g, "") || "0", 10);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
          Completed batches appear here automatically. Add one row per pack size, confirm once — each SKU updates in Stock Hub.
        </p>
        {franchises.length > 1 && (
          <select
            value={franchiseId}
            onChange={(e) => { setFranchiseId(e.target.value); setSelectedId(""); }}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#13151f] text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220]"
          >
            {franchises.map((f) => (
              <option key={f.id} value={f.id} className="dark:bg-card">{f.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {legacyTicketCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-2 font-medium">
              <Info className="h-4 w-4 shrink-0" />
              {legacyTicketCount} packaging run{legacyTicketCount === 1 ? "" : "s"} started in the previous two-step flow {legacyTicketCount === 1 ? "is" : "are"} still awaiting confirmation.
            </span>
            <Link href="/packaging/confirm" className="font-bold underline shrink-0">Review &amp; confirm them</Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Batch list */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">
                    Ready for Packaging ({readyBatches.length})
                  </h3>
                  <button onClick={loadBatches} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5" title="Refresh">
                    <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search batch or product…"
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                  />
                  {search && <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setSearch("")} />}
                </div>
              </div>

              {loading && batches.length === 0 ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-400 opacity-60" /></div>
              ) : readyBatches.length === 0 ? (
                <div className="py-14 px-6 text-center">
                  <Box className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">Nothing waiting to be packed</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Complete a run in <Link href="/production/batches?tab=ACTIVE_RUNS" className="text-[#f58220] font-semibold">Production Runs</Link> and it will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {readyBatches.map((b) => {
                    const unit = b.production?.recipe?.yieldUnit || "KG";
                    const isSel = b.id === selectedId;
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => selectBatch(b)}
                          className={clsx(
                            "w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer",
                            isSel ? "bg-orange-50 dark:bg-orange-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{b.product?.name || b.production?.recipe?.name}</span>
                            <span className="block text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                              <span className="font-mono font-semibold text-[#f58220]">{b.batchCode}</span>
                              {b.expiryDate && <> · Exp {format(new Date(b.expiryDate), "dd MMM yyyy")}</>}
                              {b.packagingStatus === "PARTIALLY_PACKED" && <> · Partly packed</>}
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className="block text-sm font-black text-gray-900 dark:text-white">{fmt(availableBulk(b))} <span className="text-[10px] font-semibold text-gray-400">{unit}</span></span>
                            <span className="block text-[10px] font-semibold text-gray-400">to pack</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Pack & confirm */}
          <div className="lg:col-span-8">
            {!selected ? (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-center p-8 bg-white dark:bg-card">
                <PackageCheck className="h-10 w-10 text-gray-300 dark:text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-gray-500 dark:text-slate-400">Select a batch to pack</h3>
                <p className="text-sm text-gray-400 dark:text-slate-500 max-w-xs mt-1">Batch details, remaining quantity and matching SKUs are filled in for you.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                {/* Batch header */}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{selected.product?.name || selected.production?.recipe?.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono font-semibold text-[#f58220]">{selected.batchCode}</span>
                      {selected.expiryDate && <> · Expires {format(new Date(selected.expiryDate), "dd MMM yyyy")}</>}
                    </p>
                  </div>
                  <button onClick={() => setSelectedId("")} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10" title="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Quantity strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-white/5 border-b border-gray-100 dark:border-white/5 text-center">
                  {[
                    { label: "Planned Yield", value: plannedYieldOf(selected.production).qty, cls: "text-gray-500 dark:text-slate-400" },
                    // Packaging always works from what was actually produced.
                    { label: "Actual Yield", value: selected.approvedQty || selected.quantity || 0, cls: "text-gray-800 dark:text-white" },
                    { label: "Already Packed", value: alreadyPacked, cls: "text-gray-800 dark:text-white" },
                    { label: "Currently Allocated", value: calc.allocated, cls: "text-blue-600 dark:text-blue-400" },
                    { label: "Remaining Bulk", value: calc.remaining, cls: calc.over ? "text-rose-600" : "text-[#f58220]" },
                  ].map((s) => (
                    <div key={s.label} className="py-2.5 px-2">
                      <p className="text-[10px] font-bold uppercase text-gray-400">{s.label}</p>
                      <p className={clsx("text-sm font-bold mt-0.5 tabular-nums", s.cls)}>
                        {s.value == null ? "—" : fmt(s.value)} <span className="text-[10px] text-gray-400">{batchUnit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Packaging rows */}
                <div className="p-4 sm:p-5 space-y-3">
                  {calc.lines.map(({ row, size, choices, goodWeight, damagedWeight, error }, i) => {
                    return (
                      <div key={row.key} className={clsx("rounded-xl border p-3", error && (row.good || row.damaged) ? "border-rose-200 dark:border-rose-500/30" : "border-gray-200 dark:border-white/10")}>
                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                          <div className={clsx("col-span-2", row.size === "custom" ? "sm:col-span-2" : "sm:col-span-3")}>
                            <label className={labelCls}>Pack size</label>
                            <div className="flex gap-1.5">
                              <select
                                value={row.size}
                                onChange={(e) => updateRow(row.key, { size: e.target.value })}
                                className={clsx(inputCls, "cursor-pointer font-semibold")}
                              >
                                {presets.map((p) => <option key={p} value={p} className="dark:bg-card">{sizeLabel(p)}</option>)}
                                <option value="custom" className="dark:bg-card">Custom…</option>
                              </select>
                            </div>
                          </div>
                          {row.size === "custom" && (
                            <div className="col-span-2 sm:col-span-3">
                              <label className={labelCls}>Custom size</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="number" min="0" step="any" inputMode="decimal"
                                  value={row.customValue}
                                  onChange={(e) => updateRow(row.key, { customValue: e.target.value })}
                                  placeholder="e.g. 750"
                                  className={clsx(inputCls, "flex-1 min-w-0 tabular-nums")}
                                />
                                <select
                                  value={row.customUnit}
                                  onChange={(e) => updateRow(row.key, { customUnit: e.target.value })}
                                  className={clsx(inputCls.replace("w-full ", ""), "w-16 shrink-0 cursor-pointer")}
                                >
                                  {customUnits.map((u) => <option key={u} value={u} className="dark:bg-card">{sizeLabel(u)}</option>)}
                                </select>
                              </div>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className={clsx(labelCls, "!text-emerald-600 dark:!text-emerald-400")}>Good (pcs)</label>
                            <input
                              type="text" inputMode="numeric"
                              value={row.good || ""}
                              onChange={(e) => updateRow(row.key, { good: digits(e.target.value) })}
                              onFocus={(e) => e.currentTarget.select()}
                              placeholder="0"
                              className={clsx(inputCls, "font-bold tabular-nums")}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={clsx(labelCls, "!text-amber-600 dark:!text-amber-400")}>Damaged (pcs)</label>
                            <input
                              type="text" inputMode="numeric"
                              value={row.damaged || ""}
                              onChange={(e) => updateRow(row.key, { damaged: digits(e.target.value) })}
                              onFocus={(e) => e.currentTarget.select()}
                              placeholder="0"
                              className={clsx(inputCls, "font-bold tabular-nums")}
                            />
                          </div>
                          <div className={clsx("col-span-2 flex items-end justify-between gap-2", row.size === "custom" ? "sm:col-span-3" : "sm:col-span-5")}>
                            <div className="min-w-0">
                              <label className={labelCls}>Weight</label>
                              <p className="text-sm font-bold tabular-nums text-gray-800 dark:text-white py-1.5 whitespace-nowrap">
                                {fmt(goodWeight)} <span className="text-[10px] text-gray-400">{batchUnit}</span>
                                {damagedWeight > 0 && <span className="text-[11px] font-semibold text-amber-600"> +{fmt(damagedWeight)} dmg</span>}
                              </p>
                            </div>
                            <button
                              onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : prev))}
                              disabled={rows.length === 1}
                              className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 shrink-0"
                              title={rows.length === 1 ? "At least one pack size is needed" : "Remove row"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Finished product for this pack size: a verified existing variant, or Create New Variant */}
                        {size && (() => {
                          const { linked, nameMatches } = choices;
                          const confirmedMatch = row.nameMatchChoice === "use" ? nameMatches.find((p: any) => p.id === row.productId) : null;
                          const existing = !row.createNew ? [...linked, ...(confirmedMatch ? [confirmedMatch] : [])].find((p: any) => p.id === row.productId) : null;
                          const rc = rowCosts[row.key];
                          const cost = rc && rc.good > 0 ? rc.costPerGoodPacket : null;
                          const money = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
                          const sku = row.newSku.trim().toUpperCase();
                          const skuState = skuChecks[sku];
                          const toNew = () => updateRow(row.key, { createNew: true, productId: "" });
                          return (
                            <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-100 dark:border-white/5 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className={clsx(labelCls, "!mb-0")}>{row.createNew ? "Create New Variant" : "Finished Product"}</label>
                                {row.createNew && linked.length > 0 && (
                                  <button type="button" onClick={() => updateRow(row.key, { createNew: false, productId: linked.length === 1 ? linked[0].id : "" })} className="text-[11px] font-bold text-[#f58220] hover:underline cursor-pointer">
                                    Use existing {sizeLabel(size)} variant instead
                                  </button>
                                )}
                                {!row.createNew && (
                                  <button type="button" onClick={toNew} className="text-[11px] font-bold text-[#f58220] hover:underline cursor-pointer">
                                    Create New Variant instead
                                  </button>
                                )}
                              </div>

                              {/* Same-name product not linked to this recipe: confirm before using or duplicating it. */}
                              {row.createNew && nameMatches.length > 0 && row.nameMatchChoice === "" && (
                                <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 px-2.5 py-2 space-y-1.5">
                                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                                    <span>&quot;{nameMatches[0].name}&quot; ({nameMatches[0].sku}) already exists for {sizeLabel(size)} but isn&apos;t linked to this recipe. Is it this product?</span>
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {nameMatches.map((m: any) => (
                                      <button key={m.id} type="button" onClick={() => updateRow(row.key, { createNew: false, productId: m.id, nameMatchChoice: "use" })} className="px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-card text-[11px] font-bold text-amber-800 dark:text-amber-300 cursor-pointer hover:bg-amber-100/60">
                                        Yes, use {m.sku}
                                      </button>
                                    ))}
                                    <button type="button" onClick={() => updateRow(row.key, { nameMatchChoice: "new" })} className="px-2.5 py-1 rounded-md bg-[#f58220] hover:bg-[#e8740e] text-[11px] font-bold text-white cursor-pointer">
                                      No, create a new variant
                                    </button>
                                  </div>
                                </div>
                              )}

                              {row.createNew ? (
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                  <div className="sm:col-span-7">
                                    <label className={labelCls}>Product Name</label>
                                    <input value={row.newName} onChange={(e) => updateRow(row.key, { newName: e.target.value })} placeholder={`${baseName} ${sizeLabel(size)}`} aria-label="New variant product name" className={inputCls} />
                                  </div>
                                  <div className="sm:col-span-5">
                                    <label className={labelCls}>SKU</label>
                                    <input value={row.newSku} onChange={(e) => updateRow(row.key, { newSku: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder={`FG-XXXX-${size.toUpperCase()}`} aria-label="New variant SKU" className={clsx(inputCls, "font-mono")} />
                                    {SKU_RE.test(sku) && (
                                      <p className={clsx("text-[10px] font-semibold mt-0.5", skuState && typeof skuState === "object" ? (skuState.available ? "text-emerald-600" : "text-rose-600") : "text-gray-400")}>
                                        {skuState === "checking" || skuState === undefined ? "Checking SKU…" : skuState === "failed" ? "Couldn't check SKU" : skuState.available ? "SKU available" : `Taken by "${skuState.owner || "another product"}"`}
                                      </p>
                                    )}
                                  </div>
                                  <p className="sm:col-span-12 text-[10px] text-gray-400">Created as <span className="font-semibold text-amber-600">Pricing Pending</span> — set its selling price later in Product Master.</p>
                                </div>
                              ) : linked.length > 1 && !confirmedMatch ? (
                                <div>
                                  <label className={labelCls}>{linked.length} {sizeLabel(size)} variants of this recipe — choose one</label>
                                  <select value={row.productId} onChange={(e) => updateRow(row.key, { productId: e.target.value })} aria-label={`${sizeLabel(size)} variant`} className={clsx(inputCls, "cursor-pointer")}>
                                    <option value="" className="dark:bg-card">Choose the {sizeLabel(size)} variant…</option>
                                    {linked.map((o: any) => <option key={o.id} value={o.id} className="dark:bg-card">{o.name} · {o.sku}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                                  <div className="col-span-2 sm:col-span-7 min-w-0">
                                    <label className={labelCls}>Product Name</label>
                                    <p className="text-sm font-semibold py-1.5 truncate text-gray-900 dark:text-white" title={existing?.name}>{existing?.name || "—"}</p>
                                  </div>
                                  <div className="col-span-2 sm:col-span-5 min-w-0">
                                    <label className={labelCls}>SKU</label>
                                    <p className="text-sm font-mono py-1.5 truncate text-gray-700 dark:text-slate-300">{existing?.sku || "—"}</p>
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className={labelCls}>Production Cost / pkt</label>
                                <p className={clsx("text-sm font-bold tabular-nums py-1 text-gray-900 dark:text-white", costsLoading && "opacity-50")} title={expenseSource === "LEGACY" ? "Calculated automatically — this batch has no saved expense data, so only raw materials and expenses already recorded on it are included" : "Calculated automatically — manufacturing cost plus the recipe's packaging expenses"}>
                                  {cost != null ? money(cost) : row.good > 0 ? (costsLoading ? "…" : "—") : "—"}
                                  {expenseSource === "LEGACY" && cost != null && <span className="ml-2 text-[10px] font-semibold text-amber-600">Expense data unavailable</span>}
                                </p>
                                {rc && rc.damaged > 0 && rc.good > 0 && (
                                  <p className="text-[10px] text-amber-600">Includes the cost of {rc.damaged} damaged packet{rc.damaged === 1 ? "" : "s"} ({money(rc.damageAbsorbed)}).</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        {error && (row.good > 0 || row.damaged > 0 || row.size === "custom") && (
                          <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{error}</p>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={addRow}
                    disabled={rows.length >= MAX_ROWS}
                    className="w-full py-2 rounded-xl border border-dashed border-gray-300 dark:border-white/15 text-xs font-bold text-gray-600 dark:text-slate-300 hover:border-[#f58220] hover:text-[#f58220] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Another Pack Size
                  </button>

                  {/* Totals */}


                  <ProductionCostPanel
                    batchId={selected.id}
                    unit={batchUnit}
                    rows={costRows}
                    refreshKey={costRefresh}
                    onCostsChange={handleCostsChange}
                  />

                  <button
                    onClick={handleConfirm}
                    disabled={submitting || hasErrors}
                    className="w-full py-3 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {submitting ? "Confirming…" : `Confirm Packaging${rows.length > 1 ? ` (${rows.length} sizes)` : ""}`}
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
                    <span>Unpacked bulk stays available for a later session.</span>
                    <button onClick={() => setWasteTarget(selected)} className="inline-flex items-center gap-1 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="h-3 w-3" /> Waste remaining {fmt(available)} {batchUnit}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!wasteTarget}
        onClose={() => setWasteTarget(null)}
        title="Move remaining balance to wastage?"
        size="sm"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button onClick={() => setWasteTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-[#13151f] dark:text-gray-300 dark:border-gray-700">
              Cancel
            </button>
            <button onClick={handleWasteBalance} disabled={wasting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 min-w-[110px] flex items-center justify-center">
              {wasting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Move to Wastage"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-slate-300">
          The unpacked {wasteTarget ? fmt(availableBulk(wasteTarget)) : 0} {wasteTarget?.production?.recipe?.yieldUnit || "KG"} of <strong>{wasteTarget?.batchCode}</strong> will be deducted from stock and recorded as wastage. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

export default function PackagingPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-400 opacity-60" /></div>}>
      <PackagingContent />
    </Suspense>
  );
}
