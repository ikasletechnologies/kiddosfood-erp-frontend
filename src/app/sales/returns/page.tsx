"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, Search, RefreshCw, ArrowLeft, Trash2,
  User, Building2, AlertTriangle, Receipt, Undo2,
  ChevronRight, Printer, FileSpreadsheet, Check,
  CheckCircle2, XCircle, Sparkles, ShoppingBag, Clock, X,
  Store, AlertCircle, Calendar, Hash, Tag, IndianRupee, ShieldAlert,
  Eye, Wallet, CreditCard, ArrowDownLeft
} from "lucide-react";
import { salesApi, franchiseApi, customersApi, franchiseOrdersApi, settingsApi, posApi, accountsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReturnItem {
  productId: string;
  productName: string;
  sku?: string;
  originalSoldQty: number;
  alreadyReturnedQty: number;
  returnableQuantity: number;
  returnQuantity: number;
  rate: number;
  taxPercent: number;
  originalLineAmount: number;
  condition: string;
}

interface ReturnOrder {
  id: string;
  returnNumber: string;
  source: 'FRANCHISE' | 'PARTNER';
  partyKind: 'CUSTOMER' | 'DEALER' | 'FRANCHISE';
  entityId: string;
  entityName: string;
  entityPhone?: string;
  orderRefId: string;
  orderRefNumber: string;
  reason: string;
  refundAmount: number;
  taxableValue?: number;
  gstRate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  taxAmount?: number;
  refundMethod: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  hasRecallQuarantinedItem: boolean;
  posOrder?: any;
  items: Array<{
    productId: string;
    productName: string;
    orderQuantity: number;
    returnQuantity: number;
    rate: number;
    condition: string;
    recallId?: string | null;
    taxableValue?: number;
    taxAmount?: number;
    totalAmount?: number;
  }>;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING: { label: "Pending Approval", color: "text-[#f58220]", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
  APPROVED: { label: "Approved", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
  COMPLETED: { label: "Settled", color: "text-emerald-600 dark:text-emerald-400 font-bold", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  REJECTED: { label: "Rejected", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/20" },
  DRAFT: { label: "Draft Request", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-white/5", border: "border-slate-200 dark:border-white/10" },
};

export default function SalesReturnsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isFranchiseUser = user?.role === 'FRANCHISE_ADMIN' || user?.role === 'FRANCHISE_STAFF';

  // Navigation
  const [view, setView] = useState<"list" | "create">("list");
  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'ALL' | 'CUSTOMER' | 'DEALER' | 'FRANCHISE'>('ALL');

  // Form State
  const [returnSource, setReturnSource] = useState<'FRANCHISE' | 'PARTNER'>('PARTNER');
  const [entities, setEntities] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [existingReturns, setExistingReturns] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Invoice Search State
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [searchingInvoices, setSearchingInvoices] = useState(false);
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Original Method");
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [previewingReturn, setPreviewingReturn] = useState<ReturnOrder | null>(null);
  const [viewingReturnDetails, setViewingReturnDetails] = useState<ReturnOrder | null>(null);
  const [refundingReturn, setRefundingReturn] = useState<ReturnOrder | null>(null);
  const [refundModalMethod, setRefundModalMethod] = useState<'CASH_BANK' | 'CREDIT_LEDGER'>('CASH_BANK');
  const [refundAccounts, setRefundAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("CASH");
  const [processingRefund, setProcessingRefund] = useState(false);

  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const currentCompany = companyProfile || FALLBACK_COMPANY;

  const submitKeyRef = useRef<string>(crypto.randomUUID());
  const submittingRef = useRef(false);
  const autoInvoiceLoadedRef = useRef<string | null>(null);

  // ─── Data Syncing ──────────────────────────────────────────────────────────

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => { if (res.data) setCompanyProfile(res.data); })
      .catch(() => {});
  }, []);

  const normalizeReturn = (r: any): ReturnOrder => {
    const orderRef = r.posOrder || r.salesOrder || r.franchiseOrder;
    
    // Resolve Authoritative Party Type
    let partyKind: 'CUSTOMER' | 'DEALER' | 'FRANCHISE' = 'CUSTOMER';
    if (r.posOrder?.partyType) {
      if (r.posOrder.partyType === 'DEALER') partyKind = 'DEALER';
      else if (r.posOrder.partyType === 'FRANCHISE') partyKind = 'FRANCHISE';
      else partyKind = 'CUSTOMER';
    } else if (r.dealerId) {
      partyKind = 'DEALER';
    } else if (r.customerId) {
      partyKind = 'CUSTOMER';
    } else if (r.franchiseOrderId || (r.franchiseId && !r.posOrderId)) {
      partyKind = 'FRANCHISE';
    }

    const entityName = r.customer?.name
      || r.dealer?.name
      || r.franchise?.name
      || r.posOrder?.customerName
      || (partyKind === 'CUSTOMER' ? 'Walk-in Customer' : partyKind === 'DEALER' ? 'Dealer Partner' : 'Franchise Branch');

    return {
      id: r.id,
      returnNumber: r.returnNumber,
      source: partyKind === 'FRANCHISE' ? 'FRANCHISE' : 'PARTNER',
      partyKind,
      entityId: r.customerId || r.dealerId || r.franchiseId || (partyKind === 'CUSTOMER' ? 'walk-in' : ''),
      entityName,
      entityPhone: r.customer?.phone || r.dealer?.phone || '',
      orderRefId: r.posOrderId || r.salesOrderId || r.franchiseOrderId || '',
      orderRefNumber: orderRef?.invoiceNum || orderRef?.orderNumber || orderRef?.challanNumber || (r.posOrderId ? 'Sale Invoice' : 'Direct'),
      reason: r.reason || 'Not specified',
      refundAmount: Number(r.refundAmount) || 0,
      taxableValue: r.taxableValue != null ? Number(r.taxableValue) : undefined,
      gstRate: r.gstRate != null ? Number(r.gstRate) : undefined,
      cgst: r.cgst != null ? Number(r.cgst) : undefined,
      sgst: r.sgst != null ? Number(r.sgst) : undefined,
      igst: r.igst != null ? Number(r.igst) : undefined,
      taxAmount: r.taxAmount != null ? Number(r.taxAmount) : undefined,
      refundMethod: r.refundMethod || 'Original Method',
      status: r.status,
      createdAt: r.createdAt,
      hasRecallQuarantinedItem: (r.items || []).some((it: any) => !!it.recallId),
      posOrder: r.posOrder,
      items: (r.items || []).map((it: any) => ({
        productId: it.productId || '',
        productName: it.productName,
        orderQuantity: it.quantity,
        returnQuantity: it.quantity,
        rate: it.rate,
        condition: it.condition || 'Good',
        recallId: it.recallId || null,
        taxableValue: it.taxableValue != null ? Number(it.taxableValue) : undefined,
        taxAmount: it.taxAmount != null ? Number(it.taxAmount) : undefined,
        totalAmount: it.totalAmount != null ? Number(it.totalAmount) : (it.rate * it.quantity),
      })),
    };
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesApi.getReturns();
      const rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const fetched = rawList.map(normalizeReturn);
      setReturns(fetched);
    } catch (err) {
      showToast("Failed to load returns", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Load Recent Invoices for New Return
  const loadRecentInvoices = useCallback(async () => {
    try {
      const res = await posApi.getOrders({ status: 'COMPLETED' });
      const orders = (res.data?.data || res.data || [])
        .filter((o: any) => o.status !== 'CANCELLED' && o.partyType !== 'FRANCHISE')
        .slice(0, 15);
      setRecentInvoices(orders);
    } catch (e) {
      // ignore
    }
  }, []);

  // Load selection options when form loads
  const loadFormSelections = async (source: 'FRANCHISE' | 'PARTNER') => {
    try {
      if (source === 'FRANCHISE' && !isFranchiseUser) {
        const res = await franchiseApi.getAll();
        setEntities(res.data || []);
      } else {
        const [custRes, dealerRes] = await Promise.all([
          customersApi.getAll(),
          api.get("/api/dealers").catch(() => ({ data: [] }))
        ]);
        const customers = (custRes.data?.data || custRes.data || []).map((c: any) => ({ ...c, _kind: 'CUSTOMER' }));
        const dealers = (dealerRes.data?.data || dealerRes.data || []).map((d: any) => ({ ...d, _kind: 'DEALER' }));
        const merged = [...customers, ...dealers];
        const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
        setEntities(unique);
      }
    } catch (err) {
      showToast("Error loading customer/dealer list", "error");
    }
  };

  useEffect(() => {
    if (view === "create") {
      loadRecentInvoices();
      if (!searchParams.get('invoiceNum') && !searchParams.get('orderId')) {
        loadFormSelections(isFranchiseUser ? 'PARTNER' : returnSource);
      }
    }
  }, [view, returnSource, isFranchiseUser, searchParams, loadRecentInvoices]);

  // ─── Setup Order Items For Return ──────────────────────────────────────────

  const applyOrderForReturn = (order: any, allRetList: any[] = returns) => {
    setSelectedOrder(order);

    // Compute already returned per product
    const alreadyReturned: Record<string, number> = {};
    (allRetList || []).forEach((r: any) => {
      const matches = r.orderRefId === order.id || r.posOrderId === order.id;
      if (!matches || r.status === 'REJECTED') return;
      (r.items || []).forEach((it: any) => {
        const key = it.productId || it.productName;
        alreadyReturned[key] = (alreadyReturned[key] || 0) + Number(it.returnQuantity || it.quantity || 0);
      });
    });

    const populated: ReturnItem[] = (order.orderItems || order.items || []).map((i: any) => {
      const productId = i.productId || `prod_${Math.random().toString(36).substring(2, 6)}`;
      const productName = i.product?.name || i.productName || "Item";
      const soldQty = Number(i.quantity) || 1;
      const prevReturned = alreadyReturned[productId] ?? alreadyReturned[productName] ?? 0;
      const returnable = Math.max(0, soldQty - prevReturned);
      const rate = Number(i.price ?? i.unitPrice ?? 0);
      const taxPct = Number(i.taxPercent ?? 0);
      const originalLineAmount = soldQty * rate;

      return {
        productId,
        productName,
        sku: i.product?.sku || i.sku || (productId ? productId.substring(0, 8) : undefined),
        originalSoldQty: soldQty,
        alreadyReturnedQty: prevReturned,
        returnableQuantity: returnable,
        returnQuantity: 0,
        rate,
        taxPercent: taxPct,
        originalLineAmount,
        condition: "Good",
      };
    });

    setReturnItems(populated);

    // Resolve Entity
    let entity: any = null;
    if (order.partyType === 'DEALER' || order.partyId) {
      entity = {
        id: order.partyId || order.customerId || 'dealer',
        name: order.customerName || 'Dealer',
        _kind: 'DEALER'
      };
    } else {
      entity = {
        id: order.customerId || 'walk-in',
        name: order.customerName || order.customer?.name || 'Walk-in Customer',
        phone: order.customer?.phone,
        _kind: 'CUSTOMER'
      };
    }
    setSelectedEntity(entity);
  };

  // ─── Search Invoices Handler ───────────────────────────────────────────────

  const handleInvoiceSearch = async (term: string) => {
    setInvoiceSearchQuery(term);
    if (!term.trim()) {
      setInvoiceSearchResults([]);
      return;
    }
    setSearchingInvoices(true);
    try {
      const res = await posApi.getOrders({ search: term.trim(), status: 'COMPLETED' });
      const list = (res.data?.data || res.data || [])
        .filter((o: any) => o.status !== 'CANCELLED' && o.partyType !== 'FRANCHISE');
      setInvoiceSearchResults(list.slice(0, 10));
    } catch (e) {
      setInvoiceSearchResults([]);
    } finally {
      setSearchingInvoices(false);
    }
  };

  // ─── Auto-load from Query Params ───────────────────────────────────────────

  useEffect(() => {
    const rawInvoiceNum = searchParams.get('invoiceNum') || '';
    const orderIdParam = searchParams.get('orderId') || '';
    const cleanInvoiceNum = rawInvoiceNum.replace(/^#+/, '').trim().toLowerCase();
    const cleanOrderId = orderIdParam.trim();

    if (!cleanInvoiceNum && !cleanOrderId) return;
    const lookupKey = `${cleanInvoiceNum}-${cleanOrderId}`;
    if (autoInvoiceLoadedRef.current === lookupKey) return;
    autoInvoiceLoadedRef.current = lookupKey;

    setView("create");
    setLoadingOrders(true);

    posApi.getOrders({ search: cleanInvoiceNum || undefined })
      .then(res => {
        const list = (res.data?.data || res.data || []).filter((o: any) => o.status !== 'CANCELLED');
        const matched = list.find((o: any) =>
          (cleanOrderId && o.id === cleanOrderId) ||
          (cleanInvoiceNum && (o.invoiceNum?.toLowerCase() === cleanInvoiceNum || o.id === cleanInvoiceNum))
        );
        if (matched) {
          applyOrderForReturn(matched);
        }
      })
      .catch(() => showToast("Could not pre-load selected invoice details", "error"))
      .finally(() => setLoadingOrders(false));
  }, [searchParams, showToast]);

  // ─── Form Handlers ─────────────────────────────────────────────────────────

  const handleItemQuantityChange = (idx: number, val: number) => {
    setReturnItems(prev => {
      const updated = [...prev];
      const target = updated[idx];
      const safeVal = Math.max(0, Math.min(Number(val) || 0, target.returnableQuantity));
      updated[idx] = { ...target, returnQuantity: safeVal };
      return updated;
    });
  };

  const handleItemConditionChange = (idx: number, cond: string) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], condition: cond };
      return updated;
    });
  };

  const resetForm = () => {
    submitKeyRef.current = crypto.randomUUID();
    autoInvoiceLoadedRef.current = null;
    setReturnSource("PARTNER");
    setSelectedEntity(null);
    setSelectedOrder(null);
    setReturnItems([]);
    setReason("");
    setRefundMethod("Original Method");
    setInvoiceSearchQuery("");
    setInvoiceSearchResults([]);
    if (searchParams.get('invoiceNum') || searchParams.get('orderId')) {
      router.replace('/sales/returns');
    }
  };

  const handleSave = async (status: "DRAFT" | "PENDING") => {
    if (!selectedOrder && status !== "DRAFT") {
      showToast("Please select a verified sale invoice reference", "error");
      return;
    }

    const activeItems = returnItems.filter(it => it.returnQuantity > 0);
    if (activeItems.length === 0 && status !== "DRAFT") {
      showToast("Return Quantity must be greater than 0 for at least one item", "error");
      return;
    }

    if (!reason.trim() && status !== "DRAFT") {
      showToast("Please enter a return reason", "error");
      return;
    }

    if (status === "DRAFT" && !selectedOrder && activeItems.length === 0) {
      setView("list");
      resetForm();
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const isCustomer = selectedEntity?._kind === 'CUSTOMER' && selectedEntity?.id !== 'walk-in';
      const isDealer = selectedEntity?._kind === 'DEALER';

      await salesApi.createReturn({
        reason: reason.trim(),
        refundMethod,
        idempotencyKey: submitKeyRef.current,
        posOrderId: selectedOrder.id,
        ...(isCustomer ? { customerId: selectedEntity.id } : {}),
        ...(isDealer ? { dealerId: selectedEntity.id } : {}),
        items: activeItems.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.returnQuantity,
          rate: i.rate,
          condition: i.condition
        }))
      });

      showToast("Sales return submitted for verification successfully!", "success");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:refresh-inventory"));
      }
      fetchReturns();
      setView("list");
      resetForm();
    } catch (e: any) {
      const rawError = e?.response?.data?.error || e?.message || "Failed to submit return request";
      showToast(rawError, "error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ─── Verification Flow Handlers ────────────────────────────────────────────

  const handleApproveReturn = async (id: string) => {
    try {
      await salesApi.updateReturnStatus(id, 'APPROVED', user?.fullName || 'User');
      showToast("Return approved! Stock has been restored to inventory.", "success");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:refresh-inventory"));
      }
      fetchReturns();
      if (viewingReturnDetails?.id === id) {
        setViewingReturnDetails(prev => prev ? { ...prev, status: 'APPROVED' } : null);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to approve return", "error");
    }
  };

  const handleRejectReturn = async (id: string) => {
    try {
      await salesApi.updateReturnStatus(id, 'REJECTED', user?.fullName || 'User');
      showToast("Return request has been rejected.", "success");
      fetchReturns();
      if (viewingReturnDetails?.id === id) {
        setViewingReturnDetails(prev => prev ? { ...prev, status: 'REJECTED' } : null);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to reject return", "error");
    }
  };

  // Open Refund Modal
  const openRefundModal = async (ret: ReturnOrder) => {
    setRefundingReturn(ret);
    setRefundModalMethod('CASH_BANK');
    setSelectedPaymentMode('CASH');
    try {
      const accRes = await accountsApi.getAll();
      const list = Array.isArray(accRes.data) ? accRes.data : (accRes.data?.data || []);
      setRefundAccounts(list);
      if (list.length > 0) {
        setSelectedAccountId(list[0].id);
      }
    } catch (e) {
      setRefundAccounts([]);
    }
  };

  // Execute Refund
  const handleExecuteRefund = async () => {
    if (!refundingReturn) return;
    if (refundModalMethod === 'CASH_BANK' && !selectedAccountId) {
      showToast("Please select a payout account", "error");
      return;
    }

    setProcessingRefund(true);
    try {
      const payload: any = {
        refundMethod: refundModalMethod === 'CREDIT_LEDGER' ? 'Credit Ledger' : 'Cash Voucher',
        method: refundModalMethod === 'CREDIT_LEDGER' ? 'CASH' : selectedPaymentMode,
        accountId: refundModalMethod === 'CREDIT_LEDGER' ? undefined : selectedAccountId
      };

      await (salesApi as any).refundReturn(refundingReturn.id, payload);
      showToast("Refund processed successfully and return settled!", "success");
      setRefundingReturn(null);
      fetchReturns();
      if (viewingReturnDetails?.id === refundingReturn.id) {
        setViewingReturnDetails(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to process refund", "error");
    } finally {
      setProcessingRefund(false);
    }
  };

  // ─── Filters & Statistics ──────────────────────────────────────────────────

  const filteredReturns = returns.filter(r => {
    const term = search.toLowerCase();
    const matchSearch = !search ||
      r.returnNumber.toLowerCase().includes(term) ||
      r.entityName.toLowerCase().includes(term) ||
      r.orderRefNumber.toLowerCase().includes(term);

    const matchTab = activeTab === 'ALL' || r.partyKind === activeTab;
    return matchSearch && matchTab;
  });

  const stats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'PENDING').length,
    approved: returns.filter(r => r.status === 'APPROVED').length,
    refunded: returns.filter(r => r.status === 'COMPLETED').reduce((s, r) => s + r.refundAmount, 0),
    rejected: returns.filter(r => r.status === 'REJECTED').length,
  };

  const estimatedRefund = returnItems.reduce((acc, it) => {
    const gross = it.returnQuantity * it.rate;
    const tax = gross * ((it.taxPercent || 0) / 100);
    return acc + gross + tax;
  }, 0);

  const isInvoiceFullyReturned = selectedOrder && returnItems.length > 0 && returnItems.every(i => i.returnableQuantity === 0);

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CREATE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    const partyTypeLabel = selectedOrder?.partyType || (selectedEntity?._kind === 'DEALER' ? 'Dealer' : 'Customer');

    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background min-h-[calc(100vh-56px)]">
        {/* Top Header */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { resetForm(); setView("list"); }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-[#f58220]" />
                New Sales Return
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Search verified sale invoice, select return items, and submit for verification.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Form Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar max-w-5xl mx-auto w-full">

          {/* Super Admin only: Return Source toggle */}
          {!isFranchiseUser && (
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-3 shadow-2xs">
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400">
                Return Source
              </label>
              <div className="flex gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => { setReturnSource('PARTNER'); resetForm(); }}
                  className={clsx(
                    "flex-1 py-2 rounded-xl border-2 transition-all flex items-center gap-2 justify-center text-xs font-bold cursor-pointer",
                    returnSource === 'PARTNER'
                      ? "border-[#f58220] bg-orange-50/80 dark:bg-orange-500/10 text-[#f58220]"
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400"
                  )}
                >
                  <User className="h-4 w-4" /> Customer / Dealer
                </button>
                <button
                  type="button"
                  onClick={() => { setReturnSource('FRANCHISE'); resetForm(); }}
                  className={clsx(
                    "flex-1 py-2 rounded-xl border-2 transition-all flex items-center gap-2 justify-center text-xs font-bold cursor-pointer",
                    returnSource === 'FRANCHISE'
                      ? "border-[#f58220] bg-orange-50/80 dark:bg-orange-500/10 text-[#f58220]"
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400"
                  )}
                >
                  <Building2 className="h-4 w-4" /> Franchise Branch
                </button>
              </div>
            </div>
          )}

          {/* Invoice Search & Selection Card */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#f58220]" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                  1. Search &amp; Select Sale Invoice
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                Only sales made by your franchise are returnable
              </span>
            </div>

            {/* Direct Invoice Search Bar */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Search Invoice # or Customer / Dealer Name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={invoiceSearchQuery}
                  onChange={e => handleInvoiceSearch(e.target.value)}
                  placeholder="e.g. INV-2026-00084 or Customer name..."
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
                />
                {invoiceSearchQuery && (
                  <button
                    onClick={() => { setInvoiceSearchQuery(""); setInvoiceSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search Suggestions Dropdown */}
              {invoiceSearchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                  <div className="p-2 text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-white/[0.02]">
                    Matching Invoices ({invoiceSearchResults.length})
                  </div>
                  {invoiceSearchResults.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => {
                        applyOrderForReturn(inv);
                        setInvoiceSearchResults([]);
                        setInvoiceSearchQuery("");
                      }}
                      className="p-3 hover:bg-orange-50/50 dark:hover:bg-white/5 cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-0 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          #{inv.invoiceNum}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300">
                            {inv.partyType || 'CUSTOMER'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                          {inv.customerName || inv.customer?.name || 'Walk-in Customer'} • {formatDate(inv.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          ₹{Number(inv.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-semibold">Select Invoice →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Pick Recent Invoices */}
            {!selectedOrder && recentInvoices.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase text-gray-400 dark:text-slate-500 block mb-2">
                  Or Pick from Recent Franchise Invoices:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {recentInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => applyOrderForReturn(inv)}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#f58220] bg-gray-50/50 dark:bg-white/[0.02] hover:bg-orange-50/30 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-800 dark:text-white">
                          #{inv.invoiceNum}
                        </span>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 truncate max-w-[180px]">
                          {inv.customerName || inv.customer?.name || 'Walk-in Customer'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                          ₹{Number(inv.totalAmount || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-400 block">{formatDate(inv.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected Order Summary Card */}
          {selectedOrder && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] flex items-center justify-center font-bold">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                          #{selectedOrder.invoiceNum || selectedOrder.orderNumber}
                        </span>
                        <span className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          partyTypeLabel.toUpperCase().includes('DEALER')
                            ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                        )}>
                          {partyTypeLabel}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mt-0.5">
                        {selectedEntity?.name || selectedOrder.customerName || 'Walk-in Customer'}
                        {selectedEntity?.phone && <span className="text-gray-400 font-normal"> • {selectedEntity.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">Sale Date</p>
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200 mt-0.5">{formatDate(selectedOrder.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedOrder(null); setReturnItems([]); }}
                      className="px-2.5 py-1 text-xs text-gray-500 hover:text-rose-600 border border-gray-200 dark:border-white/10 rounded-lg"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase block">Invoice Total</span>
                    <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                      ₹{Number(selectedOrder.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase block">Total Line Items</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-slate-200">
                      {returnItems.length} Products
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase block">Returnable Products</span>
                    <span className={clsx("text-sm font-bold", isInvoiceFullyReturned ? "text-rose-500" : "text-emerald-600")}>
                      {returnItems.filter(i => i.returnableQuantity > 0).length} Available
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase block">Return Quantity</span>
                    <span className="font-mono text-sm font-bold text-[#f58220]">
                      {returnItems.filter(i => i.returnQuantity > 0).reduce((s, i) => s + i.returnQuantity, 0)} Units
                    </span>
                  </div>
                </div>
              </div>

              {/* Fully Returned Notice */}
              {isInvoiceFullyReturned && (
                <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center gap-3 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle size={20} className="shrink-0 text-rose-500" />
                  <div>
                    <p className="font-bold">Fully Returned Invoice</p>
                    <p className="text-[11px] mt-0.5 opacity-90">All products and quantities on this sale invoice have already been returned in full. No returnable items remain.</p>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
                    2. Select Products &amp; Return Quantity
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    Return quantity cannot exceed remaining returnable quantity
                  </span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[760px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs border-b border-gray-100 dark:border-white/5 font-bold uppercase">
                        <th className="px-4 py-3 min-w-[180px]">Product / SKU</th>
                        <th className="px-3 py-3 text-center min-w-[90px]">Sold</th>
                        <th className="px-3 py-3 text-center min-w-[90px]">Returned</th>
                        <th className="px-3 py-3 text-center min-w-[100px]">Returnable</th>
                        <th className="px-4 py-3 text-center min-w-[130px]">Return Qty</th>
                        <th className="px-3 py-3 min-w-[140px]">Condition</th>
                        <th className="px-3 py-3 text-right min-w-[100px]">Unit Price</th>
                        <th className="px-4 py-3 text-right min-w-[110px]">Return Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                      {returnItems.map((item, idx) => {
                        const lineReturnAmt = item.returnQuantity * item.rate * (1 + (item.taxPercent || 0) / 100);
                        const isExhausted = item.returnableQuantity === 0;

                        return (
                          <tr key={item.productId || idx} className={clsx("transition-colors", isExhausted ? "opacity-50 bg-gray-50/40" : "hover:bg-gray-50/80 dark:hover:bg-white/[0.02]")}>
                            <td className="px-4 py-3">
                              <p className="font-bold text-gray-900 dark:text-white text-xs">{item.productName}</p>
                              {item.sku && <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500">SKU: {item.sku}</span>}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-gray-700 dark:text-slate-300">
                              {item.originalSoldQty}
                            </td>
                            <td className="px-3 py-3 text-center font-semibold text-gray-500 dark:text-slate-400">
                              {item.alreadyReturnedQty > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">{item.alreadyReturnedQty}</span>
                              ) : (
                                "0"
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={clsx(
                                "px-2 py-0.5 rounded-full font-bold text-[11px]",
                                isExhausted
                                  ? "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                              )}>
                                {item.returnableQuantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isExhausted ? (
                                <span className="text-[11px] text-gray-400 italic">Fully Returned</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={item.returnableQuantity}
                                  value={item.returnQuantity}
                                  onChange={e => handleItemQuantityChange(idx, Number(e.target.value))}
                                  className="w-20 text-center font-bold py-1.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 outline-none focus:border-[#f58220]"
                                />
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <select
                                disabled={isExhausted || item.returnQuantity === 0}
                                value={item.condition}
                                onChange={e => handleItemConditionChange(idx, e.target.value)}
                                className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-white/5 outline-none focus:border-[#f58220] disabled:opacity-40"
                              >
                                <option value="Good">Good (Restockable)</option>
                                <option value="Damaged">Damaged (Quarantine)</option>
                                <option value="Defective">Defective (Quarantine)</option>
                                <option value="Expired">Expired (Quarantine)</option>
                              </select>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-slate-300">
                              ₹{item.rate.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              {item.returnQuantity > 0 ? `₹${lineReturnAmt.toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Return Total Footer */}
                <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Total Return Units: <span className="font-bold text-gray-900 dark:text-white">{returnItems.reduce((s, i) => s + i.returnQuantity, 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-600 dark:text-slate-300">Estimated Total Credit:</span>
                    <span className="font-mono font-bold text-lg text-[#f58220]">₹{estimatedRefund.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Reason & Refund Preference Card */}
              <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-4 shadow-2xs">
                <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
                  3. Return Reason &amp; Refund Method
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Return Reason *
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Defective seal, incorrect product size returned by customer..."
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-gray-800 dark:text-white bg-gray-50 dark:bg-white/5 outline-none focus:border-[#f58220]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                      Preferred Refund Method
                    </label>
                    <select
                      value={refundMethod}
                      onChange={e => setRefundMethod(e.target.value)}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-gray-800 dark:text-white bg-gray-50 dark:bg-white/5 outline-none focus:border-[#f58220]"
                    >
                      <option value="Original Method">Original Method / Cash Voucher</option>
                      <option value="Cheque / UPI">Bank Transfer / UPI</option>
                      <option value="Credit Ledger">Credit Ledger (Adjust Customer/Dealer Balance)</option>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                      Actual payout / balance adjustment is executed upon approval via the "Process Refund" verification step.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Toolbar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => { resetForm(); setView("list"); }}
            className="px-4 py-2 text-xs font-bold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave("PENDING")}
            disabled={submitting || !selectedOrder || !reason.trim() || estimatedRefund <= 0}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-[#f58220] hover:bg-[#e8740e] disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 text-white rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" /> {submitting ? "Submitting..." : "Submit Return Request"}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LIST VIEW (RETURN HISTORY & VERIFICATION)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      {/* Top Header */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-[#f58220]" />
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            {isFranchiseUser ? "Franchise Sales Returns" : "Sales Returns & RMA"}
          </h1>
        </div>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> New Return
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* Summary Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Total Returns", value: stats.total, color: "text-gray-800 dark:text-white", dot: "bg-gray-400" },
            { label: "Pending Approval", value: stats.pending, color: "text-[#f58220]", dot: "bg-[#f58220]" },
            { label: "Approved (Pending Refund)", value: stats.approved, color: "text-orange-600", dot: "bg-orange-500" },
            { label: "Settled Refunds", value: `₹${stats.refunded.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "text-emerald-600", dot: "bg-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-lg font-bold truncate", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search return # or party..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400"
            />
            {search && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                onClick={() => setSearch("")}
              />
            )}
          </div>

          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-card">
            {(isFranchiseUser
              ? (['ALL', 'CUSTOMER', 'DEALER'] as const)
              : (['ALL', 'CUSTOMER', 'DEALER', 'FRANCHISE'] as const)
            ).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                  activeTab === tab ? "bg-[#f58220] text-white font-bold" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {tab === 'ALL' ? 'All' : tab === 'CUSTOMER' ? 'Customers' : tab === 'DEALER' ? 'Dealers' : 'Franchise'}
              </button>
            ))}
          </div>

          <div className="flex-1" />
          <button
            onClick={fetchReturns}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Empty State */}
        {filteredReturns.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
              <Undo2 className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-semibold">No Sales Returns Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
                {search ? "No returns matched your search criteria." : "Create sales returns against verified franchise invoices."}
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              New Return
            </button>
          </div>
        ) : (
          /* Table */
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="px-4 py-3">Return #</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Sale Invoice</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Return Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredReturns.map(r => {
                  const style = STATUS_STYLES[r.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                        <button
                          onClick={() => setViewingReturnDetails(r)}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {r.returnNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800 dark:text-white">{r.entityName}</div>
                        <span className={clsx(
                          "inline-block text-[10px] font-bold px-1.5 py-0.2 rounded uppercase mt-0.5",
                          r.partyKind === 'DEALER' ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        )}>
                          {r.partyKind}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-400">
                        #{r.orderRefNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                        <span className="line-clamp-1 max-w-[130px]" title={r.reason}>{r.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        ₹{r.refundAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-bold border", style.color, style.bg, style.border)}>
                            {style.label}
                          </span>
                          {r.hasRecallQuarantinedItem && (
                            <span
                              title="Items from recalled batch quarantined"
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200"
                            >
                              <ShieldAlert className="h-3 w-3" /> Recall Quarantine
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveReturn(r.id)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectReturn(r.id)}
                                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'APPROVED' && (
                            <button
                              onClick={() => openRefundModal(r)}
                              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              <Wallet className="h-3.5 w-3.5" /> Process Refund
                            </button>
                          )}
                          {r.status === 'COMPLETED' && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                            </span>
                          )}
                          <button
                            onClick={() => setViewingReturnDetails(r)}
                            title="View Details"
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setPreviewingReturn(r)}
                            title="Print Credit Note"
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
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

      {/* ══════════════════════════════════════════════════════════════════════════
          3. PROCESS REFUND MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {refundingReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] flex items-center justify-center font-bold">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Process Return Refund</h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">Return #{refundingReturn.returnNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setRefundingReturn(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Refund Overview Box */}
            <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Party:</span>
                <span className="font-bold text-gray-900 dark:text-white">{refundingReturn.entityName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sale Invoice:</span>
                <span className="font-mono text-gray-700 dark:text-slate-300">#{refundingReturn.orderRefNumber}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-white/5">
                <span className="font-bold text-gray-700 dark:text-slate-200">Total Refund Amount:</span>
                <span className="font-mono font-bold text-base text-rose-600 dark:text-rose-400">
                  ₹{refundingReturn.refundAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Refund Mode Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                Choose Settlement Method
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundModalMethod('CASH_BANK')}
                  className={clsx(
                    "p-3 rounded-xl border-2 text-left transition-all cursor-pointer",
                    refundModalMethod === 'CASH_BANK'
                      ? "border-[#f58220] bg-orange-50/50 dark:bg-orange-500/10"
                      : "border-gray-200 dark:border-white/10"
                  )}
                >
                  <CreditCard className="h-4 w-4 text-[#f58220] mb-1" />
                  <p className="text-xs font-bold text-gray-900 dark:text-white">Cash / Bank / UPI</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Pay out from franchise account</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRefundModalMethod('CREDIT_LEDGER')}
                  className={clsx(
                    "p-3 rounded-xl border-2 text-left transition-all cursor-pointer",
                    refundModalMethod === 'CREDIT_LEDGER'
                      ? "border-[#f58220] bg-orange-50/50 dark:bg-orange-500/10"
                      : "border-gray-200 dark:border-white/10"
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 mb-1" />
                  <p className="text-xs font-bold text-gray-900 dark:text-white">Credit Ledger</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Adjust unpaid balance or credit party</p>
                </button>
              </div>

              {/* Cash / Bank Details */}
              {refundModalMethod === 'CASH_BANK' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Payment Account *
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={e => setSelectedAccountId(e.target.value)}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-white/5 outline-none focus:border-[#f58220]"
                    >
                      {refundAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type}) — Balance: ₹{Number(acc.balance || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={selectedPaymentMode}
                      onChange={e => setSelectedPaymentMode(e.target.value)}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-white/5 outline-none focus:border-[#f58220]"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Credit Ledger Details */}
              {refundModalMethod === 'CREDIT_LEDGER' && (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="font-bold">Automated Receivable Reversal</p>
                  <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                    If the original sale has an unpaid or partially paid balance, it will be reduced automatically. Otherwise, a credit entry will be logged on the party ledger.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setRefundingReturn(null)}
                className="px-4 py-2 text-xs font-bold border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingRefund || (refundModalMethod === 'CASH_BANK' && !selectedAccountId)}
                onClick={handleExecuteRefund}
                className="px-5 py-2 text-xs font-bold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {processingRefund ? "Processing..." : "Confirm & Settle Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          4. RETURN DETAILS MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {viewingReturnDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-[#f58220]" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Return #{viewingReturnDetails.returnNumber}
                    </h3>
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                      STATUS_STYLES[viewingReturnDetails.status]?.color,
                      STATUS_STYLES[viewingReturnDetails.status]?.bg,
                      STATUS_STYLES[viewingReturnDetails.status]?.border
                    )}>
                      {STATUS_STYLES[viewingReturnDetails.status]?.label || viewingReturnDetails.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Created on {formatDate(viewingReturnDetails.createdAt)}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingReturnDetails(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Party</span>
                <p className="font-bold text-gray-900 dark:text-white mt-0.5">{viewingReturnDetails.entityName}</p>
                <span className="text-[10px] text-gray-500 font-semibold">{viewingReturnDetails.partyKind}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Original Sale Invoice</span>
                <p className="font-mono font-bold text-gray-800 dark:text-slate-200 mt-0.5">#{viewingReturnDetails.orderRefNumber}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Credit</span>
                <p className="font-mono font-bold text-base text-rose-600 dark:text-rose-400 mt-0.5">
                  ₹{viewingReturnDetails.refundAmount.toFixed(2)}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-3 pt-2 border-t border-gray-200 dark:border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Return Reason</span>
                <p className="text-gray-700 dark:text-slate-300 mt-0.5 italic">"{viewingReturnDetails.reason}"</p>
              </div>
            </div>

            {/* Returned Products Table */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                Returned Products
              </h4>
              <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 text-[11px] font-bold border-b border-gray-200 dark:border-white/5">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-center">Condition</th>
                      <th className="px-3 py-2 text-center">Return Qty</th>
                      <th className="px-3 py-2 text-right">Unit Rate</th>
                      <th className="px-3 py-2 text-right">Credit Amt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {viewingReturnDetails.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-semibold text-gray-800 dark:text-white">
                          {it.productName}
                          {it.recallId && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-bold">
                              Quarantined
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-slate-300">
                            {it.condition || 'Good'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-gray-900 dark:text-white">
                          {it.returnQuantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-slate-400">
                          ₹{Number(it.rate || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">
                          ₹{Number(it.totalAmount || (it.rate * it.returnQuantity)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            {viewingReturnDetails.taxableValue != null && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/5">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Taxable Value</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                    ₹{Number(viewingReturnDetails.taxableValue).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">CGST + SGST</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                    ₹{((Number(viewingReturnDetails.cgst) || 0) + (Number(viewingReturnDetails.sgst) || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">IGST</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                    ₹{Number(viewingReturnDetails.igst || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">GST Rate</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-slate-200">
                    {viewingReturnDetails.gstRate ?? 0}%
                  </span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
              <button
                onClick={() => setPreviewingReturn(viewingReturnDetails)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 text-gray-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print Credit Note
              </button>

              <div className="flex items-center gap-2">
                {viewingReturnDetails.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleRejectReturn(viewingReturnDetails.id)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveReturn(viewingReturnDetails.id)}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm cursor-pointer"
                    >
                      Approve Return
                    </button>
                  </>
                )}
                {viewingReturnDetails.status === 'APPROVED' && (
                  <button
                    onClick={() => {
                      const ret = viewingReturnDetails;
                      setViewingReturnDetails(null);
                      openRefundModal(ret);
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-xl shadow-sm cursor-pointer"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Process Refund
                  </button>
                )}
                <button
                  onClick={() => setViewingReturnDetails(null)}
                  className="px-4 py-1.5 text-xs font-bold border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          5. GST CREDIT NOTE PRINT
      ══════════════════════════════════════════════════════════════════════════ */}
      {previewingReturn && (
        <GSTInvoice
          order={{
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
