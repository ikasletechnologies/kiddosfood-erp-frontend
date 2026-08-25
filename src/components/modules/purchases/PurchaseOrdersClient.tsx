"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Plus, Search, Filter, Calendar as CalendarIcon,
  ChevronDown, Store, Clock, CheckCircle2, XCircle, AlertCircle,
  Trash2, Wallet, RefreshCw, ChevronLeft, ChevronRight, Download, X, Settings, Pencil
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
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-600 border-amber-200",
  APPROVED: "bg-orange-50 text-orange-600 border-orange-200",
  SENT: "bg-blue-50 text-blue-600 border-blue-200",
  PARTIALLY_RECEIVED: "bg-orange-50 text-orange-600 border-orange-200",
  RECEIVED: "bg-emerald-50 text-emerald-600 border-emerald-200",
  CLOSED: "bg-emerald-900 text-white border-emerald-800",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
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
    if (showPaymentModal || viewingDetailsPO) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showPaymentModal, viewingDetailsPO]);

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
      confirmStyle: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white",
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
    return viewingDetailsPO.goodsReceipts.reduce((sum: number, grn: any) => {
      const grnItem = grn.items?.find((i: any) => i.itemId === itemId);
      return sum + (grnItem?.receivedQty || 0);
    }, 0);
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
    <div className={clsx("min-h-screen bg-gray-50 text-gray-800", (showPaymentModal || viewingDetailsPO) && "relative z-[10000]")}>
      {/* ── Page Header Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Company Profile"
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={fetchAll}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Spend", value: formatCurrency(totalSpend), color: "text-gray-700", dot: "bg-gray-400" },
            { label: "Pending GRNs", value: String(orders.filter(o => o.status === 'APPROVED' || o.status === 'SENT').length), color: "text-[#f58220]", dot: "bg-[#f58220]" },
            { label: "All Invoices", value: String(orders.filter(o => o.invoiceStatus === 'PENDING').length), color: "text-red-600", dot: "bg-red-500" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", card.dot)} />
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className={clsx("text-lg font-bold mt-0.5", card.color)}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
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
            {["ALL", "PENDING_APPROVAL", "APPROVED", "RECEIVED", "CLOSED"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  filterStatus === s ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {s === "ALL" ? "All" : s === "PENDING_APPROVAL" ? "Pending Approval" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
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
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-[#f58220]">
                          <ShoppingCart className="h-6 w-6" />
                        </div>
                        <p className="text-gray-800 font-semibold text-sm">No Purchase Orders Found</p>
                        <p className="text-gray-500 text-xs">Create your first PO to start ordering raw materials.</p>
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
                    <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-800 text-xs">{formatERPNumber("PO", po.poNumber || po.id, po.createdAt)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{format(new Date(po.createdAt), "dd MMM yyyy")}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-sm">{po.vendor?.name || "Unknown"}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{po.vendor?.category || 'General Supplier'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-800 text-sm">{formatCurrency(po.totalAmount)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
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
                            <div className={clsx("text-xs font-medium", isBefore(new Date(po.expectedDeliveryDate), new Date()) && po.status !== 'RECEIVED' ? "text-red-600 font-semibold" : "text-gray-700")}>
                              {format(new Date(po.expectedDeliveryDate), "dd MMM yyyy")}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">Expected</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={clsx("text-xs font-semibold", balance <= 0 ? "text-emerald-600" : "text-[#f58220]")}>
                          {balance <= 0 ? "Paid" : `${formatCurrency(balance)} Balance Due`}
                        </div>
                        {(po.advanceApplied || 0) > 0 && (
                          <div className="text-xs text-emerald-600 mt-0.5">
                            {formatCurrency(po.advanceApplied)} Advance Applied
                          </div>
                        )}
                        {/* Only offer to apply advance when the vendor actually
                            has unused credit left — getVendors() already nets
                            out whatever's been applied/reserved elsewhere, so
                            this stays correctly hidden once advance is spent. */}
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
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold hover:bg-emerald-100 transition-colors mr-1"
                            >
                              Approve
                            </button>
                          )}

                          {(po.status === 'APPROVED' || po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (
                            <button
                              type="button"
                              onClick={() => window.location.href = `/purchases/grn?poId=${po.id}`}
                              className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs font-bold hover:bg-orange-100 transition-colors mr-1"
                            >
                              Receive Goods
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => window.location.href = `/purchases/edit/${po.id}`}
                            className="p-1.5 text-gray-400 hover:text-[#f58220] hover:bg-orange-50 rounded transition-colors"
                            title="Edit PO"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingPO(po)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
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

      {viewingPO && <GSTInvoice order={viewingPO} vendor={viewingPO.vendor} companyDetails={currentCompany} documentType="PURCHASE_ORDER" onClose={() => setViewingPO(null)} />}

      {showSettings && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0f1117] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #f58220, #e8740e)", boxShadow: "0 8px 24px rgba(245,130,32,0.25)" }}>
                    <Settings size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Company Profile</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Required for GST Invoices</p>
                  </div>
                </div>
                <button onClick={() => { setShowSettings(false); setProfileRequiredForInvoice(false); setProfileErrors({}); }} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400"><X size={18} /></button>
              </div>

              {profileRequiredForInvoice && !profileErrors._api && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 font-semibold">
                  Complete your company profile to generate GST Invoices. Fields marked * are required.
                </div>
              )}

              {profileErrors._api && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 font-semibold">
                  {profileErrors._api}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProfile.name}
                      placeholder="My Restaurant"
                      onChange={(e) => { setEditingProfile({ ...editingProfile, name: e.target.value }); setProfileErrors({ ...profileErrors, name: "" }); }}
                      className={clsx("w-full h-11 bg-slate-50 dark:bg-white/5 px-4 rounded-xl font-bold text-xs border", profileErrors.name ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-white/10")}
                    />
                    {profileErrors.name && <p className="text-[10px] text-red-500 ml-1 mt-0.5">{profileErrors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      GSTIN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProfile.gstin}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      onChange={(e) => { setEditingProfile({ ...editingProfile, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) }); setProfileErrors({ ...profileErrors, gstin: "" }); }}
                      className={clsx("w-full h-11 bg-slate-50 dark:bg-white/5 px-4 rounded-xl font-bold text-xs border font-mono tracking-widest", profileErrors.gstin ? "border-red-400" : "border-slate-200 dark:border-white/10")}
                    />
                    {profileErrors.gstin && <p className="text-[10px] text-red-500 ml-1 mt-0.5">{profileErrors.gstin}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editingProfile.address}
                    placeholder="Full registered address..."
                    onChange={(e) => { setEditingProfile({ ...editingProfile, address: e.target.value }); setProfileErrors({ ...profileErrors, address: "" }); }}
                    className={clsx("w-full h-20 bg-slate-50 dark:bg-white/5 p-4 rounded-xl font-bold text-xs border resize-none", profileErrors.address ? "border-red-400" : "border-slate-200 dark:border-white/10")}
                  />
                  {profileErrors.address && <p className="text-[10px] text-red-500 ml-1 mt-0.5">{profileErrors.address}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProfile.phone}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setEditingProfile({ ...editingProfile, phone: v }); setProfileErrors({ ...profileErrors, phone: "" }); }}
                      className={clsx("w-full h-11 bg-slate-50 dark:bg-white/5 px-4 rounded-xl font-bold text-xs border", profileErrors.phone ? "border-red-400" : "border-slate-200 dark:border-white/10")}
                    />
                    {profileErrors.phone && <p className="text-[10px] text-red-500 ml-1 mt-0.5">{profileErrors.phone}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input
                      type="email"
                      value={editingProfile.email}
                      placeholder="Enter company email..."
                      onChange={(e) => { setEditingProfile({ ...editingProfile, email: e.target.value }); setProfileErrors({ ...profileErrors, email: "" }); }}
                      className={clsx("w-full h-11 bg-slate-50 dark:bg-white/5 px-4 rounded-xl font-bold text-xs border", profileErrors.email ? "border-red-400" : "border-slate-200 dark:border-white/10")}
                    />
                    {profileErrors.email && <p className="text-[10px] text-red-500 ml-1 mt-0.5">{profileErrors.email}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingProfile.state}
                    placeholder="Tamil Nadu"
                    onChange={(e) => { setEditingProfile({ ...editingProfile, state: e.target.value }); setProfileErrors({ ...profileErrors, state: "" }); }}
                    className={clsx("w-full h-11 bg-slate-50 dark:bg-white/5 px-4 rounded-xl font-bold text-xs border", profileErrors.state ? "border-red-400" : "border-slate-200 dark:border-white/10")}
                  />
                  {profileErrors.state && <p className="text-[10px] text-red-500 ml-1 mt-0.5">{profileErrors.state}</p>}
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => { setShowSettings(false); setProfileRequiredForInvoice(false); setProfileErrors({}); }} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancel</button>
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="flex-[2] py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #f58220, #e8740e)" }}
                >
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
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
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-[#f58220]" />
                <h2 className="text-base font-semibold text-gray-800">
                  Purchase Order <span className="text-gray-400 font-normal ml-1">#{viewingDetailsPO.poNumber || viewingDetailsPO.id.substring(0,8)}</span>
                </h2>
                {viewingDetailsPO.vendor?.name && (
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md ml-2">
                    {viewingDetailsPO.vendor.name}
                  </span>
                )}
              </div>
              <button onClick={() => setViewingDetailsPO(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                <X size={17} />
              </button>
            </div>

            <div className="px-6 border-b border-gray-200 flex gap-6 bg-white shrink-0">
              {["OVERVIEW", "ITEMS", "GRN", "AUDIT"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPoDetailsTab(tab as any)}
                  className={clsx(
                    "text-xs font-semibold uppercase tracking-wider py-3 border-b-2 transition-all",
                    poDetailsTab === tab ? "border-[#f58220] text-[#f58220]" : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {poDetailsTab === "OVERVIEW" && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Document Header */}
                  <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start gap-6 bg-slate-50/50 dark:bg-slate-800/20">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Purchase Order</h2>
                      <p className="text-sm font-semibold text-slate-500">{viewingDetailsPO.poNumber || viewingDetailsPO.id.substring(0, 8)}</p>
                      
                      <div className="mt-6 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                        <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider", 
                          viewingDetailsPO.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" : 
                          viewingDetailsPO.status === 'PENDING_APPROVAL' ? "bg-amber-100 text-amber-700" : 
                          "bg-slate-100 text-slate-700"
                        )}>
                          {viewingDetailsPO.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div className="text-slate-500 font-medium">PO Date:</div>
                        <div className="font-bold text-slate-800 dark:text-white">{formatDate(viewingDetailsPO.createdAt)}</div>
                        
                        <div className="text-slate-500 font-medium">Expected Delivery:</div>
                        <div className="font-bold text-slate-800 dark:text-white">{formatDate(viewingDetailsPO.expectedDeliveryDate)}</div>
                        
                        <div className="text-slate-500 font-medium">Payment Terms:</div>
                        <div className="font-bold text-slate-800 dark:text-white">{viewingDetailsPO.vendor?.paymentTerms || "Immediate"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor & Delivery Info */}
                  <div className="p-8 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vendor Details</h3>
                      <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">
                        {viewingDetailsPO.vendor?.name} 
                        {viewingDetailsPO.vendor?.vendorCode && <span className="text-slate-400 ml-1">({viewingDetailsPO.vendor.vendorCode})</span>}
                      </p>
                      {viewingDetailsPO.vendor?.contactPerson && <p className="text-xs text-slate-500 font-medium mb-1">{viewingDetailsPO.vendor.contactPerson}</p>}
                      {viewingDetailsPO.vendor?.email && <p className="text-xs text-slate-500">{viewingDetailsPO.vendor.email}</p>}
                      {viewingDetailsPO.vendor?.phone && <p className="text-xs text-slate-500">{viewingDetailsPO.vendor.phone}</p>}
                      {viewingDetailsPO.vendor?.address && <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">{viewingDetailsPO.vendor.address}</p>}
                    </div>
                    
                    <div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Delivery Destination</h3>
                      <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">
                        {viewingDetailsPO.warehouse?.name || viewingDetailsPO.franchise?.name || (
                          <span className="text-rose-500 italic">Update Warehouse</span>
                        )}
                      </p>
                      {(viewingDetailsPO.warehouse?.address || viewingDetailsPO.franchise?.address) && (
                        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                          {viewingDetailsPO.warehouse?.address || viewingDetailsPO.franchise?.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="p-8 bg-slate-50/30 dark:bg-slate-800/10">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Financial Summary</h3>
                    
                    <div className="flex flex-col md:flex-row justify-end items-start gap-12">
                      <div className="flex-1 w-full max-w-md">
                        {/* Notes */}
                        {(viewingDetailsPO.internalNotes || viewingDetailsPO.vendorNotes || viewingDetailsPO.deliveryInstructions) && (
                          <div className="space-y-4">
                            {viewingDetailsPO.vendorNotes && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendor Notes</p>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">{viewingDetailsPO.vendorNotes}</p>
                              </div>
                            )}
                            {viewingDetailsPO.deliveryInstructions && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Instructions</p>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">{viewingDetailsPO.deliveryInstructions}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full md:w-72 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Subtotal</span>
                          <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(viewingDetailsPO.subtotal || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Discount</span>
                          <span className="font-bold text-emerald-600">-{formatCurrency(viewingDetailsPO.discountAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">GST (All)</span>
                          <span className="font-bold text-slate-800 dark:text-white">{formatCurrency((viewingDetailsPO.cgst || 0) + (viewingDetailsPO.sgst || 0) + (viewingDetailsPO.igst || 0))}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Freight</span>
                          <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(viewingDetailsPO.freightCost || 0)}</span>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Grand Total</span>
                            <span className="text-lg font-black text-orange-600">{formatCurrency(viewingDetailsPO.totalAmount)}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-sm pt-2">
                          <span className="text-slate-500 font-medium">Advance Applied</span>
                          <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(viewingDetailsPO.advanceApplied || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg mt-1">
                          <span className="text-rose-600 dark:text-rose-400 font-bold">Balance Due</span>
                          <span className="font-black text-rose-600 dark:text-rose-400">{formatCurrency(viewingDetailsPO.balanceDue ?? viewingDetailsPO.balance ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signatures / Audit Info */}
                  <div className="p-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center text-xs">
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
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Price</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">GST</th>
                        <th className="px-4 py-3 font-semibold text-[10px] text-slate-500 uppercase tracking-widest text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {viewingDetailsPO.poItems?.map((item: any, idx: number) => {
                        const rQty = getReceivedQty(item.inventoryItemId);
                        const pQty = Math.max(0, item.quantity - rQty);
                        return (
                          <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.inventoryItem?.itemCode || item.inventoryItem?.id?.slice(0, 8) || "—"}</td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-800 dark:text-white">{item.inventoryItem?.name}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{item.quantity}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-emerald-600">{rQty}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-amber-600">{pQty}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{item.inventoryItem?.unit ? item.inventoryItem.unit.replace(/^1\s*/, "") : "unit"}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-3 text-xs text-right text-slate-500">{item.gstRate || 0}%</td>
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
                          <td colSpan={7} className="text-center py-10 text-slate-400 text-xs font-semibold">
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
                              <td className="px-4 py-3 text-xs font-mono text-slate-500">{grn.grnNumber || grn.id?.slice(0, 8) || "—"}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300">{formatDate(grn.createdAt)}</td>
                              <td className="px-4 py-3 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">{totalReceived}</td>
                              <td className="px-4 py-3 text-xs text-right font-semibold text-emerald-600">{totalAccepted}</td>
                              <td className="px-4 py-3 text-xs text-right font-semibold text-rose-600">{totalRejected}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{viewingDetailsPO.warehouse?.name || viewingDetailsPO.franchise?.name || (
                                <span className="text-rose-500 italic font-medium">Update Warehouse</span>
                              )}</td>
                              <td className="px-4 py-3 text-xs">
                                <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider", 
                                  grn.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : 
                                  grn.status === 'PENDING_INSPECTION' ? "bg-amber-50 text-amber-600 border-amber-200" : 
                                  "bg-slate-50 text-slate-500 border-slate-200"
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
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">By: {event.user} · {event.reference}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewingPO(viewingDetailsPO)}
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
          <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800">
            {confirmConfig.icon && <confirmConfig.icon size={28} className={confirmConfig.confirmStyle?.includes("rose") ? "text-rose-500" : confirmConfig.confirmStyle?.includes("emerald") ? "text-emerald-500" : "text-orange-500"} />}
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

