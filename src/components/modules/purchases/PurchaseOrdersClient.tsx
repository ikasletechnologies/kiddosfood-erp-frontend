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
        rawMaterialsApi.getAll().catch(() => ({ data: [] })),
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

  function buildPurchaseOrderPdf(po: any, company: any): string {
    const contentObjects: string[] = [];
    const rowHeight = 20;
    const topMargin = 790;
    const bottomMargin = 50;
    const pageHeight = 842;
    const pageWidth = 595;
    const leftMargin = 40;
    const colWidths = [25, 190, 45, 45, 65, 55, 90];
    const headers = ["#", "Item Description", "Qty", "Unit", "Rate (Rs)", "Tax", "Amount (Rs)"];

    const items = po.poItems || po.items || [];
    let currentRow = 0;
    let pageNum = 1;

    const vendorName = (po.vendor?.name || "Unknown Vendor").replace(/[()\\\r\n]/g, "");
    const vendorGstin = (po.vendor?.gstNumber || po.vendor?.gstin || "-").replace(/[()\\\r\n]/g, "");
    const vendorPhone = (po.vendor?.contact || po.vendor?.phone || "-").replace(/[()\\\r\n]/g, "");
    const companyName = (company?.name || "KIDDOS FOODS").replace(/[()\\\r\n]/g, "");
    const poNum = (po.poNumber || po.id || "PO-001").replace(/[()\\\r\n]/g, "");
    const poDate = new Date(po.createdAt || Date.now()).toLocaleDateString();

    while (currentRow < items.length || pageNum === 1) {
      let y = topMargin;
      let stream = "";

      // Document Header
      stream += `BT /F2 16 Tf 0.96 0.51 0.13 rg ${leftMargin} ${y} Td (PURCHASE ORDER) Tj ET\n`;
      stream += `BT /F2 10 Tf 0.2 0.2 0.2 rg 400 ${y} Td (PO #: ${poNum}) Tj ET\n`;
      y -= 16;
      stream += `BT /F1 9 Tf 0.4 0.4 0.4 rg 400 ${y} Td (Date: ${poDate}) Tj ET\n`;
      stream += `BT /F2 11 Tf 0.1 0.1 0.1 rg ${leftMargin} ${y} Td (${companyName}) Tj ET\n`;
      y -= 22;

      // Line divider
      stream += `0.85 0.85 0.85 RG 1 w ${leftMargin} ${y} m ${leftMargin + 515} ${y} l S\n`;
      y -= 18;

      // Vendor Info Box
      stream += `0.97 0.97 0.98 rg ${leftMargin} ${y - 35} 515 45 re f\n`;
      stream += `0.88 0.88 0.90 RG 0.5 w ${leftMargin} ${y - 35} 515 45 re S\n`;

      stream += `BT /F2 9 Tf 0.3 0.3 0.3 rg ${leftMargin + 8} ${y - 2} Td (VENDOR DETAILS:) Tj ET\n`;
      stream += `BT /F2 10 Tf 0.1 0.1 0.1 rg ${leftMargin + 8} ${y - 16} Td (${vendorName}) Tj ET\n`;
      stream += `BT /F1 8.5 Tf 0.4 0.4 0.4 rg ${leftMargin + 8} ${y - 28} Td (GSTIN: ${vendorGstin}  |  Phone: ${vendorPhone}) Tj ET\n`;

      y -= 50;

      // Table Header
      stream += `0.94 0.95 0.96 rg ${leftMargin} ${y - 4} 515 18 re f\n`;
      stream += `0.7 0.7 0.7 RG 0.5 w ${leftMargin} ${y - 4} 515 18 re S\n`;

      let x = leftMargin + 4;
      headers.forEach((h, i) => {
        stream += `BT /F2 8.5 Tf 0.2 0.2 0.2 rg ${x} ${y} Td (${h}) Tj ET\n`;
        x += colWidths[i];
      });
      y -= rowHeight;

      // Table Items
      let subtotal = 0;
      while (currentRow < items.length && y > bottomMargin + 80) {
        const it = items[currentRow];
        const name = (it.inventoryItem?.name || it.name || "Item " + (currentRow + 1)).replace(/[()\\\r\n]/g, "").slice(0, 32);
        const qty = Number(it.quantity) || 0;
        const unit = (it.inventoryItem?.unit || it.unit || "Units").replace(/[()\\\r\n]/g, "");
        const price = Number(it.price) || 0;
        const gst = Number(it.gstRate ?? it.tax ?? 5);
        const amount = qty * price;
        subtotal += amount;

        stream += `0.9 0.9 0.9 RG 0.3 w ${leftMargin} ${y - 4} m ${leftMargin + 515} ${y - 4} l S\n`;

        const rowVals = [
          String(currentRow + 1),
          name,
          String(qty),
          unit,
          price.toLocaleString("en-IN"),
          gst + "%",
          amount.toLocaleString("en-IN")
        ];

        let rx = leftMargin + 4;
        rowVals.forEach((val, ci) => {
          stream += `BT /F1 8 Tf 0.15 0.15 0.15 rg ${rx} ${y} Td (${val}) Tj ET\n`;
          rx += colWidths[ci];
        });

        y -= rowHeight;
        currentRow++;
      }

      // Totals Box if last page
      if (currentRow >= items.length) {
        const grandTotal = Number(po.totalAmount) || subtotal;
        y -= 10;
        stream += `0.96 0.96 0.97 rg 350 ${y - 35} 205 45 re f\n`;
        stream += `0.8 0.8 0.8 RG 0.5 w 350 ${y - 35} 205 45 re S\n`;

        stream += `BT /F1 9 Tf 0.4 0.4 0.4 rg 360 ${y - 8} Td (Subtotal:) Tj ET\n`;
        stream += `BT /F1 9 Tf 0.2 0.2 0.2 rg 470 ${y - 8} Td (Rs ${subtotal.toLocaleString("en-IN")}) Tj ET\n`;

        stream += `BT /F2 11 Tf 0.96 0.51 0.13 rg 360 ${y - 26} Td (Grand Total:) Tj ET\n`;
        stream += `BT /F2 11 Tf 0.1 0.1 0.1 rg 470 ${y - 26} Td (Rs ${grandTotal.toLocaleString("en-IN")}) Tj ET\n`;
      }

      stream += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth / 2 - 20} 25 Td (Page ${pageNum}) Tj ET\n`;

      contentObjects.push(stream);
      pageNum++;
      if (currentRow >= items.length) break;
    }

    const numPages = contentObjects.length;
    const allObjs: string[] = [];
    allObjs.push("<< /Type /Catalog /Pages 2 0 R >>");

    const pageObjIds: string[] = [];
    for (let i = 0; i < numPages; i++) {
      pageObjIds.push(`${5 + i * 2} 0 R`);
    }
    allObjs.push(`<< /Type /Pages /Kids [${pageObjIds.join(" ")}] /Count ${numPages} >>`);
    allObjs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    allObjs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

    for (let i = 0; i < numPages; i++) {
      const pageObjId = 5 + i * 2;
      const contentObjId = 6 + i * 2;
      const contentStream = contentObjects[i];
      const streamLen = new TextEncoder().encode(contentStream).length;

      allObjs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`);
      allObjs.push(`<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream`);
    }

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    const encoder = new TextEncoder();
    allObjs.forEach((obj, i) => {
      offsets.push(encoder.encode(pdf).length);
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });

    const xrefStart = encoder.encode(pdf).length;
    pdf += `xref\n0 ${allObjs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(offset => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });

    pdf += `trailer\n<< /Size ${allObjs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return pdf;
  }

  const handleDownloadPdf = (po: any) => {
    try {
      const company = currentCompany || { name: "KIDDOS FOODS" };
      const pdfString = buildPurchaseOrderPdf(po, company);
      const blob = new Blob([pdfString], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const poNumClean = (po.poNumber || po.id || "PO").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.href = url;
      link.download = `Purchase_Order_${poNumClean}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Purchase Order PDF downloaded successfully!");
    } catch (err) {
      console.error("Failed to download PO PDF:", err);
      toast.error("Failed to download PDF. Please try again.");
    }
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

  return (
    <div className={clsx("min-h-screen bg-gray-50 text-gray-800", (showPaymentModal || viewingDetailsPO) && "relative z-[10000]")}>
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#f58220]" />
          <div>
            <h1 className="text-base font-bold text-gray-800">Purchase Orders</h1>
            <p className="text-xs text-gray-500">Buy raw materials from vendors</p>
          </div>
        </div>
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
                          {balance <= 0 ? "Paid" : formatCurrency(balance)}
                        </div>
                        {balance > 0 && vendors.find(v => v.id === po.vendorId)?.advance > 0 && (
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
                            onClick={() => handleDownloadPdf(po)}
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

      {viewingPO && <GSTInvoice order={viewingPO} vendor={viewingPO.vendor} companyDetails={currentCompany} onClose={() => setViewingPO(null)} />}

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
            <div className="p-8 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                    <ShoppingCart size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{formatERPNumber("PO", viewingDetailsPO.poNumber || viewingDetailsPO.id, viewingDetailsPO.createdAt)}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{viewingDetailsPO.vendor?.name}</p>
                  </div>
                </div>
                <button onClick={() => setViewingDetailsPO(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex gap-4">
                {["OVERVIEW", "ITEMS", "GRN", "AUDIT"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPoDetailsTab(tab as any)}
                    className={clsx(
                      "text-[10px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all",
                      poDetailsTab === tab ? "border-orange-500 text-orange-600" : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {poDetailsTab === "OVERVIEW" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Status</p>
                      <span className={clsx("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", STATUS_STYLES[viewingDetailsPO.status] || STATUS_STYLES.DRAFT)}>
                        {viewingDetailsPO.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</p>
                      <p className="text-xl font-black text-orange-600">{formatCurrency(viewingDetailsPO.totalAmount)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest px-1">Order Intelligence</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">Internal Workflow Notes</p>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 italic">
                          {viewingDetailsPO.internalNotes || "No internal notes recorded for this workflow."}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">Vendor Communication</p>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 italic">
                          {viewingDetailsPO.vendorNotes || "No specific notes for the vendor."}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">Delivery Instructions</p>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 italic">
                          {viewingDetailsPO.deliveryInstructions || "Standard delivery protocol applies."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {poDetailsTab === "ITEMS" && (
                <div className="space-y-4">
                  {viewingDetailsPO.poItems?.map((item: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 dark:bg-white/5 p-5 rounded-3xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-card flex items-center justify-center text-orange-500 shadow-sm"><Store size={18} /></div>
                        <div>
                          <p className="text-sm font-black text-gray-900 dark:text-white uppercase">{item.inventoryItem?.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{item.quantity} {item.inventoryItem?.unit} @ {formatCurrency(item.price)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(item.quantity * item.price)}</p>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase mt-0.5">{item.gstRate}% GST</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {poDetailsTab === "AUDIT" && (
                <div className="space-y-6">
                  <div className="relative pl-8 border-l-2 border-slate-100 dark:border-white/5 ml-2 space-y-8">
                    <div className="relative">
                      <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">PO Created</p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{format(new Date(viewingDetailsPO.createdAt), "dd MMM yyyy · HH:mm")}</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase">System Entry</p>
                    </div>
                    {viewingDetailsPO.approvedAt && (
                      <div className="relative">
                        <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-orange-500 shadow-lg shadow-orange-500/20" />
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Approved</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{format(new Date(viewingDetailsPO.approvedAt), "dd MMM yyyy · HH:mm")}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">By: {viewingDetailsPO.approvedBy || 'Admin'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-8 border-t border-gray-100 dark:border-white/5 flex gap-4">
              {/* Workflow simplified: removed Approve button from details */}
              {viewingDetailsPO.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => {
                    handleApprove(viewingDetailsPO.id);
                    setViewingDetailsPO(null);
                  }}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Approve Purchase Order
                </button>
              )}

              <button onClick={() => { setViewingPO(viewingDetailsPO); setViewingDetailsPO(null); }} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Download PDF</button>
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

