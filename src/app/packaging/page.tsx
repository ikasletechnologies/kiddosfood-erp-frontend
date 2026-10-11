"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Box, CheckCircle2, AlertTriangle, RefreshCw, Search, X, PackageCheck,
  Trash2, ArrowRight, Info, Plus, ChevronDown, Check,
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { productionApi, franchiseApi, productsApi } from "@/lib/api";
import { convertUnit } from "@/lib/unitConversion";
import { generateSKU } from "@/lib/utils/erp";
import { packagingBlocker, packableQty } from "@/config/production-features";

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
  production?: { status?: string | null; recipe?: { name?: string; yieldUnit?: string | null } | null } | null;
}

interface PackRow {
  key: string;
  size: string; // preset like "500g", or "custom"
  customValue: string;
  customUnit: string;
  good: number;
  damaged: number;
  productId: string;
  createNew: boolean;
  newName: string;
  newSku: string;
  newPrice: number;
  matchedFor: string; // pack size the auto-filled product/variant fields belong to
}

interface ConfirmedLine {
  packetSize: string;
  sku: string;
  productName: string;
  goodQty: number;
  damagedQty: number;
  totalWeight: number;
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

const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

// Searchable finished-product picker (name, SKU, current selling price).
function ProductPicker({ options, value, onChange, inputCls }: {
  options: any[];
  value: string;
  onChange: (id: string) => void;
  inputCls: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const sel = options.find((o) => o.id === value);
  const list = options.filter((o) => !q || norm(o.name).includes(norm(q)) || (o.sku || "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={clsx(inputCls, "flex items-center justify-between gap-2 text-left cursor-pointer")}>
        {sel ? (
          <span className="min-w-0 flex items-center gap-2">
            <span className="font-semibold truncate">{sel.name}</span>
            <span className="font-mono text-[11px] text-gray-400 shrink-0">{sel.sku}</span>
            <span className="text-[11px] font-bold text-emerald-600 shrink-0">₹{Number(sel.basePrice || 0).toLocaleString("en-IN")}</span>
          </span>
        ) : (
          <span className="text-gray-400">Select product…</span>
        )}
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-gray-100 dark:border-white/5">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU…" className={inputCls} />
          </div>
          <ul className="max-h-56 overflow-y-auto custom-scrollbar py-1">
            {list.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 text-center">No matching products</li>
            ) : list.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setQ(""); }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-800 dark:text-white truncate">{o.name}</span>
                    <span className="block font-mono text-[10px] text-gray-400">{o.sku}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-emerald-600">₹{Number(o.basePrice || 0).toLocaleString("en-IN")}</span>
                    {o.id === value && <Check className="h-3.5 w-3.5 text-[#f58220]" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
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

// Pack size as a comparable amount in a base unit (g / ml / pcs).
function canonicalSize(qty: number, unit: string): { amount: number; dim: string } | null {
  const u = unit.toUpperCase();
  if (u === "G" || u === "KG") return { amount: convertUnit(qty, u, "G"), dim: "W" };
  if (u === "ML" || u === "L") return { amount: convertUnit(qty, u, "ML"), dim: "V" };
  if (u === "PCS" || u === "PC" || u === "UNIT") return { amount: qty, dim: "C" };
  return null;
}

function parseSizeText(text: string): { amount: number; dim: string } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs|pc|unit)$/i);
  return m ? canonicalSize(Number(m[1]), m[2]) : null;
}

// Pack size a product represents: the SKU's size segment (the ERP SKU format
// always ends in one, e.g. FG-VEGD-500G), else a size at the end of its name.
function productSize(p: any): { amount: number; dim: string } | null {
  const fromSku = (p.sku || "").match(/-(\d+(?:\.\d+)?)(KG|G|ML|L|PCS|PC)$/i);
  if (fromSku) return canonicalSize(Number(fromSku[1]), fromSku[2]);
  const fromName = (p.name || "").match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs)\.?\s*\)?\s*$/i);
  return fromName ? canonicalSize(Number(fromName[1]), fromName[2]) : null;
}

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sameSize = (a: { amount: number; dim: string } | null, b: { amount: number; dim: string } | null) =>
  !!a && !!b && a.dim === b.dim && Math.abs(a.amount - b.amount) < 0.000001;

// Base product name without any master pack size it may already carry.
function baseNameOf(batch: Batch): string {
  const raw = batch.product?.name || batch.production?.recipe?.name || "Product";
  return raw.replace(/\s*\(?\s*\d+(\.\d+)?\s*(kg|g|l|ml|pcs)\.?\s*\)?\s*$/i, "").trim() || raw;
}

const isSameBase = (p: any, base: string) => norm(p.name).includes(norm(base));

/**
 * Active, SKU'd products of this pack size for the batch's base product. Only
 * when none exist are other products of the same size offered (never
 * auto-selected), for catalogues whose naming differs from the recipe.
 */
function variantsFor(products: any[], base: string, packetSize: string): any[] {
  const want = parseSizeText(packetSize);
  if (!want) return [];
  const sameSizeList = products.filter((p) => p.isActive !== false && p.sku && sameSize(productSize(p), want));
  const sameBase = sameSizeList.filter((p) => isSameBase(p, base));
  return sameBase.length ? sameBase : sameSizeList;
}

function newRow(size: string, customUnit: string): PackRow {
  return {
    key: Math.random().toString(36).slice(2),
    size, customValue: "", customUnit,
    good: 0, damaged: 0,
    productId: "", createNew: false, newName: "", newSku: "", newPrice: 0, matchedFor: "",
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
  const [confirmed, setConfirmed] = useState<{ batchCode: string; lines: ConfirmedLine[] } | null>(null);
  const [wasteTarget, setWasteTarget] = useState<Batch | null>(null);
  const [wasting, setWasting] = useState(false);

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

  // Auto-match the finished product for a row's pack size. When the size is
  // unchanged it only fills a still-empty choice, so a product picked or a
  // variant name typed by the operator is never overwritten.
  const withMatchedProduct = useCallback(
    (r: PackRow): PackRow => {
      const size = rowPacketSize(r);
      if (!size || !selected) return { ...r, productId: "", createNew: false, matchedFor: "" };
      const options = variantsFor(products, baseName, size);
      if (r.matchedFor === size) {
        const valid = r.productId && options.some((p) => p.id === r.productId);
        if (valid || r.createNew) return r;
        return { ...r, productId: options[0] && isSameBase(options[0], baseName) ? options[0].id : "" };
      }
      const taken = new Set(products.map((p: any) => (p.sku || "").toUpperCase()).filter(Boolean));
      return {
        ...r,
        matchedFor: size,
        productId: options[0] && isSameBase(options[0], baseName) ? options[0].id : "",
        // No existing variant of this base product + size: start on Create New Variant.
        createNew: !(options[0] && isSameBase(options[0], baseName)),
        newName: `${baseName} ${sizeLabel(size)}`,
        newSku: uniqueSku(generateSKU("FINISHED_GOOD", baseName, size.toUpperCase()), taken),
        newPrice: 0,
      };
    },
    [products, baseName, selected]
  );

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
      setConfirmed(null);
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
      const options = size ? variantsFor(products, baseName, size) : [];
      const newSku = r.newSku.trim().toUpperCase();
      const newName = r.newName.trim();
      const productKey = r.createNew ? `new:${newSku || norm(newName)}` : r.productId ? `id:${r.productId}` : "";
      const dupProduct = productKey && seenProduct.has(productKey) ? seenProduct.get(productKey)! : -1;
      if (productKey && dupProduct < 0) seenProduct.set(productKey, i);
      const skuOwner = newSku ? products.find((p: any) => (p.sku || "").toUpperCase() === newSku) : null;
      const nameOwner = newName ? products.find((p: any) => norm(p.name) === norm(newName)) : null;
      const skuSize = newSku.match(/-(\d+(?:\.\d+)?)(KG|G|ML|L|PCS|PC)$/i);

      let error = "";
      if (r.size === "custom" && unitDim(r.customUnit) !== batchDim) error = `${sizeLabel(r.customUnit)} can't be packed from a ${batchUnit} batch`;
      else if (!size || per <= 0) error = r.size === "custom" ? "Enter a custom size greater than 0" : "Choose a pack size";
      else if (dupOf >= 0) error = `Same size as row ${dupOf + 1} — use one row per size`;
      else if (r.good + r.damaged <= 0) error = "Enter good or damaged packets";
      else if (!r.createNew && !options.some((p) => p.id === r.productId)) error = `Select a ${sizeLabel(size)} product, or create a new variant`;
      else if (r.createNew && newName.length < 2) error = "Enter the product name";
      else if (r.createNew && nameOwner) error = `"${nameOwner.name}" already exists — select it under Use Existing Product`;
      else if (r.createNew && !SKU_RE.test(newSku)) error = "Enter a SKU (letters, numbers and hyphens)";
      else if (r.createNew && skuOwner) error = `SKU ${newSku} already belongs to "${skuOwner.name}"`;
      else if (r.createNew && skuSize && !sameSize(canonicalSize(Number(skuSize[1]), skuSize[2]), parseSizeText(size))) error = `SKU ends in ${skuSize[1]}${skuSize[2]} but the pack size is ${sizeLabel(size)}`;
      else if (r.createNew && !(r.newPrice > 0)) error = "Enter the selling price";
      else if (dupProduct >= 0) error = `Same product as row ${dupProduct + 1} — combine them into one row`;
      return { row: r, size, per, options, goodWeight: r.good * per, damagedWeight: r.damaged * per, error };
    });
    const good = lines.reduce((s, l) => s + l.goodWeight, 0);
    const damaged = lines.reduce((s, l) => s + l.damagedWeight, 0);
    const remaining = available - good - damaged;
    return { lines, good, damaged, allocated: good + damaged, remaining, over: remaining < -0.000001 };
  }, [rows, batchUnit, available, products, baseName]);

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
          productId: row.createNew ? undefined : row.productId,
          newProduct: row.createNew
            ? { name: row.newName.trim(), sku: row.newSku.trim().toUpperCase(), basePrice: Number(row.newPrice) }
            : undefined,
        })),
      });
      const lines: ConfirmedLine[] = res.data?.summary || [];
      setConfirmed({ batchCode: selected.batchCode, lines });
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

        {confirmed && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Packaging confirmed · {confirmed.batchCode}
              </p>
              <button onClick={() => setConfirmed(null)} className="text-emerald-700/60 hover:text-emerald-800" title="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs text-emerald-900 dark:text-emerald-200">
              {confirmed.lines.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 bg-white/70 dark:bg-white/5 rounded-lg px-3 py-1.5">
                  <span className="truncate">
                    <span className="font-semibold">{l.productName}</span>{" "}
                    <span className="font-mono text-[10px] text-emerald-700/70">{l.sku}</span>
                  </span>
                  <span className="font-bold shrink-0">
                    +{l.goodQty} pcs{l.damagedQty ? <span className="text-amber-600 font-semibold"> · {l.damagedQty} dmg</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/inventory/stock" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline">
              View in Stock Hub <ArrowRight className="h-3 w-3" />
            </Link>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-white/5 border-b border-gray-100 dark:border-white/5 text-center">
                  {[
                    { label: "Produced", value: selected.approvedQty || selected.quantity || 0, cls: "text-gray-800 dark:text-white" },
                    { label: "Already Packed", value: alreadyPacked, cls: "text-gray-800 dark:text-white" },
                    { label: "Currently Allocated", value: calc.allocated, cls: "text-blue-600 dark:text-blue-400" },
                    { label: "Remaining Bulk", value: calc.remaining, cls: calc.over ? "text-rose-600" : "text-[#f58220]" },
                  ].map((s) => (
                    <div key={s.label} className="py-2.5 px-2">
                      <p className="text-[10px] font-bold uppercase text-gray-400">{s.label}</p>
                      <p className={clsx("text-sm font-bold mt-0.5 tabular-nums", s.cls)}>
                        {fmt(s.value)} <span className="text-[10px] text-gray-400">{batchUnit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Packaging rows */}
                <div className="p-4 sm:p-5 space-y-3">
                  {calc.lines.map(({ row, size, options, goodWeight, damagedWeight, error }, i) => {
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

                        {/* Product for this pack size — chosen independently per row */}
                        {size && (
                          <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-100 dark:border-white/5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className={clsx(labelCls, "!mb-0")}>Product</label>
                              <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 p-0.5 text-[11px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => updateRow(row.key, { createNew: false })}
                                  className={clsx("px-2.5 py-1 rounded-md transition-colors cursor-pointer", !row.createNew ? "bg-[#f58220] text-white" : "text-gray-500 hover:text-gray-800 dark:hover:text-white")}
                                >
                                  Use Existing Product
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateRow(row.key, { createNew: true })}
                                  className={clsx("px-2.5 py-1 rounded-md transition-colors cursor-pointer", row.createNew ? "bg-[#f58220] text-white" : "text-gray-500 hover:text-gray-800 dark:hover:text-white")}
                                >
                                  Create New Variant
                                </button>
                              </div>
                            </div>

                            {!row.createNew ? (
                              options.length > 0 ? (
                                <ProductPicker
                                  options={options}
                                  value={row.productId}
                                  onChange={(id) => updateRow(row.key, { productId: id })}
                                  inputCls={inputCls}
                                />
                              ) : (
                                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  No existing {sizeLabel(size)} product found for {baseName}. Use Create New Variant.
                                </p>
                              )
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-5">
                                  <label className={labelCls}>Product Name</label>
                                  <input value={row.newName} onChange={(e) => updateRow(row.key, { newName: e.target.value })} placeholder={`${baseName} ${sizeLabel(size)}`} className={inputCls} />
                                </div>
                                <div className="sm:col-span-4">
                                  <label className={labelCls}>SKU</label>
                                  <input value={row.newSku} onChange={(e) => updateRow(row.key, { newSku: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="FG-XXXX-500G" className={clsx(inputCls, "font-mono")} />
                                </div>
                                <div className="sm:col-span-3">
                                  <label className={labelCls}>Selling Price (₹)</label>
                                  <input
                                    type="number" min="0" step="0.01" inputMode="decimal"
                                    value={row.newPrice || ""}
                                    onChange={(e) => updateRow(row.key, { newPrice: Math.max(0, Number(e.target.value) || 0) })}
                                    placeholder="Required"
                                    className={clsx(inputCls, "tabular-nums")}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
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
                  <div className={clsx(
                    "rounded-xl p-3 text-xs grid grid-cols-3 gap-2 border",
                    calc.over
                      ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20"
                      : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5"
                  )}>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Good weight</p>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(calc.good)} {batchUnit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Damaged weight</p>
                      <p className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">{fmt(calc.damaged)} {batchUnit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Remaining bulk</p>
                      <p className={clsx("font-bold tabular-nums", calc.over ? "text-rose-600" : "text-gray-900 dark:text-white")}>{fmt(calc.remaining)} {batchUnit}</p>
                    </div>
                    {calc.over && (
                      <p className="col-span-3 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> These rows need {fmt(calc.allocated)} {batchUnit}, but only {fmt(available)} {batchUnit} is left in this batch.
                      </p>
                    )}
                  </div>

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
