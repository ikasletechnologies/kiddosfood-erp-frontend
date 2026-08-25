"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Send, Clock, CheckCircle2, XCircle, Package, Plus,
  X, RefreshCw, Building2, Trash2, PackageCheck, Search,
  Filter, AlertCircle, MessageSquare, ArrowRight, ShieldCheck,
  Truck, History, AlertTriangle, FileText, Check, ChevronRight,
  CheckCircle, ArrowUpRight, Calendar, UserCheck
} from "lucide-react";
import { clsx } from "clsx";
import {
  franchiseProductRequestsApi,
  franchiseApi,
  productsFullApi,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

type ReqStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "DISPATCHED"
  | "DELIVERY_ISSUE"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

const STATUS_CONFIG: Record<
  ReqStatus,
  { label: string; badge: string; text: string; dot: string }
> = {
  PENDING: {
    label: "Pending Review",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700/50",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Approved",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700/50",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  PROCESSING: {
    label: "Processing & Reserved",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700/50",
    text: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  DISPATCHED: {
    label: "In Transit / Dispatched",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/50",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  DELIVERY_ISSUE: {
    label: "Delivery Issue",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-700/50",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  DELIVERED: {
    label: "Delivered & Inwarded",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700/50",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
    text: "text-gray-500 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

interface ProductItem {
  productId: string;
  productName: string;
  unit: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  dispatchedQuantity?: number;
  receivedQuantity?: number;
  damagedQuantity?: number;
  missingQuantity?: number;
  itemStatus?: string;
  adminNote?: string;
}

function FranchiseRequestsContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get("id");

  const rawRole = (user?.role as any)?.name ?? user?.role ?? "";
  const role = typeof rawRole === "string" ? rawRole.toUpperCase() : "";
  const isAdmin = role === "SUPER_ADMIN";
  const isFranchiseAdmin = role === "FRANCHISE_ADMIN";

  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReqStatus>("ALL");
  const [franchiseFilter, setFranchiseFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modal Controllers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [approveModal, setApproveModal] = useState<{ id: string; items: ProductItem[]; note: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);
  const [processModal, setProcessModal] = useState<{ id: string; request: any } | null>(null);
  const [dispatchModal, setDispatchModal] = useState<{
    id: string;
    request: any;
    dispatchDate: string;
    dispatchReference: string;
    transporter: string;
    vehicleNumber: string;
    trackingNumber: string;
    dispatchNote: string;
    items: Array<{ productId: string; dispatchedQuantity: number }>;
  } | null>(null);
  const [receiptModal, setReceiptModal] = useState<{
    id: string;
    request: any;
    receiptNote: string;
    items: Array<{
      productId: string;
      productName: string;
      unit: string;
      dispatchedQuantity: number;
      receivedQuantity: number;
      damagedQuantity: number;
      missingQuantity: number;
    }>;
  } | null>(null);
  const [resolveModal, setResolveModal] = useState<{ id: string; resolutionNote: string } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ id: string; reason: string } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ request: any } | null>(null);

  const [saving, setSaving] = useState(false);

  // New Request Form State
  const [requestNotes, setRequestNotes] = useState("");
  const [items, setItems] = useState<ProductItem[]>([
    { productId: "", productName: "", requestedQuantity: 1, unit: "kg" },
  ]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        franchiseProductRequestsApi.getAll(),
        productsFullApi.getAll(),
      ];
      if (isAdmin) {
        promises.push(franchiseApi.getAll());
      }

      const results = await Promise.all(promises);
      const rRes = results[0];
      const pRes = results[1];
      const fRes = results[2];

      const rawRequests = Array.isArray(rRes?.data) ? rRes.data : [];

      // Security scoping: Franchise Admin only sees own branch requests
      const filteredRequests = isFranchiseAdmin && user?.franchiseId
        ? rawRequests.filter((r: any) => r.franchiseId === user.franchiseId || r.franchise?.id === user.franchiseId)
        : rawRequests;

      setRequests(filteredRequests);
      setProducts(Array.isArray(pRes?.data) ? pRes.data : []);
      if (fRes?.data) {
        setFranchises(Array.isArray(fRes.data) ? fRes.data : fRes.data.franchises || []);
      }
    } catch (e: any) {
      console.error("Failed to load requests:", e);
      toast.error(e?.response?.data?.error ?? "Failed to load product requests");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isFranchiseAdmin, user?.franchiseId]);

  useEffect(() => {
    if (!authLoading) {
      fetchAll();
    }
  }, [authLoading, fetchAll]);

  const queryProductId = searchParams.get("productId");
  useEffect(() => {
    if (queryProductId && products.length > 0 && isFranchiseAdmin) {
      const prod = products.find((p: any) => p.id === queryProductId);
      if (prod) {
        setItems([{
          productId: prod.id,
          productName: prod.name,
          unit: prod.unit || "kg",
          requestedQuantity: 10,
        }]);
        setShowCreateModal(true);
      }
    }
  }, [queryProductId, products, isFranchiseAdmin]);

  // Real-time custom event refresh listener
  useEffect(() => {
    const handleRefresh = () => fetchAll();
    window.addEventListener("erp:refresh-product-requests", handleRefresh);
    return () => window.removeEventListener("erp:refresh-product-requests", handleRefresh);
  }, [fetchAll]);

  // Create Form Helpers
  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", productName: "", requestedQuantity: 1, unit: "kg" }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, field: keyof ProductItem, value: any) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        if (field === "productId") {
          const prod = products.find((p: any) => p.id === value);
          return {
            ...it,
            productId: value,
            productName: prod?.name ?? "",
            unit: prod?.unit || "kg", // Unit derived automatically from Product Master
          };
        }
        return { ...it, [field]: value };
      })
    );
  };

  // Submit New Request
  const handleCreateRequest = async () => {
    if (!isFranchiseAdmin) {
      toast.error("Only Franchise Admins can submit product requests");
      return;
    }
    const fid = user?.franchiseId;
    if (!fid) {
      toast.error("Your user account is not linked to any franchise branch");
      return;
    }

    if (items.length === 0 || items.some((it) => !it.productId)) {
      toast.error("Please select a product for each line");
      return;
    }

    if (items.some((it) => !Number.isFinite(it.requestedQuantity) || it.requestedQuantity <= 0)) {
      toast.error("Quantity must be greater than zero");
      return;
    }

    const uniqueProductIds = new Set(items.map((item) => item.productId));
    if (uniqueProductIds.size !== items.length) {
      toast.error("The same product cannot be added twice");
      return;
    }

    setSaving(true);
    try {
      const res = await franchiseProductRequestsApi.create({
        franchiseId: fid,
        requestNotes: requestNotes.trim() || undefined,
        products: items.map(({ productId, productName, unit, requestedQuantity }) => ({
          productId,
          productName,
          unit,
          requestedQuantity: Number(requestedQuantity),
        })),
      });

      const created = res?.data;
      const reqNum = created?.requestNumber || `FPR-${Date.now().toString().slice(-4)}`;
      const fName = (user as any)?.franchiseName || (user as any)?.franchise?.name || "Blackbulls";

      window.dispatchEvent(
        new CustomEvent("erp:notify-stock-request", {
          detail: {
            franchiseId: fid,
            franchiseName: fName,
            requestNumber: reqNum,
            id: created?.id || "",
            products: items.map(({ productName, requestedQuantity, unit }) => ({
              productName,
              requestedQuantity: Number(requestedQuantity),
              unit: unit || "KG",
            })),
          },
        })
      );

      toast.success("Product request submitted to Central HQ!");
      setShowCreateModal(false);
      setRequestNotes("");
      setItems([{ productId: "", productName: "", requestedQuantity: 1, unit: "kg" }]);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to submit request:", e);
      toast.error(e?.response?.data?.error ?? "Failed to submit product request");
    } finally {
      setSaving(false);
    }
  };

  // Super Admin: Approve with Item Quantities
  const handleConfirmApproval = async () => {
    if (!isAdmin || !approveModal) return;
    setSaving(true);
    try {
      await franchiseProductRequestsApi.approve(approveModal.id, {
        adminResponse: approveModal.note.trim() || undefined,
        items: approveModal.items.map((it) => ({
          productId: it.productId,
          approvedQuantity: Number(it.approvedQuantity ?? it.requestedQuantity),
          itemStatus: (it.approvedQuantity ?? it.requestedQuantity) === 0
            ? "REJECTED"
            : (it.approvedQuantity ?? it.requestedQuantity) < it.requestedQuantity
            ? "PARTIALLY_APPROVED"
            : "APPROVED",
          adminNote: it.adminNote,
        })),
      });
      toast.success("Request approved successfully");
      setApproveModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to approve request:", e);
      toast.error(e?.response?.data?.error ?? "Failed to approve request");
    } finally {
      setSaving(false);
    }
  };

  // Super Admin: Reject with Reason
  const handleConfirmRejection = async () => {
    if (!isAdmin || !rejectModal) return;
    if (!rejectModal.reason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setSaving(true);
    try {
      await franchiseProductRequestsApi.reject(rejectModal.id, {
        rejectionReason: rejectModal.reason.trim(),
      });
      toast.success("Request rejected");
      setRejectModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to reject request:", e);
      toast.error(e?.response?.data?.error ?? "Failed to reject request");
    } finally {
      setSaving(false);
    }
  };

  // Super Admin: Start Processing (Stock Reservation)
  const handleStartProcessing = async () => {
    if (!isAdmin || !processModal) return;
    setSaving(true);
    try {
      await franchiseProductRequestsApi.startProcessing(processModal.id);
      toast.success("Processing started & stock reserved");
      setProcessModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to start processing:", e);
      toast.error(e?.response?.data?.error ?? "Failed to start processing");
    } finally {
      setSaving(false);
    }
  };

  // Super Admin: Dispatch
  const handleConfirmDispatch = async () => {
    if (!isAdmin || !dispatchModal) return;
    if (!dispatchModal.dispatchReference.trim() || !dispatchModal.transporter.trim()) {
      toast.error("Challan/Reference number and Transporter are required");
      return;
    }
    setSaving(true);
    try {
      await franchiseProductRequestsApi.dispatch(dispatchModal.id, {
        dispatchDate: dispatchModal.dispatchDate,
        dispatchReference: dispatchModal.dispatchReference.trim(),
        transporter: dispatchModal.transporter.trim(),
        vehicleNumber: dispatchModal.vehicleNumber.trim() || undefined,
        trackingNumber: dispatchModal.trackingNumber.trim() || undefined,
        dispatchNote: dispatchModal.dispatchNote.trim() || undefined,
        items: dispatchModal.items,
      });
      toast.success("Stock dispatched successfully");
      setDispatchModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to dispatch request:", e);
      toast.error(e?.response?.data?.error ?? "Failed to dispatch stock");
    } finally {
      setSaving(false);
    }
  };

  // Franchise Admin: Confirm Receipt (Handles Clean Delivery vs Delivery Issue)
  const handleConfirmReceipt = async () => {
    if (!isFranchiseAdmin || !receiptModal) return;
    const hasDiscrepancy = receiptModal.items.some(
      (it) => (it.damagedQuantity || 0) > 0 || (it.missingQuantity || 0) > 0
    );

    if (hasDiscrepancy && !confirm("You have reported damaged or missing items. This will flag a DELIVERY ISSUE to Central HQ. Proceed?")) {
      return;
    }

    setSaving(true);
    try {
      await franchiseProductRequestsApi.confirmReceipt(receiptModal.id, {
        receiptNote: receiptModal.receiptNote.trim() || undefined,
        items: receiptModal.items.map((it) => ({
          productId: it.productId,
          receivedQuantity: Number(it.receivedQuantity || 0),
          damagedQuantity: Number(it.damagedQuantity || 0),
          missingQuantity: Number(it.missingQuantity || 0),
        })),
      });

      toast.success(hasDiscrepancy ? "Delivery discrepancy reported to HQ" : "Delivery receipt confirmed & stock inwarded!");
      setReceiptModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to confirm receipt:", e);
      toast.error(e?.response?.data?.error ?? "Failed to confirm receipt");
    } finally {
      setSaving(false);
    }
  };

  // Super Admin: Resolve Delivery Issue
  const handleResolveDeliveryIssue = async () => {
    if (!isAdmin || !resolveModal) return;
    if (!resolveModal.resolutionNote.trim()) {
      toast.error("Please enter a resolution note");
      return;
    }
    setSaving(true);
    try {
      await franchiseProductRequestsApi.resolveDeliveryIssue(resolveModal.id, {
        resolutionNote: resolveModal.resolutionNote.trim(),
      });
      toast.success("Delivery issue resolved");
      setResolveModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to resolve issue:", e);
      toast.error(e?.response?.data?.error ?? "Failed to resolve issue");
    } finally {
      setSaving(false);
    }
  };

  // Franchise Admin: Cancel PENDING Request
  const handleConfirmCancellation = async () => {
    if (!isFranchiseAdmin || !cancelModal) return;
    setSaving(true);
    try {
      await franchiseProductRequestsApi.cancel(cancelModal.id, {
        cancellationReason: cancelModal.reason.trim() || undefined,
      });
      toast.success("Request cancelled");
      setCancelModal(null);
      await fetchAll();
    } catch (e: any) {
      console.error("Failed to cancel request:", e);
      toast.error(e?.response?.data?.error ?? "Failed to cancel request");
    } finally {
      setSaving(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
    if (isAdmin && franchiseFilter !== "ALL") {
      const matchFid = req.franchiseId === franchiseFilter || req.franchise?.id === franchiseFilter;
      if (!matchFid) return false;
    }
    if (fromDate) {
      if (new Date(req.createdAt) < new Date(fromDate)) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(req.createdAt) > end) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (req.franchise?.name ?? "").toLowerCase().includes(q);
      const matchReqNum = (req.requestNumber ?? "").toLowerCase().includes(q);
      const matchId = (req.id ?? "").toLowerCase().includes(q);
      const matchNotes = (req.notes ?? req.requestNotes ?? "").toLowerCase().includes(q);
      const prods: any[] = req.products ?? (req.details as any)?.products ?? [];
      const matchProducts = prods.some((p: any) =>
        (p.productName ?? "").toLowerCase().includes(q)
      );
      if (!matchName && !matchReqNum && !matchId && !matchNotes && !matchProducts) {
        return false;
      }
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  if (authLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-500">Checking permissions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 bg-white dark:bg-card p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-gray-500 dark:text-slate-400 hover:text-orange-500"
            title="Refresh requests"
          >
            <RefreshCw size={18} className={clsx(loading && "animate-spin text-orange-500")} />
          </button>

          {/* New Request Button - ONLY FOR FRANCHISE ADMIN */}
          {isFranchiseAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={18} strokeWidth={2.5} /> + New Product Request
            </button>
          )}
        </div>
      </div>

      {/* ── Status Stat Counters ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {(["ALL", "PENDING", "APPROVED", "PROCESSING", "DISPATCHED", "DELIVERY_ISSUE", "DELIVERED", "REJECTED"] as const).map((s) => {
          const count = s === "ALL" ? requests.length : requests.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                "p-3 rounded-2xl border text-left transition-all relative",
                statusFilter === s
                  ? "bg-white dark:bg-card border-orange-500 ring-2 ring-orange-500/20 shadow-sm"
                  : "bg-white dark:bg-card border-gray-100 dark:border-white/5 hover:border-gray-200"
              )}
            >
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider truncate">
                {s === "DELIVERY_ISSUE" ? "Issues" : s === "ALL" ? "Total" : s}
              </p>
              <p className="text-xl font-black text-gray-900 dark:text-white mt-0.5">{count}</p>
            </button>
          );
        })}
      </div>

      {/* ── Pending Alert Banner for HQ ──────────────────────── */}
      {isAdmin && pendingCount > 0 && (
        <div className="flex items-center justify-between px-5 py-3.5 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span className="text-sm font-bold">
              {pendingCount} Franchise Request{pendingCount > 1 ? "s" : ""} awaiting Super Admin review & approval
            </span>
          </div>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className="text-xs font-black bg-amber-500 text-white px-3.5 py-1.5 rounded-xl hover:bg-amber-600 transition-all"
          >
            Review Pending
          </button>
        </div>
      )}

      {/* ── Filter Controls & Search Bar ─────────────────────── */}
      <div className="bg-white dark:bg-card rounded-3xl border border-gray-100 dark:border-white/5 p-4 space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1">
          {(["ALL", "PENDING", "APPROVED", "PROCESSING", "DISPATCHED", "DELIVERY_ISSUE", "DELIVERED", "REJECTED", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
                statusFilter === s
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:bg-orange-50 hover:text-orange-600"
              )}
            >
              {s === "ALL" ? "All Requests" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            {isAdmin && franchises.length > 0 && (
              <select
                value={franchiseFilter}
                onChange={(e) => setFranchiseFilter(e.target.value)}
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Franchises</option>
                {franchises.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-1.5 text-xs text-gray-500">
              <Calendar size={13} />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-xs text-gray-700 dark:text-slate-300 focus:outline-none"
                title="From date"
              />
              <span>to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-xs text-gray-700 dark:text-slate-300 focus:outline-none"
                title="To date"
              />
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(""); setToDate(""); }} className="text-gray-400 hover:text-red-500">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search request #, product, branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl pl-9 pr-8 py-2 text-xs font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Direct URL 403 Unauthorized Access Guard ────────── */}
      {isFranchiseAdmin && highlightedId && !loading && !requests.some(r => r.id === highlightedId) && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-600 dark:text-rose-400 font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-rose-500 shrink-0" />
            <span>403 Forbidden: You do not have permission to view or manage stock requests belonging to another franchise branch.</span>
          </div>
          <Link href="/franchise/requests" className="underline hover:opacity-80">
            View My Requests
          </Link>
        </div>
      )}

      {/* ── Request List ─────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-gray-400">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-card rounded-3xl border border-gray-100 dark:border-white/5 p-8 space-y-3">
          <div className="w-14 h-14 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-400">
            <CheckCircle2 size={28} />
          </div>
          <p className="text-base font-bold text-gray-800 dark:text-slate-200">No requests found</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "ALL" || fromDate
              ? "Try adjusting your filters or search keywords."
              : isFranchiseAdmin
              ? "You haven't placed any product requests yet. Click '+ New Product Request' to start."
              : "No product requests found in the system."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const prods: ProductItem[] = req.products ?? (req.details as any)?.products ?? [];
            const isHighlighted = highlightedId === req.id;
            const statusStyle = STATUS_CONFIG[req.status as ReqStatus] ?? STATUS_CONFIG.PENDING;
            const reqNumber = req.requestNumber || `FPR-${new Date(req.createdAt).getFullYear()}-${String(req.id).slice(0, 4).toUpperCase()}`;

            return (
              <div
                key={req.id}
                id={`request-${req.id}`}
                className={clsx(
                  "bg-white dark:bg-card rounded-3xl border p-6 transition-all space-y-5",
                  isHighlighted
                    ? "border-orange-500 ring-4 ring-orange-500/20 shadow-lg"
                    : "border-gray-100 dark:border-white/5 hover:shadow-md"
                )}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                      <Building2 size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-black text-gray-900 dark:text-white">
                          {req.franchise?.name ?? "Franchise Branch"}
                        </h3>
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30">
                          {reqNumber}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 font-medium">
                        <Clock size={12} />
                        Requested: {new Date(req.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {req.requestedBy && <span>· by {req.requestedBy}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={clsx("px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase border", statusStyle.badge)}>
                      {statusStyle.label}
                    </span>
                    <button
                      onClick={() => setHistoryModal({ request: req })}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
                      title="View Audit History"
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>

                {/* ── Status Lifecycle Stepper Visualizer ──────── */}
                <div className="py-2 px-3 bg-gray-50/70 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5">
                  <div className="flex items-center justify-between text-xs font-bold gap-2 overflow-x-auto">
                    {[
                      { step: "Requested", done: true },
                      { step: "Approved", done: ["APPROVED", "PROCESSING", "DISPATCHED", "DELIVERY_ISSUE", "DELIVERED"].includes(req.status) },
                      { step: "Processing", done: ["PROCESSING", "DISPATCHED", "DELIVERY_ISSUE", "DELIVERED"].includes(req.status) },
                      { step: "Dispatched", done: ["DISPATCHED", "DELIVERY_ISSUE", "DELIVERED"].includes(req.status) },
                      {
                        step: req.status === "DELIVERY_ISSUE" ? "Delivery Issue" : "Delivered",
                        done: ["DELIVERED", "DELIVERY_ISSUE"].includes(req.status),
                        isIssue: req.status === "DELIVERY_ISSUE"
                      },
                    ].map((st, i, arr) => (
                      <div key={st.step} className="flex items-center gap-2 shrink-0">
                        <div className={clsx(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                          st.isIssue
                            ? "bg-red-500 text-white"
                            : st.done
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                        )}>
                          {st.done ? <Check size={11} strokeWidth={3} /> : i + 1}
                        </div>
                        <span className={clsx(
                          "text-[11px]",
                          st.isIssue
                            ? "text-red-500 font-black"
                            : st.done
                            ? "text-gray-900 dark:text-white font-bold"
                            : "text-gray-400"
                        )}>
                          {st.step}
                        </span>
                        {i < arr.length - 1 && (
                          <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 ml-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Branch Note */}
                {(req.notes || req.requestNotes) && (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/20 rounded-2xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                    <MessageSquare size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-black">Branch Request Note:</span> {req.notes || req.requestNotes}
                    </div>
                  </div>
                )}

                {/* HQ Admin Response / Rejection Reason */}
                {req.adminResponse && (
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/30 rounded-2xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                    <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <span className="font-black">Central HQ Response:</span> {req.adminResponse}
                    </div>
                  </div>
                )}

                {req.rejectionReason && (
                  <div className="p-3 bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30 rounded-2xl text-xs text-red-900 dark:text-red-300 flex items-start gap-2.5">
                    <XCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                    <div>
                      <span className="font-black">Rejection Reason:</span> {req.rejectionReason}
                    </div>
                  </div>
                )}

                {/* Dispatch Details Card */}
                {["DISPATCHED", "DELIVERY_ISSUE", "DELIVERED"].includes(req.status) && (
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/30 rounded-2xl text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-300">
                      <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                        <Truck size={14} /> Dispatch & Logistics Details
                      </span>
                      {req.dispatchedAt && (
                        <span className="text-[11px] text-gray-500 font-medium">
                          Dispatched: {new Date(req.dispatchedAt).toLocaleDateString("en-IN")}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-gray-700 dark:text-slate-300">
                      <div>
                        <p className="text-[10px] text-gray-400">Challan / Ref #</p>
                        <p className="font-black">{req.dispatchReference || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Transporter</p>
                        <p className="font-black">{req.transporter || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Vehicle #</p>
                        <p className="font-black">{req.vehicleNumber || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Tracking #</p>
                        <p className="font-black">{req.trackingNumber || "N/A"}</p>
                      </div>
                    </div>
                    {req.dispatchNote && (
                      <p className="text-[11px] text-gray-600 dark:text-slate-400 pt-1">
                        <span className="font-bold">Dispatch Note:</span> {req.dispatchNote}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Product Items Matrix ────────────────────── */}
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Product Demand & Inventory Matrix ({prods.length})
                  </p>
                  <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/5">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-white/5 text-gray-400 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-white/5">
                        <tr>
                          <th className="py-2.5 px-3.5">Product</th>
                          <th className="py-2.5 px-3 text-center">Unit</th>
                          <th className="py-2.5 px-3 text-center">Requested</th>
                          <th className="py-2.5 px-3 text-center">Approved</th>
                          <th className="py-2.5 px-3 text-center">Dispatched</th>
                          <th className="py-2.5 px-3 text-center">Received</th>
                          {req.status === "DELIVERY_ISSUE" && (
                            <th className="py-2.5 px-3 text-center text-red-500">Discrepancy</th>
                          )}
                          <th className="py-2.5 px-3 text-right">Line Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
                        {prods.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3.5 font-bold text-gray-900 dark:text-white">
                              {item.productName}
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-500">{item.unit}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-gray-800 dark:text-slate-200">
                              {item.requestedQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                              {item.approvedQuantity !== undefined ? item.approvedQuantity : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                              {item.dispatchedQuantity !== undefined ? item.dispatchedQuantity : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {item.receivedQuantity !== undefined ? item.receivedQuantity : "-"}
                            </td>
                            {req.status === "DELIVERY_ISSUE" && (
                              <td className="py-2.5 px-3 text-center text-red-500 font-bold">
                                {(item.damagedQuantity || 0) > 0 && `Damaged: ${item.damagedQuantity} `}
                                {(item.missingQuantity || 0) > 0 && `Missing: ${item.missingQuantity}`}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300">
                                {item.itemStatus || req.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Action Buttons Footer ──────────────────── */}
                <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-gray-400 font-medium">
                    {req.status === "PENDING" && "Awaiting HQ approval"}
                    {req.status === "APPROVED" && "Approved. Ready for processing & stock reservation."}
                    {req.status === "PROCESSING" && "HQ is preparing goods. Ready for dispatch."}
                    {req.status === "DISPATCHED" && "Goods in transit. Awaiting branch delivery receipt."}
                    {req.status === "DELIVERY_ISSUE" && "Discrepancy reported by branch. Awaiting HQ resolution."}
                    {req.status === "DELIVERED" && "Delivery completed & stock inwarded to branch inventory."}
                  </div>

                  {/* Super Admin Operations */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {req.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => setApproveModal({
                              id: req.id,
                              items: prods.map(p => ({ ...p, approvedQuantity: p.requestedQuantity, itemStatus: "APPROVED" })),
                              note: ""
                            })}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                          >
                            <CheckCircle2 size={14} /> Review & Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: req.id, reason: "" })}
                            className="flex items-center gap-1.5 px-4 py-2 border border-red-200 dark:border-red-800/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-bold transition-all"
                          >
                            <XCircle size={14} /> Reject Request
                          </button>
                        </>
                      )}

                      {req.status === "APPROVED" && (
                        <button
                          onClick={() => setProcessModal({ id: req.id, request: req })}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          <PackageCheck size={14} /> Start Processing & Reserve Stock
                        </button>
                      )}

                      {req.status === "PROCESSING" && (
                        <button
                          onClick={() => setDispatchModal({
                            id: req.id,
                            request: req,
                            dispatchDate: new Date().toISOString().split("T")[0],
                            dispatchReference: `DC-${Date.now().toString().slice(-6)}`,
                            transporter: "",
                            vehicleNumber: "",
                            trackingNumber: "",
                            dispatchNote: "",
                            items: prods.map(p => ({
                              productId: p.productId,
                              dispatchedQuantity: p.approvedQuantity || p.requestedQuantity
                            }))
                          })}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          <Truck size={14} /> Dispatch Goods (Issue DC)
                        </button>
                      )}

                      {req.status === "DELIVERY_ISSUE" && (
                        <button
                          onClick={() => setResolveModal({ id: req.id, resolutionNote: "" })}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          <ShieldCheck size={14} /> Resolve Delivery Discrepancy
                        </button>
                      )}
                    </div>
                  )}

                  {/* Franchise Admin Operations */}
                  {isFranchiseAdmin && (
                    <div className="flex items-center gap-2">
                      {req.status === "PENDING" && (
                        <button
                          onClick={() => setCancelModal({ id: req.id, reason: "" })}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-bold transition-all"
                        >
                          <Trash2 size={14} /> Cancel Request
                        </button>
                      )}

                      {req.status === "DISPATCHED" && (
                        <button
                          onClick={() => setReceiptModal({
                            id: req.id,
                            request: req,
                            receiptNote: "",
                            items: prods.map(p => ({
                              productId: p.productId,
                              productName: p.productName,
                              unit: p.unit,
                              dispatchedQuantity: p.dispatchedQuantity || p.approvedQuantity || p.requestedQuantity,
                              receivedQuantity: p.dispatchedQuantity || p.approvedQuantity || p.requestedQuantity,
                              damagedQuantity: 0,
                              missingQuantity: 0,
                            }))
                          })}
                          className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
                        >
                          <PackageCheck size={15} /> Confirm Receipt & Inward Stock
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 1. New Request Modal (Franchise Admin) ────────────── */}
      {showCreateModal && isFranchiseAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col border border-gray-100 dark:border-white/10 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">New Product Request</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Request finished goods supply from Central Home House production
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Products & Quantities *
                  </label>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600">
                    <Plus size={14} /> Add Product
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-white/5 p-2.5 rounded-2xl border border-gray-200/70 dark:border-white/5">
                      <div className="col-span-6">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(i, "productId", e.target.value)}
                          className="w-full bg-white dark:bg-[#181b26] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                          <option value="" className="text-gray-400">Select product...</option>
                          {products.map((p: any) => (
                            <option key={p.id} value={p.id} className="text-gray-900 dark:text-white py-1">
                              {p.name} {p.sku ? `(${p.sku})` : ""} · [{p.unit || "kg"}]
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          min={1}
                          step="any"
                          placeholder="Qty"
                          value={item.requestedQuantity || ""}
                          onChange={(e) => updateItem(i, "requestedQuantity", Number(e.target.value))}
                          className="w-full bg-white dark:bg-[#181b26] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                      </div>

                      {/* Product unit is read-only from Product Master */}
                      <div className="col-span-2">
                        <input
                          type="text"
                          readOnly
                          value={item.unit || "kg"}
                          className="w-full bg-gray-100 dark:bg-white/10 border border-transparent rounded-xl px-2 py-2 text-xs font-bold text-gray-500 text-center cursor-not-allowed"
                          title="Product Unit (read-only from Master)"
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-500">
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Optional Branch Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Urgent demand for upcoming festival weekend..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none font-medium"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-white/5 flex gap-3 justify-end bg-gray-50/50 dark:bg-white/[0.02]">
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-slate-300">
                Cancel
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={saving || items.every((it) => !it.productId)}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-orange-500/20"
              >
                {saving ? "Submitting..." : "Submit Product Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Review & Approve Modal (Super Admin) ─────────── */}
      {approveModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-gray-100 dark:border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={18} /> Review & Approve Demand
              </h2>
              <button onClick={() => setApproveModal(null)} className="p-1 text-gray-400">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              You can approve the full requested quantity, adjust to a lower quantity, or reject individual lines.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {approveModal.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{item.productName}</p>
                    <p className="text-[10px] text-gray-400">Requested: {item.requestedQuantity} {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400">Approve:</span>
                    <input
                      type="number"
                      min={0}
                      max={item.requestedQuantity}
                      value={item.approvedQuantity ?? item.requestedQuantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setApproveModal(prev => prev ? {
                          ...prev,
                          items: prev.items.map((it, i) => i === idx ? { ...it, approvedQuantity: val } : it)
                        } : null);
                      }}
                      className="w-20 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1 text-xs font-bold text-center"
                    />
                    <span className="text-[10px] text-gray-400">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                HQ Admin Response Note (Optional)
              </label>
              <textarea
                rows={2}
                value={approveModal.note}
                onChange={(e) => setApproveModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                placeholder="Add notes for the franchise regarding production timeline or allocation..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setApproveModal(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600">
                Cancel
              </button>
              <button onClick={handleConfirmApproval} disabled={saving} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold">
                {saving ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Reject Request Modal (Super Admin) ────────────── */}
      {rejectModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-gray-100 dark:border-white/10">
            <h2 className="text-base font-black text-red-500 flex items-center gap-2">
              <XCircle size={18} /> Reject Product Request
            </h2>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                placeholder="State the reason for rejecting this request..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmRejection} disabled={saving || !rejectModal.reason.trim()} className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold">
                {saving ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Start Processing Modal (Super Admin) ──────────── */}
      {processModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-gray-100 dark:border-white/10">
            <h2 className="text-base font-black text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <PackageCheck size={18} /> Start Processing & Reserve Stock
            </h2>
            <p className="text-xs text-gray-500">
              Starting processing will verify Central HQ finished-goods availability and transition approved quantities to <strong>Reserved Stock</strong>.
            </p>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 rounded-2xl text-xs text-purple-900 dark:text-purple-300">
              <p className="font-bold uppercase text-[10px] tracking-wider mb-1">Atomic Stock Reservation Rule</p>
              <p>Reserved stock cannot be allocated to other sales or branch transfers while processing.</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setProcessModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleStartProcessing} disabled={saving} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold">
                {saving ? "Processing..." : "Confirm & Reserve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Dispatch Logistics Modal (Super Admin) ────────── */}
      {dispatchModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-gray-100 dark:border-white/10 max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Truck size={18} /> Dispatch Goods & Issue Delivery Challan
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Challan / Ref # *</label>
                <input
                  type="text"
                  value={dispatchModal.dispatchReference}
                  onChange={(e) => setDispatchModal(prev => prev ? { ...prev, dispatchReference: e.target.value } : null)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Dispatch Date *</label>
                <input
                  type="date"
                  value={dispatchModal.dispatchDate}
                  onChange={(e) => setDispatchModal(prev => prev ? { ...prev, dispatchDate: e.target.value } : null)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Transporter / Method *</label>
                <input
                  type="text"
                  placeholder="e.g. Self Van / VRL Logistics"
                  value={dispatchModal.transporter}
                  onChange={(e) => setDispatchModal(prev => prev ? { ...prev, transporter: e.target.value } : null)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Vehicle # (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TN-38-AB-1234"
                  value={dispatchModal.vehicleNumber}
                  onChange={(e) => setDispatchModal(prev => prev ? { ...prev, vehicleNumber: e.target.value } : null)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Dispatch Note</label>
              <textarea
                rows={2}
                placeholder="Add delivery instructions or driver contact..."
                value={dispatchModal.dispatchNote}
                onChange={(e) => setDispatchModal(prev => prev ? { ...prev, dispatchNote: e.target.value } : null)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setDispatchModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmDispatch} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
                {saving ? "Dispatching..." : "Confirm Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Confirm Receipt Modal (Franchise Admin) ───────── */}
      {receiptModal && isFranchiseAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-gray-100 dark:border-white/10 max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <PackageCheck size={18} /> Confirm Goods Receipt & Inward Stock
            </h2>
            <p className="text-xs text-gray-500">
              Verify the received quantities against dispatched stock. Damaged/short goods will be flagged as a discrepancy.
            </p>

            <div className="space-y-3">
              {receiptModal.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-gray-900 dark:text-white">{item.productName}</span>
                    <span className="text-indigo-600">Dispatched: {item.dispatchedQuantity} {item.unit}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5 font-bold">Good Received</label>
                      <input
                        type="number"
                        min={0}
                        max={item.dispatchedQuantity}
                        value={item.receivedQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setReceiptModal(prev => prev ? {
                            ...prev,
                            items: prev.items.map((it, i) => i === idx ? { ...it, receivedQuantity: val } : it)
                          } : null);
                        }}
                        className="w-full bg-white dark:bg-card border rounded-xl px-2.5 py-1 text-xs font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-red-500 block mb-0.5 font-bold">Damaged</label>
                      <input
                        type="number"
                        min={0}
                        value={item.damagedQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setReceiptModal(prev => prev ? {
                            ...prev,
                            items: prev.items.map((it, i) => i === idx ? { ...it, damagedQuantity: val } : it)
                          } : null);
                        }}
                        className="w-full bg-white dark:bg-card border border-red-200 dark:border-red-800/40 text-red-500 rounded-xl px-2.5 py-1 text-xs font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-500 block mb-0.5 font-bold">Missing / Short</label>
                      <input
                        type="number"
                        min={0}
                        value={item.missingQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setReceiptModal(prev => prev ? {
                            ...prev,
                            items: prev.items.map((it, i) => i === idx ? { ...it, missingQuantity: val } : it)
                          } : null);
                        }}
                        className="w-full bg-white dark:bg-card border border-amber-200 dark:border-amber-800/40 text-amber-500 rounded-xl px-2.5 py-1 text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Receipt Note</label>
              <textarea
                rows={2}
                placeholder="Add receipt comments or remarks on package condition..."
                value={receiptModal.receiptNote}
                onChange={(e) => setReceiptModal(prev => prev ? { ...prev, receiptNote: e.target.value } : null)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setReceiptModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmReceipt} disabled={saving} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold">
                {saving ? "Inwarding..." : "Confirm & Inward Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Resolve Delivery Issue Modal (Super Admin) ──── */}
      {resolveModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-gray-100 dark:border-white/10">
            <h2 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <ShieldCheck size={18} /> Resolve Delivery Discrepancy
            </h2>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Resolution Note *
              </label>
              <textarea
                rows={3}
                value={resolveModal.resolutionNote}
                onChange={(e) => setResolveModal(prev => prev ? { ...prev, resolutionNote: e.target.value } : null)}
                placeholder="e.g. Credit note issued for damaged boxes / Replacement batch sent in transfer #123..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setResolveModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleResolveDeliveryIssue} disabled={saving || !resolveModal.resolutionNote.trim()} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold">
                {saving ? "Resolving..." : "Resolve Discrepancy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. Cancel Request Modal (Franchise Admin) ───────── */}
      {cancelModal && isFranchiseAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-gray-100 dark:border-white/10">
            <h2 className="text-base font-black text-gray-800 dark:text-white flex items-center gap-2">
              <Trash2 size={18} className="text-red-500" /> Cancel Pending Request
            </h2>
            <p className="text-xs text-gray-500">
              Are you sure you want to cancel this request? The status will update to <strong>CANCELLED</strong> in the audit log.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                Cancellation Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                placeholder="Specify reason for cancelling..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">
                Close
              </button>
              <button onClick={handleConfirmCancellation} disabled={saving} className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold">
                {saving ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. Audit History Modal ──────────────────────────── */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-gray-100 dark:border-white/10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <History size={18} /> Lifecycle Audit History
              </h2>
              <button onClick={() => setHistoryModal(null)} className="p-1 text-gray-400">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {(historyModal.request.statusHistory || [
                {
                  action: "REQUEST_CREATED",
                  fromStatus: "NONE",
                  toStatus: "PENDING",
                  performedBy: historyModal.request.requestedBy || "Franchise Admin",
                  performedAt: historyModal.request.createdAt,
                  note: historyModal.request.notes || historyModal.request.requestNotes,
                },
                ...(historyModal.request.status !== "PENDING" ? [{
                  action: `STATUS_${historyModal.request.status}`,
                  fromStatus: "PENDING",
                  toStatus: historyModal.request.status,
                  performedBy: historyModal.request.status === "CANCELLED" ? "Franchise Admin" : "Central HQ",
                  performedAt: historyModal.request.updatedAt || historyModal.request.createdAt,
                  note: historyModal.request.adminResponse || historyModal.request.rejectionReason,
                }] : [])
              ]).map((hist: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-orange-600 dark:text-orange-400">{hist.action || "Status Change"}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(hist.performedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-slate-300">
                    By: <strong>{hist.performedBy}</strong> {hist.performedByRole ? `(${hist.performedByRole})` : ""}
                  </p>
                  {hist.note && (
                    <p className="text-[11px] text-gray-500 italic bg-white dark:bg-card p-2 rounded-xl mt-1">
                      &ldquo;{hist.note}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setHistoryModal(null)} className="px-5 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FranchiseRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-gray-400">Loading...</p>
        </div>
      }
    >
      <FranchiseRequestsContent />
    </Suspense>
  );
}
