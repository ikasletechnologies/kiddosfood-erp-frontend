"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, RefreshCw, ArrowLeft, Trash2, 
  User, Building2, AlertTriangle, Undo2, 
  Printer, Check, CheckCircle2, MoreVertical, X
} from "lucide-react";
import { salesApi, franchiseApi, customersApi, franchiseOrdersApi, settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { clsx } from "clsx";
import api from "@/lib/api/base";
import { formatDate } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReturnItem {
  productId: string;
  productName: string;
  orderQuantity: number;
  returnQuantity: number;
  rate: number;
  condition: string;
}

interface ReturnOrder {
  id: string;
  returnNumber: string;
  source: 'FRANCHISE' | 'PARTNER';
  entityId: string;
  entityName: string;
  entityPhone?: string;
  orderRefId: string;
  orderRefNumber: string;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'DRAFT';
  createdAt: string;
  items: ReturnItem[];
  _rawState?: any;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "Pending",     color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",    border: "border-amber-200 dark:border-amber-500/20" },
  APPROVED:  { label: "Approved",    color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-500/10",     border: "border-blue-200 dark:border-blue-500/20" },
  COMPLETED: { label: "Refunded",    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  REJECTED:  { label: "Rejected",    color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-500/10",     border: "border-rose-200 dark:border-rose-500/20" },
  DRAFT:     { label: "Draft",       color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-white/5",        border: "border-slate-200 dark:border-white/10" },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function SalesReturnsPage() {
  const { showToast } = useToast();

  // Navigation
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'ALL' | 'FRANCHISE' | 'PARTNER'>('ALL');

  // Form State
  const [returnSource, setReturnSource] = useState<'FRANCHISE' | 'PARTNER'>('PARTNER');
  const [entities, setEntities] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Original Method");
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [returnNo, setReturnNo] = useState("RT-1");
  const [showRowMenu, setShowRowMenu] = useState<string | null>(null);
  const [previewingReturn, setPreviewingReturn] = useState<ReturnOrder | null>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const currentCompany = companyProfile || FALLBACK_COMPANY;

  // ── Data Syncing ─────────────────────────────────────────────────────────────

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => { if (res.data) setCompanyProfile(res.data); })
      .catch(() => {});
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      let fetched: ReturnOrder[] = [];
      try {
        const res = await salesApi.getReturns();
        fetched = res.data || [];
      } catch {
        // Fallback to local storage if API route is not available
      }

      const localData = localStorage.getItem("sales_returns");
      if (localData) {
        const locals = JSON.parse(localData);
        const apiIds = new Set(fetched.map(x => x.id));
        const uniqueLocals = locals.filter((l: any) => !apiIds.has(l.id));
        fetched = [...uniqueLocals, ...fetched];
      }

      setReturns(fetched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Load selection options when form loads
  const loadFormSelections = async (source: 'FRANCHISE' | 'PARTNER') => {
    try {
      if (source === 'FRANCHISE') {
        const res = await franchiseApi.getAll();
        setEntities(res.data || []);
      } else {
        const [custRes, dealerRes] = await Promise.all([
          customersApi.getAll(),
          api.get("/api/dealers").catch(() => ({ data: [] }))
        ]);
        const customers = custRes.data?.data || custRes.data || [];
        const dealers = dealerRes.data?.data || dealerRes.data || [];
        
        const merged = [...customers, ...dealers];
        const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
        
        setEntities(unique);
      }
    } catch {
      showToast("Error loading partner lists", "error");
    }
  };

  useEffect(() => {
    if (view === "create" || view === "edit") {
      loadFormSelections(returnSource);
    }
  }, [view, returnSource]);

  // Auto increment Return No
  useEffect(() => {
    if (view === "create" && !draftId) {
      const numericNos = returns
        .map(o => parseInt(o.returnNumber.replace(/[^0-9]/g, "")))
        .filter(n => !isNaN(n));
      const nextNo = numericNos.length > 0 ? Math.max(...numericNos) + 1 : 1;
      setReturnNo(`RT-${nextNo}`);
    }
  }, [view, returns, draftId]);

  // ── Form Selection Triggers ──────────────────────────────────────────────────

  const handleEntityChange = async (entityId: string) => {
    const entity = entities.find(e => e.id === entityId);
    setSelectedEntity(entity || null);
    setSelectedOrder(null);
    setReturnItems([]);
    setOrdersList([]);

    if (!entity) return;

    try {
      if (returnSource === 'FRANCHISE') {
        const res = await franchiseOrdersApi.getAll({ franchiseId: entityId });
        setOrdersList(res.data || []);
      } else {
        try {
          const res = await salesApi.getSalesOrders({ customerId: entityId });
          setOrdersList(res.data || []);
        } catch {
          const localOrdersStr = localStorage.getItem("sale_orders");
          if (localOrdersStr) {
            const allSales = JSON.parse(localOrdersStr);
            const matches = allSales.filter((o: any) => o.customerId === entityId || o.customerName === entity.name);
            setOrdersList(matches.map((o: any) => ({
              id: o.id,
              orderNumber: o.orderNo,
              totalAmount: o.finalAmount,
              createdAt: o.createdAt,
              items: o.items.map((i: any) => ({
                productId: i.productId,
                productName: i.description,
                quantity: i.qty,
                unitPrice: i.rate,
              }))
            })));
          }
        }
      }
    } catch {
      showToast("Could not load associated orders", "error");
    }
  };

  const handleOrderChange = (orderId: string) => {
    const order = ordersList.find(o => o.id === orderId);
    setSelectedOrder(order || null);

    if (!order) {
      setReturnItems([]);
      return;
    }

    const populated = (order.items || []).map((i: any) => ({
      productId: i.productId || `prod_${Math.random().toString(36).substr(2, 4)}`,
      productName: i.productName || i.description || "Custom Item",
      orderQuantity: i.quantity || i.qty || 1,
      returnQuantity: 0,
      rate: i.unitPrice || i.rate || 0,
      condition: "Good",
    }));
    setReturnItems(populated);
  };

  const estimatedRefund = returnItems.reduce((acc, it) => acc + (it.returnQuantity * it.rate), 0);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setDraftId(null);
    setReturnSource("PARTNER");
    setSelectedEntity(null);
    setSelectedOrder(null);
    setReturnItems([]);
    setReason("");
    setRefundMethod("Original Method");
  };

  const handleSave = async (status: "DRAFT" | "PENDING") => {
    if (!selectedEntity && status !== "DRAFT") {
      showToast("Please select a partner/franchise", "error");
      return;
    }
    if (!selectedOrder && status !== "DRAFT") {
      showToast("Please choose the original order reference", "error");
      return;
    }
    const activeItems = returnItems.filter(it => it.returnQuantity > 0);
    if (activeItems.length === 0 && status !== "DRAFT") {
      showToast("Return Quantity must be greater than 0 for at least one item", "error");
      return;
    }

    if (status === "DRAFT" && !selectedEntity && activeItems.length === 0) {
      setView("list");
      resetForm();
      return;
    }

    setSubmitting(true);

    const payload: ReturnOrder = {
      id: draftId || `rt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      returnNumber: returnNo,
      source: returnSource,
      entityId: selectedEntity?.id || null,
      entityName: selectedEntity?.name || "Walk-in Partner",
      entityPhone: selectedEntity?.phone || "",
      orderRefId: selectedOrder?.id || "",
      orderRefNumber: selectedOrder?.orderNumber || selectedOrder?.orderNo || "Direct",
      reason,
      refundAmount: estimatedRefund,
      refundMethod,
      status,
      createdAt: new Date().toISOString(),
      items: activeItems,
      _rawState: {
        returnSource,
        selectedEntity,
        selectedOrder,
        returnItems,
        reason,
        refundMethod,
        ordersList
      }
    };

    try {
      try {
        await salesApi.createReturn({
          reason,
          items: activeItems.map(i => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.returnQuantity,
            rate: i.rate,
            condition: i.condition
          })),
          ...(returnSource === 'FRANCHISE' 
            ? { franchiseId: selectedEntity.id, franchiseOrderId: selectedOrder.id }
            : { customerId: selectedEntity.id, salesOrderId: selectedOrder.id }
          )
        });
      } catch {
        // Fallback to local storage if API is offline
      }

      const localData = localStorage.getItem("sales_returns");
      let locals = localData ? JSON.parse(localData) : [];
      if (draftId) {
        locals = locals.filter((x: any) => x.id !== draftId);
      }
      locals.unshift(payload);
      localStorage.setItem("sales_returns", JSON.stringify(locals));

      showToast(status === "DRAFT" ? "Return draft request saved" : "Sales Return logged successfully!", "success");
      fetchReturns();
      setView("list");
      resetForm();
    } catch {
      showToast("Failed to record return request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ret: ReturnOrder) => {
    setDraftId(ret.id);
    setReturnNo(ret.returnNumber);
    const raw = ret._rawState || {};
    setReturnSource(raw.returnSource || ret.source);
    setSelectedEntity(raw.selectedEntity || { id: ret.entityId, name: ret.entityName, phone: ret.entityPhone });
    setSelectedOrder(raw.selectedOrder || { id: ret.orderRefId, orderNumber: ret.orderRefNumber });
    setReturnItems(raw.returnItems || ret.items);
    setReason(raw.reason || ret.reason);
    setRefundMethod(raw.refundMethod || ret.refundMethod || "Original Method");
    setOrdersList(raw.ordersList || []);
    setView("edit");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Sales Return entry?")) return;
    try {
      const localData = localStorage.getItem("sales_returns");
      if (localData) {
        let locals = JSON.parse(localData);
        locals = locals.filter((x: any) => x.id !== id);
        localStorage.setItem("sales_returns", JSON.stringify(locals));
      }
      showToast("Return record removed", "success");
      fetchReturns();
    } catch {
      showToast("Failed to remove return", "error");
    }
  };

  const processStatusChange = async (id: string, nextStatus: 'APPROVED' | 'COMPLETED' | 'REJECTED') => {
    try {
      const localData = localStorage.getItem("sales_returns");
      if (localData) {
        const locals = JSON.parse(localData);
        const updated = locals.map((x: any) => {
          if (x.id === id) {
            return { 
              ...x, 
              status: nextStatus,
              refundAmount: nextStatus === 'COMPLETED' ? x.refundAmount : 0 
            };
          }
          return x;
        });
        localStorage.setItem("sales_returns", JSON.stringify(updated));
      }

      try {
        const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        const user = userStr ? JSON.parse(userStr) : null;
        await salesApi.updateReturnStatus(id, nextStatus, user?.fullName || 'Admin');
      } catch {
        // Fallback handler
      }

      showToast(`Return status set to: ${nextStatus}!`, "success");
      fetchReturns();
    } catch {
      showToast("Status transition failed", "error");
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────────────

  const filteredReturns = returns.filter(r => {
    const matchSearch = !search ||
      r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.entityName.toLowerCase().includes(search.toLowerCase());

    let matchTab = true;
    if (activeTab === 'FRANCHISE') matchTab = r.source === 'FRANCHISE';
    if (activeTab === 'PARTNER') matchTab = r.source === 'PARTNER';

    return matchSearch && matchTab;
  });

  const stats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'PENDING').length,
    refunded: returns.filter(r => r.status === 'COMPLETED').reduce((s, r) => s + r.refundAmount, 0),
    rejected: returns.filter(r => r.status === 'REJECTED').length,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CREATE / EDIT VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create" || view === "edit") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen w-full min-w-0">

        {/* Top Header */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                const hasInput = selectedEntity || reason;
                if (hasInput) {
                  handleSave("DRAFT");
                } else {
                  setView("list");
                  resetForm();
                }
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
              <Undo2 className="h-5 w-5 text-[#f58220] shrink-0" />
              <span>{view === "create" ? "Sales Return / Credit Note" : `Edit Return #${returnNo}`}</span>
            </h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
            Return No: <strong className="text-[#f58220] font-bold">{returnNo}</strong>
          </span>
        </div>

        {/* Scrollable Form Workspace */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 custom-scrollbar w-full min-w-0">

          {/* Return Source + Entity + Order */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-4 shadow-2xs w-full min-w-0">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Return Source</label>
              <div className="flex gap-2.5 sm:gap-3 max-w-sm flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => { setReturnSource('PARTNER'); resetForm(); }}
                  className={clsx(
                    "flex-1 py-2 px-3 rounded-xl border-2 transition-all flex items-center gap-2 justify-center text-xs font-semibold cursor-pointer",
                    returnSource === 'PARTNER' ? "border-[#f58220] bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
                  )}
                >
                  <User className="h-4 w-4 shrink-0" /> Dealer / Retailer
                </button>
                <button
                  type="button"
                  onClick={() => { setReturnSource('FRANCHISE'); resetForm(); }}
                  className={clsx(
                    "flex-1 py-2 px-3 rounded-xl border-2 transition-all flex items-center gap-2 justify-center text-xs font-semibold cursor-pointer",
                    returnSource === 'FRANCHISE' ? "border-[#f58220] bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0" /> Franchise Branch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-gray-100 dark:border-white/5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                  Select {returnSource === 'FRANCHISE' ? 'Franchise' : 'Customer / Dealer'} *
                </label>
                <select
                  value={selectedEntity?.id || ""}
                  onChange={e => handleEntityChange(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                >
                  <option value="" className="dark:bg-card">Choose partner...</option>
                  {entities.map(e => (
                    <option key={e.id} value={e.id} className="dark:bg-card">{e.name} {e.phone ? `(${e.phone})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Original Invoice Reference *</label>
                <select
                  disabled={!selectedEntity}
                  value={selectedOrder?.id || ""}
                  onChange={e => handleOrderChange(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] disabled:opacity-50"
                >
                  <option value="" className="dark:bg-card">{selectedEntity ? "Choose original order..." : "Select entity first"}</option>
                  {ordersList.map(o => (
                    <option key={o.id} value={o.id} className="dark:bg-card">
                      #{o.orderNumber || o.orderNo} (₹{Number(o.totalAmount || o.finalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}) — {formatDate(o.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Return Items Table */}
          {selectedOrder && (
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
              <div className="px-4 py-2.5 bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Return Quantities &amp; Conditions</span>
                <span className="text-xs font-semibold text-[#f58220] bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-md font-mono">
                  Order: #{selectedOrder.orderNumber || selectedOrder.orderNo}
                </span>
              </div>
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-100 dark:border-white/5 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Product</th>
                      <th className="text-center px-4 py-2.5 w-24">Qty Bought</th>
                      <th className="text-center px-4 py-2.5 w-36">Return Qty</th>
                      <th className="text-left px-4 py-2.5 w-44">Condition</th>
                      <th className="text-right px-4 py-2.5 w-28">Rate</th>
                      <th className="text-right px-4 py-2.5 w-32">Credit Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {returnItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <strong className="text-gray-800 dark:text-white font-semibold block">{item.productName}</strong>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">SKU: {item.productId.substring(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-slate-400 font-mono">{item.orderQuantity}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...returnItems];
                                next[idx].returnQuantity = Math.max(0, item.returnQuantity - 1);
                                setReturnItems(next);
                              }}
                              className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 font-bold text-sm cursor-pointer"
                            >-</button>
                            <span className="w-8 text-center font-bold font-mono text-sm text-gray-900 dark:text-white">{item.returnQuantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...returnItems];
                                next[idx].returnQuantity = Math.min(item.orderQuantity, item.returnQuantity + 1);
                                setReturnItems(next);
                              }}
                              className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 font-bold text-sm cursor-pointer"
                            >+</button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.condition}
                            onChange={e => {
                              const next = [...returnItems];
                              next[idx].condition = e.target.value;
                              setReturnItems(next);
                            }}
                            className="w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-orange-400"
                          >
                            <option value="Good" className="dark:bg-card">Good Condition</option>
                            <option value="Damaged" className="dark:bg-card">Damaged / Broken</option>
                            <option value="Expired" className="dark:bg-card">Expired</option>
                            <option value="Incorrect" className="dark:bg-card">Incorrect Item</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs sm:text-sm text-gray-600 dark:text-slate-400">₹{Number(item.rate).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                          ₹{Number(item.rate * item.returnQuantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reason + Refund Method + Summary */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start w-full min-w-0">
            <div className="flex-1 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-4 shadow-2xs min-w-0">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Reason for Return *</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="State the reason for this return (e.g. Broken in transit, expired, wrong item...)"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none resize-none focus:border-orange-400 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Refund Method</label>
                <select
                  value={refundMethod}
                  onChange={e => setRefundMethod(e.target.value)}
                  className="w-full sm:w-64 border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-orange-400"
                >
                  <option value="Original Method" className="dark:bg-card">Original Payment Method</option>
                  <option value="Credit Ledger" className="dark:bg-card">Adjust in Customer Ledger</option>
                  <option value="Cash Voucher" className="dark:bg-card">Cash / Direct refund</option>
                  <option value="Cheque / UPI" className="dark:bg-card">Bank Cheque / UPI</option>
                </select>
              </div>
            </div>

            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 w-full lg:w-72 shrink-0 space-y-3 shadow-2xs">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Estimated Credit Note</p>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f58220]">
                ₹{estimatedRefund.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex gap-2 items-start pt-2 border-t border-gray-100 dark:border-white/5 text-xs text-gray-400 dark:text-slate-500">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">Credits are estimated. Ledger will be adjusted after physical QC inspection.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <button
            type="button"
            onClick={() => { setView("list"); resetForm(); }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleSave("DRAFT")}
              disabled={submitting}
              className="px-4 py-2 text-xs sm:text-sm font-semibold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-700 dark:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave("PENDING")}
              disabled={submitting || !selectedEntity || !selectedOrder || !reason}
              className="flex items-center gap-1.5 px-5 sm:px-6 py-2 text-xs sm:text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Check className="h-4 w-4" /> <span>{submitting ? "Processing..." : "Submit Return Request"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Undo2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Sales Returns
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Process customer returns, restock items, and issue credit notes
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span>New Return</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total Returns", value: stats.total,                                                               color: "text-gray-700 dark:text-slate-200",    dot: "bg-gray-400" },
            { label: "Pending Review", value: stats.pending,                                                             color: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-500" },
            { label: "Refunded Total", value: `₹${stats.refunded.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            { label: "Rejected Requests", value: stats.rejected,                                                        color: "text-rose-600 dark:text-rose-400",    dot: "bg-rose-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3.5 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-2xs">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-lg font-bold truncate font-mono", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search return or party..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end min-w-0">
            <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full custom-scrollbar p-0.5 bg-white dark:bg-card shrink-0">
              {(['ALL', 'PARTNER', 'FRANCHISE'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors rounded-lg whitespace-nowrap shrink-0",
                    activeTab === tab ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  {tab === 'ALL' ? 'All' : tab === 'PARTNER' ? 'Dealers' : 'Franchise'}
                </button>
              ))}
            </div>

            <button
              onClick={fetchReturns}
              className="p-2 sm:p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors cursor-pointer shrink-0"
              title="Refresh"
              aria-label="Refresh Returns"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-70" />
            <p className="text-xs text-gray-500 dark:text-slate-400">Loading returns...</p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs w-full min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center">
              <Undo2 className="h-7 w-7 sm:h-8 sm:w-8 text-[#f58220]" />
            </div>
            <div className="max-w-md">
              <p className="text-gray-900 dark:text-white font-bold text-base sm:text-lg">No Sales Returns</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
                Log returns and issue credit notes to partners and customers.
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create Return
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Return #</th>
                    <th className="text-left px-4 py-3">Party</th>
                    <th className="text-left px-4 py-3">Order Ref</th>
                    <th className="text-left px-4 py-3">Reason</th>
                    <th className="text-right px-4 py-3">Credit</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredReturns.map(r => {
                    const style = STATUS_STYLES[r.status] || STATUS_STYLES.DRAFT;
                    return (
                      <tr key={r.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-orange-600 dark:text-orange-400 text-xs whitespace-nowrap">
                          {r.returnNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1 max-w-[180px] sm:max-w-[220px]">
                            <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate w-full" title={r.entityName}>
                              {r.entityName}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                              {r.source === 'FRANCHISE' ? 'Franchise' : 'Dealer'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 font-mono whitespace-nowrap">
                          #{r.orderRefNumber}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                          <span className="line-clamp-1 max-w-[140px]" title={r.reason}>{r.reason || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-rose-600 dark:text-rose-400 text-xs sm:text-sm whitespace-nowrap">
                          ₹{Number(r.refundAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => processStatusChange(r.id, 'APPROVED')}
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => processStatusChange(r.id, 'REJECTED')}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {r.status === 'APPROVED' && (
                              <button
                                onClick={() => processStatusChange(r.id, 'COMPLETED')}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                Process Refund
                              </button>
                            )}
                            {r.status === 'COMPLETED' && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                              </span>
                            )}
                            <div className="relative">
                              <button
                                onClick={() => setShowRowMenu(showRowMenu === r.id ? null : r.id)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {showRowMenu === r.id && (
                                <div className="absolute right-0 top-8 z-50 w-32 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1 text-left animate-in zoom-in-95 duration-150">
                                  <button
                                    onClick={() => { handleEdit(r); setShowRowMenu(null); }}
                                    className="w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-700 dark:text-slate-200 text-left cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => { setPreviewingReturn(r); setShowRowMenu(null); }}
                                    className="w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-700 dark:text-slate-200 text-left cursor-pointer"
                                  >
                                    Print
                                  </button>
                                  <button
                                    onClick={() => { handleDelete(r.id); setShowRowMenu(null); }}
                                    className="w-full px-3 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs text-red-600 dark:text-red-400 text-left border-t border-gray-100 dark:border-white/5 cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {previewingReturn && (
        <GSTInvoice
          order={{
            id: previewingReturn.id,
            poNumber: previewingReturn.returnNumber,
            createdAt: previewingReturn.createdAt,
            items: (previewingReturn.items || []).map((it) => ({
              itemName: it.productName,
              quantity: it.returnQuantity,
              price: it.rate,
              gstRate: 0,
            })),
          }}
          vendor={{
            name: previewingReturn.entityName,
            phone: previewingReturn.entityPhone,
          }}
          companyDetails={currentCompany}
          documentType="SALES_RETURN"
          onClose={() => setPreviewingReturn(null)}
        />
      )}
    </div>
  );
}
