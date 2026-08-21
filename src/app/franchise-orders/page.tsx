"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Plus, X, RefreshCw, CheckCircle2, Clock,
  Truck, PackageCheck, AlertTriangle, ChevronDown, Receipt,
  CreditCard, Banknote, ArrowRight, Package, Warehouse, ClipboardList,
  Ban, XCircle, Trash2, ShieldAlert
} from "lucide-react";
import { clsx } from "clsx";
import api, { franchiseOrdersApi, franchiseProductRequestsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";
import Link from "next/link";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "Kiddos Food Headquarters",
  gstin: "27AAAAA1111A1Z1",
  address: "123 corporate HQ, Mumbai, MH",
  phone: "9999999999",
  email: "admin@kiddosfood.com",
  state: "Maharashtra"
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/20",
  APPROVED:     "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700/20",
  IN_PRODUCTION:"bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-700/20",
  DISPATCHED:   "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-700/20",
  DELIVERED:    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/20",
  CANCELLED:    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/20",
};

const STATUS_ICONS: Record<string, any> = {
  PENDING: Clock, APPROVED: CheckCircle2, IN_PRODUCTION: Package,
  DISPATCHED: Truck, DELIVERED: PackageCheck, CANCELLED: X,
};

const NEXT_STATUS: Record<string, string> = {
  PENDING: "APPROVED", APPROVED: "IN_PRODUCTION",
  IN_PRODUCTION: "DISPATCHED", DISPATCHED: "DELIVERED",
};

// Production is a fulfillment path, not a mandatory status: once approved, an order
// that HQ already has enough finished stock for skips IN_PRODUCTION entirely and goes
// straight to dispatch. Only an order that actually needs production stops there.
function getNextStatus(order: any): string | undefined {
  if (order.status === "APPROVED" && order.fulfillmentPath === "STOCK") {
    return "DISPATCHED";
  }
  return NEXT_STATUS[order.status];
}

export default function FranchiseOrdersPage() {
  const { user } = useAuth();
  const isFranchiseAdmin = user?.role === "FRANCHISE_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [franchiseData, setFranchiseData] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [invoiceModalData, setInvoiceModalData] = useState<{ order: any; vendor: any } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [companyDetails, setCompanyDetails] = useState<any>(null);

  // Create form
  const [orderType, setOrderType] = useState<"STOCK" | "REQUEST">("STOCK");
  const [selectedFranchise, setSelectedFranchise] = useState(user?.franchiseId ?? "");
  const [paymentType, setPaymentType] = useState("CREDIT");
  const [preferredDelivery, setPreferredDelivery] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [notes, setNotes] = useState("");
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: "", quantity: 1 },
  ]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        api.get("/api/franchise-orders", {
          params: isFranchiseAdmin && user?.franchiseId ? { franchiseId: user.franchiseId } : undefined
        }),
        api.get("/api/products?stockSource=HQ"),
      ]);
      const rawOrders: any[] = ordersRes.data ?? [];
      const scopedOrders = isFranchiseAdmin && user?.franchiseId
        ? rawOrders.filter((o: any) => o.franchiseId === user.franchiseId || o.franchise?.id === user.franchiseId)
        : rawOrders;

      setOrders(scopedOrders);
      setProducts((productsRes.data ?? []).filter((p: any) => p.isActive));

      if (isFranchiseAdmin && user?.franchiseId) {
        const frRes = await api.get(`/api/franchise/${user.franchiseId}`);
        setFranchiseData(frRes.data);
      }

      if (!isFranchiseAdmin) {
        const franchiseRes = await api.get("/api/franchise");
        setFranchises(franchiseRes.data ?? []);
      }

      const compRes = await api.get("/api/settings/company").catch(() => ({ data: null }));
      if (compRes?.data) setCompanyDetails(compRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isFranchiseAdmin, user?.franchiseId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener("erp:refresh-franchise-orders", handler);
    return () => window.removeEventListener("erp:refresh-franchise-orders", handler);
  }, [fetchAll]);

  useEffect(() => {
    if (user?.franchiseId) setSelectedFranchise(user.franchiseId);
  }, [user]);

  const handleCreate = async () => {
    setError("");
    const validItems = orderItems.filter(i => i.productId && i.quantity > 0);
    if (!selectedFranchise || validItems.length === 0) {
      setError("Select a franchise and at least one product.");
      return;
    }
    const unpriced = validItems
      .map(i => products.find(p => p.id === i.productId))
      .filter((p): p is any => !!p && !(p.basePrice > 0));
    if (unpriced.length > 0) {
      setError(`HQ hasn't set a price yet for: ${Array.from(new Set(unpriced.map(p => p.name))).join(", ")}. Ask HQ to update pricing before this can be ordered or requested.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/api/franchise-orders", {
        franchiseId: selectedFranchise,
        orderType,
        paymentType,
        expectedDispatchDate: preferredDelivery || undefined,
        priority,
        notes: notes || undefined,
        items: validItems,
      });

      const createdOrder = res?.data;
      const orderNum = createdOrder?.orderNumber || `FO-${Date.now().toString().slice(-4)}`;
      const selectedF = franchises.find(f => f.id === selectedFranchise);
      const fName = selectedF?.name || (user as any)?.franchiseName || "Blackbulls";

      window.dispatchEvent(
        new CustomEvent("erp:notify-stock-request", {
          detail: {
            franchiseId: selectedFranchise,
            franchiseName: fName,
            requestNumber: orderNum,
            id: createdOrder?.id || "",
            isSupplyOrder: true,
            products: validItems.map(i => {
              const p = products.find(prod => prod.id === i.productId);
              return {
                productName: p?.name || "KARI KOZHAMBU",
                requestedQuantity: Number(i.quantity),
                unit: p?.unit || "KG",
              };
            }),
          },
        })
      );

      setShowCreate(false);
      setOrderItems([{ productId: "", quantity: 1 }]);
      setNotes(""); setPreferredDelivery(""); setPriority("NORMAL"); setOrderType("STOCK");
      fetchAll();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Failed to create order.");
    } finally { setSaving(false); }
  };

  // Cancellation Modal State (Franchise & Pending Admin)
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState("Ordered wrong product");
  const [cancelCustomNotes, setCancelCustomNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Super Admin Review Cancellation Modal State
  const [reviewCancelModalOrder, setReviewCancelModalOrder] = useState<any | null>(null);
  const [adminReviewNote, setAdminReviewNote] = useState("");
  const [reviewingCancel, setReviewingCancel] = useState(false);

  const handleAdvanceStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.patch(`/api/franchise-orders/${orderId}/status`, { status: nextStatus });
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to update status.");
    }
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancelModalOrder) return;
    const isDirectCancel = cancelModalOrder.status === "PENDING";

    if (cancelReasonPreset === "Other" && !cancelCustomNotes.trim()) {
      toast.error("Please provide a reason note when 'Other' is selected.");
      return;
    }

    const finalReason = cancelReasonPreset === "Other"
      ? cancelCustomNotes.trim()
      : (cancelCustomNotes.trim() ? `${cancelReasonPreset}: ${cancelCustomNotes.trim()}` : cancelReasonPreset);

    setCancelling(true);
    const fName = cancelModalOrder.franchise?.name || (user as any)?.franchiseName || "Blackbulls";
    const ordNumber = cancelModalOrder.orderNumber || `FO-${String(cancelModalOrder.id).slice(0, 6).toUpperCase()}`;

    const prodSummary = cancelModalOrder.items && cancelModalOrder.items.length > 0
      ? `${cancelModalOrder.items[0].productName || cancelModalOrder.items[0].product?.name || "Product"} · ${cancelModalOrder.items[0].quantity} ${cancelModalOrder.items[0].unit || "KG"}`
      : "Stock Order";

    if (isDirectCancel) {
      // 1. Direct cancellation for PENDING orders
      try {
        await franchiseOrdersApi.cancelPendingOrder(cancelModalOrder.id, {
          reasonCode: cancelReasonPreset,
          reasonNote: cancelCustomNotes.trim() || undefined,
        });

        // Optimistic UI state update
        setOrders((prev) =>
          prev.map((o) =>
            o.id === cancelModalOrder.id
              ? { ...o, status: "CANCELLED", notes: `Cancelled: ${finalReason}` }
              : o
          )
        );

        // Dispatch notification for Super Admin
        window.dispatchEvent(
          new CustomEvent("erp:notify-order-cancelled", {
            detail: {
              franchiseId: cancelModalOrder.franchiseId || cancelModalOrder.franchise?.id,
              franchiseName: fName,
              orderNumber: ordNumber,
              productSummary: prodSummary,
              reason: finalReason,
              id: cancelModalOrder.id,
            },
          })
        );

        toast.success(`Order ${ordNumber} has been cancelled.`);
        setCancelModalOrder(null);
        setCancelReasonPreset("Ordered wrong product");
        setCancelCustomNotes("");
        fetchAll().catch(() => null);
      } catch (e: any) {
        console.error("Failed to cancel pending order:", e);
        toast.error(e?.response?.data?.error ?? e?.message ?? "Failed to cancel order.");
      } finally {
        setCancelling(false);
      }
    } else {
      // 2. Cancellation Request for APPROVED / PROCESSING orders (Separate review entity)
      try {
        await franchiseOrdersApi.createCancellationRequest(cancelModalOrder.id, {
          reasonCode: cancelReasonPreset,
          reasonNote: cancelCustomNotes.trim() || undefined,
        });

        // Optimistic UI state update: order remains APPROVED/PROCESSING, but has pending cancellationRequest
        setOrders((prev) =>
          prev.map((o) =>
            o.id === cancelModalOrder.id
              ? {
                  ...o,
                  cancellationRequest: {
                    status: "PENDING",
                    reasonCode: cancelReasonPreset,
                    reasonNote: cancelCustomNotes.trim() || undefined,
                    requestedAt: new Date().toISOString(),
                    requestedBy: (user as any)?.name || (user as any)?.username || "Franchise Admin",
                  },
                }
              : o
          )
        );

        // Dispatch notification for Super Admin
        window.dispatchEvent(
          new CustomEvent("erp:notify-cancellation-requested", {
            detail: {
              franchiseId: cancelModalOrder.franchiseId || cancelModalOrder.franchise?.id,
              franchiseName: fName,
              orderNumber: ordNumber,
              productSummary: prodSummary,
              reason: finalReason,
              id: cancelModalOrder.id,
            },
          })
        );

        toast.success(`Cancellation request for ${ordNumber} submitted for HQ review.`);
        setCancelModalOrder(null);
        setCancelReasonPreset("Ordered wrong product");
        setCancelCustomNotes("");
        fetchAll().catch(() => null);
      } catch (e: any) {
        console.error("Failed to submit cancellation request:", e);
        toast.error(e?.response?.data?.error ?? e?.message ?? "Failed to submit cancellation request.");
      } finally {
        setCancelling(false);
      }
    }
  };

  // Super Admin: Approve Cancellation Request
  const handleApproveCancellationReview = async () => {
    if (!reviewCancelModalOrder) return;
    setReviewingCancel(true);
    const ord = reviewCancelModalOrder;
    const ordNumber = ord.orderNumber || `FO-${String(ord.id).slice(0, 6).toUpperCase()}`;
    const fName = ord.franchise?.name || "Franchise";

    try {
      await franchiseOrdersApi.approveCancellationRequest(ord.id, {
        reviewNote: adminReviewNote.trim() || undefined,
      });

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === ord.id
            ? {
                ...o,
                status: "CANCELLED",
                notes: `Cancellation Approved by HQ: ${adminReviewNote.trim() || "Approved"}`,
                cancellationRequest: { ...o.cancellationRequest, status: "APPROVED", reviewedAt: new Date().toISOString() },
              }
            : o
        )
      );

      // Dispatch notification
      window.dispatchEvent(
        new CustomEvent("erp:notify-cancellation-approved", {
          detail: {
            franchiseId: ord.franchiseId || ord.franchise?.id,
            franchiseName: fName,
            orderNumber: ordNumber,
            id: ord.id,
            reviewNote: adminReviewNote.trim(),
          },
        })
      );

      toast.success(`Cancellation approved for ${ordNumber}. Stock released.`);
      setReviewCancelModalOrder(null);
      setAdminReviewNote("");
      fetchAll().catch(() => null);
    } catch (e: any) {
      console.error("Failed to approve cancellation:", e);
      toast.error(e?.response?.data?.error ?? "Failed to approve cancellation.");
    } finally {
      setReviewingCancel(false);
    }
  };

  // Super Admin: Reject Cancellation Request
  const handleRejectCancellationReview = async () => {
    if (!reviewCancelModalOrder) return;
    setReviewingCancel(true);
    const ord = reviewCancelModalOrder;
    const ordNumber = ord.orderNumber || `FO-${String(ord.id).slice(0, 6).toUpperCase()}`;
    const fName = ord.franchise?.name || "Franchise";

    try {
      await franchiseOrdersApi.rejectCancellationRequest(ord.id, {
        reviewNote: adminReviewNote.trim() || undefined,
      });

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === ord.id
            ? {
                ...o,
                cancellationRequest: { ...o.cancellationRequest, status: "REJECTED", reviewedAt: new Date().toISOString() },
              }
            : o
        )
      );

      // Dispatch notification
      window.dispatchEvent(
        new CustomEvent("erp:notify-cancellation-rejected", {
          detail: {
            franchiseId: ord.franchiseId || ord.franchise?.id,
            franchiseName: fName,
            orderNumber: ordNumber,
            id: ord.id,
            reviewNote: adminReviewNote.trim(),
          },
        })
      );

      toast.success(`Cancellation request rejected for ${ordNumber}. Order continues.`);
      setReviewCancelModalOrder(null);
      setAdminReviewNote("");
      fetchAll().catch(() => null);
    } catch (e: any) {
      console.error("Failed to reject cancellation:", e);
      toast.error(e?.response?.data?.error ?? "Failed to reject cancellation.");
    } finally {
      setReviewingCancel(false);
    }
  };

  // Franchise: Withdraw Cancellation Request
  const handleWithdrawCancellation = async (order: any) => {
    if (!confirm(`Withdraw cancellation request for ${order.orderNumber || "this order"}?`)) return;
    try {
      await franchiseOrdersApi.withdrawCancellationRequest(order.id);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, cancellationRequest: { ...o.cancellationRequest, status: "WITHDRAWN" } }
            : o
        )
      );
      toast.success("Cancellation request withdrawn.");
      fetchAll().catch(() => null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to withdraw cancellation request.");
    }
  };

  const handlePayment = async (orderId: string) => {
    try {
      await api.post(`/api/franchise-orders/${orderId}/payment`, { 
        amount: 0,
        accountId: undefined // Backend will now default to CASH
      });
      toast.success("Payment recorded! View it in Collections or Supplier Ledger.", { duration: 6000 });
      fetchAll();
    } catch (e: any) {
      const errMsg = e?.response?.data?.error ?? "Failed to record payment.";
      toast.error(errMsg);
      setError(errMsg);
    }
  };

  const handleInvoice = async (orderId: string) => {
    try {
      const res = await api.get(`/api/franchise-orders/${orderId}/invoice`);
      const inv = res.data;
      
      const orderObj = orders.find(o => o.id === orderId);
      const franchiseGstin = orderObj?.franchise?.gstin || "NOT PROVIDED";
      
      const mappedOrder = {
        id: inv.orderNumber,
        poNumber: inv.invoiceNumber,
        createdAt: inv.issuedAt,
        items: inv.lineItems.map((item: any) => ({
          itemName: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
          gstRate: item.gstRate,
          hsnCode: item.hsnCode,
        })),
        paid: inv.grandTotal,
        advancePaid: 0,
      };

      const mappedVendor = {
        name: inv.franchise,
        address: inv.franchiseLocation,
        gstin: franchiseGstin,
        contact: orderObj?.franchise?.contactNum || "",
      };

      setInvoiceModalData({ order: mappedOrder, vendor: mappedVendor });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Invoice not available yet (must be paid).");
    }
  };

  const filtered = statusFilter === "ALL" ? orders : orders.filter(o => o.status === statusFilter);

  const statsMap = {
    PENDING:      orders.filter(o => o.status === "PENDING").length,
    APPROVED:     orders.filter(o => o.status === "APPROVED").length,
    IN_PRODUCTION:orders.filter(o => o.status === "IN_PRODUCTION").length,
    DISPATCHED:   orders.filter(o => o.status === "DISPATCHED").length,
    DELIVERED:    orders.filter(o => o.status === "DELIVERED").length,
    CANCELLED:    orders.filter(o => o.status === "CANCELLED").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/20">
              <ShoppingCart size={24} className="text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Franchise <span className="text-slate-400 font-medium ml-1 tracking-tighter italic">Orders</span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-14 uppercase tracking-widest text-[10px]">
            {isFranchiseAdmin ? "Restock your franchise inventory from HQ" : "Manage all franchise product orders"}
          </p>
        </div>

        {isFranchiseAdmin && franchiseData && (
          <div className="hidden md:flex items-center gap-6 px-8 py-4 bg-slate-50 dark:bg-white/5 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-inner">
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Outstanding</p>
              <p className="text-sm font-black text-rose-500">₹{(franchiseData.outstandingAmount || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Credit Limit</p>
              <p className="text-sm font-black text-slate-600 dark:text-slate-300">₹{(franchiseData.creditLimit || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Balance Limit</p>
              <p className="text-sm font-black text-emerald-500">₹{(franchiseData.balanceLimit || 0).toLocaleString("en-IN")}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button onClick={() => fetchAll()} className="p-4 rounded-3xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-400">
            <RefreshCw size={20} className={clsx(loading && "animate-spin text-orange-500")} />
          </button>
          <button onClick={() => { setShowCreate(true); setError(""); }} className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all">
            <Plus size={18} /> New Order
          </button>
        </div>
      </header>

      {/* Guide Banner for Franchise Admins */}
      {isFranchiseAdmin && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/20 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-emerald-500 text-white rounded-2xl shrink-0 mt-1">
              <CreditCard size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">How to Monitor Payments</h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Every payment made to HQ is instantly logged. You can monitor your transactions in real-time under{" "}
                <Link href="/accounting/payments" className="text-emerald-600 dark:text-emerald-400 font-black hover:underline">
                  Finance &rarr; Collections
                </Link>{" "}
                or review outstanding dues and transaction statements in your{" "}
                <Link href="/franchise/supplier-ledger" className="text-emerald-600 dark:text-emerald-400 font-black hover:underline">
                  Supplier Ledger (HQ)
                </Link>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Pending", value: statsMap.PENDING, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "In Production", value: statsMap.IN_PRODUCTION, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Dispatched", value: statsMap.DISPATCHED, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Delivered", value: statsMap.DELIVERED, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Cancelled", value: statsMap.CANCELLED, color: "text-rose-500", bg: "bg-rose-500/10" },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-card/40 p-6 rounded-[28px] border border-slate-100 dark:border-white/5 shadow-xl shadow-black/[0.02]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <div className={clsx("text-3xl font-black tracking-tighter", s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit border border-slate-200 dark:border-white/5 overflow-x-auto">
        {["ALL", "PENDING", "APPROVED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED", "CANCELLED"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              statusFilter === s
                ? "bg-white dark:bg-card text-slate-900 dark:text-white shadow-md border border-slate-100 dark:border-white/10"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >{s === "IN_PRODUCTION" ? "In Prod." : s}</button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Orders...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 bg-slate-50 dark:bg-white/[0.02] rounded-[48px] border-2 border-dashed border-slate-200 dark:border-white/5 text-center">
          <ShoppingCart className="mx-auto mb-4 text-slate-200" size={48} />
          <p className="text-sm font-black text-slate-400 uppercase tracking-tight">No orders found</p>
          <p className="text-xs text-slate-400 mt-1">Place your first order using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const StatusIcon = STATUS_ICONS[order.status] ?? Clock;
            const nextStatus = getNextStatus(order);
            const isDelayed  = order.delayStatus === "DELAYED";
            const needsProduction = order.status === "APPROVED" && order.fulfillmentPath === "PRODUCTION";

            return (
              <div key={order.id} className="bg-white dark:bg-card/40 backdrop-blur-md rounded-[32px] border border-slate-100 dark:border-white/5 p-8 hover:shadow-2xl transition-all">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {order.orderNumber}
                      </h3>
                      <span className={clsx("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5", STATUS_STYLES[order.status])}>
                        <StatusIcon size={11} /> {order.status.replace("_", " ")}
                      </span>
                      {order.cancellationRequest?.status === "PENDING" && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                          <Clock size={11} /> Cancellation: Awaiting HQ Review
                        </span>
                      )}
                      {order.orderType === "REQUEST" && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center gap-1.5">
                          <ClipboardList size={11} /> Requested
                        </span>
                      )}
                      {order.status === "APPROVED" && order.fulfillmentPath === "STOCK" && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 flex items-center gap-1.5">
                          <Warehouse size={11} /> Ready to Dispatch — In HQ Stock
                        </span>
                      )}
                      {needsProduction && (
                        <span className={clsx(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5",
                          order.materialsReady
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                        )}>
                          <Package size={11} /> {order.materialsReady ? "Materials Available" : "Insufficient Raw Materials"}
                        </span>
                      )}
                      {isDelayed && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-red-100 text-red-600 border-red-200 flex items-center gap-1">
                          <AlertTriangle size={10} /> Delayed
                        </span>
                      )}
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        order.paymentStatus === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-400"
                      )}>
                        {order.paymentType === "CREDIT" ? "Pay Later / Credit" : "Advance Paid"} · {order.paymentStatus}
                      </span>
                      {order.priority === "URGENT" && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20 flex items-center gap-1">
                          <AlertTriangle size={10} /> Urgent
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                      {order.franchise?.name} · {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="group relative">
                          <span className={clsx(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all",
                            item.productType === "MADE_TO_ORDER"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
                              : "bg-slate-50 text-slate-700 border-slate-100 dark:bg-white/5 dark:text-slate-300"
                          )}>
                            {item.product?.name} × {item.quantity}
                            {item.productType === "MADE_TO_ORDER" && <span className="text-[8px] opacity-60 ml-1">MTO</span>}
                            
                            <span className={clsx(
                              "ml-2 px-1.5 py-0.5 rounded-md text-[7px] uppercase tracking-tighter border",
                              order.status === "DELIVERED" 
                                ? "bg-emerald-500 text-white border-emerald-400" 
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            )}>
                              {order.status === "DELIVERED" ? "Delivered" : "Reserved"}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.expectedDispatchDate && (
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                        Required By: {new Date(order.expectedDispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        {order.actualDispatchDate && ` · Dispatched: ${new Date(order.actualDispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                      </p>
                    )}

                    {/* Recipe / Raw Material Availability — only relevant while an order needs production */}
                    {needsProduction && Array.isArray(order.materialsShortfall) && (
                      <div className={clsx(
                        "mt-4 p-4 rounded-2xl border text-xs",
                        order.materialsReady
                          ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-700/20"
                          : "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-700/20"
                      )}>
                        {order.materialsReady ? (
                          <p className="font-black text-emerald-700 dark:text-emerald-400">Materials Available — Production can start.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="font-black text-red-700 dark:text-red-400">Insufficient Raw Materials</p>
                            {order.materialsShortfall.map((sf: any, i: number) => (
                              <div key={i} className="space-y-1">
                                {!sf.recipeConfigured ? (
                                  <p className="text-slate-500 dark:text-slate-400 font-bold">
                                    {sf.product}: needs {sf.neededFromProduction} more units — no recipe configured, manual review required.
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-slate-500 dark:text-slate-400 font-bold">{sf.product} — {sf.neededFromProduction} units to produce:</p>
                                    <ul className="pl-3 space-y-0.5">
                                      {sf.materials.filter((m: any) => m.shortBy > 0).map((m: any, j: number) => (
                                        <li key={j} className="text-red-600 dark:text-red-400 font-bold">
                                          {m.name}: short by {m.shortBy} {m.unit} (need {m.required} {m.unit}, have {m.available} {m.unit})
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order Timeline / Cancelled Status Banner */}
                    {order.status === "CANCELLED" ? (
                      <div className="mt-4 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-bold max-w-md">
                        <XCircle size={15} className="shrink-0 text-rose-500" />
                        <span className="truncate">
                          {order.notes?.includes("Cancellation Reason:")
                            ? order.notes
                            : `Order Cancelled: ${order.notes || "No additional notes"}`}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-6 flex items-center gap-0 overflow-hidden max-w-md">
                        {["PENDING", "APPROVED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED"].map((step, idx, arr) => {
                          const isPast = arr.indexOf(order.status) >= idx;
                          return (
                            <div key={step} className="flex items-center group">
                              <div className={clsx(
                                "w-3 h-3 rounded-full border-2 transition-all",
                                isPast ? "bg-orange-500 border-orange-500 scale-110" : "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                              )} title={step.replace("_", " ")} />
                              {idx < arr.length - 1 && (
                                <div className={clsx(
                                  "w-10 h-0.5 transition-all",
                                  isPast && arr.indexOf(order.status) > idx ? "bg-orange-500" : "bg-slate-100 dark:bg-slate-800"
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 min-w-[200px]">
                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                      ₹{order.totalAmount.toLocaleString("en-IN")}
                    </p>

                    {/* Active Cancellation Review State */}
                    {order.cancellationRequest?.status === "PENDING" ? (
                      <div className="w-full space-y-2 text-right">
                        {isSuperAdmin ? (
                          <button
                            onClick={() => {
                              setReviewCancelModalOrder(order);
                              setAdminReviewNote("");
                            }}
                            className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
                          >
                            <ShieldAlert size={13} /> Review Cancellation
                          </button>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">
                              Cancellation Under HQ Review
                            </span>
                            <button
                              onClick={() => handleWithdrawCancellation(order)}
                              className="w-full px-3 py-1.5 text-[9px] font-bold text-slate-400 hover:text-slate-200 border border-slate-200 dark:border-white/10 rounded-xl transition-all"
                            >
                              Withdraw Request
                            </button>
                          </div>
                        )}
                        {isSuperAdmin && nextStatus && (
                          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                            Blocked — Cancellation review pending
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Standard Progression for Super Admin */}
                        {isSuperAdmin && nextStatus && (
                          needsProduction && !order.materialsReady ? (
                            <div className="w-full text-right space-y-1.5">
                              <button
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed"
                              >
                                Mark In Production
                              </button>
                              <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">
                                Blocked — resolve raw materials first
                              </p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAdvanceStatus(order.id, nextStatus)}
                              className="w-full px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                            >
                              Mark {nextStatus.replace("_", " ")} <ArrowRight size={12} />
                            </button>
                          )
                        )}

                        {/* Direct Cancellation for PENDING Orders */}
                        {order.status === "PENDING" && (
                          <button
                            onClick={() => {
                              setCancelModalOrder(order);
                              setCancelReasonPreset("Ordered wrong product");
                              setCancelCustomNotes("");
                            }}
                            className="w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <Ban size={13} /> Cancel Order
                          </button>
                        )}

                        {/* Request Cancellation for APPROVED / IN_PRODUCTION (Franchise Admin) */}
                        {isFranchiseAdmin && ["APPROVED", "IN_PRODUCTION"].includes(order.status) && (
                          <button
                            onClick={() => {
                              setCancelModalOrder(order);
                              setCancelReasonPreset("Ordered wrong product");
                              setCancelCustomNotes("");
                            }}
                            className="w-full px-4 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <AlertTriangle size={13} /> Request Cancellation
                          </button>
                        )}

                        {/* Dispatched / Delivered Info Note */}
                        {["DISPATCHED", "DELIVERED"].includes(order.status) && (
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                            Cannot be cancelled after dispatch
                          </p>
                        )}
                      </>
                    )}

                    {order.status === "DELIVERED" && order.paymentStatus !== "PAID" && (
                      <button
                        onClick={() => handlePayment(order.id)}
                        className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        <Banknote size={12} /> {isSuperAdmin ? "Mark Paid" : "Pay HQ"}
                      </button>
                    )}
                    {(order.paymentStatus === "PAID") && (
                      <button
                        onClick={() => handleInvoice(order.id)}
                        className="w-full px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-700/20 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                      >
                        <Receipt size={12} /> GST Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Order Modal */}
      {showCreate && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white dark:bg-card rounded-[48px] shadow-2xl w-full max-w-2xl border border-white/20 dark:border-white/5 p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-[20px] bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
                <Plus size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">New Franchise Order</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Place product order from HQ</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="ml-auto p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Order Type */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Order Type *</label>
                <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                  {[
                    { value: "STOCK" as const, label: "Check Stock & Order", icon: Warehouse },
                    { value: "REQUEST" as const, label: "Request / Make to Order", icon: ClipboardList },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOrderType(opt.value)}
                      className={clsx(
                        "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all",
                        orderType === opt.value ? "bg-white dark:bg-card text-slate-900 dark:text-white shadow-md" : "text-slate-400"
                      )}
                    >
                      <opt.icon size={12} /> {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 px-1">
                  {orderType === "STOCK"
                    ? "Fulfilled from HQ warehouse stock — limited by availability."
                    : "Ask HQ to produce and fulfill it — stock availability doesn't matter."}
                </p>
              </div>

              {/* Franchise selector (SUPER_ADMIN only) */}
              {!isFranchiseAdmin && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Franchise *</label>
                  <select
                    value={selectedFranchise}
                    onChange={e => setSelectedFranchise(e.target.value)}
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 px-4 rounded-2xl font-bold text-sm outline-none dark:text-white appearance-none"
                  >
                    <option value="">Select franchise...</option>
                    {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {/* Products */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Products *</label>
                {orderItems.map((item, idx) => {
                  const selectedProduct = products.find(p => p.id === item.productId);
                  return (
                    <div key={idx} className="flex gap-3 items-center">
                      <select
                        value={item.productId}
                        onChange={e => {
                          const updated = [...orderItems];
                          updated[idx].productId = e.target.value;
                          setOrderItems(updated);
                        }}
                        className="flex-1 h-12 bg-slate-50 dark:bg-white/5 px-4 rounded-2xl font-bold text-sm outline-none dark:text-white appearance-none"
                      >
                        <option value="">Select product...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id} disabled={!(p.basePrice > 0)}>
                            {p.name} {p.productType === "MADE_TO_ORDER" ? "(MTO)" : ""} — {p.basePrice > 0 ? `₹${p.basePrice}` : "PRICE PENDING — ask HQ to set a price"} — (Avail: {p.currentStock ?? 0})
                          </option>
                        ))}
                      </select>
                      <div className="relative group">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...orderItems];
                            updated[idx].quantity = Number(e.target.value);
                            setOrderItems(updated);
                          }}
                          className="w-24 h-12 bg-slate-50 dark:bg-white/5 px-3 rounded-2xl font-bold text-sm outline-none dark:text-white text-center"
                          placeholder="Qty"
                        />
                        {selectedProduct && (
                          orderType === "REQUEST" ? (
                            <div className="absolute -bottom-5 left-0 right-0 text-[9px] font-black uppercase tracking-tighter text-center text-indigo-500">
                              Requested
                            </div>
                          ) : (
                            <div className={clsx(
                              "absolute -bottom-5 left-0 right-0 text-[9px] font-black uppercase tracking-tighter text-center",
                              (selectedProduct.currentStock ?? 0) <= 0 ? "text-red-500" :
                              (selectedProduct.currentStock ?? 0) < item.quantity ? "text-orange-500" : "text-emerald-500"
                            )}>
                              {(selectedProduct.currentStock ?? 0) <= 0 ? "OUT OF STOCK" : `${selectedProduct.currentStock ?? 0} Avail`}
                            </div>
                          )
                        )}
                      </div>
                      {selectedProduct && (
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 w-20 text-right">
                          ₹{(selectedProduct.basePrice * item.quantity).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Payment + Delivery + Priority */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Payment Type</label>
                  <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                    {["CREDIT", "ADVANCE"].map(pt => (
                      <button
                        key={pt}
                        onClick={() => setPaymentType(pt)}
                        className={clsx(
                          "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all",
                          paymentType === pt ? "bg-white dark:bg-card text-slate-900 dark:text-white shadow-md" : "text-slate-400"
                        )}
                      >
                        {pt === "CREDIT" ? "Pay Later" : "Advance"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Required Before</label>
                  <input
                    type="date"
                    value={preferredDelivery}
                    onChange={e => setPreferredDelivery(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full h-12 bg-slate-50 dark:bg-white/5 px-4 rounded-2xl font-bold text-sm outline-none dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Priority</label>
                  <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                    {["NORMAL", "URGENT"].map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={clsx(
                          "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all",
                          priority === p ? (p === 'URGENT' ? "bg-rose-500 text-white" : "bg-white dark:bg-card text-slate-900 dark:text-white shadow-md") : "text-slate-400"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                rows={2}
                placeholder="Special notes (optional)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4 text-sm font-bold outline-none resize-none dark:text-white"
              />

              {/* Total breakdown */}
              <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>Product Total</span>
                  <span className="text-slate-900 dark:text-white">
                    ₹{orderItems.reduce((sum, item) => {
                      const p = products.find(p => p.id === item.productId);
                      return sum + (p ? p.basePrice * item.quantity : 0);
                    }, 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>GST (5%)</span>
                  <span className="text-slate-900 dark:text-white">
                    ₹{Math.round(orderItems.reduce((sum, item) => {
                      const p = products.find(p => p.id === item.productId);
                      return sum + (p ? p.basePrice * item.quantity * 0.05 : 0);
                    }, 0)).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>Delivery Charges</span>
                  <span className="text-slate-900 dark:text-white">₹50</span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Estimated Grand Total</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    ₹{(
                      orderItems.reduce((sum, item) => {
                        const p = products.find(p => p.id === item.productId);
                        return sum + (p ? p.basePrice * item.quantity : 0);
                      }, 0) * 1.05 + 50
                    ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-700/20 rounded-2xl">
                  <p className="text-xs font-black text-red-600 uppercase tracking-widest">{error}</p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-4 bg-slate-50 dark:bg-white/5 rounded-3xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-[2] py-4 bg-orange-500 text-white rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving ? "Placing Order..." : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel Order Modal with "Why cancel the order?" */}
      {/* Cancel Order Modal with "Why cancel the order?" / "Request Cancellation" */}
      {cancelModalOrder && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setCancelModalOrder(null)} />
          <div className="relative bg-white dark:bg-[#12141c] rounded-[36px] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10 p-8 space-y-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold shrink-0">
                  <Ban size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {cancelModalOrder.status === "PENDING" ? "Cancel Pending Order" : "Request Order Cancellation"}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Order: <strong className="text-slate-700 dark:text-slate-200">{cancelModalOrder.orderNumber || `FO-${String(cancelModalOrder.id).slice(0, 6).toUpperCase()}`}</strong> · {cancelModalOrder.franchise?.name || "Franchise"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCancelModalOrder(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-slate-400 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Info / Warning Box */}
            <div className={clsx(
              "p-4 rounded-2xl border text-xs font-semibold space-y-1",
              cancelModalOrder.status === "PENDING"
                ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400"
                : "bg-amber-50/80 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400"
            )}>
              <p className="font-black flex items-center gap-1.5 text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                {cancelModalOrder.status === "PENDING" ? "Direct Cancellation" : "HQ Review Required"}
              </p>
              <p className="text-[11px] opacity-90 leading-relaxed font-normal">
                {cancelModalOrder.status === "PENDING"
                  ? "This will immediately mark the order as CANCELLED, reduce Pending Demand, and notify Super Admin."
                  : "This will submit a Cancellation Request to Central HQ for review. The order status remains unchanged until HQ approves."}
              </p>
            </div>

            {/* Preset Reason Options */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Select Reason *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Ordered wrong product",
                  "Incorrect quantity",
                  "Duplicate order",
                  "Incorrect required date",
                  "No longer required",
                  "Other"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCancelReasonPreset(preset)}
                    className={clsx(
                      "px-3.5 py-2.5 rounded-xl text-xs font-bold border text-left transition-all",
                      cancelReasonPreset === preset
                        ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20"
                        : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Notes */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {cancelReasonPreset === "Other" ? "Reason Note (Mandatory) *" : "Reason Note (Optional)"}
              </label>
              <textarea
                rows={3}
                value={cancelCustomNotes}
                onChange={(e) => setCancelCustomNotes(e.target.value)}
                placeholder={cancelReasonPreset === "Other" ? "Please specify why this order is being cancelled..." : "Add additional details for HQ records..."}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancelOrder}
                className={clsx(
                  "flex-[1.5] py-3.5 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50",
                  cancelModalOrder.status === "PENDING"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/25"
                )}
              >
                {cancelling
                  ? "Processing..."
                  : cancelModalOrder.status === "PENDING"
                  ? "Confirm Cancellation"
                  : "Submit Request to HQ"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Super Admin Review Cancellation Modal */}
      {reviewCancelModalOrder && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setReviewCancelModalOrder(null)} />
          <div className="relative bg-white dark:bg-[#12141c] rounded-[36px] shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10 p-8 space-y-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Review Cancellation Request
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Order: <strong className="text-slate-700 dark:text-slate-200">{reviewCancelModalOrder.orderNumber}</strong> · {reviewCancelModalOrder.franchise?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewCancelModalOrder(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-slate-400 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Franchise Request Details */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400 uppercase font-black text-[10px]">
                <span>Reason: {reviewCancelModalOrder.cancellationRequest?.reasonCode || "Ordered wrong product"}</span>
                <span>Status at Request: {reviewCancelModalOrder.status}</span>
              </div>
              {reviewCancelModalOrder.cancellationRequest?.reasonNote && (
                <p className="text-slate-700 dark:text-slate-200 font-medium pt-1">
                  &ldquo;{reviewCancelModalOrder.cancellationRequest.reasonNote}&rdquo;
                </p>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                ⚠️ Approving will transition the order to CANCELLED and release all reserved stock.
              </div>
            </div>

            {/* Admin Resolution Notes */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                HQ Review Note (Optional)
              </label>
              <textarea
                rows={2}
                value={adminReviewNote}
                onChange={(e) => setAdminReviewNote(e.target.value)}
                placeholder="Enter explanation for approval or rejection..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={reviewingCancel}
                onClick={handleRejectCancellationReview}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {reviewingCancel ? "Saving..." : "Reject Cancellation"}
              </button>
              <button
                type="button"
                disabled={reviewingCancel}
                onClick={handleApproveCancellationReview}
                className="flex-[1.5] py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {reviewingCancel ? "Approving..." : "Approve & Cancel Order"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {invoiceModalData && (
        <GSTInvoice
          order={invoiceModalData.order}
          vendor={invoiceModalData.vendor}
          companyDetails={companyDetails || FALLBACK_COMPANY}
          onClose={() => setInvoiceModalData(null)}
        />
      )}
    </div>
  );
}
