"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import { clsx } from "clsx";
import { recipesApi, rawMaterialsApi, productsApi, productsFullApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

interface RecipeItem {
  inventoryItemId: string;
  quantityRequired: number | string;
  unit: string;
}

const UNITS = ["KG", "G", "L", "ML", "PCS", "PKT", "BOX", "DOZEN"];

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
  const [deleting, setDeleting] = useState<string | null>(null);
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

  const uniqueCategories = categories.map(c => c.name);

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

  const downloadRecipePDF = (recipe: any) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Please allow pop-ups in your browser to print/download the recipe.");
        return;
      }

      const instructions = (recipe.instructions || "")
        .replace(/\[unitWeight:[\d.]+\]/, "")
        .replace(/\[weightUnit:\w+\]/, "")
        .trim();

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Recipe - ${recipe.name}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; margin: 0; background: #fff; }
              .action-bar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
              .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s; }
              .btn-primary { background: #f97316; color: white; }
              .btn-primary:hover { background: #ea580c; }
              .btn-secondary { background: #f1f5f9; color: #475569; }
              .btn-secondary:hover { background: #e2e8f0; }
              .header { border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
              .title-section h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; text-transform: uppercase; }
              .product { color: #64748b; font-size: 13px; margin-top: 4px; font-weight: 600; }
              .date { font-size: 12px; color: #94a3b8; font-weight: 600; }
              .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
              .stat-box { background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
              .stat-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em; }
              .stat-value { font-size: 18px; font-weight: 800; color: #0f172a; }
              .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #ea580c; margin-bottom: 12px; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; }
              .section-title::after { content: ""; flex: 1; height: 1px; background: #fed7aa; }
              table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 28px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
              th { text-align: left; background: #f8fafc; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; }
              td { padding: 12px 16px; border-top: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #334155; }
              .instructions-box { background: #fffaf5; padding: 20px; border-radius: 12px; border: 1px solid #fed7aa; }
              .instructions-content { white-space: pre-wrap; line-height: 1.6; font-size: 13px; color: #431407; font-weight: 500; }
              @media print {
                .no-print { display: none !important; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <div class="action-bar no-print">
              <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
              <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
            </div>
            <div class="header">
              <div class="title-section">
                <h1>${recipe.name}</h1>
                <div class="product">Finished Product: ${recipe.product?.name || 'N/A'} ${recipe.recipeCode ? `(${recipe.recipeCode})` : ''}</div>
              </div>
              <div class="date">Generated: ${new Date().toLocaleDateString()}</div>
            </div>
            
            <div class="stats">
              <div class="stat-box">
                <div class="stat-label">Yield Output</div>
                <div class="stat-value">${recipe.yieldQty} ${recipe.yieldUnit || 'Units'}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Batch Configuration</div>
                <div class="stat-value">${recipe.batchSize || '1'} ${recipe.yieldUnit || recipe.recipeItems?.[0]?.unit || 'KG'}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Total Components</div>
                <div class="stat-value">${recipe.recipeItems?.length || 0} Materials</div>
              </div>
            </div>

            <div class="section-title">Bill of Materials (Formula)</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ingredient / Raw Material</th>
                  <th style="text-align: center;">Required Quantity</th>
                  <th style="text-align: right;">Unit of Measure</th>
                </tr>
              </thead>
              <tbody>
                ${recipe.recipeItems && recipe.recipeItems.length > 0
                  ? recipe.recipeItems.map((item: any, idx: number) => `
                    <tr>
                      <td style="color: #94a3b8; font-weight: 600; width: 40px;">${idx + 1}</td>
                      <td style="font-weight: 700; color: #1e293b;">${item.inventoryItem?.name || item.name || 'Material'}</td>
                      <td style="text-align: center; font-weight: 700;">${item.quantityRequired}</td>
                      <td style="text-align: right; color: #64748b; font-weight: 600;">${item.unit || 'KG'}</td>
                    </tr>
                  `).join('')
                  : `<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No ingredients added yet</td></tr>`
                }
              </tbody>
            </table>

            <div class="section-title">Production Methodology</div>
            <div class="instructions-box">
              <div class="instructions-content">${instructions || 'Standard production procedures apply.'}</div>
            </div>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      toast.success("Opening printable recipe document...");

      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (e) {
          console.error("Auto print error", e);
        }
      }, 400);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate recipe document.");
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await recipesApi.delete(id);
      toast.success("Recipe deleted");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to delete recipe.");
    } finally {
      setDeleting(null);
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
    <div className="space-y-6">
      {/* ── Summary & Search Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {[
            { label: "Total Recipes", value: recipes.length, color: "text-gray-800", dot: "bg-gray-400" },
            { label: "Total Ingredients", value: recipes.reduce((s, r) => s + (r.recipeItems?.length ?? 0), 0), color: "text-[#f58220]", dot: "bg-[#f58220]" },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center gap-3 shadow-sm">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", stat.dot)} />
              <div>
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className={clsx("text-base font-bold mt-0.5", stat.color)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-[#f58220] transition-colors"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <button
            onClick={fetchAll}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors bg-white shrink-0"
            title="Refresh"
          >
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-3.5 py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm shrink-0"
          >
            <Plus size={14} />
            New Recipe
          </button>
        </div>
      </div>

      {/* ── Recipe List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="w-8 h-8 border-2 border-[#f58220] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium text-gray-500">Loading recipes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <ChefHat size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-800">No Recipes Found</p>
          <p className="text-xs text-gray-500 mt-1">Create your first recipe to define formulas and production yields.</p>
          <button
            onClick={openCreate}
            className="mt-4 flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm"
          >
            <Plus size={14} /> Create Recipe
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(recipe => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div
                key={recipe.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-all shadow-sm"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs shrink-0">
                      {recipe.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-800 truncate">{recipe.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {recipe.product?.name && (
                          <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                            <Package size={12} className="text-[#f58220]" /> {recipe.product.name}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          Yield: {recipe.yieldQty} {recipe.yieldUnit || "units"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {recipe.recipeItems?.length ?? 0} ingredients
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/production?recipeId=${recipe.id}`); }}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-orange-50 text-[#f58220] border border-orange-200 hover:bg-orange-100 transition-colors flex items-center gap-1"
                      title="Start Production"
                    >
                      <Play size={11} fill="currentColor" /> Produce
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); downloadRecipePDF(recipe); }}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(recipe); }}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(recipe.id); }}
                      disabled={deleting === recipe.id}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      {deleting === recipe.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                    <div className="pt-3 grid md:grid-cols-2 gap-4">
                      {/* Bill of Materials */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Bill of Materials</p>
                        <div className="space-y-1.5">
                          {recipe.recipeItems?.length > 0 ? recipe.recipeItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                              <span className="text-xs font-medium text-gray-700">{item.inventoryItem?.name || "Ingredient"}</span>
                              <span className="text-xs font-bold text-gray-800">{item.quantityRequired} {item.unit}</span>
                            </div>
                          )) : (
                            <p className="text-xs text-gray-400 italic">No ingredients defined.</p>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Instructions</p>
                        {recipe.instructions ? (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs text-gray-700 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                            {recipe.instructions.replace(/\[unitWeight:[\d.]+\]/, "").replace(/\[weightUnit:\w+\]/, "").trim()}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No instructions provided.</p>
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
            <label className="text-xs font-semibold text-gray-700">Recipe Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Khakhra Classic Mix"
              className="w-full h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Category</label>
            <select
              value={form.category}
              onChange={(e) => {
                if (e.target.value === "___NEW___") {
                  setIsAddingCategory(true);
                } else {
                  setForm(f => ({ ...f, category: e.target.value }));
                }
              }}
              className="w-full h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all"
            >
              <option value="">Select Category</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="___NEW___">+ Add New Category</option>
            </select>
          </div>

          {form.productId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Shelf Life (Days)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 7"
                value={form.shelfLifeDays ?? ""}
                onChange={e => setForm(f => ({ ...f, shelfLifeDays: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-full h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all"
              />
              <p className="text-[10px] text-gray-400">Batch expiry = Production Date + Shelf Life. Leave blank to use the default (7 days).</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Yield *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={form.yieldQty}
                onChange={e => setForm(f => ({ ...f, yieldQty: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                className="flex-1 h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all"
              />
              <select
                value={form.yieldUnit}
                onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))}
                className="w-24 h-9 bg-white border border-gray-200 px-2 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all cursor-pointer"
              >
                <option value="" disabled>Select...</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Instructions</label>
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
              className="w-full min-h-[5rem] bg-white border border-gray-200 px-3 py-2 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all resize-none placeholder:text-gray-400 overflow-hidden"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">
                Ingredients / Bill of Materials *
              </label>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#f58220] hover:text-[#e8740e] bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg border border-orange-200 transition-colors"
              >
                <Plus size={14} strokeWidth={3} /> Add Ingredient
              </button>
            </div>

            {form.items.length === 0 && (
              <div className="py-8 text-center rounded-lg border border-gray-200 bg-gray-50/50">
                <ChefHat size={24} className="mx-auto text-gray-400 mb-1.5" />
                <p className="text-xs font-semibold text-gray-700">No Ingredients Yet</p>
                <p className="text-xs text-gray-500 mt-0.5">Click &quot;Add Ingredient&quot; above to add materials to this recipe.</p>
              </div>
            )}

            <div id="ingredients-container" className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 space-y-1 min-w-[120px]">
                    <label className="text-xs font-medium text-gray-500">Material</label>
                    <select
                      value={item.inventoryItemId}
                      onChange={e => updateItem(idx, { inventoryItemId: e.target.value })}
                      className="w-full h-8 bg-white border border-gray-200 px-2 rounded text-xs font-medium text-gray-800 outline-none focus:border-[#f58220] cursor-pointer"
                    >
                      <option value="">Select...</option>
                      {materials.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      <option value="___NEW___" className="font-bold text-[#f58220]">+ Add New Material</option>
                    </select>
                  </div>

                  <div className="w-20 space-y-1">
                    <label className="text-xs font-medium text-gray-500">Qty</label>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={item.quantityRequired}
                      onChange={e => updateItem(idx, { quantityRequired: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                      className="w-full h-8 bg-white border border-gray-200 px-2 rounded text-xs font-semibold text-gray-800 outline-none focus:border-[#f58220] text-center"
                    />
                  </div>

                  <div className="w-20 space-y-1">
                    <label className="text-xs font-medium text-gray-500">Unit</label>
                    <select
                      value={item.unit}
                      onChange={e => updateItem(idx, { unit: e.target.value })}
                      className="w-full h-8 bg-white border border-gray-200 px-2 rounded text-xs font-medium text-gray-800 uppercase outline-none focus:border-[#f58220] cursor-pointer"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  <button
                    onClick={() => removeItem(idx)}
                    className="p-2 mb-[1px] text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 font-semibold text-gray-500 hover:text-gray-700 text-xs rounded-lg hover:bg-gray-100 transition-colors"
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
            <label className="text-xs font-semibold text-gray-700">Category Name *</label>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Beverages"
              autoFocus
              className="w-full h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400"
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
            <label className="text-xs font-semibold text-gray-700">Material Name *</label>
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
              <div key={item.id} className="space-y-3 pt-1 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="space-y-1.5">
                  {materialList.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setMaterialList(prev => prev.filter(m => m.id !== item.id))}
                        className="text-gray-400 hover:text-red-500 text-xs transition-colors"
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
                    className="w-full h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">Unit</label>
                  <select
                    value={item.unit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMaterialList(prev => prev.map(m => m.id === item.id ? { ...m, unit: val } : m));
                    }}
                    className="w-full h-9 bg-white border border-gray-200 px-3 rounded-lg font-medium text-xs text-gray-800 uppercase outline-none focus:border-[#f58220] transition-all"
                  >
                    <option value="kg">KG</option>
                    <option value="g">G</option>
                    <option value="L">L</option>
                    <option value="ml">ML</option>
                    <option value="units">UNITS</option>
                    <option value="pcs">PCS</option>
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

    </div>
  );
}
