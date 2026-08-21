"use client";

import { useState, useEffect, useCallback } from "react";
import { X,
  Package, Plus, Search, IndianRupee,
  RefreshCw, Edit2, Trash2, CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { productsFullApi } from "@/lib/api";
import Link from "next/link";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsFullApi.getAll();
      setProducts(res.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await productsFullApi.delete(id);
      fetchProducts();
    } catch (e) { console.error(e); }
  };

  const filtered = products.filter((p) =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = products.filter((p) => p.isActive).length;
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-4 animate-in fade-in duration-700">
      {/* Refined Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-100 pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-orange-500 rounded-full" />
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Products</h1>
          </div>
          <p className="text-sm font-medium text-slate-400 max-w-md leading-relaxed">
            Manage your digital product universe. From raw ingredients to final consumer goods.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchProducts}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-all active:scale-90"
          >
            <RefreshCw size={18} className={clsx(loading && "animate-spin")} />
          </button>
          <Link
            href="/products/add"
            className="flex items-center gap-3 bg-slate-900 text-white pl-6 pr-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:bg-black hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-slate-900/10"
          >
            <Plus size={16} strokeWidth={3} /> Register Item
          </Link>
        </div>
      </div>

      {/* Elegant Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-12 px-2">
        {[
          { label: "Total Items", value: products.length, color: "text-slate-900" },
          { label: "Available", value: activeCount, color: "text-emerald-500" },
          { label: "Categories", value: categories.length, color: "text-blue-500" },
          { label: "Low Stock", value: 0, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="space-y-1">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{s.label}</p>
            <p className={clsx("text-2xl font-black transition-all tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Minimalist Search */}
      <div className="relative group max-w-2xl">
        <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Quick search by name, category, or SKU..."
          className="w-full pl-14 pr-6 py-5 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100 outline-none transition-all"
        />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
      </div>

      {/* Elegant Grid */}
      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-slate-200 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Refreshing Inventory</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-40 text-center space-y-6">
          <div className="p-8 bg-slate-50 w-fit mx-auto rounded-[2.5rem]">
            <Package size={48} className="text-slate-200" strokeWidth={1} />
          </div>
          <p className="text-slate-400 font-medium">No matches found for your current filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="group bg-white border border-slate-100 rounded-[1.5rem] p-5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:-translate-y-2 hover:border-orange-200 transition-all duration-500 flex flex-col relative"
            >
              {/* Corner Actions */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                <Link
                  href={`/products/edit?id=${product.id}`}
                  className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-slate-900 hover:shadow-md transition-all"
                >
                  <Edit2 size={13} />
                </Link>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-red-500 hover:shadow-md transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Status & Category */}
              <div className="flex items-center gap-2 mb-3">
                <span className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  product.isActive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-200"
                )} />
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.1em]">
                  {product.category || "General"}
                </span>
              </div>

              <h3 className="font-black text-slate-900 text-base leading-tight mb-1 group-hover:text-orange-600 transition-colors line-clamp-1">
                {product.name}
              </h3>

              <p className="text-[11px] font-medium text-slate-400 line-clamp-2 mb-4 min-h-[1.5rem]">
                {product.description || "No description provided."}
              </p>

              {/* Bottom Info */}
              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-0.5 text-slate-900">
                    <span className="text-[9px] font-bold tracking-tight">₹</span>
                    <span className="text-lg font-black tabular-nums">{product.basePrice || 0}</span>
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {product.isVeg && (
                      <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest px-1 py-0.5 bg-emerald-50 rounded">Veg</span>
                    )}
                    {!product.recipe && (
                      <span className="text-[7px] font-black text-red-400 uppercase tracking-widest px-1 py-0.5 bg-red-50 rounded">No Recipe</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[7px] font-black text-slate-200 uppercase tracking-widest mb-0.5">SKU</p>
                  <p className="text-[8px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">
                    {product.sku?.split('-')[0] || "---"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
