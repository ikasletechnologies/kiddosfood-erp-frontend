"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Plus, Search, Filter, Calendar as CalendarIcon,
  ChevronDown, Store, Clock, CheckCircle2, XCircle, AlertCircle,
  Trash2, Wallet, RefreshCw, ChevronLeft, ChevronRight, Download, X, Settings
} from "lucide-react";
import Link from "next/link";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, startOfDay, isBefore } from "date-fns";
import { vendorsApi, purchaseOrdersApi, rawMaterialsApi, settingsApi, accountsApi } from "../../../lib/api";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import GSTInvoice from "../../documents/GSTInvoice";
import api from "../../../lib/api";
import AddMaterialDrawer from "../inventory/AddMaterialDrawer";
import RecordPaymentModal from "./RecordPaymentModal";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

interface POItem {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  price: number;
  hsnCode: string;
  gstRate: number;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10",
  PENDING_APPROVAL: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40",
  APPROVED: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40",
  SENT: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40",
  PARTIALLY_RECEIVED: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40",
  RECEIVED: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40",
  CLOSED: "bg-emerald-900 text-white border-emerald-800 dark:bg-emerald-900/50 dark:border-emerald-700/50",
  CANCELLED: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40",
};

const STATUS_ICONS: Record<string, any> = {
  DRAFT: Clock,
  PENDING_APPROVAL: Clock,
  APPROVED: CheckCircle2,
  SENT: CheckCircle2,
  PARTIALLY_RECEIVED: Store,
  RECEIVED: Store,
  CLOSED: CheckCircle2,
  CANCELLED: XCircle,
};

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

import { formatCurrency, formatERPNumber } from "@/lib/utils";


export default function PurchaseOrdersClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingPO, setPayingPO] = useState<any>(null);

  const [viewingPO, setViewingPO] = useState<any>(null);
  const [viewingDetailsPO, setViewingDetailsPO] = useState<any>(null);
  const [poDetailsTab, setPoDetailsTab] = useState<"OVERVIEW" | "ITEMS" | "GRN" | "AUDIT">("OVERVIEW");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const EMPTY_PROFILE = { name: "", gstin: "", address: "", phone: "", email: "", state: "" };
  const [editingProfile, setEditingProfile] = useState<any>(EMPTY_PROFILE);
  const [showSettings, setShowSettings] = useState(false);
  const [profileRequiredForInvoice, setProfileRequiredForInvoice] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle?: string;
    icon?: any;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    confirmStyle: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20",
    icon: AlertCircle,
    onConfirm: () => {}
  });

  const closeConfirm = () => setConfirmConfig({ ...confirmConfig, isOpen: false });

  useEffect(() => {
    if (showPaymentModal || viewingDetailsPO || showSettings) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showPaymentModal, viewingDetailsPO, showSettings]);

  const currentCompany = companyProfile || FALLBACK_COMPANY;
  const isProfileComplete = !!(companyProfile?.name && companyProfile?.gstin && companyProfile?.address);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, vRes, rmRes, cpRes, aRes] = await Promise.all([
        purchaseOrdersApi.getAll().catch(() => ({ data: [] })),
        vendorsApi.getAll().catch(() => ({ data: [] })),
        rawMaterialsApi.getAll(false, undefined, 'FINISHED_GOOD').catch(() => ({ data: [] })),
        settingsApi.getCompanyProfile().catch(() => ({ data: null })),
        accountsApi.getAll().catch(() => ({ data: [] }))
      ]);
      setOrders(poRes.data ?? []);
      setVendors(vRes.data ?? []);
      setMaterials(rmRes.data ?? []);
      const accs = aRes.data || [];
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
      if (cpRes.data) {
        setCompanyProfile(cpRes.data);
        setEditingProfile(cpRes.data);
      } else {
        setEditingProfile({ name: "", gstin: "", address: "", phone: "", email: "", state: "" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveProfile = async () => {
    const errors: Record<string, string> = {};
    const p = editingProfile;

    if (!p.name?.trim()) errors.name = "Company name is required.";
    if (!p.gstin?.trim()) {
      errors.gstin = "GSTIN is required.";
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(p.gstin.trim())) {
      errors.gstin = "Invalid GSTIN — must be 15 characters (e.g. 22AAAAA0000A1Z5).";
    }
    if (!p.address?.trim()) errors.address = "Address is required.";
    if (!p.phone?.trim()) {
      errors.phone = "Phone number is required.";
    } else if (!/^\d{10}$/.test(p.phone.trim())) {
      errors.phone = "Phone must be exactly 10 digits.";
    }
    if (!p.state?.trim()) errors.state = "State is required.";
    if (p.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
      errors.email = "Enter a valid email address.";
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setProfileSaving(true);
    try {
      const res = await settingsApi.updateCompanyProfile({
        ...p,
        name: p.name.trim(),
        gstin: p.gstin.trim().toUpperCase(),
        address: p.address.trim(),
        phone: p.phone.trim(),
        email: p.email?.trim() || null,
        state: p.state.trim(),
      });
      setCompanyProfile(res.data);
      setEditingProfile(res.data);
      setProfileErrors({});
      setShowSettings(false);
      setProfileRequiredForInvoice(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || "Failed to save profile. Please try again.";
      setProfileErrors({ _api: msg });
    } finally {
      setProfileSaving(false);
    }
  };


  const handleApplyAdvance = async (id: string) => {
    try {
      await purchaseOrdersApi.applyAdvance(id);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to apply advance.");
    }
  };

  const handleCancel = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Cancel Purchase Order",
      message: "Are you sure you want to cancel this purchase order? This action cannot be undone.",
      confirmText: "Yes, Cancel PO",
      confirmStyle: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 text-white",
      icon: XCircle,
      onConfirm: async () => {
        closeConfirm();
        try {
          await purchaseOrdersApi.cancel(id);
          toast.success("Purchase order cancelled successfully.");
          fetchAll();
        } catch (e: any) {
          toast.error(e?.response?.data?.error ?? "Failed to cancel PO");
        }
      }
    });
  };

  const handleApprove = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Approve Purchase Order",
      message: "Are you sure you want to approve this purchase order? Once approved, it can be sent to the vendor.",
      confirmText: "Approve PO",
      confirmStyle: "bg-[#f58220] hover:bg-[#e8740e] shadow-[#f58220]/20 text-white",
      icon: CheckCircle2,
      onConfirm: async () => {
        closeConfirm();
        try {
          await api.patch(`/api/purchase-orders/${id}/approve`);
          toast.success("Purchase order approved successfully.");
          fetchAll();
        } catch (e: any) {
          toast.error(e?.response?.data?.error ?? "Failed to approve PO");
        }
      }
    });
  };

  const filtered = orders.filter((o) => {
    const matchesSearch = !search || o.vendor?.name?.toLowerCase().includes(search.toLowerCase()) || o.id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "ALL" || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalSpend = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const totalPaid = orders.reduce((s, o) => s + (o.paid ?? 0), 0);
  const totalBalance = Math.max(0, totalSpend - totalPaid);
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  const getReceivedQty = (itemId: string) => {
    if (!viewingDetailsPO || !viewingDetailsPO.goodsReceipts) return 0;
    // GoodsReceiptItem's join key to the PO item is `materialId`, not
    // `itemId` (which doesn't exist on that model) — this previously always
    // failed to match, so Received/Pending here silently showed 0/full-qty
    // regardless of what was actually received.
    return viewingDetailsPO.goodsReceipts.reduce((sum: number, grn: any) => {
      const grnItem = grn.items?.find((i: any) => i.materialId === itemId);
      return sum + (grnItem?.receivedQty || 0);
    }, 0);
  };

  // Actual/received unit price for a PO line, from completed GRNs only (the
  // point at which it's actually recognized financially) — weighted by
  // accepted qty across GRNs if the same material was received more than
  // once. The PO's own price (item.price) is never touched; this is purely
  // additional display so "PO Price ₹50 vs Actual ₹55" is visible without
  // mutating the historical PO record.
  const getActualPriceInfo = (itemId: string): { actualPrice: number; overridden: boolean } | null => {
    if (!viewingDetailsPO || !viewingDetailsPO.goodsReceipts) return null;
    let qtySum = 0;
    let valueSum = 0;
    let overridden = false;
    viewingDetailsPO.goodsReceipts.forEach((grn: any) => {
      if (grn.status !== "COMPLETED") return;
      const grnItem = grn.items?.find((i: any) => i.materialId === itemId);
      if (grnItem && grnItem.acceptedQty > 0) {
        qtySum += grnItem.acceptedQty;
        valueSum += grnItem.acceptedQty * grnItem.price;
        if (grnItem.priceOverridden) overridden = true;
      }
    });
    if (qtySum === 0) return null;
    return { actualPrice: valueSum / qtySum, overridden };
  };

  const getAuditTimeline = () => {
    if (!viewingDetailsPO) return [];
    const timeline: Array<{ timestamp: Date; user: string; action: string; reference: string; color: string }> = [];

    // 1. PO Created
    timeline.push({
      timestamp: new Date(viewingDetailsPO.createdAt),
      user: "System",
      action: "Purchase Order Created",
      reference: `PO #${viewingDetailsPO.poNumber || viewingDetailsPO.id.slice(0, 8)}`,
      color: "bg-blue-500"
    });

    // 2. Approved
    if (viewingDetailsPO.approvedAt) {
      timeline.push({
        timestamp: new Date(viewingDetailsPO.approvedAt),
        user: viewingDetailsPO.approvedBy || "Admin",
        action: "Purchase Order Approved",
        reference: `Status: APPROVED`,
        color: "bg-emerald-500"
      });
    }

    // 3. GRNs
    if (viewingDetailsPO.goodsReceipts) {
      viewingDetailsPO.goodsReceipts.forEach((grn: any) => {
        timeline.push({
          timestamp: new Date(grn.createdAt),
          user: "QC Inspector",
          action: `Goods Receipt Note (${grn.status})`,
          reference: `GRN #${grn.grnNumber || grn.id.slice(0, 8)}`,
          color: grn.status === 'COMPLETED' ? "bg-emerald-500" : "bg-amber-500"
        });
      });
    }

    // 4. Invoices/Bills
    if (viewingDetailsPO.invoices) {
      viewingDetailsPO.invoices.forEach((inv: any) => {
        timeline.push({
          timestamp: new Date(inv.createdAt),
          user: "Accounts Admin",
          action: `Purchase Bill Created (${inv.status})`,
          reference: `Bill #${inv.invoiceNumber || inv.id.slice(0, 8)} - ${formatCurrency(inv.amount)}`,
          color: "bg-indigo-500"
        });
      });
    }

    return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  return (
    <div className={clsx("min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground", (showPaymentModal || viewingDetailsPO) && "relative z-[10000]")}>
      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title="Company Profile"
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={fetchAll}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
          <Link
            href="/purchases/new"
            onClick={() => localStorage.removeItem('draftPurchaseOrder')}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> New PO
          </Link>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 w-full min-w-0">
        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total Spend", value: formatCurrency(totalSpend), color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400" },
            { label: "Pending GRNs", value: String(orders.filter(o => o.status === 'APPROVED' || o.status === 'SENT').length), color: "text-[#f58220]", dot: "bg-[#f58220]" },
            { label: "All Invoices", value: String(orders.filter(o => o.invoiceStatus === 'PENDING').length), color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 shadow-sm min-w-0">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", card.dot)} />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{card.label}</p>
                <p className={clsx("text-base sm:text-lg font-bold mt-0.5 truncate", card.color)}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-card text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto custom-scrollbar bg-white dark:bg-card max-w-full">
            {["ALL", "PENDING_APPROVAL", "APPROVED", "RECEIVED", "CLOSED"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                  filterStatus === s ? "bg-[#f58220] text-white" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {s === "ALL" ? "All" : s === "PENDING_APPROVAL" ? "Pending Approval" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="text-left px-4 py-3">PO No</th>
                  <th className="text-left px-4 py-3">Vendor</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Delivery</th>
                  <th className="text-left px-4 py-3">Payment</th>
                  <th className="text-center px-4 py-3">Details</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-[#f58220]">
                          <ShoppingCart className="h-6 w-6" />
                        </div>
                        <p className="text-gray-800 dark:text-white font-semibold text-sm">No Purchase Orders Found</p>
                        <p className="text-gray-500 dark:text-slate-400 text-xs">Create your first PO to start ordering raw materials.</p>
                        <Link href="/purchases/new" onClick={() => localStorage.removeItem('draftPurchaseOrder')} className="mt-2 px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-semibold rounded-lg transition-colors">
                          Create New PO
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((po) => {
                  const currentPaid = po.paid ?? 0;
                  const balance = Math.max(0, (po.totalAmount ?? 0) - currentPaid);
                  const style = STATUS_STYLES[po.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-800 dark:text-white text-xs">{formatERPNumber("PO", po.poNumber || po.id, po.createdAt)}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{format(new Date(po.createdAt), "dd MMM yyyy")}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 dark:text-slate-200 text-sm">{po.vendor?.name || "Unknown"}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{po.vendor?.category || 'General Supplier'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-800 dark:text-white text-sm">{formatCurrency(po.totalAmount)}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          {po.receivedItemsCount || 0} / {po.totalItemsCount || 0} units
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style)}>
                          {po.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {po.expectedDeliveryDate ? (
                          <div>
                            <div className={clsx("text-xs font-medium", isBefore(new Date(po.expectedDeliveryDate), new Date()) && po.status !== 'RECEIVED' ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-700 dark:text-slate-300")}>
                              {format(new Date(po.expectedDeliveryDate), "dd MMM yyyy")}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Expected</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500 italic">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={clsx("text-xs font-semibold", balance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#f58220]")}>
                          {balance <= 0 ? "Paid" : `${formatCurrency(balance)} Balance Due`}
                        </div>
                        {(po.advanceApplied || 0) > 0 && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {formatCurrency(po.advanceApplied)} Advance Applied
                          </div>
                        )}
                        {/* Only offer to apply advance when the vendor actually
                            has unused credit left */}
                        {balance > 0 && (vendors.find(v => v.id === po.vendorId)?.advance || 0) > 0 && (
                          <button
                            onClick={() => handleApplyAdvance(po.id)}
                            className="text-xs text-[#f58220] hover:underline mt-0.5 block font-medium"
                          >
                            Apply Advance
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingDetailsPO(po)}
                          className="text-xs font-semibold text-[#f58220] hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {po.status === 'PENDING_APPROVAL' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(po.id)}
                              className="px-2.5 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40 rounded text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors mr-1"
                            >
                              Approve
                            </button>
                          )}

                          {(po.status === 'APPROVED' || po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (
                            <button
                              type="button"
                              onClick={() => window.location.href = `/purchases/grn?poId=${po.id}`}
                              className="px-2.5 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40 rounded text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors mr-1"
                            >
                              Receive Goods
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewingPO(po)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); setPayingPO(null); }}
        onSuccess={fetchAll}
        payingPO={payingPO}
        accounts={accounts}
        defaultAccountId={selectedAccountId}
      />

      {viewingPO && (
        <GSTInvoice
          order={viewingPO}
          vendor={viewingPO.vendor}
          companyDetails={currentCompany}
          documentType="PURCHASE_ORDER"
          terms={viewingPO.vendorNotes ? [viewingPO.vendorNotes] : (viewingPO.deliveryInstructions ? [viewingPO.deliveryInstructions] : undefined)}
          notes={viewingPO.internalNotes || viewingPO.notes || undefined}
          onClose={() => setViewingPO(null)}
        />
      )}

      {showSettings && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-[#0f1117] w-full max-w-lg rounded-2xl sm:rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden flex flex-col max-h-[calc(100dvh-24px)] sm:max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-[#0f1117]">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ background: "linear-gradient(135deg, #f58220, #e8740e)", boxShadow: "0 8px 24px rgba(245,130,32,0.25)" }}>
                  <Settings size={20} className="text-white sm:w-[22px] sm:h-[22px]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">Company Profile</h2>
                  <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">Required for GST Invoices</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowSettings(false); setProfileRequiredForInvoice(false); setProfileErrors({}); }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {profileRequiredForInvoice && !profileErrors._api && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold">
                  Complete your company profile to generate GST Invoices. Fields marked * are required.
                </div>
              )}

              {profileErrors._api && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-900/40 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold">
                  {profileErrors._api}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProfile.name}
                      placeholder="My Restaurant"
                      onChange={(e) => { setEditingProfile({ ...editingProfile, name: e.target.value }); setProfileErrors({ ...profileErrors, name: "" }); }}
                      className={clsx("w-full h-10 sm:h-11 bg-slate-50 dark:bg-white/5 px-3.5 sm:px-4 rounded-xl font-bold text-xs border outline-none transition-colors", profileErrors.name ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10 focus:border-[#f58220]")}
                    />
                    {profileErrors.name && <p className="text-[10px] text-red-500 ml-1 mt-0.5 font-medium">{profileErrors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                      GSTIN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProfile.gstin}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      onChange={(e) => { setEditingProfile({ ...editingProfile, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) }); setProfileErrors({ ...profileErrors, gstin: "" }); }}
                      className={clsx("w-full h-10 sm:h-11 bg-slate-50 dark:bg-white/5 px-3.5 sm:px-4 rounded-xl font-bold text-xs border font-mono tracking-widest outline-none transition-colors", profileErrors.gstin ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10 focus:border-[#f58220]")}
                    />
                    {profileErrors.gstin && <p className="text-[10px] text-red-500 ml-1 mt-0.5 font-medium">{profileErrors.gstin}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editingProfile.address}
                    placeholder="Full registered address..."
                    onChange={(e) => { setEditingProfile({ ...editingProfile, address: e.target.value }); setProfileErrors({ ...profileErrors, address: "" }); }}
                    className={clsx("w-full h-20 bg-slate-50 dark:bg-white/5 p-3.5 sm:p-4 rounded-xl font-bold text-xs border resize-none outline-none transition-colors", profileErrors.address ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10 focus:border-[#f58220]")}
                  />
                  {profileErrors.address && <p className="text-[10px] text-red-500 ml-1 mt-0.5 font-medium">{profileErrors.address}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProfile.phone}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setEditingProfile({ ...editingProfile, phone: v }); setProfileErrors({ ...profileErrors, phone: "" }); }}
                      className={clsx("w-full h-10 sm:h-11 bg-slate-50 dark:bg-white/5 px-3.5 sm:px-4 rounded-xl font-bold text-xs border outline-none transition-colors", profileErrors.phone ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10 focus:border-[#f58220]")}
                    />
                    {profileErrors.phone && <p className="text-[10px] text-red-500 ml-1 mt-0.5 font-medium">{profileErrors.phone}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Email</label>
                    <input
                      type="email"
                      value={editingProfile.email}
                      placeholder="Enter company email..."
                      onChange={(e) => { setEditingProfile({ ...editingProfile, email: e.target.value }); setProfileErrors({ ...profileErrors, email: "" }); }}
                      className={clsx("w-full h-10 sm:h-11 bg-slate-50 dark:bg-white/5 px-3.5 sm:px-4 rounded-xl font-bold text-xs border outline-none transition-colors", profileErrors.email ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10 focus:border-[#f58220]")}
                    />
                    {profileErrors.email && <p className="text-[10px] text-red-500 ml-1 mt-0.5 font-medium">{profileErrors.email}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingProfile.state}
                    placeholder="Tamil Nadu"
                    onChange={(e) => { setEditingProfile({ ...editingProfile, state: e.target.value }); setProfileErrors({ ...profileErrors, state: "" }); }}
                    className={clsx("w-full h-10 sm:h-11 bg-slate-50 dark:bg-white/5 px-3.5 sm:px-4 rounded-xl font-bold text-xs border outline-none transition-colors", profileErrors.state ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10 focus:border-[#f58220]")}
                  />
                  {profileErrors.state && <p className="text-[10px] text-red-500 ml-1 mt-0.5 font-medium">{profileErrors.state}</p>}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-8 py-3 sm:py-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setShowSettings(false); setProfileRequiredForInvoice(false); setProfileErrors({}); }}
                className="px-4 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="px-5 sm:px-8 py-2.5 sm:py-3 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #f58220, #e8740e)" }}
              >
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {viewingDetailsPO && mounted && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setViewingDetailsPO(null)} />
          <div className="bg-white dark:bg-[#0f1117] w-full max-w-2xl h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-[#0f1117] border-b border-gray-200 dark:border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-[#f58220]" />
                <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                  Purchase Order <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">#{viewingDetailsPO.poNumber || viewingDetailsPO.id.substring(0,8)}</span>
                </h2>
                {viewingDetailsPO.vendor?.name && (
                  <span className="text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 px-2.5 py-1 rounded-md ml-2">
                    {viewingDetailsPO.vendor.name}
                  </span>
                )}
              </div>
              <button onClick={() => setViewingDetailsPO(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-slate-400 transition-colors">
                <X size={17} />
              </button>
            </div>

            <div className="px-6 border-b border-gray-200 dark:border-white/10 flex gap-6 bg-white dark:bg-[#0f1117] shrink-0">
              {["OVERVIEW", "ITEMS", "GRN", "AUDIT"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPoDetailsTab(tab as any)}
                  className={clsx(
                    "text-xs font-semibold uppercase tracking-wider py-3 border-b-2 transition-all",
                    poDetailsTab === tab ? "border-[#f58220] text-[#f58220]" : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/50 dark:bg-[#0b0c14]">
              {poDetailsTab === "OVERVIEW" && (
                <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
                  {/* Document Header */}
                  <div className="p-8 border-b border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start gap-6 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Purchase Order</h2>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{viewingDetailsPO.poNumber || viewingDetailsPO.id.substring(0, 8)}</p>
                      
                      <div className="mt-6 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                        <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider", 
                          viewingDetailsPO.status === 'COMPLETED' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : 
                          viewingDetailsPO.status === 'PENDING_APPROVAL' ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" : 
                          "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300"
                        )}>
                          {viewingDetailsPO.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div className="text-slate-500 dark:text-slate-400 font-medium">PO Date:</div>
                        <div className="font-bold text-slate-800 dark:text-white">{formatDate(viewingDetailsPO.createdAt)}</div>
                        
                        <div className="text-slate-500 dark:text-slate-400 font-medium">Expected Delivery:</div>
                        <div className="font-bold text-slate-800 dark:text-white">{formatDate(viewingDetailsPO.expectedDeliveryDate)}</div>
                        
                        <div className="text-slate-500 dark:text-slate-400 font-medium">Payment Terms:</div>
                        <div className="font-bold text-slate-800 dark:text-white">{viewingDetailsPO.vendor?.paymentTerms || "Immediate"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor & Delivery Info */}
                  <div className="p-8 border-b border-slate-200 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vendor Details</h3>
                      <p className="text-sm font-bold text-slate-800 dark:text-white mb-2.5">
                        {viewingDetailsPO.vendor?.name || "Not provided"} 
                        {viewingDetailsPO.vendor?.vendorCode && (
                          <span className="text-slate-400 font-mono font-medium ml-1.5">({viewingDetailsPO.vendor.vendorCode})</span>
                        )}
                      </p>
                      
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 dark:text-slate-500 font-medium w-16 shrink-0">Phone:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                            {viewingDetailsPO.vendor?.contact || viewingDetailsPO.vendor?.phone || "Not provided"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 dark:text-slate-500 font-medium w-16 shrink-0">Email:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {viewingDetailsPO.vendor?.email || "Not provided"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 dark:text-slate-500 font-medium w-16 shrink-0">GSTIN:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 uppercase">
                            {viewingDetailsPO.vendor?.gstNumber || viewingDetailsPO.vendor?.gstin || "Not provided"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 pt-0.5">
                          <span className="text-slate-400 dark:text-slate-500 font-medium w-16 shrink-0">Address:</span>
                          <span className="text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
                            {[
                              viewingDetailsPO.vendor?.address,
                              viewingDetailsPO.vendor?.city,
                              viewingDetailsPO.vendor?.state,
                              viewingDetailsPO.vendor?.pincode
                            ].filter(Boolean).join(", ") || viewingDetailsPO.vendor?.address || "Not provided"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Delivery Destination</h3>
                      <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">
                        {viewingDetailsPO.warehouse?.name || viewingDetailsPO.franchise?.name || (
                          <span className="text-rose-500 italic">Update Warehouse</span>
                        )}
                      </p>
                      {(viewingDetailsPO.warehouse?.address || viewingDetailsPO.franchise?.address) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                          {viewingDetailsPO.warehouse?.address || viewingDetailsPO.franchise?.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="p-8 bg-slate-50/30 dark:bg-white/[0.01]">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Financial Summary</h3>
                    
                    <div className="flex flex-col md:flex-row justify-end items-start gap-12">
                      <div className="flex-1 w-full max-w-md">
                        {/* Notes & Terms */}
                        {Boolean(
                          viewingDetailsPO.internalNotes ||
                          viewingDetailsPO.notes ||
                          viewingDetailsPO.vendorNotes ||
                          viewingDetailsPO.deliveryInstructions
                        ) && (
                          <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes &amp; Terms</h3>
                            {(viewingDetailsPO.internalNotes || viewingDetailsPO.notes) && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Internal Remarks</p>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 p-3 rounded-lg whitespace-pre-wrap">
                                  {viewingDetailsPO.internalNotes || viewingDetailsPO.notes}
                                </p>
                              </div>
                            )}
                            {(viewingDetailsPO.vendorNotes || viewingDetailsPO.deliveryInstructions) && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier Instructions</p>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 p-3 rounded-lg whitespace-pre-wrap">
                                  {viewingDetailsPO.vendorNotes || viewingDetailsPO.deliveryInstructions}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full md:w-72 space-y-3">
                        {(() => {
                          // Once a completed GRN has produced a Purchase Bill,
                          // that bill's commercials (VendorInvoice — itself
                          // derived from GoodsReceiptItem's actual price via
                          // computeCommercialsFromPO) are the real financial
                          // position of this PO, not the PO's own ordered
                          // subtotal/GST/total. The PO's own fields are never
                          // mutated — `hasActualInvoice` just picks which set
                          // to display, and the original value is still shown
                          // as a reference line below Grand Total whenever it
                          // differs.
                          const hasActual = viewingDetailsPO.hasActualInvoice;
                          const subtotal = hasActual ? viewingDetailsPO.actualSubtotal : (viewingDetailsPO.subtotal || 0);
                          const discount = hasActual ? viewingDetailsPO.actualDiscountAmount : (viewingDetailsPO.discountAmount || 0);
                          const freight = hasActual ? viewingDetailsPO.actualFreightCost : (viewingDetailsPO.freightCost || 0);
                          const grandTotal = hasActual ? viewingDetailsPO.actualTotalAmount : viewingDetailsPO.totalAmount;
                          const balanceDue = hasActual ? viewingDetailsPO.actualBalanceDue : (viewingDetailsPO.balanceDue ?? viewingDetailsPO.balance ?? 0);
                          const originalDiffers = hasActual && Math.abs(grandTotal - viewingDetailsPO.totalAmount) > 0.01;

                          const companyState = (currentCompany?.state || "").toLowerCase().trim();
                          const vendorState = (viewingDetailsPO.vendor?.state || "").toLowerCase().trim();
                          const stateOfSupply = (viewingDetailsPO.stateOfSupply || "").toLowerCase().trim();
                          const isSameState = stateOfSupply && companyState
                            ? companyState === stateOfSupply
                            : !companyState || !vendorState
                              ? true
                              : vendorState.includes(companyState) || companyState.includes(vendorState);

                          let rawCgst = hasActual ? viewingDetailsPO.actualCgst : (viewingDetailsPO.cgst || 0);
                          let rawSgst = hasActual ? viewingDetailsPO.actualSgst : (viewingDetailsPO.sgst || 0);
                          let rawIgst = hasActual ? viewingDetailsPO.actualIgst : (viewingDetailsPO.igst || 0);

                          if (rawCgst === 0 && rawSgst === 0 && rawIgst === 0) {
                            const totalTax = (viewingDetailsPO.poItems || []).reduce((acc: number, it: any) => {
                              const itPrice = Number(it.price) || 0;
                              const itQty = Number(it.quantity) || 0;
                              const itGst = Number(it.gstRate) || 0;
                              return acc + (itPrice * itQty * (itGst / 100));
                            }, 0);
                            const roundedTax = Math.round(totalTax * 100) / 100;
                            if (isSameState) {
                              rawCgst = Math.round((roundedTax / 2) * 100) / 100;
                              rawSgst = Math.round((roundedTax - rawCgst) * 100) / 100;
                              rawIgst = 0;
                            } else {
                              rawIgst = roundedTax;
                              rawCgst = 0;
                              rawSgst = 0;
                            }
                          }

                          return (
                            <>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Subtotal</span>
                                <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(subtotal)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Discount</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">-{formatCurrency(discount)}</span>
                              </div>
                              {isSameState ? (
                                <>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">CGST</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(rawCgst)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">SGST</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(rawSgst)}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500 dark:text-slate-400 font-medium">IGST</span>
                                  <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(rawIgst)}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Freight</span>
                                <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(freight)}</span>
                              </div>

                              <div className="pt-3 border-t border-slate-200 dark:border-white/10">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                    {hasActual ? "Actual Received Value" : "Grand Total"}
                                  </span>
                                  <span className="text-lg font-black text-orange-600 dark:text-orange-400">{formatCurrency(grandTotal)}</span>
                                </div>
                                {originalDiffers && (
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Original PO Value</span>
                                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{formatCurrency(viewingDetailsPO.totalAmount)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-between items-center text-sm pt-2">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Advance Applied</span>
                                <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(viewingDetailsPO.advanceApplied || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg mt-1 border border-rose-200 dark:border-rose-900/40">
                                <span className="text-rose-600 dark:text-rose-400 font-bold">Balance Due</span>
                                <span className="font-black text-rose-600 dark:text-rose-400">{formatCurrency(balanceDue)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Signatures / Audit Info */}
                  <div className="p-8 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-center text-xs">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Created By</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300">System Entry</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approved By</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300">{viewingDetailsPO.approvedBy || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {poDetailsTab === "ITEMS" && (
                <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
                  <table className="w-full text-left border-collapse bg-slate-50 dark:bg-[#0b0c14]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-900/50">
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">Code</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">Material</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Ordered</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Received</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Pending</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">Unit</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">PO Price</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Actual Price</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Variance</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">
                          {(() => {
                            const companyState = (currentCompany?.state || "").toLowerCase().trim();
                            const vendorState = (viewingDetailsPO.vendor?.state || "").toLowerCase().trim();
                            const stateOfSupply = (viewingDetailsPO.stateOfSupply || "").toLowerCase().trim();
                            const isSameState = stateOfSupply && companyState
                              ? companyState === stateOfSupply
                              : !companyState || !vendorState
                                ? true
                                : vendorState.includes(companyState) || companyState.includes(vendorState);
                            return isSameState ? "GST (CGST+SGST)" : "IGST";
                          })()}
                        </th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {viewingDetailsPO.poItems?.map((item: any, idx: number) => {
                        const rQty = getReceivedQty(item.inventoryItemId);
                        const pQty = Math.max(0, item.quantity - rQty);
                        const actualInfo = getActualPriceInfo(item.inventoryItemId);
                        const variance = actualInfo ? Number((actualInfo.actualPrice - item.price).toFixed(2)) : 0;
                        const companyState = (currentCompany?.state || "").toLowerCase().trim();
                        const vendorState = (viewingDetailsPO.vendor?.state || "").toLowerCase().trim();
                        const stateOfSupply = (viewingDetailsPO.stateOfSupply || "").toLowerCase().trim();
                        const isSameState = stateOfSupply && companyState
                          ? companyState === stateOfSupply
                          : !companyState || !vendorState
                            ? true
                            : vendorState.includes(companyState) || companyState.includes(vendorState);
                        const gRate = Number(item.gstRate) || 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{item.inventoryItem?.itemCode || item.inventoryItem?.id?.slice(0, 8) || "—"}</td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-800 dark:text-white">{item.inventoryItem?.name}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{item.quantity}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">{rQty}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-amber-600 dark:text-amber-400">{pQty}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{item.inventoryItem?.unit ? item.inventoryItem.unit.replace(/^1\s*/, "") : "unit"}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold">
                              {actualInfo ? (
                                <span className={actualInfo.overridden ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}>
                                  {formatCurrency(actualInfo.actualPrice)}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-right font-semibold">
                              {actualInfo && variance !== 0 ? (
                                <span className={variance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                                  {variance > 0 ? "+" : ""}{formatCurrency(variance)}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-right text-slate-500 dark:text-slate-400">
                              {isSameState ? (
                                <div>
                                  <div>CGST: {(gRate / 2)}%</div>
                                  <div>SGST: {(gRate / 2)}%</div>
                                </div>
                              ) : (
                                <div>IGST: {gRate}%</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-right font-bold text-slate-800 dark:text-white">{formatCurrency(item.total || (item.quantity * item.price))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {poDetailsTab === "GRN" && (
                <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
                  <table className="w-full text-left border-collapse bg-slate-50 dark:bg-[#0b0c14]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-900/50">
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">GRN No</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Received</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Accepted</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Rejected</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">Warehouse</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {(!viewingDetailsPO.goodsReceipts || viewingDetailsPO.goodsReceipts.length === 0) ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                            No GRNs linked to this PO yet.
                          </td>
                        </tr>
                      ) : (
                        viewingDetailsPO.goodsReceipts.map((grn: any, idx: number) => {
                          const totalReceived = grn.items?.reduce((s: number, i: any) => s + (i.receivedQty || 0), 0) || 0;
                          const totalAccepted = grn.items?.reduce((s: number, i: any) => s + (i.acceptedQty || 0), 0) || 0;
                          const totalRejected = grn.items?.reduce((s: number, i: any) => s + (i.rejectedQty || 0), 0) || 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{grn.grnNumber || grn.id?.slice(0, 8) || "—"}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300">{formatDate(grn.createdAt)}</td>
                              <td className="px-4 py-3 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{totalReceived}</td>
                              <td className="px-4 py-3 text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">{totalAccepted}</td>
                              <td className="px-4 py-3 text-xs text-right font-semibold text-rose-600 dark:text-rose-400">{totalRejected}</td>
                              <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{viewingDetailsPO.warehouse?.name || viewingDetailsPO.franchise?.name || (
                                <span className="text-rose-500 italic font-medium">Update Warehouse</span>
                              )}</td>
                              <td className="px-4 py-3 text-xs">
                                <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider", 
                                  grn.status === 'COMPLETED' ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40" : 
                                  grn.status === 'PENDING_INSPECTION' ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" : 
                                  "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10"
                                )}>
                                  {grn.status?.replace(/_/g, ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {poDetailsTab === "AUDIT" && (
                <div className="space-y-6">
                  <div className="relative pl-8 border-l-2 border-slate-100 dark:border-white/5 ml-2 space-y-8">
                    {getAuditTimeline().map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className={clsx("absolute -left-[41px] top-0 w-4 h-4 rounded-full shadow-lg", event.color)} />
                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">{event.action}</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{format(event.timestamp, "dd MMM yyyy · HH:mm")}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 uppercase">By: {event.user} · {event.reference}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewingPO(viewingDetailsPO)}
                className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              >
                Download PDF
              </button>

              {viewingDetailsPO.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => {
                    handleApprove(viewingDetailsPO.id);
                    setViewingDetailsPO(null);
                  }}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#f58220] rounded-lg hover:bg-[#e8740e] shadow-sm transition-colors"
                >
                  Approve Order
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirmation Modal */}
      <Modal isOpen={confirmConfig.isOpen} onClose={closeConfirm} title={confirmConfig.title} size="sm">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={clsx(
            "w-16 h-16 rounded-full flex items-center justify-center border",
            confirmConfig.confirmStyle?.includes("rose")
              ? "bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-500"
              : confirmConfig.confirmStyle?.includes("emerald")
              ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-emerald-500"
              : "bg-orange-50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30 text-[#f58220]"
          )}>
            {confirmConfig.icon && <confirmConfig.icon size={28} />}
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
            {confirmConfig.message}
          </p>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={closeConfirm} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors">
            Cancel
          </button>
          <button 
            onClick={confirmConfig.onConfirm}
            className={clsx("flex-[2] py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all", confirmConfig.confirmStyle)}
          >
            {confirmConfig.confirmText}
          </button>
        </div>
      </Modal>
    </div>
  );
}

