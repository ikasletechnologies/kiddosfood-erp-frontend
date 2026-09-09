"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ChefHat,
  Package,
  Search,
  Check,
  AlertTriangle,
  Play,
  Download,
  ChevronDown,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import { clsx } from "clsx";
import { recipesApi, rawMaterialsApi, productsApi, productsFullApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { RECIPE_UNITS as UNITS } from "@/lib/recipe-units";
import { exportRecipeToPdf } from "@/lib/recipe-export";

interface RecipeItem {
  inventoryItemId: string;
  quantityRequired: number | string;
  unit: string;
}

const emptyForm = {
  recipeCode: "",
  category: "",
  name: "",
  productId: "",
  shelfLifeDays: null as number | null,
  yieldQty: 1,
  yieldUnit: "",
  instructions: "",
  estimatedDurationMinutes: null as number | null,
  items: [] as RecipeItem[],
};

export default function RecipeMasterTab() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [materialRowIdx, setMaterialRowIdx] = useState<number | null>(null);
  const [materialList, setMaterialList] = useState<{ id: string; name: string; unit: string }[]>([{ id: "1", name: "", unit: "kg" }]);
  const [savingMaterial, setSavingMaterial] = useState(false);

  const [openMaterialIdx, setOpenMaterialIdx] = useState<number | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialDropdownPos, setMaterialDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryDropdownPos, setCategoryDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (openMaterialIdx === null && !isCategoryDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest('.material-selector-container')) return;
      if (target.closest('.category-selector-container')) return;
      setOpenMaterialIdx(null);
      setIsCategoryDropdownOpen(false);
    };
    // Any scroll of an ancestor (the ingredients list, the modal body) would
    // leave the portal's fixed-position dropdown pointing at stale
    // coordinates, so just close it rather than tracking scroll deltas.
    // Scrolling inside the dropdown's own results list also fires this (the
    // capture-phase listener sees it too) — that must NOT close it.
    const handleScroll = (event: Event) => {
      const target = event.target as Element;
      if (target?.closest?.('.material-selector-container')) return;
      if (target?.closest?.('.category-selector-container')) return;
      setOpenMaterialIdx(null);
      setIsCategoryDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openMaterialIdx, isCategoryDropdownOpen]);

  const uniqueCategories = categories.map(c => c.name);

  // Anchors a search dropdown beside its trigger instead of below it —
  // opening below pushed the panel into the footer/next rows and got
  // clipped by the scrollable ingredients list. Aligns the dropdown's right
  // edge with the trigger's right edge (opening leftward over the row)
  // rather than the trigger's left edge, so it stays inside the modal
  // instead of spilling past its right border into the backdrop.
  const computeSideDropdownPos = (rect: DOMRect) => {
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 360;
    const dropdownWidth = Math.min(Math.max(rect.width, 240), Math.max(200, screenWidth - 24));
    let left = rect.right - dropdownWidth;
    if (left < 8) left = Math.max(8, rect.left);
    if (left + dropdownWidth > screenWidth - 8) {
      left = Math.max(8, screenWidth - dropdownWidth - 8);
    }

    const estimatedHeight = 280;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;
    let top = rect.top - 6;
    if (top + estimatedHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - estimatedHeight - 8);
    }
    return { top, left, width: dropdownWidth };
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, mRes, pRes, cRes] = await Promise.all([
        recipesApi.getAll(),
        rawMaterialsApi.getAll(false, undefined, 'FINISHED_GOOD'),
        productsApi.getAll(),
        recipesApi.getCategories()
      ]);
      setRecipes(rRes.data ?? []);
      setMaterials(mRes.data ?? []);
      setProducts(pRes.data ?? []);
      setCategories(cRes.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setIsAddingCategory(false);
    setForm({ ...emptyForm });
    setEditingId(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (recipe: any) => {
    setIsAddingCategory(false);
    setForm({
      recipeCode: recipe.recipeCode ?? "",
      category: recipe.category ?? "",
      name: recipe.name ?? "",
      productId: recipe.productId ?? "",
      shelfLifeDays: products.find((p: any) => p.id === recipe.productId)?.shelfLifeDays ?? null,
      yieldQty: recipe.yieldQty ?? 1,
      yieldUnit: recipe.yieldUnit ?? "",
      instructions: recipe.instructions ?? "",
      estimatedDurationMinutes: recipe.estimatedDurationMinutes ?? null,
      items: (recipe.recipeItems ?? []).map((i: any) => ({
        inventoryItemId: i.inventoryItemId,
        quantityRequired: i.quantityRequired,
        unit: i.unit,
      })),
    });
    setEditingId(recipe.id);
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Recipe name is required."); return; }
    if (!form.yieldUnit) { setError("Select the recipe's yield unit (e.g. KG, L, PCS)."); return; }
    if (form.items.length === 0) { setError("Add at least one ingredient."); return; }
    if (form.items.some(item => !item.inventoryItemId)) {
      setError("Please select a material for all ingredients.");
      return;
    }
    if (form.items.some(item => !item.quantityRequired || Number(item.quantityRequired) <= 0)) {
      setError("Please specify a valid quantity greater than 0 for all ingredients.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await recipesApi.upsert({
        ...(editingId ? { id: editingId } : {}),
        recipeCode: form.recipeCode || undefined,
        category: form.category || undefined,
        name: form.name,
        productId: form.productId || undefined,
        yieldQty: form.yieldQty,
        yieldUnit: form.yieldUnit,
        instructions: form.instructions || undefined,
        estimatedDurationMinutes: form.estimatedDurationMinutes,
        items: form.items,
      });
      // Shelf life lives on the linked Product master (batch expiry is
      // computed from it there), not on the recipe row itself.
      if (form.productId) {
        await productsFullApi.update(form.productId, { shelfLifeDays: form.shelfLifeDays });
      }
      toast.success(editingId ? "Recipe updated" : "Recipe created");
      setShowForm(false);
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to save recipe.");
    } finally {
      setSaving(false);
    }
  };

  const downloadRecipePDF = async (recipe: any) => {
    if (downloadingId) return;
    try {
      setDownloadingId(recipe.id);
      let fullRecipe = recipe;
      if (recipe.id && (!recipe.recipeItems || recipe.recipeItems.length === 0)) {
        try {
          const res = await recipesApi.getById(recipe.id);
          if (res.data) fullRecipe = res.data;
        } catch (e) {
          // fallback to recipe
        }
      }

      await exportRecipeToPdf(fullRecipe);
      toast.success(`Downloaded recipe: ${recipe.name}`);
    } catch (err: any) {
      console.error("Failed to export recipe PDF", err);
      toast.error(err?.message || "Failed to download recipe PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const res = await recipesApi.createCategory(newCategoryName.trim());
      await fetchAll();
      setForm(prev => ({ ...prev, category: res.data.name }));
      setIsAddingCategory(false);
      setNewCategoryName("");
      toast.success("Category created");
    } catch (e) {
      console.error(e);
      toast.error("Failed to create category. It might already exist.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateMaterial = async () => {
    const validMaterials = materialList.filter(m => m.name.trim());
    if (validMaterials.length === 0) return;
    setSavingMaterial(true);
    try {
      let lastRes: any = null;
      for (const mat of validMaterials) {
        lastRes = await rawMaterialsApi.create({
          name: mat.name.trim(),
          unit: mat.unit,
          costPrice: 0
        });
      }
      await fetchAll();

      if (materialRowIdx !== null && lastRes) {
        setForm(f => {
          const newItems = [...f.items];
          newItems[materialRowIdx].inventoryItemId = lastRes.data.id;
          return { ...f, items: newItems };
        });
      }
      setIsAddingMaterial(false);
      setMaterialList([{ id: "1", name: "", unit: "kg" }]);
      setMaterialRowIdx(null);
      toast.success(validMaterials.length > 1 ? "Materials created" : "Material created");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error ?? "Failed to create material");
    } finally {
      setSavingMaterial(false);
    }
  };

  const handleDeleteClick = (recipe: any) => {
    setRecipeToDelete(recipe);
  };

  const confirmDeleteRecipe = async () => {
    if (!recipeToDelete) return;
    setIsDeleting(true);
    try {
      await recipesApi.delete(recipeToDelete.id);
      toast.success("Recipe deleted successfully");
      setRecipeToDelete(null);
      fetchAll();
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || "Failed to delete recipe.";
      toast.error(errMsg);
      if (errMsg.toLowerCase().includes("production") || errMsg.toLowerCase().includes("referenced")) {
        setRecipeToDelete((prev: any) => prev ? {
          ...prev,
          isUsedInProduction: true,
          productionCount: Math.max(1, prev.productionCount || 1)
        } : null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { inventoryItemId: "", quantityRequired: "", unit: "KG" }],
    }));
    setTimeout(() => {
      const el = document.getElementById('ingredients-container');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  };

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, patch: Partial<RecipeItem>) => {
    if (patch.inventoryItemId === "___NEW___") {
      setMaterialRowIdx(idx);
      setMaterialList([{ id: "1", name: "", unit: "kg" }]);
      setIsAddingMaterial(true);
      return;
    }
    setForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, ...patch } : item),
    }));
  };

  const filtered = recipes.filter(r =>
    !search ||
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6 text-gray-800 dark:text-slate-100 w-full min-w-0">
      {/* ── Top Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 w-full min-w-0">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5 sm:gap-3 flex-1 w-full min-w-0 max-w-md">
          {[
            { label: "Total Recipes", value: recipes.length, color: "text-gray-800 dark:text-white", dot: "bg-gray-400" },
            { label: "Bulk Formulas", value: recipes.filter(r => !r.productId).length, color: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 px-3 sm:px-4 py-2.5 flex items-center gap-2.5 sm:gap-3 shadow-sm min-w-0">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", stat.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium truncate" title={stat.label}>{stat.label}</p>
                <p className={clsx("text-sm sm:text-base font-bold mt-0.5", stat.color)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg text-xs font-medium outline-none focus:border-[#f58220] transition-colors placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchAll}
              className="p-2 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400 transition-colors bg-white dark:bg-white/5 shrink-0"
              title="Refresh"
            >
              <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
            </button>
            <button
              onClick={openCreate}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-3.5 py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} />
              <span>New Recipe</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Recipe List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5">
          <div className="w-8 h-8 border-2 border-[#f58220] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Loading recipes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-500 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white">No Recipes Found</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Create your first recipe to define formulas and production yields.</p>
          <button
            onClick={openCreate}
            className="mt-4 flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm"
          >
            <Plus size={14} /> Create Recipe
          </button>
        </div>
      ) : (
        <div className="grid gap-3 w-full min-w-0">
          {filtered.map(recipe => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div
                key={recipe.id}
                className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden hover:border-gray-300 dark:hover:border-white/10 transition-all shadow-sm w-full min-w-0"
              >
                <div
                  className="p-3.5 sm:p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors space-y-3 md:space-y-0 md:flex md:items-center md:justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  {/* Left Side: Avatar + Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-slate-200 font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                      {recipe.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate" title={recipe.name}>
                        {recipe.name}
                      </h3>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
                        {recipe.product?.name && (
                          <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 font-medium bg-gray-100/70 dark:bg-white/5 px-2 py-0.5 rounded">
                            <Package size={12} className="text-[#f58220] shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{recipe.product.name}</span>
                          </span>
                        )}
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded border border-green-200 dark:border-green-500/20 shrink-0">
                          Yield: {recipe.yieldQty} {recipe.yieldUnit || "units"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">
                          {recipe.recipeItems?.length ?? 0} ingredients
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Actions (Stacked on mobile, inline on desktop) */}
                  <div className="flex items-center justify-between md:justify-end gap-2 pt-2.5 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-white/5 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/production?recipeId=${recipe.id}`); }}
                      className="flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-500/10 text-[#f58220] border border-orange-200 dark:border-orange-500/20 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-1.5"
                      title="Start Production"
                    >
                      <Play size={11} fill="currentColor" /> Produce
                    </button>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); downloadRecipePDF(recipe); }}
                        disabled={downloadingId === recipe.id}
                        className="p-2 md:p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloadingId === recipe.id ? <RefreshCw size={14} className="animate-spin text-orange-500" /> : <Download size={14} />}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(recipe); }}
                        className="p-2 md:p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteClick(recipe); }}
                        className="p-2 md:p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-white/5">
                    <div className="pt-3 grid md:grid-cols-2 gap-4">
                      {/* Bill of Materials */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Bill of Materials</p>
                        <div className="space-y-1.5">
                          {recipe.recipeItems?.length > 0 ? recipe.recipeItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-gray-200 dark:border-white/5">
                              <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{item.inventoryItem?.name || "Ingredient"}</span>
                              <span className="text-xs font-bold text-gray-800 dark:text-white">{item.quantityRequired} {item.unit}</span>
                            </div>
                          )) : (
                            <p className="text-xs text-gray-400 dark:text-slate-500 italic">No ingredients defined.</p>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Instructions</p>
                        {recipe.instructions ? (
                          <div className="bg-gray-50 dark:bg-white/[0.02] p-3 rounded-lg border border-gray-200 dark:border-white/5 text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                            {recipe.instructions.replace(/\[unitWeight:[\d.]+\]/, "").replace(/\[weightUnit:\w+\]/, "").trim()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-slate-500 italic">No instructions provided.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? `Edit Recipe${form.recipeCode ? ` — ${form.recipeCode}` : ""}` : "New Recipe"}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Recipe Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Khakhra Classic Mix"
              className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5 relative category-selector-container">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Category</label>
            <div
              onClick={(e) => {
                if (isCategoryDropdownOpen) {
                  setIsCategoryDropdownOpen(false);
                  return;
                }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setCategoryDropdownPos(computeSideDropdownPos(rect));
                setIsCategoryDropdownOpen(true);
                setCategorySearchQuery("");
              }}
              className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all cursor-pointer flex items-center justify-between gap-1"
            >
              <span className={clsx("truncate", !form.category && "text-gray-400 dark:text-slate-500 font-normal")}>
                {form.category || "Select Category"}
              </span>
              <ChevronDown size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
            </div>

            {isCategoryDropdownOpen && categoryDropdownPos && typeof document !== "undefined" && createPortal(
              <div
                className="category-selector-container fixed z-[999] min-w-[220px] bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden"
                style={{ top: categoryDropdownPos.top, left: categoryDropdownPos.left, width: categoryDropdownPos.width }}
              >
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 dark:border-white/5">
                  <Search size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={categorySearchQuery}
                    onChange={e => setCategorySearchQuery(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="Search category..."
                    className="w-full text-xs outline-none py-0.5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 bg-transparent"
                  />
            {categorySearchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setCategorySearchQuery("")} 
              />
            )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {uniqueCategories.filter(c => c.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())).length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-400 dark:text-slate-500 text-center">No categories found</div>
                  ) : (
                    uniqueCategories
                      .filter(c => c.toLowerCase().includes(categorySearchQuery.trim().toLowerCase()))
                      .map(c => (
                        <div
                          key={c}
                          onClick={e => {
                            e.stopPropagation();
                            setForm(f => ({ ...f, category: c }));
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={clsx(
                            "px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-orange-50 dark:hover:bg-white/5 truncate",
                            form.category === c ? "bg-orange-50 dark:bg-orange-500/10 text-[#f58220] font-bold" : "text-gray-700 dark:text-slate-300"
                          )}
                        >
                          {c}
                        </div>
                      ))
                  )}
                </div>
                <div
                  onClick={e => {
                    e.stopPropagation();
                    setIsAddingCategory(true);
                    setIsCategoryDropdownOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-bold text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 cursor-pointer border-t border-gray-100 dark:border-white/5 flex items-center gap-1.5"
                >
                  <Plus size={12} /> Add New Category
                </div>
              </div>,
              document.body
            )}
          </div>

          {form.productId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Shelf Life (Days)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 7"
                value={form.shelfLifeDays ?? ""}
                onChange={e => setForm(f => ({ ...f, shelfLifeDays: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-500">Batch expiry = Production Date + Shelf Life. Leave blank to use the default (7 days).</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Yield *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={form.yieldQty}
                onChange={e => setForm(f => ({ ...f, yieldQty: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                className="flex-1 h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all"
              />
              <select
                value={form.yieldUnit}
                onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))}
                className="w-24 h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-2 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all cursor-pointer"
              >
                <option value="" disabled className="dark:bg-card">Select...</option>
                {UNITS.map(u => <option key={u} value={u} className="dark:bg-card">{u}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Instructions</label>
            <textarea
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              rows={2}
              placeholder="Step-by-step production instructions..."
              className="w-full min-h-[5rem] bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500 overflow-hidden"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Ingredients / Bill of Materials *
              </label>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#f58220] hover:text-[#e8740e] bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-500/20 transition-colors"
              >
                <Plus size={14} strokeWidth={3} /> Add Ingredient
              </button>
            </div>

            {form.items.length === 0 && (
              <div className="py-8 text-center rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                <ChefHat size={24} className="mx-auto text-gray-400 dark:text-slate-500 mb-1.5" />
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">No Ingredients Yet</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Click &quot;Add Ingredient&quot; above to add materials to this recipe.</p>
              </div>
            )}

            <div id="ingredients-container" className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-end gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-gray-200 dark:border-white/5">
                  <div className="w-full sm:flex-1 space-y-1 min-w-0 relative material-selector-container">
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Material</label>
                    <div
                      onClick={(e) => {
                        if (openMaterialIdx === idx) {
                          setOpenMaterialIdx(null);
                          return;
                        }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMaterialDropdownPos(computeSideDropdownPos(rect));
                        setOpenMaterialIdx(idx);
                        setMaterialSearchQuery("");
                      }}
                      className="w-full h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-2 rounded text-xs font-medium text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer flex items-center justify-between gap-1"
                    >
                      <span className={clsx("truncate", !item.inventoryItemId && "text-gray-400 dark:text-slate-500 font-normal")}>
                        {materials.find((m: any) => m.id === item.inventoryItemId)?.name || "Select..."}
                      </span>
                      <ChevronDown size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
                    </div>

                    {openMaterialIdx === idx && materialDropdownPos && typeof document !== "undefined" && createPortal(
                      <div
                        className="material-selector-container fixed z-[999] min-w-[220px] bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden"
                        style={{ top: materialDropdownPos.top, left: materialDropdownPos.left, width: materialDropdownPos.width }}
                      >
                        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 dark:border-white/5">
                          <Search size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
                          <input
                            autoFocus
                            type="text"
                            value={materialSearchQuery}
                            onChange={e => setMaterialSearchQuery(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Search material..."
                            className="w-full text-xs outline-none py-0.5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 bg-transparent"
                          />
            {materialSearchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setMaterialSearchQuery("")} 
              />
            )}
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {materials.filter((m: any) => m.name.toLowerCase().includes(materialSearchQuery.trim().toLowerCase())).length === 0 ? (
                            <div className="px-3 py-3 text-xs text-gray-400 dark:text-slate-500 text-center">No materials found</div>
                          ) : (
                            materials
                              .filter((m: any) => m.name.toLowerCase().includes(materialSearchQuery.trim().toLowerCase()))
                              .map((m: any) => (
                                <div
                                  key={m.id}
                                  onClick={e => {
                                    e.stopPropagation();
                                    updateItem(idx, { inventoryItemId: m.id });
                                    setOpenMaterialIdx(null);
                                  }}
                                  className={clsx(
                                    "px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-orange-50 dark:hover:bg-white/5 truncate",
                                    item.inventoryItemId === m.id ? "bg-orange-50 dark:bg-orange-500/10 text-[#f58220] font-bold" : "text-gray-700 dark:text-slate-300"
                                  )}
                                >
                                  {m.name}
                                </div>
                              ))
                          )}
                        </div>
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            updateItem(idx, { inventoryItemId: "___NEW___" });
                            setOpenMaterialIdx(null);
                          }}
                          className="px-3 py-2 text-xs font-bold text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 cursor-pointer border-t border-gray-100 dark:border-white/5 flex items-center gap-1.5"
                        >
                          <Plus size={12} /> Add New Material
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>

                  <div className="flex-1 sm:w-20 sm:flex-initial space-y-1 min-w-[70px]">
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Qty</label>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={item.quantityRequired}
                      onChange={e => updateItem(idx, { quantityRequired: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                      className="w-full h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-2 rounded text-xs font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220] text-center"
                    />
                  </div>

                  <div className="flex-1 sm:w-20 sm:flex-initial space-y-1 min-w-[70px]">
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Unit</label>
                    <select
                      value={item.unit}
                      onChange={e => updateItem(idx, { unit: e.target.value })}
                      className="w-full h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-2 rounded text-xs font-medium text-gray-800 dark:text-white uppercase outline-none focus:border-[#f58220] cursor-pointer"
                    >
                      {UNITS.map(u => <option key={u} value={u} className="dark:bg-card">{u}</option>)}
                    </select>
                  </div>

                  <button
                    onClick={() => removeItem(idx)}
                    className="p-2 mb-[1px] text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-white/10 rounded transition-colors shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-rose-500/10 rounded-lg border border-red-200 dark:border-rose-500/20">
              <AlertTriangle size={15} className="text-red-500 dark:text-rose-400 shrink-0" />
              <p className="text-xs font-semibold text-red-600 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#f58220] hover:bg-[#e8740e] text-white px-5 py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
            >
              {saving ? "Saving..." : <><Check size={14} strokeWidth={3} /> {editingId ? "Update Recipe" : "Create Recipe"}</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Category Creation SlideOver */}
      <SlideOver
        isOpen={isAddingCategory}
        onClose={() => {
          setIsAddingCategory(false);
          setNewCategoryName("");
          if (form.category === "") {
            setForm(prev => ({ ...prev, category: "" }));
          }
        }}
        title="Add New Category"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Category Name *</label>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Beverages"
              autoFocus
              className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={handleCreateCategory}
            disabled={savingCategory || !newCategoryName.trim()}
            className="w-full bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingCategory ? "Saving..." : "Create Category"}
          </button>
        </div>
      </SlideOver>

      {/* Material Creation SlideOver */}
      <SlideOver
        isOpen={isAddingMaterial}
        onClose={() => {
          setIsAddingMaterial(false);
          setMaterialList([{ id: "1", name: "", unit: "kg" }]);
          setMaterialRowIdx(null);
        }}
        title="Add New Material"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Material Name *</label>
            <button
              type="button"
              onClick={() => setMaterialList(prev => [...prev, { id: Math.random().toString(36).slice(2), name: "", unit: "kg" }])}
              className="text-xs font-bold text-[#f58220] hover:text-[#e8740e] flex items-center gap-1 transition-colors"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          <div className="space-y-4">
            {materialList.map((item, idx) => (
              <div key={item.id} className="space-y-3 pt-1 pb-3 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
                <div className="space-y-1.5">
                  {materialList.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Item #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setMaterialList(prev => prev.filter(m => m.id !== item.id))}
                        className="text-gray-400 dark:text-slate-500 hover:text-red-500 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <input
                    value={item.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMaterialList(prev => prev.map(m => m.id === item.id ? { ...m, name: val } : m));
                    }}
                    placeholder="e.g. Black Grams"
                    autoFocus={idx === 0}
                    className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Unit</label>
                  <select
                    value={item.unit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMaterialList(prev => prev.map(m => m.id === item.id ? { ...m, unit: val } : m));
                    }}
                    className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white uppercase outline-none focus:border-[#f58220] transition-all"
                  >
                    <option value="kg" className="dark:bg-card">KG</option>
                    <option value="g" className="dark:bg-card">G</option>
                    <option value="L" className="dark:bg-card">L</option>
                    <option value="ml" className="dark:bg-card">ML</option>
                    <option value="units" className="dark:bg-card">UNITS</option>
                    <option value="pcs" className="dark:bg-card">PCS</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleCreateMaterial}
            disabled={savingMaterial || !materialList.some(m => m.name.trim())}
            className="w-full bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingMaterial ? "Saving..." : "Create Material"}
          </button>
        </div>
      </SlideOver>

      {/* ── Delete Confirmation / Protection Modal ── */}
      <Modal
        isOpen={!!recipeToDelete}
        onClose={() => {
          if (!isDeleting) setRecipeToDelete(null);
        }}
        title="Delete Recipe"
        size="sm"
      >
        {recipeToDelete && (
          <div className="space-y-4">
            {recipeToDelete.isUsedInProduction || (recipeToDelete.productionCount || 0) > 0 ? (
              // PROTECTED: Recipe is used in production
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                  <AlertTriangle className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" size={18} />
                  <div>
                    <p className="font-bold text-sm text-amber-900 dark:text-amber-200 mb-1">
                      Recipe Cannot Be Deleted
                    </p>
                    <p>
                      This recipe cannot be deleted because it is already used in production ({recipeToDelete.productionCount || 1} production record{recipeToDelete.productionCount !== 1 ? "s" : ""}).
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Recipe Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{recipeToDelete.name}</span>
                  </div>
                  {recipeToDelete.product?.name && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Finished Product</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{recipeToDelete.product.name}</span>
                    </div>
                  )}
                  {recipeToDelete.recipeCode && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Recipe Code</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{recipeToDelete.recipeCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Production Usage</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {recipeToDelete.productionCount || 1} Batch / Run Record(s)
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  To preserve manufacturing audit trails, batch traceability, and inventory cost records, recipes linked to production history cannot be removed.
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRecipeToDelete(null)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              // DELETABLE: Recipe has not been used in production
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Deletion</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Are you sure you want to delete this recipe? This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Recipe Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{recipeToDelete.name}</span>
                  </div>
                  {recipeToDelete.product?.name && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Product</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{recipeToDelete.product.name}</span>
                    </div>
                  )}
                  {recipeToDelete.recipeCode && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Recipe Code</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{recipeToDelete.recipeCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Formula Components</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {recipeToDelete.recipeItems?.length || 0} ingredient(s)
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipeToDelete(null)}
                    disabled={isDeleting}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteRecipe}
                    disabled={isDeleting}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>Delete Recipe</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
}
