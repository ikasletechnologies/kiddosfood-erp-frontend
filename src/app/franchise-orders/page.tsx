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
import { formatDate } from "@/lib/utils";

const FALLBACK_COMPANY = {
  name: "Kiddos Food Headquarters",
  gstin: "27AAAAA1111A1Z1",
  address: "123 corporate HQ, Mumbai, MH",
  phone: "9999999999",
  email: "admin@kiddosfood.com",
  state: "Maharashtra"
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  PENDING: {
    label: "Pending",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Approved",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    dot: "bg-blue-500",
  },
  IN_PRODUCTION: {
    label: "In Production",
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    border: "border-indigo-200 dark:border-indigo-500/20",
    dot: "bg-indigo-500",
  },
  DISPATCHED: {
    label: "Dispatched",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    dot: "bg-purple-500",
  },
  DELIVERED: {
    label: "Delivered",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/20",
    dot: "bg-red-500",
  },
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
      try {
        await franchiseOrdersApi.cancelPendingOrder(cancelModalOrder.id, {
          reasonCode: cancelReasonPreset,
          reasonNote: cancelCustomNotes.trim() || undefined,
        });

        setOrders((prev) =>
          prev.map((o) =>
            o.id === cancelModalOrder.id
              ? { ...o, status: "CANCELLED", notes: `Cancelled: ${finalReason}` }
              : o
          )
        );

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
      try {
        await franchiseOrdersApi.createCancellationRequest(cancelModalOrder.id, {
          reasonCode: cancelReasonPreset,
          reasonNote: cancelCustomNotes.trim() || undefined,
        });

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
        accountId: undefined
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
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <ShoppingCart size={22} className="text-orange-500" />
              Franchise Orders
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isFranchiseAdmin ? "Restock your franchise inventory from HQ" : "Manage all franchise product orders"}
          </p>
        </div>

        {isFranchiseAdmin && franchiseData && (
          <div className="hidden lg:flex items-center gap-4 text-xs font-semibold px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
            <div className="flex flex-col">
              <span className="text-slate-500">Outstanding</span>
              <span className="text-red-600">₹{(franchiseData.outstandingAmount || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col">
              <span className="text-slate-500">Credit Limit</span>
              <span className="text-slate-700 dark:text-slate-300">₹{(franchiseData.creditLimit || 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col">
              <span className="text-slate-500">Balance</span>
              <span className="text-emerald-600">₹{(franchiseData.balanceLimit || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => fetchAll()}
            title="Refresh Orders"
            className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
          <button
            onClick={() => { setShowCreate(true); setError(""); }}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm shadow-sm transition-all duration-150 active:scale-95 flex items-center gap-2"
          >
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      {/* Guide Banner for Franchise Admins */}
      {isFranchiseAdmin && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0 mt-0.5">
              <CreditCard size={16} />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-400">Monitor Payments</h4>
              <p className="text-sm font-medium text-emerald-700/80 dark:text-emerald-500/80 leading-relaxed">
                Every payment made to HQ is instantly logged. Monitor transactions in{" "}
                <Link href="/accounting/payments" className="font-bold underline">
                  Finance &rarr; Collections
                </Link>{" "}
                or review your{" "}
                <Link href="/franchise/supplier-ledger" className="font-bold underline">
                  Supplier Ledger
                </Link>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary Row */}
      <div className="flex flex-col lg:flex-row gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {[
            { label: "Pending", value: statsMap.PENDING, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/30" },
            { label: "In Production", value: statsMap.IN_PRODUCTION, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20", border: "border-indigo-200 dark:border-indigo-900/30" },
            { label: "Dispatched", value: statsMap.DISPATCHED, icon: Truck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-900/30" },
            { label: "Delivered", value: statsMap.DELIVERED, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/30" },
            { label: "Cancelled", value: statsMap.CANCELLED, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-900/30" },
          ].map((s, i) => (
            <div key={i} className={clsx("flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800 flex-1 min-w-[180px]", s.border)}>
              <div className={clsx("p-2 rounded-lg", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 print:hidden">
        {["ALL", "PENDING", "APPROVED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED", "CANCELLED"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              statusFilter === s
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            {s === "IN_PRODUCTION" ? "In Production" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">Loading orders...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
          <ShoppingCart className="mx-auto text-slate-300" size={40} />
          <p className="text-sm font-semibold text-slate-400">No orders found.</p>
          <button onClick={() => { setShowCreate(true); setError(""); }} className="text-orange-500 font-bold hover:underline text-sm">Place a new order</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const StatusIcon = STATUS_ICONS[order.status] ?? Clock;
            const nextStatus = getNextStatus(order);
            const isDelayed  = order.delayStatus === "DELAYED";
            const needsProduction = order.status === "APPROVED" && order.fulfillmentPath === "PRODUCTION";
            const conf = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;

            return (
              <div key={order.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                
                {/* Order Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight uppercase">
                        {order.orderNumber}
                      </h3>
                      <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", conf.bg, conf.color, conf.border)}>
                        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", conf.dot)} />
                        {conf.label}
                      </span>
                      {order.priority === "URGENT" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm shadow-rose-500/20">
                          <AlertTriangle size={10} /> Urgent
                        </span>
                      )}
                      {order.paymentType === "CREDIT" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                          Credit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                          Advance Paid
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {order.franchise?.name} · Ordered: {formatDate(order.createdAt)}
                    </p>
                  </div>
                  
                  <div className="text-left md:text-right">
                    <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                      ₹{order.totalAmount.toLocaleString("en-IN")}
                    </p>
                    {order.expectedDispatchDate && (
                      <p className="text-xs font-semibold text-slate-500">
                        Needed by: {formatDate(order.expectedDispatchDate)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Body */}
                <div className="p-4 flex flex-col lg:flex-row gap-6">
                  
                  {/* Items List */}
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className={clsx(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all",
                          item.productType === "MADE_TO_ORDER"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
                            : "bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-sm"
                        )}>
                          <span>{item.product?.name}</span>
                          <span className="text-slate-400">×</span>
                          <span>{item.quantity}</span>
                          {item.productType === "MADE_TO_ORDER" && <span className="text-[10px] font-bold uppercase opacity-60 ml-1">MTO</span>}
                        </div>
                      ))}
                    </div>

                    {/* Timeline / Progress */}
                    {order.status !== "CANCELLED" && (
                      <div className="flex items-center gap-0 overflow-hidden max-w-sm pt-2">
                        {["PENDING", "APPROVED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED"].map((step, idx, arr) => {
                          const isPast = arr.indexOf(order.status) >= idx;
                          return (
                            <div key={step} className="flex items-center group">
                              <div className={clsx(
                                "w-2.5 h-2.5 rounded-full border-2 transition-all",
                                isPast ? "bg-orange-500 border-orange-500 scale-110" : "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                              )} title={step.replace("_", " ")} />
                              {idx < arr.length - 1 && (
                                <div className={clsx(
                                  "w-8 h-[2px] transition-all",
                                  isPast && arr.indexOf(order.status) > idx ? "bg-orange-500" : "bg-slate-100 dark:bg-slate-800"
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Material Shortfall Notice */}
                    {needsProduction && Array.isArray(order.materialsShortfall) && (
                      <div className={clsx(
                        "p-3 rounded-lg border text-xs mt-2",
                        order.materialsReady
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-700/20 dark:text-emerald-400"
                          : "bg-red-50 border-red-100 text-red-700 dark:bg-red-900/10 dark:border-red-700/20 dark:text-red-400"
                      )}>
                        {order.materialsReady ? (
                          <p className="font-bold">Materials Available — Production can start.</p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="font-bold">Insufficient Raw Materials</p>
                            {order.materialsShortfall.map((sf: any, i: number) => (
                              <div key={i}>
                                {!sf.recipeConfigured ? (
                                  <p className="font-medium opacity-90">{sf.product}: needs {sf.neededFromProduction} more units — no recipe configured, manual review required.</p>
                                ) : (
                                  <>
                                    <p className="font-semibold">{sf.product} — {sf.neededFromProduction} units to produce:</p>
                                    <ul className="pl-3 list-disc opacity-90 font-medium">
                                      {sf.materials.filter((m: any) => m.shortBy > 0).map((m: any, j: number) => (
                                        <li key={j}>{m.name}: short by {m.shortBy} {m.unit}</li>
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

                    {/* Cancellation Note */}
                    {order.status === "CANCELLED" && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-lg flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400 font-semibold">
                        <XCircle size={18} className="shrink-0 mt-0.5" />
                        <span>{order.notes || "Order Cancelled"}</span>
                      </div>
                    )}

                    {/* Pending HQ Review Notice */}
                    {order.cancellationRequest?.status === "PENDING" && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 font-semibold">
                        <Clock size={16} className="animate-pulse shrink-0" />
                        <span>Cancellation request awaiting HQ review</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col gap-2 min-w-[200px] border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700 pt-4 lg:pt-0 lg:pl-6">
                    {order.cancellationRequest?.status === "PENDING" ? (
                      isSuperAdmin ? (
                        <button
                          onClick={() => { setReviewCancelModalOrder(order); setAdminReviewNote(""); }}
                          className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <ShieldAlert size={14} /> Review Cancellation
                        </button>
                      ) : (
                        <button
                          onClick={() => handleWithdrawCancellation(order)}
                          className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition-all"
                        >
                          Withdraw Request
                        </button>
                      )
                    ) : (
                      <>
                        {isSuperAdmin && nextStatus && (
                          needsProduction && !order.materialsReady ? (
                            <div className="space-y-1 w-full">
                              <button disabled className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                                Mark In Production
                              </button>
                              <p className="text-[10px] font-bold text-red-500 text-center">Blocked by materials</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAdvanceStatus(order.id, nextStatus)}
                              className="w-full px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                            >
                              Mark {nextStatus.replace("_", " ")} <ArrowRight size={14} />
                            </button>
                          )
                        )}

                        {order.status === "PENDING" && (
                          <button
                            onClick={() => { setCancelModalOrder(order); setCancelReasonPreset("Ordered wrong product"); setCancelCustomNotes(""); }}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Ban size={14} /> Cancel Order
                          </button>
                        )}

                        {isFranchiseAdmin && ["APPROVED", "IN_PRODUCTION"].includes(order.status) && (
                          <button
                            onClick={() => { setCancelModalOrder(order); setCancelReasonPreset("Ordered wrong product"); setCancelCustomNotes(""); }}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <AlertTriangle size={14} /> Request Cancel
                          </button>
                        )}
                      </>
                    )}

                    {order.status === "DELIVERED" && order.paymentStatus !== "PAID" && (
                      <button
                        onClick={() => handlePayment(order.id)}
                        className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Banknote size={14} /> {isSuperAdmin ? "Mark Paid" : "Pay HQ"}
                      </button>
                    )}
                    
                    {order.paymentStatus === "PAID" && (
                      <button
                        onClick={() => handleInvoice(order.id)}
                        className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                      >
                        <Receipt size={14} /> View Invoice
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Franchise Order</h2>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Place a new product order from HQ</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg bg-slate-100 dark:bg-slate-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Order Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Order Type *</label>
                <div className="flex gap-2">
                  {[
                    { value: "STOCK" as const, label: "Check Stock & Order", icon: Warehouse },
                    { value: "REQUEST" as const, label: "Request / Make to Order", icon: ClipboardList },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOrderType(opt.value)}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-all shadow-sm",
                        orderType === opt.value
                          ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30"
                          : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                      )}
                    >
                      <opt.icon size={14} /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {!isFranchiseAdmin && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Franchise *</label>
                  <select
                    value={selectedFranchise}
                    onChange={e => setSelectedFranchise(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Select franchise...</option>
                    {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {/* Products List */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Products *</label>
                {orderItems.map((item, idx) => {
                  const selectedProduct = products.find(p => p.id === item.productId);
                  return (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <select
                          value={item.productId}
                          onChange={e => {
                            const updated = [...orderItems];
                            updated[idx].productId = e.target.value;
                            setOrderItems(updated);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                          <option value="">Select product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} disabled={!(p.basePrice > 0)}>
                              {p.name} {p.productType === "MADE_TO_ORDER" ? "(MTO)" : ""} — {p.basePrice > 0 ? `₹${p.basePrice}` : "PRICE PENDING"} — (Avail: {p.currentStock ?? 0})
                            </option>
                          ))}
                        </select>
                        {selectedProduct && (
                          <p className={clsx(
                            "text-[10px] font-bold px-1",
                            orderType === "REQUEST" ? "text-indigo-500" :
                            (selectedProduct.currentStock ?? 0) <= 0 ? "text-red-500" :
                            (selectedProduct.currentStock ?? 0) < item.quantity ? "text-orange-500" : "text-emerald-500"
                          )}>
                            {orderType === "REQUEST" ? "Requested" : 
                            (selectedProduct.currentStock ?? 0) <= 0 ? "OUT OF STOCK" : `${selectedProduct.currentStock ?? 0} Available`}
                          </p>
                        )}
                      </div>
                      
                      <div className="w-24">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...orderItems];
                            updated[idx].quantity = Number(e.target.value);
                            setOrderItems(updated);
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none text-center"
                          placeholder="Qty"
                        />
                      </div>
                      
                      <div className="w-24 pt-2 text-right">
                        {selectedProduct && (
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            ₹{(selectedProduct.basePrice * item.quantity).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Payment Type</label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="CREDIT">Pay Later (Credit)</option>
                    <option value="ADVANCE">Advance Paid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Required Before</label>
                  <input
                    type="date"
                    value={preferredDelivery}
                    onChange={e => setPreferredDelivery(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white outline-none resize-none"
                />
              </div>

              {/* Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-sm font-semibold text-slate-500">
                  <span>Product Total</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    ₹{orderItems.reduce((sum, item) => {
                      const p = products.find(p => p.id === item.productId);
                      return sum + (p ? p.basePrice * item.quantity : 0);
                    }, 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-500">
                  <span>GST (5%)</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    ₹{Math.round(orderItems.reduce((sum, item) => {
                      const p = products.find(p => p.id === item.productId);
                      return sum + (p ? p.basePrice * item.quantity * 0.05 : 0);
                    }, 0)).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-500">
                  <span>Delivery Charges</span>
                  <span className="text-slate-700 dark:text-slate-300">₹50</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Estimated Grand Total</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">
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
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-[2] py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 transition-all"
                >
                  {saving ? "Placing Order..." : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel Modals follow similar structure... (condensed to match clean style) */}
      {cancelModalOrder && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center">
                  <Ban size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {cancelModalOrder.status === "PENDING" ? "Cancel Pending Order" : "Request Cancellation"}
                  </h3>
                  <p className="text-sm font-semibold text-slate-500">
                    Order: {cancelModalOrder.orderNumber}
                  </p>
                </div>
              </div>
              <button onClick={() => setCancelModalOrder(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className={clsx(
              "p-4 rounded-lg border text-sm font-semibold",
              cancelModalOrder.status === "PENDING"
                ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400"
                : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
            )}>
              <p className="flex items-center gap-1.5 font-bold mb-1">
                <AlertTriangle size={16} />
                {cancelModalOrder.status === "PENDING" ? "Direct Cancellation" : "HQ Review Required"}
              </p>
              <p className="opacity-90 font-medium text-xs">
                {cancelModalOrder.status === "PENDING"
                  ? "This will immediately cancel the order."
                  : "This submits a cancellation request to HQ. Order status remains unchanged until approved."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Select Reason *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Ordered wrong product", "Incorrect quantity", "Duplicate order",
                  "Incorrect required date", "No longer required", "Other"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCancelReasonPreset(preset)}
                    className={clsx(
                      "px-3 py-2 rounded-lg text-xs font-bold border text-left transition-all",
                      cancelReasonPreset === preset
                        ? "bg-rose-500 text-white border-rose-500"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {cancelReasonPreset === "Other" ? "Notes (Mandatory) *" : "Notes (Optional)"}
              </label>
              <textarea
                rows={2}
                value={cancelCustomNotes}
                onChange={(e) => setCancelCustomNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setCancelModalOrder(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors">
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancelOrder}
                className={clsx(
                  "flex-[1.5] py-2.5 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50",
                  cancelModalOrder.status === "PENDING" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {cancelling ? "Processing..." : cancelModalOrder.status === "PENDING" ? "Confirm Cancellation" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {reviewCancelModalOrder && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Review Cancellation</h3>
                  <p className="text-sm font-semibold text-slate-500">Order: {reviewCancelModalOrder.orderNumber}</p>
                </div>
              </div>
              <button onClick={() => setReviewCancelModalOrder(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold">
              <p className="text-slate-500 dark:text-slate-400 mb-1">Reason: {reviewCancelModalOrder.cancellationRequest?.reasonCode}</p>
              {reviewCancelModalOrder.cancellationRequest?.reasonNote && (
                <p className="text-slate-700 dark:text-slate-300">&ldquo;{reviewCancelModalOrder.cancellationRequest.reasonNote}&rdquo;</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">HQ Review Note (Optional)</label>
              <textarea
                rows={2}
                value={adminReviewNote}
                onChange={(e) => setAdminReviewNote(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={reviewingCancel}
                onClick={handleRejectCancellationReview}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                Reject Cancellation
              </button>
              <button
                type="button"
                disabled={reviewingCancel}
                onClick={handleApproveCancellationReview}
                className="flex-[1.5] py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
              >
                Approve & Cancel
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
