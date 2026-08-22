"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, RefreshCw, ArrowLeft, Trash2, 
  User, Building2, AlertTriangle, Receipt, Undo2, 
  ChevronRight, Printer, FileSpreadsheet, Check, 
  CheckCircle2, XCircle, Sparkles, ShoppingBag, Clock, MoreVertical, X } from "lucide-react";
import { salesApi, franchiseApi, customersApi, franchiseOrdersApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { clsx } from "clsx";
import api from "@/lib/api/base";

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
  PENDING:   { label: "Pending Approval", color: "text-[#f58220]",  bg: "bg-orange-50",  border: "border-orange-200" },
  APPROVED:  { label: "Approved",         color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  COMPLETED: { label: "Refund Processed font-bold", color: "text-emerald-600 font-bold", bg: "bg-emerald-50", border: "border-emerald-200" },
  REJECTED:  { label: "Rejected",         color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
  DRAFT:     { label: "Draft Request",    color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200" },
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
  const [returnNo, setReturnNo] = useState("1");
  const [showRowMenu, setShowRowMenu] = useState<string | null>(null);

  // ── Data Syncing ─────────────────────────────────────────────────────────────

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      let fetched: ReturnOrder[] = [];
      try {
        const res = await salesApi.getReturns();
        fetched = res.data || [];
      } catch (err) {
        console.log("No backend returns endpoint active. Using LocalStorage fallback.");
      }

      // Merge with LocalStorage
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
        
        // Merge and deduplicate by ID just in case
        const merged = [...customers, ...dealers];
        const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
        
        setEntities(unique);
      }
    } catch (err) {
      showToast("Error loading source lists", "error");
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
        // Fallback or api search for sales orders
        try {
          const res = await salesApi.getSalesOrders({ customerId: entityId });
          setOrdersList(res.data || []);
        } catch (e) {
          // If endpoint fails, synthesize some sample mock orders in local storage
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
    } catch (err) {
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

    // Populate order items
    const populated = (order.items || []).map((i: any) => ({
      productId: i.productId || `prod_${Math.random().toString(36).substr(2,4)}`,
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
      } catch (err) {
        console.log("Saving locally to local storage fallback.");
      }

      // Save locally
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
    } catch (e) {
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
    } catch (e) {
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
              // If completed, set refund amount active
              refundAmount: nextStatus === 'COMPLETED' ? x.refundAmount : 0 
            };
          }
          return x;
        });
        localStorage.setItem("sales_returns", JSON.stringify(updated));
      }

      // Backend status sync fallback
      try {
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        await salesApi.updateReturnStatus(id, nextStatus, user?.fullName || 'Admin');
      } catch (err) {
        console.log("No backend status handler active.");
      }

      showToast(`Return status successfully set to: ${nextStatus}!`, "success");
      fetchReturns();
    } catch (e) {
      showToast("Status transition failed", "error");
    }
  };

  const printReturn = (ret: ReturnOrder) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>Sales Return #${ret.returnNumber}</title>
        <style>
          body { font-family: sans-serif; padding: 30px; color: #334155; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
          .title { font-size: 22px; font-weight: bold; color: #1e293b; text-transform: uppercase; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
          .box { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #f8fafc; }
          .box-title { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f1f5f9; padding: 10px; font-size: 12px; font-weight: bold; text-align: left; }
          td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .totals { text-align: right; margin-top: 30px; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Sales Return / Credit Note</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Return No: <strong>${ret.returnNumber}</strong></div>
          </div>
          <div style="text-align: right; font-size: 13px;">
            <div>Logged Date: <strong>${new Date(ret.createdAt).toLocaleDateString()}</strong></div>
            <div>Order Reference: <strong>#${ret.orderRefNumber}</strong></div>
            <div style="margin-top: 5px;"><span style="background: #e2e8f0; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">${ret.status}</span></div>
          </div>
        </div>
        <div class="meta">
          <div class="box">
            <div class="box-title">Source Party</div>
            <strong>${ret.entityName}</strong><br/>
            ${ret.entityPhone ? `Phone: ${ret.entityPhone}<br/>` : ""}
            Source Type: ${ret.source === "FRANCHISE" ? "Franchise Branch" : "Retailer/Dealer"}
          </div>
          <div class="box">
            <div class="box-title">Reason & Method</div>
            Reason: ${ret.reason}<br/>
            Refund: ${ret.refundMethod}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty Bought</th>
              <th>Qty Returned</th>
              <th>Condition</th>
              <th>Price/Unit</th>
              <th style="text-align: right;">Total Credit</th>
            </tr>
          </thead>
          <tbody>
            ${ret.items.map((it, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${it.productName}</td>
                <td>${it.orderQuantity}</td>
                <td><strong>${it.returnQuantity}</strong></td>
                <td><span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${it.condition}</span></td>
                <td>₹${Number(it.rate).toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold;">₹${Number(it.rate * it.returnQuantity).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="totals">
          Estimated Refund Credit: <span style="font-size: 18px; color: #b91c1c; font-weight: bold; margin-left: 10px;">₹${Number(ret.refundAmount).toFixed(2)}</span>
        </div>
        <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // ── Filters ──────────────────────────────────────────────────────────────────

  const getFilteredReturns = () => {
    return returns.filter(r => {
      const matchSearch = !search ||
        r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.entityName.toLowerCase().includes(search.toLowerCase());

      let matchTab = true;
      if (activeTab === 'FRANCHISE') matchTab = r.source === 'FRANCHISE';
      if (activeTab === 'PARTNER') matchTab = r.source === 'PARTNER';

      return matchSearch && matchTab;
    });
  };

  const filteredReturns = getFilteredReturns();

  const stats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'PENDING').length,
    refunded: returns.filter(r => r.status === 'COMPLETED').reduce((s, r) => s + r.refundAmount, 0),
    rejected: returns.filter(r => r.status === 'REJECTED').length,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CREATE/EDIT VIEW (Locked viewport height calc(100vh - 56px))
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create" || view === "edit") {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 104px)" }}>

        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
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
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-[#f58220]" />
            {view === "create" ? "Sales Return / Credit Note" : `Edit Return #${returnNo}`}
          </h2>
        </div>

        {/* Scrollable Form Workspace */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Return Source + Entity + Order */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Return Source</label>
              <div className="flex gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => { setReturnSource('PARTNER'); resetForm(); }}
                  className={clsx(
                    "flex-1 py-2.5 rounded-lg border-2 transition-all flex items-center gap-2 justify-center text-xs font-semibold",
                    returnSource === 'PARTNER' ? "border-[#f58220] bg-orange-50 text-[#f58220]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <User className="h-4 w-4" /> Dealer / Retailer
                </button>
                <button
                  type="button"
                  onClick={() => { setReturnSource('FRANCHISE'); resetForm(); }}
                  className={clsx(
                    "flex-1 py-2.5 rounded-lg border-2 transition-all flex items-center gap-2 justify-center text-xs font-semibold",
                    returnSource === 'FRANCHISE' ? "border-[#f58220] bg-orange-50 text-[#f58220]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Building2 className="h-4 w-4" /> Franchise Branch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Select {returnSource === 'FRANCHISE' ? 'Franchise' : 'Customer'} *
                </label>
                <select
                  value={selectedEntity?.id || ""}
                  onChange={e => handleEntityChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
                >
                  <option value="">Choose partner...</option>
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>{e.name} {e.phone ? `(${e.phone})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Original Invoice Reference *</label>
                <select
                  disabled={!selectedEntity}
                  value={selectedOrder?.id || ""}
                  onChange={e => handleOrderChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white disabled:opacity-50"
                >
                  <option value="">{selectedEntity ? "Choose original order..." : "Select entity first"}</option>
                  {ordersList.map(o => (
                    <option key={o.id} value={o.id}>
                      #{o.orderNumber || o.orderNo} (₹{Number(o.totalAmount || o.finalAmount || 0).toLocaleString()}) — {new Date(o.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Return Items Table */}
          {selectedOrder && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Return Quantities / Conditions</span>
                <span className="text-xs font-semibold text-[#f58220] bg-orange-50 px-2.5 py-1 rounded-md">Order: #{selectedOrder.orderNumber || selectedOrder.orderNo}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium">Product</th>
                    <th className="text-center px-4 py-2.5 w-28 font-medium">Qty Bought</th>
                    <th className="text-center px-4 py-2.5 w-40 font-medium">Return Qty</th>
                    <th className="text-left px-4 py-2.5 w-44 font-medium">Condition</th>
                    <th className="text-right px-4 py-2.5 w-32 font-medium">Rate</th>
                    <th className="text-right px-4 py-2.5 w-36 font-medium">Credit Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {returnItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <strong className="text-gray-800 font-semibold block">{item.productName}</strong>
                        <span className="text-[10px] text-gray-400 font-mono">SKU: {item.productId.substring(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-500">{item.orderQuantity}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...returnItems];
                              next[idx].returnQuantity = Math.max(0, item.returnQuantity - 1);
                              setReturnItems(next);
                            }}
                            className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-sm"
                          >-</button>
                          <span className="w-8 text-center font-bold font-mono text-sm">{item.returnQuantity}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...returnItems];
                              next[idx].returnQuantity = Math.min(item.orderQuantity, item.returnQuantity + 1);
                              setReturnItems(next);
                            }}
                            className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-sm"
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
                          className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-orange-400"
                        >
                          <option value="Good">Good Condition</option>
                          <option value="Damaged">Damaged / Broken</option>
                          <option value="Expired">Expired</option>
                          <option value="Incorrect">Incorrect Item</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">₹{Number(item.rate).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">₹{Number(item.rate * item.returnQuantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reason + Refund Method + Summary */}
          <div className="flex gap-4 items-start">
            <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Reason for Return *</label>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="State the reason for this return (e.g. Broken in transit, expired, wrong item...)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Refund Method</label>
                <select
                  value={refundMethod}
                  onChange={e => setRefundMethod(e.target.value)}
                  className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-orange-400"
                >
                  <option value="Original Method">Original Payment Method</option>
                  <option value="Credit Ledger">Adjust in Customer Ledger</option>
                  <option value="Cash Voucher">Cash / Direct refund</option>
                  <option value="Cheque / UPI">Bank Cheque / UPI</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 w-64 shrink-0 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimated Credit Note</p>
              <div className="text-3xl font-black font-mono text-[#f58220]">
                ₹{estimatedRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex gap-2 items-start pt-2 border-t border-gray-100 text-xs text-gray-400">
                <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">Credits are estimated. Ledger will be updated after physical check approval.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => { setView("list"); resetForm(); }}
            className="px-4 py-2 text-sm font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave("DRAFT")}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave("PENDING")}
            disabled={submitting || !selectedEntity || !selectedOrder || !reason}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors"
          >
            <Check className="h-4 w-4" /> {submitting ? "Processing..." : "Submit Return Request"}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-[#f58220]" />
          Sales Returns / Credit Notes
        </h1>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Return
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total",     value: stats.total,                               color: "text-gray-700",    dot: "bg-gray-400" },
            { label: "Pending",   value: stats.pending,                             color: "text-orange-600",  dot: "bg-orange-500" },
            { label: "Refunded",  value: `₹${stats.refunded.toLocaleString()}`,     color: "text-emerald-600", dot: "bg-emerald-500" },
            { label: "Rejected",  value: stats.rejected,                            color: "text-rose-600",    dot: "bg-rose-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search return or party..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            {(['ALL', 'PARTNER', 'FRANCHISE'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === tab ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {tab === 'ALL' ? 'All' : tab === 'PARTNER' ? 'Dealers' : 'Franchise'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={fetchReturns} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Empty State ── */}
        {filteredReturns.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Undo2 className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Sales Returns</p>
              <p className="text-gray-500 text-sm mt-1">Log returns and issue credit notes to partners.</p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Create Return
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
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
              <tbody className="divide-y divide-gray-100">
                {filteredReturns.map(r => {
                  const style = STATUS_STYLES[r.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {r.returnNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-sm">{r.entityName}</div>
                        <div className="text-xs text-gray-400">{r.source === 'FRANCHISE' ? 'Franchise' : 'Dealer'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-medium">
                        #{r.orderRefNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <span className="line-clamp-1 max-w-[140px]" title={r.reason}>{r.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 text-sm">
                        ₹{Number(r.refundAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => processStatusChange(r.id, 'APPROVED')}
                                className="px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => processStatusChange(r.id, 'REJECTED')}
                                className="px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'APPROVED' && (
                            <button
                              onClick={() => processStatusChange(r.id, 'COMPLETED')}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              Process Refund
                            </button>
                          )}
                          {r.status === 'COMPLETED' && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </span>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setShowRowMenu(showRowMenu === r.id ? null : r.id)}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {showRowMenu === r.id && (
                              <div className="absolute right-0 top-8 z-50 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-left">
                                <button
                                  onClick={() => { handleEdit(r); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 text-left"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { printReturn(r); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 text-left"
                                >
                                  Print
                                </button>
                                <button
                                  onClick={() => { handleDelete(r.id); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-red-50 text-xs text-red-600 text-left border-t border-gray-100"
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
        )}
      </div>
    </div>
  );
}

