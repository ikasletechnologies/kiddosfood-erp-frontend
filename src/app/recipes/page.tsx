"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ChefHat, Plus, Search, Trash2, Edit2, Download, ChevronRight, X, ArrowLeft, 
  Scale, Play, RefreshCw, FlaskConical, LayoutGrid, PackageOpen 
} from "lucide-react";
import { SlideOver } from "@/components/ui/SlideOver";
import { clsx } from "clsx";
import { recipesApi, productsFullApi, rawMaterialsApi, productsApi } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

const formatCurrency = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RecipesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [materialRowIdx, setMaterialRowIdx] = useState<number | null>(null);
  const [materialList, setMaterialList] = useState<{ id: string; name: string; unit: string }[]>([{ id: "1", name: "", unit: "kg" }]);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", basePrice: 0, category: "FINISHED_GOOD", sku: "" });
  const [savingProduct, setSavingProduct] = useState(false);

  // Scaling Modal State
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scalingRecipe, setScalingRecipe] = useState<any>(null);
  const [scaleTargetYield, setScaleTargetYield] = useState<number>(1);
  const [formData, setFormData] = useState({
    productId: "",
    recipeCode: "",
    category: "",
    name: "",
    yieldQty: 1,
    yieldUnit: "",
    unitWeight: 1,
    weightUnit: "kg",
    instructions: "",
    items: [] as any[]
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes, mRes, cRes] = await Promise.all([
        recipesApi.getAll(),
        productsFullApi.getAll(),
        rawMaterialsApi.getAll(false, undefined, 'FINISHED_GOOD'),
        recipesApi.getCategories()
      ]);
      setRecipes(rRes.data ?? []);
      setProducts(pRes.data ?? []);
      setMaterials(mRes.data ?? []);
      setCategories(cRes.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this recipe?")) return;
    try {
      await recipesApi.delete(id);
      fetchAll();
      showToast("Recipe deleted", "success");
    } catch (e) { console.error(e); }
  };

  const filtered = recipes.filter((r) =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const uniqueCategories = categories.map(c => c.name);

  const handleOpenNew = () => {
    setIsAddingCategory(false);
    setEditingRecipe(null);
    setFormData({
      productId: "",
      recipeCode: "",
      category: "",
      name: "",
      yieldQty: 1,
      yieldUnit: "",
      unitWeight: 1,
      weightUnit: "kg",
      instructions: "",
      items: []
    });
    setStep(1);
    setShowModal(true);
  };

  const handleOpenEdit = (recipe: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAddingCategory(false);
    setEditingRecipe(recipe);
    const instructions = recipe.instructions || "";
    const unitWeightMatch = instructions.match(/\[unitWeight:([\d.]+)\]/);
    const weightUnitMatch = instructions.match(/\[weightUnit:(\w+)\]/);

    setFormData({
      productId: recipe.productId || "",
      recipeCode: recipe.recipeCode || "",
      category: recipe.category || "",
      name: recipe.name,
      yieldQty: recipe.yieldQty,
      yieldUnit: recipe.yieldUnit || "",
      unitWeight: unitWeightMatch ? Number(unitWeightMatch[1]) : 1,
      weightUnit: weightUnitMatch ? weightUnitMatch[1] : "kg",
      instructions: instructions.replace(/\[unitWeight:[\d.]+\]/, "").replace(/\[weightUnit:\w+\]/, "").trim(),
      items: recipe.recipeItems?.map((i: any) => ({
        inventoryItemId: i.inventoryItemId,
        quantityRequired: i.quantityRequired,
        unit: i.unit
      })) || []
    });
    setStep(1);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || formData.items.length === 0) {
      showToast("Please provide a recipe name and add at least one material", "error");
      return;
    }
    if (!formData.yieldUnit) {
      showToast("Select the recipe's yield unit (e.g. KG, L, Pcs)", "error");
      return;
    }
    const payload = {
      ...formData,
      id: editingRecipe?.id,
      instructions: `${formData.instructions} [unitWeight:${formData.unitWeight}][weightUnit:${formData.weightUnit}]`
    };

    setSaving(true);
    try {
      await recipesApi.upsert(payload);
      showToast(editingRecipe ? "Recipe updated" : "Recipe created", "success");
      setShowModal(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      showToast("Failed to save recipe", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const res = await recipesApi.createCategory(newCategoryName.trim());
      await fetchAll();
      setFormData(prev => ({ ...prev, category: res.data.name }));
      setIsAddingCategory(false);
      setNewCategoryName("");
      showToast("Category created", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to create category. It might already exist.", "error");
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
        setFormData(f => {
          const newItems = [...f.items];
          newItems[materialRowIdx].inventoryItemId = lastRes.data.id;
          return { ...f, items: newItems };
        });
      }
      setIsAddingMaterial(false);
      setMaterialList([{ id: "1", name: "", unit: "kg" }]);
      setMaterialRowIdx(null);
      showToast(validMaterials.length > 1 ? "Materials created" : "Material created", "success");
    } catch (e: any) {
      console.error(e);
      showToast(e?.response?.data?.error || "Failed to create material", "error");
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
      
      setFormData(f => ({ ...f, productId: res.data.id }));
      
      setIsAddingProduct(false);
      setNewProduct({ name: "", basePrice: 0, category: "FINISHED_GOOD", sku: "" });
      showToast("Product created", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Failed to create product", "error");
    } finally {
      setSavingProduct(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { inventoryItemId: "", quantityRequired: "", unit: "KG" }]
    });
    setTimeout(() => {
      const el = document.getElementById('ingredients-container');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  };

  const removeItem = (idx: number) => {
    const newItems = [...formData.items];
    newItems.splice(idx, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (idx: number, field: string, val: any) => {
    if (field === 'inventoryItemId' && val === "___NEW___") {
      setMaterialRowIdx(idx);
      setMaterialList([{ id: "1", name: "", unit: "kg" }]);
      setIsAddingMaterial(true);
      return;
    }

    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: val };

    // Auto-set unit if material changes
    if (field === 'inventoryItemId') {
      const mat = materials.find(m => m.id === val);
      if (mat) newItems[idx].unit = mat.unit || 'KG';
    }

    setFormData({ ...formData, items: newItems });
  };

  const handleOpenScale = (recipe: any) => {
    setScalingRecipe(recipe);
    setScaleTargetYield(recipe.yieldQty);
    setShowScaleModal(true);
  };

  const getMaterialCost = (materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    return mat?.costPrice || mat?.basePrice || 0;
  };

  const getMaterialName = (materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    return mat?.name || "Unknown Material";
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
            <div class="date">Generated: ${formatDate(new Date())}</div>
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

  const scaleMultiplier = scalingRecipe ? scaleTargetYield / scalingRecipe.yieldQty : 1;

  const scaledItems = scalingRecipe?.recipeItems?.map((item: any) => {
    const unitCost = getMaterialCost(item.inventoryItemId);
    const originalQty = item.quantityRequired;
    const scaledQty = originalQty * scaleMultiplier;
    const lineCost = scaledQty * unitCost;
    return {
      name: getMaterialName(item.inventoryItemId),
      originalQty,
      scaledQty,
      unit: item.unit || "KG",
      unitCost,
      lineCost
    };
  }) || [];

  const totalScaledCost = scaledItems.reduce((sum: number, item: any) => sum + item.lineCost, 0);
  const totalInputQty = scaledItems.reduce((sum: number, item: any) => sum + item.scaledQty, 0);
  
  const originalUnitWeightMatch = scalingRecipe?.instructions?.match(/\[unitWeight:([\d.]+)\]/);
  const originalUnitWeight = originalUnitWeightMatch ? Number(originalUnitWeightMatch[1]) : 1;
  const totalOutputWeight = scaleTargetYield * originalUnitWeight;
  const yieldPct = totalInputQty > 0 ? (totalOutputWeight / totalInputQty) * 100 : 100;

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0 p-3 sm:p-0">
        {/* Action Toolbar */}
        <div className="flex items-center justify-end gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
          <div className="flex gap-2">
            <button onClick={fetchAll} className="p-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-all" title="Refresh">
              <RefreshCw size={18} className="text-gray-400" />
            </button>
            <button
              onClick={handleOpenNew}
              className="flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shadow-lg shadow-orange-500/20"
            >
              <Plus size={18} strokeWidth={3} /> New Recipe
            </button>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Total Formulas", value: recipes.length, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10" },
            { label: "Products Covered", value: new Set(recipes.map((r) => r.productId)).size, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
            { label: "Avg Ingredients", value: recipes.length ? (recipes.reduce((s, r) => s + (r.recipeItems?.length ?? 0), 0) / recipes.length).toFixed(1) : 0, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/5 p-4 sm:p-5 shadow-sm min-w-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{stat.label}</p>
              <p className={clsx("text-xl sm:text-2xl font-black", stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-card rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden w-full min-w-0">
          <div className="p-4 sm:p-6 border-b border-gray-50 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by recipe name or product..."
                className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
              {search && (
                <X 
                  size={14} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                  onClick={() => setSearch("")} 
                />
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw size={32} className="mx-auto text-orange-500 animate-spin opacity-20" />
              <p className="mt-4 text-sm font-bold text-gray-400">Syncing Recipes...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <ChefHat size={48} strokeWidth={1} className="mx-auto text-gray-200" />
              <p className="mt-4 text-sm font-bold text-gray-400">No recipes found matching your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-left min-w-[650px]">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-white/5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Recipe Detail</th>
                    <th className="px-6 py-4">Standard Output</th>
                    <th className="px-6 py-4">Materials</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {filtered.map((recipe) => (
                    <tr
                      key={recipe.id}
                      onClick={(e) => handleOpenEdit(recipe, e)}
                      className="group hover:bg-orange-50/30 dark:hover:bg-orange-500/5 cursor-pointer transition-all"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">
                            {recipe.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">{recipe.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-tight">Product: {recipe.product?.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-700 dark:text-slate-200">{recipe.yieldQty} Units</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">per {recipe.batchSize || '1'} {recipe.recipeItems?.[0]?.unit || 'KG'} Batch</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-black text-gray-700 dark:text-slate-200">{recipe.recipeItems?.length || 0}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">Ingredients</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                          Production Ready
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/production?recipeId=${recipe.id}`); }}
                            className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all"
                            title="Start Production"
                          >
                            <Play size={16} fill="currentColor" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenScale(recipe); }}
                            className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-all"
                            title="Scale & Costing Calculator"
                          >
                            <Scale size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadRecipePDF(recipe); }}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                            title="Download PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={(e) => handleOpenEdit(recipe, e)}
                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(recipe.id, e)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="w-8 flex justify-center text-gray-300 group-hover:text-orange-400 transition-all">
                            <ChevronRight size={20} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recipe Creator Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        hideHeader
        size="2xl"
      >
        <div className="p-2 space-y-8 text-slate-900 dark:text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#F97316] flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <ChefHat size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-[#1e293b] dark:text-white tracking-tight uppercase">
                  {editingRecipe ? `Edit Recipe${formData.recipeCode ? ` — ${formData.recipeCode}` : ""}` : "New Recipe"}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  Define formula and bill of materials
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowModal(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Recipe Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Khakhra Classic Mix"
                className="w-full h-10 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Category</label>
              <select
                value={uniqueCategories.includes(formData.category) ? formData.category : (formData.category ? "___NEW___" : "")}
                onChange={(e) => {
                  if (e.target.value === "___NEW___") {
                    setIsAddingCategory(true);
                  } else {
                    setFormData({ ...formData, category: e.target.value });
                  }
                }}
                className="w-full h-10 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white"
              >
                <option value="">Select Category</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="___NEW___">+ Add New Category</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Yield *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.yieldQty}
                    onChange={(e) => setFormData({ ...formData, yieldQty: Number(e.target.value) })}
                    className="w-24 h-10 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white"
                  />
                  <select
                    value={formData.yieldUnit}
                    onChange={(e) => setFormData({ ...formData, yieldUnit: e.target.value })}
                    className="flex-1 h-10 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white uppercase"
                  >
                    <option value="" disabled>Select...</option>
                    <option value="kg">KG</option>
                    <option value="g">G</option>
                    <option value="L">L</option>
                    <option value="ml">ML</option>
                    <option value="pcs">Pcs</option>
                    <option value="pkts">Pkts</option>
                    <option value="units">Units</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Instructions</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={2}
                placeholder="Production steps and notes..."
                className="w-full bg-slate-50 dark:bg-white/5 border-0 p-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Ingredients Table */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ingredients / Bill of Materials *</label>
                <button onClick={addItem} className="flex items-center gap-1.5 text-[11px] font-black text-[#F97316] bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 px-4 py-2 rounded-xl transition-all uppercase tracking-wider">
                  <Plus size={14} strokeWidth={3} /> Add Ingredient
                </button>
              </div>

              {formData.items.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                  <ChefHat className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={28} />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No ingredients yet</p>
                </div>
              ) : (
                <div id="ingredients-container" className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar scroll-smooth">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex items-end gap-3 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl relative group">
                      <div className="flex-1 space-y-1.5 relative">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Material</label>
                        <div className="relative">
                          <div
                            onClick={() => {
                              setActiveSearchIdx(idx);
                              setMaterialSearchQuery("");
                            }}
                            className="w-full h-10 bg-white dark:bg-slate-900 border-0 px-3 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between text-slate-900 dark:text-white"
                          >
                            <span className={clsx(!item.inventoryItemId && "text-slate-400")}>
                              {materials.find(m => m.id === item.inventoryItemId)?.name || "Search materials..."}
                            </span>
                            <Search size={14} className="text-slate-400" />
                          </div>

                          {activeSearchIdx === idx && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveSearchIdx(null)} />
                              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-orange-500 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="p-3 border-b border-slate-100 dark:border-white/10 flex items-center gap-2 relative">
                                  <Search size={14} className="text-orange-500" />
                                  <input
                                    autoFocus
                                    value={materialSearchQuery}
                                    onChange={(e) => setMaterialSearchQuery(e.target.value)}
                                    placeholder="Type to search..."
                                    className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                  {materialSearchQuery && (
                                    <X 
                                      size={14} 
                                      className="text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                                      onClick={() => setMaterialSearchQuery("")} 
                                    />
                                  )}
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                                  {materials
                                    .filter(m => m.name.toLowerCase().includes(materialSearchQuery.toLowerCase()))
                                    .map(m => (
                                      <div
                                        key={m.id}
                                        onClick={() => {
                                          updateItem(idx, 'inventoryItemId', m.id);
                                          setActiveSearchIdx(null);
                                        }}
                                        className="p-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-orange-500 hover:text-white cursor-pointer transition-colors flex items-center justify-between"
                                      >
                                        <span>{m.name}</span>
                                        <span className="text-[10px] uppercase opacity-60">{m.unit || 'KG'}</span>
                                      </div>
                                    ))}
                                  <div
                                    onClick={() => {
                                      setMaterialRowIdx(idx);
                                      setMaterialList([{ id: "1", name: "", unit: "kg" }]);
                                      setIsAddingMaterial(true);
                                      setActiveSearchIdx(null);
                                    }}
                                    className="p-3 text-xs font-bold text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer transition-colors flex items-center gap-2 border-t border-orange-100 dark:border-white/10"
                                  >
                                    <Plus size={14} /> Add New Material
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="w-24 space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Qty</label>
                        <input
                          type="number"
                          value={item.quantityRequired}
                          onChange={(e) => updateItem(idx, 'quantityRequired', Number(e.target.value))}
                          className="w-full h-10 bg-white dark:bg-slate-900 border-0 px-3 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="w-24 space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 border-0 px-2 rounded-lg text-xs font-bold outline-none uppercase text-slate-900 dark:text-white cursor-pointer"
                        >
                          <option value="KG">KG</option>
                          <option value="G">G</option>
                          <option value="L">L</option>
                          <option value="ML">ML</option>
                          <option value="PCS">PCS</option>
                          <option value="PKT">PKT</option>
                        </select>
                      </div>

                      <button
                        onClick={() => removeItem(idx)}
                        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || formData.items.length === 0}
                className="bg-[#F97316] text-white px-8 py-3.5 rounded-xl font-black text-xs hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : (editingRecipe ? "Update Recipe" : "Save Recipe")}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Scale Modal */}
      {scalingRecipe && (
        <Modal
          isOpen={showScaleModal}
          onClose={() => setShowScaleModal(false)}
          hideHeader
          size="2xl"
        >
          <div className="p-6 space-y-6 text-slate-900 dark:text-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black">{scalingRecipe.name}</h3>
                <p className="text-xs text-slate-400">Scale batch formulation</p>
              </div>
              <button onClick={() => setShowScaleModal(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-xl flex items-center justify-between">
              <div>
                <label className="text-xs font-black text-orange-600">Target Output Units</label>
                <input
                  type="number"
                  value={scaleTargetYield}
                  onChange={(e) => setScaleTargetYield(Number(e.target.value) || 1)}
                  className="w-32 h-10 mt-1 bg-white dark:bg-slate-900 border-0 px-3 rounded-lg text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-500">Est. Batch Cost</div>
                <div className="text-xl font-black text-orange-600">{formatCurrency(totalScaledCost)}</div>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {scaledItems.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-xs">
                  <span className="font-bold">{item.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">{item.scaledQty.toFixed(2)} {item.unit}</span>
                    <span className="text-slate-400 font-semibold">{formatCurrency(item.lineCost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Category Creation SlideOver */}
      <SlideOver
        isOpen={isAddingCategory}
        onClose={() => {
          setIsAddingCategory(false);
          setNewCategoryName("");
        }}
        title="Add New Category"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Category Name *</label>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Instant Mixes"
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
          setMaterialList([{ id: "1", name: "", unit: "kg" }]);
          setMaterialRowIdx(null);
        }}
        title="Add New Material"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Material Name *</label>
            <button
              type="button"
              onClick={() => setMaterialList(prev => [...prev, { id: Math.random().toString(36).slice(2), name: "", unit: "kg" }])}
              className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          <div className="space-y-6">
            {materialList.map((item, idx) => (
              <div key={item.id} className="space-y-4 pt-1 pb-4 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
                <div className="space-y-2">
                  {materialList.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item #{idx + 1}</span>
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
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 border-0 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Unit</label>
                  <select
                    value={item.unit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMaterialList(prev => prev.map(m => m.id === item.id ? { ...m, unit: val } : m));
                    }}
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
              </div>
            ))}
          </div>
          
          <button
            onClick={handleCreateMaterial}
            disabled={savingMaterial || !materialList.some(m => m.name.trim())}
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
    </>
  );
}
