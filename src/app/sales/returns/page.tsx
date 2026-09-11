"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, RefreshCw, ArrowLeft, Trash2,
  User, Building2, AlertTriangle, Receipt, Undo2,
  ChevronRight, Printer, FileSpreadsheet, Check,
  CheckCircle2, XCircle, Sparkles, ShoppingBag, Clock, X,
  Store, AlertCircle, Calendar, Hash, Tag, IndianRupee } from "lucide-react";
import { salesApi, franchiseApi, customersApi, franchiseOrdersApi, settingsApi, posApi } from "@/lib/api";
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
  entityId: string;
  entityName: string;
  entityPhone?: string;
  orderRefId: string;
  orderRefNumber: string;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  items: Array<{
    productId: string;
    productName: string;
    orderQuantity: number;
    returnQuantity: number;
    rate: number;
    condition: string;
  }>;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "Pending Approval", color: "text-[#f58220]",  bg: "bg-orange-50 dark:bg-orange-500/10",  border: "border-orange-200 dark:border-orange-500/20" },
  APPROVED:  { label: "Approved",         color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
  COMPLETED: { label: "Refund Processed", color: "text-emerald-600 dark:text-emerald-400 font-bold", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  REJECTED:  { label: "Rejected",         color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/10",    border: "border-rose-200 dark:border-rose-500/20" },
  DRAFT:     { label: "Draft Request",    color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-white/5",   border: "border-slate-200 dark:border-white/10" },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function SalesReturnsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Navigation
  const [view, setView] = useState<"list" | "create">("list");
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
  const [existingReturns, setExistingReturns] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Original Method");
  const [submitting, setSubmitting] = useState(false);
  const [previewingReturn, setPreviewingReturn] = useState<ReturnOrder | null>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const currentCompany = companyProfile || FALLBACK_COMPANY;

  const submitKeyRef = useRef<string>(crypto.randomUUID());
  const submittingRef = useRef(false);
  const autoInvoiceLoadedRef = useRef<string | null>(null);

  // ── Data Syncing ─────────────────────────────────────────────────────────────

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => { if (res.data) setCompanyProfile(res.data); })
      .catch(() => {});
  }, []);

  const normalizeReturn = (r: any): ReturnOrder => {
    const orderRef = r.posOrder || r.salesOrder || r.franchiseOrder;
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      source: r.franchiseId ? 'FRANCHISE' : 'PARTNER',
      entityId: r.customerId || r.franchiseId || '',
      entityName: r.customer?.name || r.franchise?.name || 'Walk-in Partner',
      entityPhone: r.customer?.phone || '',
      orderRefId: r.posOrderId || r.salesOrderId || r.franchiseOrderId || '',
      orderRefNumber: orderRef?.invoiceNum || orderRef?.orderNumber || orderRef?.challanNumber || 'Direct',
      reason: r.reason,
      refundAmount: Number(r.refundAmount) || 0,
      refundMethod: r.refundMethod || 'Original Method',
      status: r.status,
      createdAt: r.createdAt,
      items: (r.items || []).map((it: any) => ({
        productId: it.productId || '',
        productName: it.productName,
        orderQuantity: it.quantity,
        returnQuantity: it.quantity,
        rate: it.rate,
        condition: it.condition || 'Good',
      })),
    };
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesApi.getReturns();
      const fetched = (res.data || []).map(normalizeReturn);
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
        const customers = (custRes.data?.data || custRes.data || []).map((c: any) => ({ ...c, _kind: 'CUSTOMER' }));
        const dealers = (dealerRes.data?.data || dealerRes.data || []).map((d: any) => ({ ...d, _kind: 'DEALER' }));

        const merged = [...customers, ...dealers];
        const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());

        setEntities(unique);
      }
    } catch (err) {
      showToast("Error loading source lists", "error");
    }
  };

  useEffect(() => {
    if (view === "create" && !searchParams.get('invoiceNum') && !searchParams.get('orderId')) {
      loadFormSelections(returnSource);
    }
  }, [view, returnSource, searchParams]);

  // ── Auto-load invoice from Query Parameters (e.g. from POS) ───────────────
  useEffect(() => {
    const rawInvoiceNum = searchParams.get('invoiceNum') || '';
    const orderIdParam = searchParams.get('orderId') || '';
    const sourceParam = searchParams.get('source') || '';

    const cleanInvoiceNum = rawInvoiceNum.replace(/^#+/, '').trim().toLowerCase();
    const rawInvoiceLower = rawInvoiceNum.trim().toLowerCase();
    const cleanOrderId = orderIdParam.trim();

    const lookupKey = `${cleanInvoiceNum}-${cleanOrderId}-${sourceParam}`;
    if ((!cleanInvoiceNum && !cleanOrderId) || autoInvoiceLoadedRef.current === lookupKey) return;

    autoInvoiceLoadedRef.current = lookupKey;
    setView("create");

    const loadTargetedInvoice = async () => {
      setLoadingOrders(true);
      try {
        const [custRes, dealerRes, franRes, posRes, soRes, foRes, returnsRes] = await Promise.all([
          customersApi.getAll().catch(() => ({ data: [] })),
          api.get("/api/dealers").catch(() => ({ data: [] })),
          franchiseApi.getAll().catch(() => ({ data: [] })),
          posApi.getOrders({ search: cleanInvoiceNum || undefined }).catch(() => ({ data: [] })),
          salesApi.getSalesOrders({ search: cleanInvoiceNum || undefined }).catch(() => ({ data: [] })),
          franchiseOrdersApi.getAll().catch(() => ({ data: [] })),
          salesApi.getReturns().catch(() => ({ data: [] })),
        ]);

        const customers = (custRes.data?.data || custRes.data || []).map((c: any) => ({ ...c, _kind: 'CUSTOMER' }));
        const dealers = (dealerRes.data?.data || dealerRes.data || []).map((d: any) => ({ ...d, _kind: 'DEALER' }));
        const franchises = franRes.data || [];
        const allReturns = (returnsRes.data?.data || returnsRes.data || []);

        const allPos = (posRes.data?.data || posRes.data || []).filter((o: any) => o.status !== 'CANCELLED');
        const allSo = (soRes.data?.data || soRes.data || []).filter((o: any) => o.status !== 'CANCELLED');
        const allFo = (foRes.data || []).filter((o: any) => o.status !== 'CANCELLED');

        let matchedOrder: any = null;
        let matchedSource: 'FRANCHISE' | 'PARTNER' = 'PARTNER';
        let matchedEntity: any = null;

        if (sourceParam === 'FRANCHISE') {
          matchedOrder = allFo.find((o: any) =>
            (cleanOrderId && o.id === cleanOrderId) ||
            (cleanInvoiceNum && (
              (o.orderNumber && o.orderNumber.toLowerCase() === cleanInvoiceNum) ||
              ('#' + (o.orderNumber || '')).toLowerCase() === rawInvoiceLower ||
              o.id === cleanInvoiceNum
            ))
          );
          if (matchedOrder) {
            matchedSource = 'FRANCHISE';
            matchedEntity = franchises.find((f: any) => f.id === matchedOrder.franchiseId) || {
              id: matchedOrder.franchiseId,
              name: matchedOrder.franchise?.name || 'Franchise Branch',
              _kind: 'FRANCHISE'
            };
          }
        }

        if (!matchedOrder && (sourceParam === 'POS' || !sourceParam)) {
          matchedOrder = allPos.find((o: any) =>
            (cleanOrderId && o.id === cleanOrderId) ||
            (cleanInvoiceNum && (
              (o.invoiceNum && o.invoiceNum.toLowerCase() === cleanInvoiceNum) ||
              ('#' + (o.invoiceNum || '')).toLowerCase() === rawInvoiceLower ||
              o.id === cleanInvoiceNum
            ))
          );
          if (matchedOrder) {
            matchedSource = 'PARTNER';
            if (matchedOrder.partyType === 'DEALER' || matchedOrder.partyId) {
              matchedEntity = dealers.find((d: any) => d.id === (matchedOrder.partyId || matchedOrder.customerId)) || {
                id: matchedOrder.partyId || matchedOrder.customerId,
                name: matchedOrder.customerName || 'Dealer',
                _kind: 'DEALER'
              };
            } else {
              matchedEntity = customers.find((c: any) => c.id === (matchedOrder.customerId || matchedOrder.customer?.id)) || {
                id: matchedOrder.customerId || 'walk-in',
                name: matchedOrder.customer?.name || matchedOrder.customerName || 'Walk-in Customer',
                _kind: 'CUSTOMER'
              };
            }
          }
        }

        if (!matchedOrder && (sourceParam === 'SALES_ORDER' || !sourceParam)) {
          matchedOrder = allSo.find((o: any) =>
            (cleanOrderId && o.id === cleanOrderId) ||
            (cleanInvoiceNum && (
              (o.orderNumber && o.orderNumber.toLowerCase() === cleanInvoiceNum) ||
              ('#' + (o.orderNumber || '')).toLowerCase() === rawInvoiceLower ||
              o.id === cleanInvoiceNum
            ))
          );
          if (matchedOrder) {
            matchedSource = 'PARTNER';
            matchedEntity = customers.find((c: any) => c.id === matchedOrder.customerId) || {
              id: matchedOrder.customerId,
              name: matchedOrder.customer?.name || 'Customer',
              _kind: 'CUSTOMER'
            };
          }
        }

        if (matchedSource === 'FRANCHISE') {
          setEntities(franchises);
        } else {
          const merged = [...customers, ...dealers];
          if (matchedEntity && !merged.some(e => e.id === matchedEntity.id)) {
            merged.unshift(matchedEntity);
          }
          setEntities(Array.from(new Map(merged.map(item => [item.id, item])).values()));
        }

        setReturnSource(matchedSource);
        setSelectedEntity(matchedEntity);
        setExistingReturns(allReturns);

        if (matchedOrder) {
          const normalizedOrder = {
            id: matchedOrder.id,
            _source: sourceParam === 'FRANCHISE' ? 'FRANCHISE' : (matchedOrder.orderItems ? 'POS' : 'SALES_ORDER'),
            orderNumber: matchedOrder.invoiceNum || matchedOrder.orderNumber,
            totalAmount: matchedOrder.totalAmount,
            taxAmount: matchedOrder.taxAmount || 0,
            subTotal: matchedOrder.subTotal || matchedOrder.subtotal,
            createdAt: matchedOrder.createdAt,
            partyType: matchedOrder.partyType || (matchedEntity?._kind || 'CUSTOMER'),
            items: matchedOrder.orderItems
              ? matchedOrder.orderItems.map((i: any) => ({
                  productId: i.productId,
                  productName: i.product?.name || i.productName || "Item",
                  sku: i.product?.sku || i.sku,
                  quantity: i.quantity,
                  unitPrice: i.price ?? i.unitPrice,
                  taxPercent: i.taxPercent ?? 0,
                  totalPrice: i.totalPrice ?? ((i.price ?? 0) * (i.quantity ?? 1)),
                }))
              : (matchedOrder.items || []).map((i: any) => ({
                  productId: i.productId,
                  productName: i.productName || i.product?.name || i.description || "Item",
                  sku: i.product?.sku || i.sku,
                  quantity: i.quantity || i.qty,
                  unitPrice: i.unitPrice ?? i.rate ?? 0,
                  taxPercent: i.taxPercent ?? i.gstRate ?? 0,
                  totalPrice: (i.unitPrice ?? i.rate ?? 0) * (i.quantity || i.qty || 1),
                })),
            raw: matchedOrder,
          };

          setSelectedOrder(normalizedOrder);
          setOrdersList([normalizedOrder]);

          // Compute already returned per product
          const alreadyReturned: Record<string, number> = {};
          allReturns.forEach((r: any) => {
            const matches = normalizedOrder._source === 'POS'
              ? r.posOrderId === normalizedOrder.id
              : normalizedOrder._source === 'FRANCHISE'
              ? r.franchiseOrderId === normalizedOrder.id
              : r.salesOrderId === normalizedOrder.id;
            if (!matches || r.status === 'REJECTED') return;
            (r.items || []).forEach((it: any) => {
              const key = it.productId || it.productName;
              alreadyReturned[key] = (alreadyReturned[key] || 0) + Number(it.quantity || 0);
            });
          });

          // Populate Return Items
          const populated: ReturnItem[] = (normalizedOrder.items || []).map((i: any) => {
            const productId = i.productId || `prod_${Math.random().toString(36).substring(2,6)}`;
            const productName = i.productName || "Item";
            const soldQty = Number(i.quantity) || 1;
            const prevReturned = alreadyReturned[productId] ?? alreadyReturned[productName] ?? 0;
            const returnable = Math.max(0, soldQty - prevReturned);
            const rate = Number(i.unitPrice) || 0;
            const taxPct = Number(i.taxPercent) || 0;
            const originalLineAmount = soldQty * rate;

            return {
              productId,
              productName,
              sku: i.sku || (productId ? productId.substring(0, 8) : undefined),
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
        }
      } catch (err) {
        showToast("Could not pre-load selected invoice details", "error");
      } finally {
        setLoadingOrders(false);
      }
    };

    loadTargetedInvoice();
  }, [searchParams, showToast]);

  // ── Form Selection Triggers ──────────────────────────────────────────────────

  const handleEntityChange = async (entityId: string) => {
    const entity = entities.find(e => e.id === entityId);
    setSelectedEntity(entity || null);
    setSelectedOrder(null);
    setReturnItems([]);
    setOrdersList([]);
    setExistingReturns([]);

    if (!entity) return;

    setLoadingOrders(true);
    try {
      if (returnSource === 'FRANCHISE') {
        const res = await franchiseOrdersApi.getAll({ franchiseId: entityId });
        setOrdersList(res.data || []);
      } else {
        const isDealer = entity._kind === 'DEALER';

        const [soRes, posRes, returnsRes] = await Promise.all([
          isDealer ? Promise.resolve({ data: [] }) : salesApi.getSalesOrders({ customerId: entityId }).catch(() => ({ data: [] })),
          posApi.getOrders().catch(() => ({ data: [] })),
          isDealer ? Promise.resolve({ data: [] }) : salesApi.getReturns({ customerId: entityId }).catch(() => ({ data: [] })),
        ]);

        const salesOrders = (soRes.data?.data || soRes.data || []).map((o: any) => ({
          id: o.id,
          _source: 'SALES_ORDER',
          orderNumber: o.orderNumber,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          partyType: 'CUSTOMER',
          items: (o.items || []).map((i: any) => ({
            productId: i.productId,
            productName: i.productName || i.description,
            sku: i.product?.sku || i.sku,
            quantity: i.quantity || i.qty,
            unitPrice: i.unitPrice ?? i.rate,
            taxPercent: i.taxPercent ?? i.gstRate ?? 0,
          })),
        }));

        const allPosOrders = posRes.data?.data || posRes.data || [];
        const posOrders = allPosOrders
          .filter((o: any) =>
            o.status !== 'CANCELLED' &&
            (isDealer ? o.partyId === entityId : (o.customerId === entityId || o.customer?.id === entityId))
          )
          .map((o: any) => ({
            id: o.id,
            _source: 'POS',
            orderNumber: o.invoiceNum,
            totalAmount: o.totalAmount,
            createdAt: o.createdAt,
            partyType: isDealer ? 'DEALER' : 'CUSTOMER',
            items: (o.orderItems || []).map((i: any) => ({
              productId: i.productId,
              productName: i.product?.name,
              sku: i.product?.sku || i.sku,
              quantity: i.quantity,
              unitPrice: i.price,
              taxPercent: i.taxPercent ?? 0,
            })),
          }));

        setOrdersList([...posOrders, ...salesOrders]);
        setExistingReturns(returnsRes.data?.data || returnsRes.data || []);
      }
    } catch (err) {
      showToast("Could not load associated orders", "error");
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleOrderChange = (orderId: string) => {
    const order = ordersList.find(o => o.id === orderId);
    setSelectedOrder(order || null);

    if (!order) {
      setReturnItems([]);
      return;
    }

    const alreadyReturned: Record<string, number> = {};
    existingReturns.forEach((r: any) => {
      const matchesOrder = order._source === 'POS' ? r.posOrderId === order.id : r.salesOrderId === order.id;
      if (!matchesOrder || r.status === 'REJECTED') return;
      (r.items || []).forEach((it: any) => {
        const key = it.productId || it.productName;
        alreadyReturned[key] = (alreadyReturned[key] || 0) + Number(it.quantity || 0);
      });
    });

    const populated: ReturnItem[] = (order.items || []).map((i: any) => {
      const productId = i.productId || `prod_${Math.random().toString(36).substr(2,4)}`;
      const productName = i.productName || i.description || "Item";
      const boughtQuantity = Number(i.quantity || i.qty) || 1;
      const returned = alreadyReturned[productId] ?? alreadyReturned[productName] ?? 0;
      const returnable = Math.max(0, boughtQuantity - returned);
      const rate = Number(i.unitPrice || i.rate || 0);
      const taxPercent = Number(i.taxPercent || i.gstRate || 0);
      const originalLineAmount = boughtQuantity * rate;

      return {
        productId,
        productName,
        sku: i.sku || (productId ? productId.substring(0, 8) : undefined),
        originalSoldQty: boughtQuantity,
        alreadyReturnedQty: returned,
        returnableQuantity: returnable,
        returnQuantity: 0,
        rate,
        taxPercent,
        originalLineAmount,
        condition: "Good",
      };
    });

    setReturnItems(populated);
  };

  // Calculations
  const returnSubtotal = returnItems.reduce((acc, it) => acc + (it.returnQuantity * it.rate), 0);
  const returnTax = returnItems.reduce((acc, it) => acc + (it.returnQuantity * it.rate * ((it.taxPercent || 0) / 100)), 0);
  const estimatedRefund = returnSubtotal + returnTax;
  const isInvoiceFullyReturned = returnItems.length > 0 && returnItems.every(it => it.returnableQuantity === 0);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    submitKeyRef.current = crypto.randomUUID();
    autoInvoiceLoadedRef.current = null;
    setReturnSource("PARTNER");
    setSelectedEntity(null);
    setSelectedOrder(null);
    setReturnItems([]);
    setReason("");
    setRefundMethod("Original Method");
    if (searchParams.get('invoiceNum') || searchParams.get('orderId')) {
      router.replace('/sales/returns');
    }
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

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const hasRealCustomer = selectedEntity?.id && selectedEntity.id !== 'walk-in' && !/walk[-_ ]?in/i.test(selectedEntity.id) && selectedEntity._kind === 'CUSTOMER';

      await salesApi.createReturn({
        reason,
        idempotencyKey: submitKeyRef.current,
        items: activeItems.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.returnQuantity,
          rate: i.rate,
          condition: i.condition
        })),
        ...(returnSource === 'FRANCHISE'
          ? { franchiseId: selectedEntity.id, franchiseOrderId: selectedOrder.id }
          : {
              ...(hasRealCustomer ? { customerId: selectedEntity.id } : {}),
              ...(selectedOrder._source === 'POS'
                ? { posOrderId: selectedOrder.id }
                : { salesOrderId: selectedOrder.id }),
            }
        )
      });

      showToast(status === "DRAFT" ? "Return draft request saved" : "Sales Return logged successfully!", "success");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:refresh-inventory"));
      }
      fetchReturns();
      setView("list");
      resetForm();
    } catch (e: any) {
      const rawError = e?.response?.data?.error || e?.message || "";
      if (rawError.includes("Foreign key constraint") || rawError.includes("ReturnOrder_customerId_fkey")) {
        showToast("Unable to submit this return because the customer information could not be resolved. Please verify the original sale and try again.", "error");
      } else {
        showToast(rawError || "Failed to record return request", "error");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const processStatusChange = async (id: string, nextStatus: 'APPROVED' | 'COMPLETED' | 'REJECTED') => {
    try {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
      const user = userStr ? JSON.parse(userStr) : null;
      await salesApi.updateReturnStatus(id, nextStatus, user?.fullName || 'Admin');
      showToast(`Return status successfully set to: ${nextStatus}!`, "success");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:refresh-inventory"));
      }
      fetchReturns();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Status transition failed", "error");
    }
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
  // 1. CREATE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    const partyTypeLabel = selectedOrder?.partyType || (selectedEntity?._kind === 'DEALER' ? 'Dealer' : selectedEntity?._kind === 'FRANCHISE' || returnSource === 'FRANCHISE' ? 'Franchise' : 'Customer');

    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background min-h-[calc(100vh-56px)]">

        {/* Top Header */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
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
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-[#f58220]" />
                Sales Return / Credit Note
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Process item return against verified sale invoice and credit party ledger.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-400 dark:text-slate-500 hidden sm:inline">
              Session: {submitKeyRef.current.substring(0, 8)}
            </span>
          </div>
        </div>

        {/* Scrollable Form Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar max-w-6xl mx-auto w-full">

          {/* Return Source Selection */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-4 shadow-2xs">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-2">
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
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
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
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
                  )}
                >
                  <Building2 className="h-4 w-4" /> Franchise Branch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-white/5">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Select {returnSource === 'FRANCHISE' ? 'Franchise' : 'Customer / Dealer'} *
                </label>
                <select
                  value={selectedEntity?.id || ""}
                  onChange={e => handleEntityChange(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-gray-50 dark:bg-white/5 cursor-pointer"
                >
                  <option value="">Choose partner...</option>
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e._kind ? `[${e._kind}]` : ''} {e.phone ? `(${e.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Original Invoice Reference *
                </label>
                <select
                  disabled={!selectedEntity || loadingOrders}
                  value={selectedOrder?.id || ""}
                  onChange={e => handleOrderChange(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-gray-50 dark:bg-white/5 cursor-pointer disabled:opacity-50"
                >
                  <option value="">
                    {!selectedEntity
                      ? "Select partner first"
                      : loadingOrders
                      ? "Loading invoices..."
                      : ordersList.length === 0
                      ? "No eligible invoices for this party"
                      : "Choose original invoice..."}
                  </option>
                  {ordersList.map(o => (
                    <option key={o.id} value={o.id}>
                      {o._source === 'POS' ? '[POS] ' : o._source === 'FRANCHISE' ? '[FRANCHISE] ' : '[SO] '}
                      #{o.orderNumber || o.orderNo} (₹{Number(o.totalAmount || o.finalAmount || 0).toLocaleString()}) — {formatDate(o.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── RETURN DETAILS CARD ── */}
          {selectedOrder && (
            <div className="space-y-4">
              {/* Invoice Summary Header Card */}
              <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] flex items-center justify-center font-bold">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                          #{selectedOrder.orderNumber}
                        </span>
                        <span className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          partyTypeLabel.toUpperCase().includes('DEALER')
                            ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                            : partyTypeLabel.toUpperCase().includes('FRANCHISE')
                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                        )}>
                          {partyTypeLabel}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mt-0.5">
                        {selectedEntity?.name || selectedOrder.raw?.customerName || 'Walk-in Partner'}
                        {selectedEntity?.phone && <span className="text-gray-400 font-normal"> · {selectedEntity.phone}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase">
                      Sale Date
                    </p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200 mt-0.5">
                      {formatDate(selectedOrder.createdAt)}
                    </p>
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
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase block">Returnable Items</span>
                    <span className={clsx(
                      "text-sm font-bold",
                      isInvoiceFullyReturned ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {returnItems.filter(i => i.returnableQuantity > 0).length} Available
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase block">Selected Return</span>
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

              {/* Items Breakdown Table */}
              <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">
                    Invoice Products &amp; Return Quantity
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    Specify return quantity and condition per item
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
                          <tr key={idx} className={clsx(
                            "transition-colors",
                            isExhausted ? "opacity-60 bg-gray-50/40 dark:bg-white/[0.01]" : "hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                          )}>
                            {/* Product Name & SKU */}
                            <td className="px-4 py-3.5">
                              <p className="font-bold text-gray-900 dark:text-white">{item.productName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.sku && (
                                  <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500">
                                    SKU: {item.sku}
                                  </span>
                                )}
                                {item.taxPercent > 0 && (
                                  <span className="text-[10px] text-gray-400 dark:text-slate-500">
                                    GST: {item.taxPercent}%
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Original Sold */}
                            <td className="px-3 py-3.5 text-center font-semibold text-gray-600 dark:text-slate-400">
                              {item.originalSoldQty}
                            </td>

                            {/* Already Returned */}
                            <td className="px-3 py-3.5 text-center font-semibold text-gray-400 dark:text-slate-500">
                              {item.alreadyReturnedQty}
                            </td>

                            {/* Remaining Returnable */}
                            <td className="px-3 py-3.5 text-center font-bold">
                              <span className={clsx(
                                "px-2 py-0.5 rounded-md text-[11px]",
                                isExhausted
                                  ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              )}>
                                {item.returnableQuantity}
                              </span>
                            </td>

                            {/* Return Quantity Controls */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isExhausted || item.returnQuantity <= 0}
                                  onClick={() => {
                                    const next = [...returnItems];
                                    next[idx].returnQuantity = Math.max(0, item.returnQuantity - 1);
                                    setReturnItems(next);
                                  }}
                                  className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 font-bold disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                >-</button>

                                <input
                                  type="number"
                                  min={0}
                                  max={item.returnableQuantity}
                                  disabled={isExhausted}
                                  value={item.returnQuantity}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(Number(e.target.value) || 0, item.returnableQuantity));
                                    const next = [...returnItems];
                                    next[idx].returnQuantity = val;
                                    setReturnItems(next);
                                  }}
                                  className="w-12 text-center font-bold font-mono py-1 px-1 border border-gray-200 dark:border-white/10 rounded-lg text-xs bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white outline-none focus:border-[#f58220] disabled:opacity-40"
                                />

                                <button
                                  type="button"
                                  disabled={isExhausted || item.returnQuantity >= item.returnableQuantity}
                                  onClick={() => {
                                    const next = [...returnItems];
                                    next[idx].returnQuantity = Math.min(item.returnableQuantity, item.returnQuantity + 1);
                                    setReturnItems(next);
                                  }}
                                  className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 font-bold disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                >+</button>
                              </div>
                            </td>

                            {/* Condition */}
                            <td className="px-3 py-3.5">
                              <select
                                disabled={isExhausted}
                                value={item.condition}
                                onChange={e => {
                                  const next = [...returnItems];
                                  next[idx].condition = e.target.value;
                                  setReturnItems(next);
                                }}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer disabled:opacity-40"
                              >
                                <option value="Good">Good Condition</option>
                                <option value="Damaged">Damaged / Broken</option>
                                <option value="Expired">Expired</option>
                                <option value="Incorrect">Incorrect Item</option>
                              </select>
                            </td>

                            {/* Unit Price */}
                            <td className="px-3 py-3.5 text-right font-mono font-semibold text-gray-700 dark:text-slate-300">
                              ₹{Number(item.rate).toFixed(2)}
                            </td>

                            {/* Return Amount */}
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-[#f58220]">
                              ₹{lineReturnAmt.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reason + Refund Method + Return Calculation Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-4 shadow-2xs">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Reason for Return <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="State the reason for return (e.g. Customer returned sealed unit, packaging damaged, defective batch)..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none resize-none focus:border-[#f58220] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Refund Method
                    </label>
                    <select
                      value={refundMethod}
                      onChange={e => setRefundMethod(e.target.value)}
                      className="w-full sm:w-64 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-semibold bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer"
                    >
                      <option value="Original Method">Original Payment Method</option>
                      <option value="Credit Ledger">Adjust in Customer/Dealer Ledger</option>
                      <option value="Cash Voucher">Cash / Direct refund</option>
                      <option value="Cheque / UPI">Bank Cheque / UPI</option>
                    </select>
                  </div>
                </div>

                {/* Credit Summary Card */}
                <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 space-y-3.5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                      Total Credit Amount
                    </p>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-[#f58220] mt-1">
                      ₹{estimatedRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-white/5 mt-3 text-xs">
                      <div className="flex justify-between text-gray-500 dark:text-slate-400">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-slate-200">
                          ₹{returnSubtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500 dark:text-slate-400">
                        <span>Tax / GST:</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-slate-200">
                          ₹{returnTax.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 items-start text-[11px] text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-white/5">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <p className="leading-snug">Stock hub and party ledger are updated upon approval.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => { setView("list"); resetForm(); }}
            className="px-4 py-2 text-xs font-bold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave("DRAFT")}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-700 dark:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave("PENDING")}
            disabled={submitting || !selectedEntity || !selectedOrder || !reason.trim() || estimatedRefund <= 0}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#f58220] hover:bg-[#e8740e] disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 text-white rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
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
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end">
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
            { label: "Total",     value: stats.total,                               color: "text-gray-700 dark:text-slate-200",    dot: "bg-gray-400" },
            { label: "Pending",   value: stats.pending,                             color: "text-orange-600 dark:text-orange-400",  dot: "bg-orange-500" },
            { label: "Refunded",  value: `₹${stats.refunded.toLocaleString()}`,     color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            { label: "Rejected",  value: stats.rejected,                            color: "text-rose-600 dark:text-rose-400",    dot: "bg-rose-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
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
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-card">
            {(['ALL', 'PARTNER', 'FRANCHISE'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === tab ? "bg-[#f58220] text-white" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {tab === 'ALL' ? 'All' : tab === 'PARTNER' ? 'Dealers' : 'Franchise'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={fetchReturns} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {filteredReturns.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
              <Undo2 className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-semibold">No Sales Returns</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Log returns and issue credit notes to partners.</p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
            >
              Create Return
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
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
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 dark:text-slate-200 text-xs">
                        {r.returnNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 dark:text-white text-sm">{r.entityName}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">{r.source === 'FRANCHISE' ? 'Franchise' : 'Dealer'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 font-medium">
                        #{r.orderRefNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                        <span className="line-clamp-1 max-w-[140px]" title={r.reason}>{r.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400 text-sm">
                        ₹{Number(r.refundAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => processStatusChange(r.id, 'APPROVED')}
                                className="px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => processStatusChange(r.id, 'REJECTED')}
                                className="px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'APPROVED' && (
                            <button
                              onClick={() => processStatusChange(r.id, 'COMPLETED')}
                              className="px-2.5 py-1 text-xs font-medium text-[#f58220] dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded transition-colors"
                            >
                              Process Refund
                            </button>
                          )}
                          {r.status === 'COMPLETED' && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </span>
                          )}
                          <button
                            onClick={() => setPreviewingReturn(r)}
                            title="Print"
                            className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
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

