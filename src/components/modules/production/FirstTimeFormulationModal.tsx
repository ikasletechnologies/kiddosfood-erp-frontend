"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import RecipeExpensesEditor from "./RecipeExpensesEditor";
import { productionApi, rawMaterialsApi, recipesApi } from "@/lib/api";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_RECIPE_EXPENSES,
  RecipeExpenseDraft,
  draftsFrom,
  expensesPayloadFrom,
} from "@/lib/recipe-expenses";
import { entryUnitsFor } from "@/lib/qty-display";
import { MANUAL_INGREDIENT_UNITS, MANUAL_YIELD_UNITS, validateReference } from "@/lib/manual-recipe";

type Product = { id: string; name: string; sku?: string | null; packSize?: { quantity?: number; unit?: string } | null };
type Row = { inventoryItemId: string; quantity: string; unit: string };

export default function FirstTimeFormulationModal({
  product,
  isOpen,
  onClose,
  onSaved,
  variantProductIds = [],
}: {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (recipe: any) => void;
  variantProductIds?: string[];
}) {
  const [categories, setCategories] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<RecipeExpenseDraft[]>(() => draftsFrom(DEFAULT_RECIPE_EXPENSES, DEFAULT_CATEGORIES));
  const [category, setCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [yieldQty, setYieldQty] = useState("");
  const [yieldUnit, setYieldUnit] = useState("KG");
  const [instructions, setInstructions] = useState("");
  const [rows, setRows] = useState<Row[]>([{ inventoryItemId: "", quantity: "", unit: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setCategory(""); setAddingCategory(false); setNewCategory(""); setYieldQty(""); setYieldUnit("KG"); setInstructions("");
    setRows([{ inventoryItemId: "", quantity: "", unit: "" }]); setError("");
    Promise.all([recipesApi.getCategories(), rawMaterialsApi.getAll(false, undefined, "FINISHED_GOOD"), productionApi.getCostingSettings()])
      .then(([c, m, settings]) => {
        setCategories(c.data || []);
        setMaterials((m.data || []).filter((x: any) => x.isActive !== false && String(x.category || "").toUpperCase() !== "FINISHED_GOOD"));
        const configured = settings.data?.categories?.length ? settings.data.categories : DEFAULT_CATEGORIES;
        setExpenses(draftsFrom(settings.data?.defaultExpenses || DEFAULT_RECIPE_EXPENSES, configured));
      })
      .catch(() => setError("Could not load recipe setup options."));
  }, [isOpen]);

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const materialNameCounts = useMemo(() => materials.reduce((counts: Record<string, number>, material: any) => {
    const key = String(material.name || "").trim().toLocaleLowerCase("en-IN");
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {}), [materials]);
  const allowedIngredientUnits = (stockUnit: string) => entryUnitsFor(stockUnit)
    .map((unit) => unit.toUpperCase())
    .filter((unit, index, all) => MANUAL_INGREDIENT_UNITS.includes(unit) && all.indexOf(unit) === index);
  const updateRow = (index: number, patch: Partial<Row>) => setRows((all) => all.map((r, i) => i === index ? { ...r, ...patch } : r));
  const chooseMaterial = (index: number, id: string) => {
    const material = materialById.get(id) as any;
    const units = allowedIngredientUnits(String(material?.unit || "").toUpperCase());
    if (material && units.length === 0) setError(`${material.name} is stocked in ${material.unit}; configure a supported KG, G, L, ML, PCS or BOX stock unit before using it.`);
    else setError("");
    updateRow(index, { inventoryItemId: id, unit: units[0] || "" });
  };

  const createCategory = async () => {
    const clean = newCategory.trim();
    if (!clean) return setError("Category name is required.");
    const duplicate = categories.find((item) => String(item.name || "").trim().toLocaleLowerCase("en-IN") === clean.toLocaleLowerCase("en-IN"));
    if (duplicate) { setCategory(duplicate.name); setError(`Recipe category "${duplicate.name}" already exists.`); return; }
    setSavingCategory(true); setError("");
    try {
      const response = await recipesApi.createCategory(clean);
      setCategories((current) => [...current, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategory(response.data.name);
      setNewCategory("");
      setAddingCategory(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not create recipe category.");
    } finally { setSavingCategory(false); }
  };

  const save = async () => {
    if (!product) return;
    if (!category) return setError("Select a recipe category.");
    const y = Number(yieldQty);
    if (!Number.isFinite(y) || y <= 0) return setError("Reference yield must be greater than zero.");
    if (!rows.length || rows.some((r) => !r.inventoryItemId || !Number.isFinite(Number(r.quantity)) || Number(r.quantity) <= 0)) return setError("Select every ingredient and enter a quantity greater than zero.");
    if (new Set(rows.map((r) => r.inventoryItemId)).size !== rows.length) return setError("Each ingredient can only be added once.");
    const referenceError = validateReference({ yieldQty, yieldUnit, items: rows }, materials);
    if (referenceError) return setError(referenceError);
    const expenseCheck = expensesPayloadFrom(expenses);
    if (expenseCheck.error) return setError(expenseCheck.error);
    setSaving(true); setError("");
    try {
      // The product unique key makes retries resolve to the same recipe rather than
      // creating a second source of truth. If a previous attempt created only the
      // master, reuse it and finish its formulation.
      let recipe: any;
      try {
        recipe = (await recipesApi.getByProduct(product.id)).data;
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
      }
      if (!recipe) {
        recipe = (await recipesApi.upsert({
          name: product.name,
          productId: product.id,
          category,
          instructions: instructions || undefined,
          ingredientIds: rows.map((r) => r.inventoryItemId),
          additionalExpenses: expenseCheck.payload,
        })).data;
      } else {
        recipe = (await recipesApi.upsert({
          id: recipe.id,
          name: recipe.name || product.name,
          productId: product.id,
          category,
          instructions: instructions || undefined,
          ingredientIds: rows.map((r) => r.inventoryItemId),
          additionalExpenses: expenseCheck.payload,
        })).data;
      }
      await recipesApi.linkProducts(recipe.id, variantProductIds.length ? variantProductIds : [product.id]);
      await recipesApi.saveFormulation(recipe.id, {
        yieldQty: y,
        yieldUnit,
        items: rows.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity), unit: r.unit })),
      });
      onSaved((await recipesApi.getById(recipe.id)).data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not save the recipe formulation.");
    } finally { setSaving(false); }
  };

  return <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Create Recipe Formulation" size="xl">
    <div className="space-y-5">
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/20 dark:bg-orange-500/10">
        <p className="text-xs font-bold text-gray-900 dark:text-white">{product?.name}</p>
        <p className="text-[11px] text-gray-500">SKU: {product?.sku || "Not set"} · Product is locked for this formulation</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 text-xs font-semibold">
          <div className="flex items-center justify-between"><label htmlFor="recipe-category">Recipe Category</label><button type="button" onClick={() => { setAddingCategory((value) => !value); setError(""); }} className="font-bold text-[#f58220]">+ Add Category</button></div>
          <select id="recipe-category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 dark:border-white/10 dark:bg-[#13151f]">
            <option value="">Select category</option>{categories.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </select>
          {addingCategory && <div className="flex gap-2 pt-1"><input autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCategory(); } }} placeholder="New category name" className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-white/10 dark:bg-[#13151f]" /><button type="button" onClick={createCategory} disabled={savingCategory} className="rounded-lg bg-[#f58220] px-3 text-xs font-bold text-white disabled:opacity-50">{savingCategory ? "Saving…" : "Save"}</button></div>}
        </div>
        <label className="space-y-1 text-xs font-semibold">Reference Yield
          <span className="mt-1 flex gap-2"><input type="number" min="0" step="any" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} placeholder="Quantity" className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 dark:border-white/10 dark:bg-[#13151f]" />
            <select value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 dark:border-white/10 dark:bg-[#13151f]">{MANUAL_YIELD_UNITS.map((u) => <option key={u}>{u}</option>)}</select></span>
        </label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><p className="text-xs font-bold">Ingredients</p><button type="button" onClick={() => setRows((r) => [...r, { inventoryItemId: "", quantity: "", unit: "" }])} className="flex items-center gap-1 text-xs font-bold text-[#f58220]"><Plus size={13} /> Add Ingredient</button></div>
        {rows.map((row, index) => {
          const material = materialById.get(row.inventoryItemId) as any; return <div key={index} className="grid grid-cols-[minmax(0,1fr)_100px_74px_30px] gap-2">
            <select value={row.inventoryItemId} onChange={(e) => chooseMaterial(index, e.target.value)} className="h-9 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-[#13151f]"><option value="">Select raw material</option>{materials.map((m) => { const duplicate = materialNameCounts[String(m.name || "").trim().toLocaleLowerCase("en-IN")] > 1; return <option key={m.id} value={m.id}>{m.name}{duplicate ? ` · ${m.sku || m.id.slice(-6)}` : ""}</option>; })}</select>
            <input type="number" min="0" step="any" value={row.quantity} onChange={(e) => updateRow(index, { quantity: e.target.value })} placeholder="Qty" className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-[#13151f]" />
            <select value={row.unit} onChange={(e) => updateRow(index, { unit: e.target.value })} disabled={!material} className="h-9 rounded-lg border border-gray-200 bg-white px-1 text-xs dark:border-white/10 dark:bg-[#13151f]">{MANUAL_INGREDIENT_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <button type="button" aria-label="Remove ingredient" onClick={() => setRows((r) => r.filter((_, i) => i !== index))} disabled={rows.length === 1} className="text-gray-400 disabled:opacity-30"><Trash2 size={15} /></button>
          </div>;
        })}
      </div>
      <div><p className="mb-2 text-xs font-bold">Additional Expenses</p><RecipeExpensesEditor value={expenses} onChange={setExpenses} /></div>
      <label className="block space-y-1 text-xs font-semibold">Cooking Instructions (optional)<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-[#13151f]" /></label>
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold dark:bg-white/10">Cancel</button><button type="button" onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#f58220] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving && <RefreshCw size={13} className="animate-spin" />} Save Formulation</button></div>
    </div>
  </Modal>;
}
