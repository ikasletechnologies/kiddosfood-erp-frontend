"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck, Search, RefreshCw, CheckCircle2, AlertTriangle, Package, Plus, Sparkles, Link2
} from "lucide-react";
import { clsx } from "clsx";
import { productionApi, franchiseApi, productsApi, productsFullApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { generateSKU } from "@/lib/utils/erp";

interface PackagingTicket {
  id: string;
  packetSize: string;
  quantityPackets: number;
  totalWeight: number;
  barcode: string;
  createdAt: string;
  status: string;
  goodQty?: number | null;
  damagedQty?: number | null;
  spoiledQty?: number | null;
  confirmedAt?: string | null;
  batch: {
    batchCode: string;
    expiryDate: string;
    recall?: { status: string } | null;
    product?: { id?: string; name: string; sku?: string; category?: string; basePrice?: number } | null;
    production?: { recipe?: { yieldUnit?: string | null } | null } | null;
  };
}

const HISTORY_STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CONFIRMED: { label: "Confirmed", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  CANCELLED: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
};

export default function ConfirmPackagingPage() {
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("id");

  const [tickets, setTickets] = useState<PackagingTicket[]>([]);
  const [historyTickets, setHistoryTickets] = useState<PackagingTicket[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [franchises, setFranchises] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productMode, setProductMode] = useState<"existing" | "create_new">("existing");
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductPrice, setNewProductPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<PackagingTicket | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [goodQty, setGoodQty] = useState<number>(0);
  const [damagedQty, setDamagedQty] = useState<number>(0);
  const [spoiledQty, setSpoiledQty] = useState<number>(0);

  const refreshProducts = async () => {
    try {
      const pRes = await productsApi.getAll();
      const pList = pRes.data?.data || pRes.data || [];
      setProducts(Array.isArray(pList) ? pList : []);
      return Array.isArray(pList) ? pList : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    async function initData() {
      try {
        const [fRes, pRes] = await Promise.all([franchiseApi.getAll(), productsApi.getAll()]);
        const list = fRes.data || [];
        setFranchises(list);
        const pList = pRes.data?.data || pRes.data || [];
        setProducts(Array.isArray(pList) ? pList : []);
        if (list.length > 0) {
          const hq = list.find((f: any) => f.isHQ);
          const fallback = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setSelectedFranchiseId((hq || fallback).id);
        }
      } catch (err) {
        toast.error("Failed to load initial metadata");
      }
    }
    initData();
  }, []);

  const loadTickets = async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    try {
      const res = await productionApi.getPackagings(selectedFranchiseId);
      const all: PackagingTicket[] = res.data || [];
      const pending = all.filter((t) => t.status === "AWAITING_CONFIRMATION");
      setTickets(pending);
      const past = all
        .filter((t) => t.status === "CONFIRMED" || t.status === "CANCELLED")
        .sort((a, b) => new Date(b.confirmedAt || b.createdAt).getTime() - new Date(a.confirmedAt || a.createdAt).getTime());
      setHistoryTickets(past);
      if (preselectId) {
        const match = pending.find((t) => t.id === preselectId);
        if (match) selectTicket(match, products);
      }
    } catch (err) {
      toast.error("Failed to load pending packaging runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFranchiseId]);

  const selectTicket = (ticket: PackagingTicket, prodList = products) => {
    setSelectedTicket(ticket);
    setGoodQty(ticket.goodQty ?? 0);
    setDamagedQty(ticket.damagedQty ?? 0);
    setSpoiledQty(ticket.spoiledQty ?? 0);

    const batchProd = ticket.batch?.product;
    const batchProdName = batchProd?.name || "Product";
    const packetSize = ticket.packetSize || "Pack";
    const suggestedName = `${batchProdName} (${packetSize})`;
    const generatedSku = generateSKU("FINISHED_GOOD", batchProdName, packetSize);

    setNewProductName(suggestedName);
    setNewProductSku(generatedSku);
    setNewProductPrice(batchProd?.basePrice || 0);

    // Look for exact existing product ID match
    const existingById = prodList.find((p) => p.id === batchProd?.id);
    // Look for existing finished good matching suggested name
    const existingByName = prodList.find((p) => p.name?.toLowerCase() === suggestedName.toLowerCase());

    if (existingById) {
      setSelectedProductId(existingById.id);
      setProductMode("existing");
    } else if (existingByName) {
      setSelectedProductId(existingByName.id);
      setProductMode("existing");
    } else {
      setSelectedProductId("");
      // If no existing match, default to existing with empty select or allow easy create
      setProductMode(prodList.length > 0 ? "existing" : "create_new");
    }
  };

  const filteredTickets = tickets.filter((t) =>
    t.batch?.batchCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.batch?.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = historyTickets.filter((t) =>
    t.batch?.batchCode?.toLowerCase().includes(historyQuery.toLowerCase()) ||
    t.batch?.product?.name?.toLowerCase().includes(historyQuery.toLowerCase())
  );

  const total = goodQty + damagedQty + spoiledQty;
  const planned = selectedTicket?.quantityPackets ?? 0;
  const isBalanced = selectedTicket ? total === planned : false;
  const isRecalled = selectedTicket?.batch?.recall?.status === "IN_PROGRESS";

  const handleConfirm = async () => {
    if (!selectedTicket) return;

    if (goodQty < 0 || damagedQty < 0 || spoiledQty < 0) {
      toast.error("Quantities cannot be negative");
      return;
    }
    if (!isBalanced) {
      toast.error(`Good + Damaged + Spoiled (${total}) must equal the planned quantity (${planned})`);
      return;
    }

    setSubmitting(true);
    try {
      let finalProductId = selectedProductId;

      // If user chooses to create a new finished good on the fly
      if (productMode === "create_new") {
        if (!newProductName.trim()) {
          toast.error("Please enter a name for the new finished good product");
          setSubmitting(false);
          return;
        }

        const createRes = await productsFullApi.create({
          name: newProductName.trim(),
          sku: newProductSku.trim() || undefined,
          basePrice: Number(newProductPrice) || 0,
          category: selectedTicket.batch?.product?.category || "FINISHED_GOOD",
          productType: "FINISHED_GOOD",
          is_menu_item: true,
          isVeg: true,
          isActive: true,
        });

        const createdProduct = createRes.data?.data || createRes.data;
        if (!createdProduct?.id) {
          throw new Error("Failed to obtain created product ID");
        }
        finalProductId = createdProduct.id;
        toast.success(`Created new finished good: ${newProductName}`);
        await refreshProducts();
      }

      if (!finalProductId) {
        toast.error("Please select an existing finished good or create a new one.");
        setSubmitting(false);
        return;
      }

      await productionApi.confirmPackaging(selectedTicket.id, {
        goodQty,
        damagedQty,
        spoiledQty,
        productId: finalProductId,
      });

      toast.success(`Packaging confirmed — ${goodQty} packets added to Finished Goods.`);
      setSelectedTicket(null);
      await loadTickets();
      await refreshProducts();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Error confirming packaging run.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      {/* Page Header Toolbar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex flex-col md:flex-row md:items-center justify-end gap-3">
        <select
          value={selectedFranchiseId}
          onChange={(e) => setSelectedFranchiseId(e.target.value)}
          className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#13151f] text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220]"
        >
          {franchises.map((f) => (
            <option key={f.id} value={f.id} className="dark:bg-card">
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left 2 Columns: Pending tickets list */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#f58220]" />
                  Awaiting Confirmation
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search packaging runs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400 dark:text-slate-500">
                  No packaging runs awaiting confirmation.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                        <th className="text-left px-4 py-3">Product / Batch</th>
                        <th className="text-center px-4 py-3">Pack Size</th>
                        <th className="text-right px-4 py-3">Packets Planned</th>
                        <th className="text-center px-4 py-3">Created</th>
                        <th className="text-center px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredTickets.map((ticket) => {
                        const recalled = ticket.batch?.recall?.status === "IN_PROGRESS";
                        const isSelected = selectedTicket?.id === ticket.id;

                        return (
                          <tr
                            key={ticket.id}
                            className={clsx(
                              "transition-colors",
                              isSelected ? "bg-orange-50/70 dark:bg-orange-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {ticket.batch?.product?.name}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-mono">
                                Batch: {ticket.batch?.batchCode}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold border text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 font-mono">
                                {ticket.packetSize}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-slate-200">
                              {ticket.quantityPackets}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-slate-400">
                              {format(new Date(ticket.createdAt), "dd MMM, HH:mm")}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {recalled ? (
                                <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                                  Recalled
                                </span>
                              ) : (
                                <button
                                  onClick={() => selectTicket(ticket)}
                                  className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                                >
                                  Confirm
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* History */}
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden mt-5 shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5 text-[#f58220]" />
                  History
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-slate-500">
                  No confirmed or cancelled packaging runs yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                        <th className="text-left px-4 py-3">Product / Batch</th>
                        <th className="text-center px-4 py-3">Pack Size</th>
                        <th className="text-right px-4 py-3">Good / Damaged / Spoiled</th>
                        <th className="text-center px-4 py-3">Confirmed</th>
                        <th className="text-center px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredHistory.map((ticket) => {
                        const style = HISTORY_STATUS_STYLES[ticket.status] || HISTORY_STATUS_STYLES.CANCELLED;
                        return (
                          <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800 dark:text-white">{ticket.batch?.product?.name}</div>
                              <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-mono">Batch: {ticket.batch?.batchCode}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
                                {ticket.packetSize}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs">
                              {ticket.goodQty !== null && ticket.goodQty !== undefined ? (
                                <span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{ticket.goodQty}</span>
                                  {" / "}
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{ticket.damagedQty ?? 0}</span>
                                  {" / "}
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">{ticket.spoiledQty ?? 0}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-slate-400">
                              {ticket.confirmedAt ? format(new Date(ticket.confirmedAt), "dd MMM, HH:mm") : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                                {style.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Column: Confirmation form */}
          <div className="lg:col-span-1">
            {selectedTicket ? (
              <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-[#f58220]">Confirm Complete Packaging Run</span>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                      {selectedTicket.batch?.product?.name}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Batch {selectedTicket.batch?.batchCode} · {selectedTicket.packetSize} · Planned {planned} packets
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {isRecalled ? (
                  <div className="flex gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium p-2.5 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>This batch is under recall — packaging cannot be confirmed.</span>
                  </div>
                ) : (
                  <>
                    {selectedTicket.goodQty !== null && selectedTicket.goodQty !== undefined ? (
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-lg text-emerald-800 dark:text-emerald-300 text-sm">
                        <p className="font-semibold mb-1">Physical verification saved:</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          <li>{selectedTicket.goodQty} Good</li>
                          <li>{selectedTicket.damagedQty} Damaged</li>
                          <li>{selectedTicket.spoiledQty} Spoiled</li>
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
                        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Not physically verified yet</p>
                        <p className="text-xs mt-1">Quantities have not been physically verified on the Labels page.</p>
                      </div>
                    )}

                    {/* Product Mapping Option Selector */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-bold text-gray-800 dark:text-white">
                        Finished Good / Sellable Product
                      </label>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-lg text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setProductMode("existing")}
                          className={clsx(
                            "py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                            productMode === "existing"
                              ? "bg-white dark:bg-card text-[#f58220] shadow-xs"
                              : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
                          )}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          <span>Link Existing</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductMode("create_new")}
                          className={clsx(
                            "py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                            productMode === "create_new"
                              ? "bg-white dark:bg-card text-[#f58220] shadow-xs"
                              : "text-gray-600 dark:text-slate-400 hover:text-gray-900"
                          )}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-[#f58220]" />
                          <span>Create New Good</span>
                        </button>
                      </div>

                      {productMode === "existing" ? (
                        <div>
                          <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                          >
                            <option value="" className="dark:bg-card">-- Select Finished Good / SKU --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id} className="dark:bg-card">
                                {p.name} {p.sku ? `(${p.sku})` : ""} {p.basePrice ? `· ₹${p.basePrice}` : ""}
                              </option>
                            ))}
                          </select>
                          {products.length === 0 && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                              No products found in catalogue. Switch to &quot;Create New Good&quot; above to create one automatically.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 p-3 bg-orange-50/40 dark:bg-orange-500/5 rounded-lg border border-orange-200 dark:border-orange-500/20">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                              New Product Name *
                            </label>
                            <input
                              type="text"
                              value={newProductName}
                              onChange={(e) => setNewProductName(e.target.value)}
                              placeholder="e.g. Dosa Batter (1KG)"
                              className="w-full border border-gray-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-xs text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                                SKU Code
                              </label>
                              <input
                                type="text"
                                value={newProductSku}
                                onChange={(e) => setNewProductSku(e.target.value)}
                                placeholder="Auto-generated"
                                className="w-full font-mono border border-gray-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-xs text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1">
                                Selling Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={newProductPrice || ""}
                                onChange={(e) => setNewProductPrice(Number(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full font-mono border border-gray-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-xs text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">
                            ✨ Will automatically create this sellable finished good in your catalog and stock the {goodQty} good packets into Finished Goods inventory.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">Good (→ Finished Goods)</label>
                        <input
                          type="number"
                          min="0"
                          value={goodQty}
                          onChange={(e) => setGoodQty(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-emerald-400 bg-white dark:bg-[#13151f]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">Damaged (→ Wastage)</label>
                        <input
                          type="number"
                          min="0"
                          value={damagedQty}
                          onChange={(e) => setDamagedQty(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-amber-400 bg-white dark:bg-[#13151f]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5">Spoiled (→ Wastage)</label>
                        <input
                          type="number"
                          min="0"
                          value={spoiledQty}
                          onChange={(e) => setSpoiledQty(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-rose-400 bg-white dark:bg-[#13151f]"
                        />
                      </div>
                    </div>

                    <div className={clsx(
                      "rounded-lg p-3 flex items-center justify-between text-sm border",
                      isBalanced ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400"
                    )}>
                      <span className="font-medium">Total Reported</span>
                      <span className="font-bold">{total} / {planned}</span>
                    </div>

                    {!isBalanced && total < planned && (
                      <div className="flex gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium p-2.5 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {planned - total} {planned - total === 1 ? 'packet' : 'packets'} still unaccounted for
                        </span>
                      </div>
                    )}

                    {!isBalanced && total > planned && (
                      <div className="flex gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium p-2.5 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Quantity exceeds planned packaging by {total - planned} {total - planned === 1 ? 'packet' : 'packets'}</span>
                      </div>
                    )}

                    <button
                      onClick={handleConfirm}
                      disabled={submitting || !isBalanced}
                      className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>{productMode === "create_new" ? "Create Good & Confirm Packaging" : "Confirm Packaging"}</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-center p-6 bg-white dark:bg-card">
                <ClipboardCheck className="h-8 w-8 text-gray-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-gray-400 dark:text-slate-500">Select a packaging run to confirm</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
