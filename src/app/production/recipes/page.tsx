"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  ChefHat,
  Package,
  Search,
  Minus,
  Check,
  AlertTriangle,
  Play,
  Download,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import { clsx } from "clsx";
import { recipesApi, rawMaterialsApi, productsApi } from "@/lib/api";
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
  yieldQty: 1,
  yieldUnit: "units",
  instructions: "",
  estimatedDurationMinutes: null as number | null,
  items: [] as RecipeItem[],
};

export default function RecipesPage() {
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
  const [newMaterial, setNewMaterial] = useState({ name: "", unit: "kg", costPrice: 0 });
  const [savingMaterial, setSavingMaterial] = useState(false);
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", basePrice: 0, category: "FINISHED_GOOD", sku: "" });
  const [savingProduct, setSavingProduct] = useState(false);

  const uniqueCategories = categories.map(c => c.name);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, mRes, pRes, cRes] = await Promise.all([
        recipesApi.getAll(),
        rawMaterialsApi.getAll(),
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
      yieldQty: recipe.yieldQty ?? 1,
      yieldUnit: recipe.yieldUnit ?? "units",
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
    if (form.items.length === 0) { setError("Add at least one ingredient."); return; }
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const instructions = (recipe.instructions || "")
      .replace(/\[unitWeight:[\d.]+\]/, "")
      .replace(/\[weightUnit:\w+\]/, "")
      .trim();

    const html = `
      <html>
        <head>
          <title>Recipe - ${recipe.name}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 4px solid #F97316; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title-section h1 { font-size: 28px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em; }
            .product { color: #64748b; font-size: 14px; margin-top: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
            .date { font-size: 12px; color: #94a3b8; font-weight: bold; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
            .stat-box { background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; }
            .stat-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.1em; }
            .stat-value { font-size: 20px; font-weight: 900; color: #0f172a; }
            .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #F97316; margin-bottom: 16px; letter-spacing: 0.15em; display: flex; align-items: center; gap: 8px; }
            .section-title::after { content: ""; flex: 1; height: 1px; background: #fee2e2; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
            th { text-align: left; background: #f8fafc; padding: 14px 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; }
            td { padding: 14px 20px; border-top: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #334155; }
            .instructions-box { background: #fffaf5; padding: 30px; border-radius: 24px; border: 1px solid #fed7aa; }
            .instructions-content { white-space: pre-wrap; line-height: 1.8; font-size: 14px; color: #431407; font-weight: 500; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-section">
              <h1>${recipe.name}</h1>
              <div class="product">Finished Product: ${recipe.product?.name || 'N/A'}</div>
            </div>
            <div class="date">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="stats">
            <div class="stat-box">
              <div class="stat-label">Yield Units</div>
              <div class="stat-value">${recipe.yieldQty} Units</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Batch Configuration</div>
              <div class="stat-value">${recipe.batchSize || '1'} ${recipe.recipeItems?.[0]?.unit || 'KG'}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Components</div>
              <div class="stat-value">${recipe.recipeItems?.length || 0} Materials</div>
            </div>
          </div>

          <div class="section-title">Bill of Materials</div>
          <table>
            <thead>
              <tr>
                <th>Ingredient / Raw Material</th>
                <th style="text-align: center;">Required Quantity</th>
                <th style="text-align: right;">Unit of Measure</th>
              </tr>
            </thead>
            <tbody>
              ${recipe.recipeItems?.map((item: any) => `
                <tr>
                  <td style="font-weight: 700; color: #1e293b;">${item.inventoryItem?.name || 'Unknown Material'}</td>
                  <td style="text-align: center; font-weight: 700;">${item.quantityRequired}</td>
                  <td style="text-align: right; color: #64748b; font-weight: 600;">${item.unit || 'KG'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Production Methodology</div>
          <div class="instructions-box">
            <div class="instructions-content">${instructions || 'Standard production procedures apply.'}</div>
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
    if (!newMaterial.name.trim()) return;
    setSavingMaterial(true);
    try {
      const res = await rawMaterialsApi.create({
        name: newMaterial.name.trim(),
        unit: newMaterial.unit,
        costPrice: newMaterial.costPrice
      });
      await fetchAll();
      
      if (materialRowIdx !== null) {
        setForm(f => {
          const newItems = [...f.items];
          newItems[materialRowIdx].inventoryItemId = res.data.id;
          return { ...f, items: newItems };
        });
      }
      setIsAddingMaterial(false);
      setNewMaterial({ name: "", unit: "kg", costPrice: 0 });
      setMaterialRowIdx(null);
      toast.success("Material created");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error ?? "Failed to create material");
    } finally {
      setSavingMaterial(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) return;
    setSavingProduct(true);
    try {
      const res = await productsApi.create({
        name: newProduct.name.trim(),
        basePrice: newProduct.basePrice,
        category: newProduct.category,
        sku: newProduct.sku || undefined
      });
      await fetchAll();
      
      setForm(f => ({ ...f, productId: res.data.id }));
      
      setIsAddingProduct(false);
      setNewProduct({ name: "", basePrice: 0, category: "FINISHED_GOOD", sku: "" });
      toast.success("Product created");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error ?? "Failed to create product");
    } finally {
      setSavingProduct(false);
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
      setNewMaterial({ name: "", unit: "kg", costPrice: 0 });
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
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-700 px-3 sm:px-4 md:px-0">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 md:p-2.5 bg-[#F97316] rounded-lg md:rounded-xl shadow-lg shadow-orange-600/20 shrink-0">
              <Layers size={18} className="text-white md:hidden" />
              <Layers size={20} className="text-white hidden md:block" />
            </div>
            <h1 className="text-lg md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Recipe <span className="text-slate-400 font-medium ml-1 tracking-tighter italic hidden sm:inline">Management</span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium ml-10 md:ml-12 uppercase tracking-widest text-[7px] md:text-[9px]">
            Define formulas, bill of materials &amp; production yields
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2.5 md:p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg md:rounded-xl hover:border-slate-300 transition-all shadow-sm group shrink-0"
          >
            <RefreshCw size={14} className={clsx("text-slate-400 group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
          </button>
          <button
            onClick={openCreate}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#F97316] text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:shadow-xl transition-all active:scale-[0.98] shadow-lg shadow-orange-600/10"
          >
            <Plus size={13} />
            New Recipe
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:border-orange-400 transition-colors dark:text-white"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {[
          { label: "Total Recipes", value: recipes.length, color: "text-orange-500" },
          { label: "Total Ingredients", value: recipes.reduce((s, r) => s + (r.recipeItems?.length ?? 0), 0), color: "text-blue-500" },
          { label: "Avg Yield / Recipe", value: recipes.length ? Math.round(recipes.reduce((s, r) => s + (r.yieldQty ?? 0), 0) / recipes.length) : 0, color: "text-emerald-500" },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-card/40 rounded-xl md:rounded-2xl border border-slate-100 dark:border-white/5 p-3 md:p-5">
            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={clsx("text-2xl md:text-3xl font-black tracking-tighter", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recipe List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/50 dark:bg-white/[0.02] rounded-[32px] border border-dashed border-slate-200 dark:border-white/5">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Recipes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-[40px] border-2 border-dashed border-slate-100 dark:border-slate-800/50">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 dark:text-slate-700 mb-6">
            <ChefHat size={32} />
          </div>
          <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">No Recipes Found</p>
          <p className="text-[10px] text-slate-500 mt-1">Create your first recipe to get started.</p>
          <button onClick={openCreate} className="mt-4 flex items-center gap-2 bg-[#F97316] text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
            <Plus size={12} /> Create Recipe
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(recipe => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div
                key={recipe.id}
                className="group bg-white dark:bg-card/40 backdrop-blur-md rounded-[24px] border border-slate-100 dark:border-white/5 overflow-hidden hover:shadow-xl transition-all"
              >
              <div className="flex items-center justify-between p-4 md:p-5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
              >
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-orange-500 flex items-center justify-center text-white font-black text-xs md:text-sm shrink-0 shadow-lg shadow-orange-500/20">
                    {recipe.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{recipe.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {recipe.product?.name && (
                        <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Package size={9} className="text-orange-400" /> {recipe.product.name}
                        </span>
                      )}
                      <span className="text-[8px] md:text-[9px] font-black text-emerald-500 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        Yield: {recipe.yieldQty} units
                      </span>
                      <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        {recipe.recipeItems?.length ?? 0} items
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/production?recipeId=${recipe.id}`); }}
                      className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 hover:bg-orange-100 transition-colors"
                      title="Start Production"
                    >
                      <Play size={13} fill="currentColor" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); downloadRecipePDF(recipe); }}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Download PDF"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(recipe); }}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(recipe.id); }}
                      disabled={deleting === recipe.id}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      {deleting === recipe.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-200">
                    <div className="pt-4 grid md:grid-cols-2 gap-6">
                      {/* Bill of Materials */}
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Bill of Materials</p>
                        <div className="space-y-2">
                          {recipe.recipeItems?.length > 0 ? recipe.recipeItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.inventoryItem?.name || "Ingredient"}</span>
                              <span className="text-[11px] font-black text-orange-500">{item.quantityRequired} {item.unit}</span>
                            </div>
                          )) : (
                            <p className="text-[10px] text-slate-400 italic">No ingredients defined.</p>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Instructions</p>
                        {recipe.instructions ? (
                          <div className="bg-[#FFFDF9] dark:bg-slate-950 p-3 rounded-xl border border-orange-100 dark:border-white/5 text-[10px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                            {recipe.instructions.replace(/\[unitWeight:[\d.]+\]/, "").replace(/\[weightUnit:\w+\]/, "").trim()}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No instructions provided.</p>
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
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Recipe" : "New Recipe"} size="2xl">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipe Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Khakhra Classic Mix"
              className="w-full h-10 bg-slate-50 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipe Code</label>
              <input
                value={form.recipeCode}
                onChange={e => setForm(f => ({ ...f, recipeCode: e.target.value }))}
                placeholder="e.g. REC001"
                className="w-full h-10 bg-slate-50 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === "___NEW___") {
                    setIsAddingCategory(true);
                  } else {
                    setForm(f => ({ ...f, category: e.target.value }));
                  }
                }}
                className="w-full h-10 bg-slate-50 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all"
              >
                <option value="">Select Category</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="___NEW___">+ Add New Category</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Product</label>
              <select
                value={form.productId}
                onChange={e => {
                  if (e.target.value === "___NEW_PRODUCT___") {
                    setIsAddingProduct(true);
                  } else {
                    setForm(f => ({ ...f, productId: e.target.value }));
                  }
                }}
                className="w-full h-10 bg-slate-50 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all"
              >
                <option value="">None</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="___NEW_PRODUCT___" className="font-bold text-orange-600">+ Add New Product</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Yield *</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={form.yieldQty}
                  onChange={e => setForm(f => ({ ...f, yieldQty: e.target.value === '' ? ('' as any) : (parseInt(e.target.value) || 0) }))}
                  className="flex-1 h-10 bg-slate-50 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all"
                />
                <select
                  value={form.yieldUnit || "units"}
                  onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))}
                  className="w-24 h-10 bg-slate-50 border-0 px-3 rounded-xl font-bold text-xs outline-none focus:ring-2 ring-orange-500/50 transition-all cursor-pointer uppercase"
                >
                  <option value="units">UNITS</option>
                  <option value="kg">KG</option>
                  <option value="g">G</option>
                  <option value="L">L</option>
                  <option value="ml">ML</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Estimated Duration (minutes)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 120"
                value={form.estimatedDurationMinutes ?? ""}
                onChange={e => setForm(f => ({ ...f, estimatedDurationMinutes: e.target.value === '' ? null : (parseInt(e.target.value) || 0) }))}
                className="w-full h-10 bg-slate-50 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructions</label>
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
              className="w-full min-h-[5rem] bg-slate-50 border-0 px-4 py-3 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-orange-500/50 transition-all resize-none placeholder:text-slate-400 overflow-hidden"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Ingredients / Bill of Materials *
              </label>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl transition-colors"
              >
                <Plus size={14} strokeWidth={3} /> Add Ingredient
              </button>
            </div>

            {form.items.length === 0 && (
              <div className="py-8 text-center rounded-2xl border-2 border-dashed border-slate-200">
                <ChefHat size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No ingredients yet</p>
              </div>
            )}

            <div id="ingredients-container" className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-end gap-3 p-4 bg-slate-50 rounded-2xl border-0">
                  <div className="flex-1 space-y-1.5 min-w-[120px]">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Material</label>
                    <select
                      value={item.inventoryItemId}
                      onChange={e => updateItem(idx, { inventoryItemId: e.target.value })}
                      className="w-full h-10 bg-white border border-slate-100 px-3 rounded-lg font-bold text-xs outline-none focus:border-orange-400 cursor-pointer text-slate-700"
                    >
                      <option value="">Select...</option>
                      {materials.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      <option value="___NEW___" className="font-bold text-orange-600">+ Add New Material</option>
                    </select>
                  </div>
                  
                  <div className="w-20 space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Qty</label>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={item.quantityRequired}
                      onChange={e => updateItem(idx, { quantityRequired: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                      className="w-full h-10 bg-white border border-slate-100 px-2 rounded-lg font-black text-xs outline-none focus:border-orange-400 text-center"
                    />
                  </div>
                  
                  <div className="w-20 space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Unit</label>
                    <select
                      value={item.unit}
                      onChange={e => updateItem(idx, { unit: e.target.value })}
                      className="w-full h-10 bg-white border border-slate-100 px-2 rounded-lg font-bold text-[10px] uppercase outline-none focus:border-orange-400 cursor-pointer"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-3 mb-[2px] text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-100">
              <AlertTriangle size={16} className="text-rose-500 shrink-0" />
              <p className="text-[10px] font-bold text-rose-600">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-6">
            <button
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-[11px] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#F97316] text-white px-8 py-3 rounded-xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest flex items-center gap-2"
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
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Category Name *</label>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Beverages"
              autoFocus
              className="w-full h-12 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={handleCreateCategory}
            disabled={savingCategory || !newCategoryName.trim()}
            className="w-full bg-[#F97316] text-white px-8 py-4 rounded-xl font-black text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          setNewMaterial({ name: "", unit: "kg", costPrice: 0 });
          setMaterialRowIdx(null);
        }}
        title="Add New Material"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Material Name *</label>
            <input
              value={newMaterial.name}
              onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
              placeholder="e.g. Black Grams"
              autoFocus
              className="w-full h-12 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
            <select
              value={newMaterial.unit}
              onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
              className="w-full h-12 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white uppercase"
            >
              <option value="kg">KG</option>
              <option value="g">G</option>
              <option value="L">L</option>
              <option value="ml">ML</option>
              <option value="units">UNITS</option>
              <option value="pcs">PCS</option>
            </select>
          </div>
          
          <button
            onClick={handleCreateMaterial}
            disabled={savingMaterial || !newMaterial.name.trim()}
            className="w-full bg-[#F97316] text-white px-8 py-4 rounded-xl font-black text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingMaterial ? "Saving..." : "Create Material"}
          </button>
        </div>
      </SlideOver>

      {/* Product Creation SlideOver */}
      <SlideOver
        isOpen={isAddingProduct}
        onClose={() => {
          setIsAddingProduct(false);
          setNewProduct({ name: "", basePrice: 0, category: "FINISHED_GOOD", sku: "" });
        }}
        title="Add New Linked Product"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Product Name *</label>
            <input
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              placeholder="e.g. Masala Dosa Batter"
              autoFocus
              className="w-full h-12 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Category</label>
            <select
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              className="w-full h-12 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white"
            >
              <option value="FINISHED_GOOD">Finished Good</option>
              <option value="SEMI_FINISHED">Semi Finished</option>
            </select>
          </div>
          
          <button
            onClick={handleCreateProduct}
            disabled={savingProduct || !newProduct.name.trim()}
            className="w-full bg-[#F97316] text-white px-8 py-4 rounded-xl font-black text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingProduct ? "Saving..." : "Create Product"}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

