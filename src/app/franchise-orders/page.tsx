"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Plus, X, RefreshCw, CheckCircle2, Clock,
  Truck, PackageCheck, AlertTriangle, ChevronDown, Receipt,
  CreditCard, Banknote, ArrowRight, Package, Warehouse, ClipboardList,
  Ban, XCircle, Trash2, ShieldAlert, ChefHat, Landmark, AlertCircle, Check, Search, Loader2
} from "lucide-react";
import { clsx } from "clsx";
import api, { franchiseOrdersApi, franchiseProductRequestsApi, accountsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const PACK_UNIT_LABELS: Record<string, string> = {
  KG: "KG",
  G: "G",
  GM: "G",
  GMS: "G",
  L: "L",
  LTR: "L",
  LITRE: "L",
  ML: "ML",
  PCS: "PCS",
  PC: "PC",
  PKT: "PKT",
  PACK: "PACK",
  BOX: "BOX",
};

function getProductPackSize(productOrItem: any): string | null {
  if (!productOrItem) return null;
  const p = productOrItem.product || productOrItem;

  // 1. Explicit packSize object
  const packSize = p.packSize;
  if (packSize) {
    if (typeof packSize === "object" && packSize !== null) {
      const qty = packSize.qty;
      const unit = packSize.unit ? (PACK_UNIT_LABELS[String(packSize.unit).toUpperCase()] || String(packSize.unit).toUpperCase()) : "";
      if (qty !== undefined && qty !== null && qty !== "") {
        const formattedQty = Number(qty) % 1 === 0 ? Number(qty) : Number(qty).toFixed(2);
        return unit ? `${formattedQty} ${unit}` : `${formattedQty}`;
      }
      if (unit) return unit;
    }
    if (typeof packSize === "string" && packSize.trim()) {
      const trimmed = packSize.trim();
      const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
      if (match) {
        const unit = PACK_UNIT_LABELS[match[2].toUpperCase()] || match[2].toUpperCase();
        return `${match[1]} ${unit}`;
      }
      return trimmed;
    }
  }

  // 2. Explicit netWeight / weight field
  const weight = p.netWeight ?? p.weight;
  if (weight !== undefined && weight !== null && weight !== "") {
    if (typeof weight === "object" && weight !== null) {
      const qty = weight.qty ?? weight.value;
      const unit = weight.unit ? (PACK_UNIT_LABELS[String(weight.unit).toUpperCase()] || String(weight.unit).toUpperCase()) : "";
      if (qty !== undefined && qty !== null && qty !== "") {
        const formattedQty = Number(qty) % 1 === 0 ? Number(qty) : Number(qty).toFixed(2);
        return unit ? `${formattedQty} ${unit}` : `${formattedQty}`;
      }
    }
    if (typeof weight === "number") {
      const formattedQty = weight % 1 === 0 ? weight : weight.toFixed(2);
      const unit = p.unit ? (PACK_UNIT_LABELS[String(p.unit).toUpperCase()] || String(p.unit).toUpperCase()) : "G";
      return `${formattedQty} ${unit}`;
    }
    if (typeof weight === "string" && weight.trim() !== "") {
      const trimmed = weight.trim();
      const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(KG|G|GM|GMS|L|LTR|LITRE|ML|PCS|PC|PKT|PACK)$/i);
      if (m) {
        const unit = PACK_UNIT_LABELS[m[2].toUpperCase()] || m[2].toUpperCase();
        return `${m[1]} ${unit}`;
      }
      return trimmed;
    }
  }

  // 3. Explicit size field
  const size = p.size;
  if (size && typeof size === "string" && size.trim() !== "") {
    const trimmed = size.trim();
    const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(KG|G|GM|GMS|L|LTR|LITRE|ML|PCS|PC|PKT|PACK)$/i);
    if (m) {
      const unit = PACK_UNIT_LABELS[m[2].toUpperCase()] || m[2].toUpperCase();
      return `${m[1]} ${unit}`;
    }
    return trimmed;
  }

  // 4. SKU size suffix (e.g. FG-APPAM-500G, FG-CARROT-1KG, FG-BM-500G)
  const sku = p.sku || p.code || p.productCode;
  if (sku && typeof sku === "string") {
    const m = sku.match(/(?:-|_|\s)(\d+(?:\.\d+)?)\s*(KG|G|GM|GMS|L|LTR|LITRE|ML|PCS|PC|PKT|PACK)$/i);
    if (m) {
      const unit = PACK_UNIT_LABELS[m[2].toUpperCase()] || m[2].toUpperCase();
      return `${m[1]} ${unit}`;
    }
  }

  // 5. Product name suffix / parentheses (e.g. "APPAM (500G)" or "CARROT 1KG")
  const name = p.name || p.productName;
  if (name && typeof name === "string") {
    const nameMatch = name.match(/(?:\(|\b)(\d+(?:\.\d+)?)\s*(KG|G|GM|GMS|L|LTR|LITRE|ML|PCS|PC|PKT|PACK)(?:\)|\b)/i);
    if (nameMatch) {
      const unit = PACK_UNIT_LABELS[nameMatch[2].toUpperCase()] || nameMatch[2].toUpperCase();
      return `${nameMatch[1]} ${unit}`;
    }
  }

  return null;
}

function getProductSku(productOrItem: any): string {
  if (!productOrItem) return "N/A";
  const p = productOrItem.product || productOrItem;
  return p.sku || p.code || p.productCode || "N/A";
}

function getProductUnit(productOrItem: any): string {
  if (!productOrItem) return "Units";
  const p = productOrItem.product || productOrItem;
  const unit = p.unit;
  if (unit) {
    if (typeof unit === "string" && unit.trim()) return unit.trim();
    if (typeof unit === "object") {
      const code = (unit.code || unit.name || unit.symbol || "").toString().trim();
      if (code) return code;
    }
  }
  const u = p.uom || p.inventoryItem?.unit || p.recipe?.yieldUnit || "";
  if (typeof u === "string" && u.trim()) return u.trim();
  if (typeof u === "object" && u !== null) {
    const code = (u.code || u.name || u.symbol || "").toString().trim();
    if (code) return code;
  }
  return "Units";
}

function getProductOptionLabel(product: any): string {
  if (!product) return "";
  const packSize = getProductPackSize(product) || "Pack size not configured";
  const sku = getProductSku(product);
  return `${product.name} — ${packSize} — SKU: ${sku}`;
}

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

// Flow 1 (STOCK): PENDING -> APPROVED (Sales Invoice) -> DISPATCHED -> DELIVERED (No production)
// Flow 2 (REQUEST): PENDING -> APPROVED -> IN_PRODUCTION -> DISPATCHED -> DELIVERED
function getNextStatus(order: any): string | undefined {
  const isStockOrder = (order.orderType || "STOCK") === "STOCK" || order.fulfillmentPath === "STOCK";
  if (isStockOrder) {
    if (order.status === "PENDING") return "APPROVED";
    if (order.status === "APPROVED") return "DISPATCHED";
    if (order.status === "DISPATCHED") return "DELIVERED";
    return undefined;
  }
  // REQUEST / MAKE TO ORDER
  if (order.status === "PENDING") return "APPROVED";
  if (order.status === "APPROVED") return "IN_PRODUCTION";
  if (order.status === "IN_PRODUCTION") return "DISPATCHED";
  if (order.status === "DISPATCHED") return "DELIVERED";
  return undefined;
}

export default function FranchiseOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = String((user as any)?.role?.name || user?.role || "").toUpperCase();
  const isSuperAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "HQ" || userRole === "PRODUCTION_MANAGER";
  const isFranchiseAdmin = userRole === "FRANCHISE_ADMIN" || userRole === "FRANCHISE";

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
  const [orderType] = useState<"REQUEST">("REQUEST");
  const [selectedFranchise, setSelectedFranchise] = useState(user?.franchiseId ?? "");
  const [paymentType] = useState("CREDIT");
  const [preferredDelivery, setPreferredDelivery] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [notes, setNotes] = useState("");
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: "", quantity: 1 },
  ]);
  const [itemSearches, setItemSearches] = useState<Record<number, string>>({});

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
      setError("Please select a franchise and at least one product with quantity.");
      return;
    }

    // Ensure distinct product selection
    const seenProductIds = new Set<string>();
    for (const item of validItems) {
      if (seenProductIds.has(item.productId)) {
        setError("Duplicate product lines detected. Please adjust quantities on a single row or select distinct products.");
        return;
      }
      seenProductIds.add(item.productId);
    }

    setSaving(true);
    try {
      const res = await api.post("/api/franchise-orders", {
        franchiseId: selectedFranchise,
        orderType: "REQUEST",
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
                productName: p?.name || "Product",
                requestedQuantity: Number(i.quantity),
                unit: p?.unit || "KG",
              };
            }),
          },
        })
      );

      setShowCreate(false);
      setOrderItems([{ productId: "", quantity: 1 }]);
      setItemSearches({});
      setNotes(""); setPreferredDelivery(""); setPriority("NORMAL");
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
  const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);

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

  // Pay HQ Modal State
  const [payModalOrder, setPayModalOrder] = useState<any | null>(null);
  const [franchiseAccounts, setFranchiseAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [payingHq, setPayingHq] = useState(false);
  const [payHqError, setPayHqError] = useState("");

  const openPayModal = async (order: any) => {
    setPayModalOrder(order);
    setPayHqError("");

    const isFullySettled = order.hqReceived || (order.paymentStatus === "PAID" && !isSuperAdmin);
    const isUnpaidForHq = isSuperAdmin && (!order.franchisePaid || order.paidAmount <= 0);

    if (isFullySettled || isUnpaidForHq) {
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);
    try {
      const res = await accountsApi.getAll();
      const accList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setFranchiseAccounts(accList);
      const defaultAcc = accList.find((a: any) => a.isDefault) || accList[0];
      if (defaultAcc) {
        setSelectedAccountId(defaultAcc.id);
      } else {
        setSelectedAccountId("");
      }
    } catch (err: any) {
      console.error("Failed to load accounts for payment:", err);
      setPayHqError("Failed to fetch accounts. Please check your connection.");
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleConfirmPayHq = async () => {
    if (!payModalOrder || payingHq) return;

    if (!selectedAccountId) {
      setPayHqError(isSuperAdmin ? "Please select an HQ receiving account." : "Please select a franchise payment account.");
      return;
    }

    const selectedAcc = franchiseAccounts.find((a) => a.id === selectedAccountId);
    const orderTotal = Number(payModalOrder.totalAmount || 0);
    const paidByFranchise = Number(payModalOrder.paidAmount || 0);
    const balanceDue = payModalOrder.balanceDue !== undefined ? Number(payModalOrder.balanceDue) : orderTotal;

    const payAmount = isSuperAdmin ? paidByFranchise : balanceDue;

    if (payAmount <= 0) {
      setPayHqError(isSuperAdmin ? "No franchise payment available to receive." : "This order has no outstanding balance.");
      return;
    }

    if (!isSuperAdmin && selectedAcc && selectedAcc.balance < payAmount) {
      setPayHqError(`Insufficient Franchise Account Balance. Available: ₹${selectedAcc.balance.toFixed(2)}, Required: ₹${payAmount.toFixed(2)}.`);
      return;
    }

    setPayingHq(true);
    setPayHqError("");
    try {
      await api.post(`/api/franchise-orders/${payModalOrder.id}/payment`, { 
        amount: payAmount,
        accountId: selectedAccountId
      });
      toast.success(
        isSuperAdmin
          ? `HQ Receipt of ₹${payAmount.toFixed(2)} confirmed successfully!`
          : `Payment of ₹${payAmount.toFixed(2)} to HQ recorded successfully!`,
        { duration: 6000 }
      );
      setPayModalOrder(null);
      fetchAll();
    } catch (e: any) {
      const errMsg = e?.response?.data?.error ?? "Failed to record payment.";
      setPayHqError(errMsg);
      toast.error(errMsg);
    } finally {
      setPayingHq(false);
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0 animate-in fade-in duration-500 w-full min-w-0">
      
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-4 w-full min-w-0">

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
      <div className="flex flex-col lg:flex-row gap-4 print:hidden w-full min-w-0">
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
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 print:hidden max-w-full">
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
            const isStockOrder = (order.orderType || "STOCK") === "STOCK" || order.fulfillmentPath === "STOCK";
            const nextStatus = getNextStatus(order);
            const isDelayed  = order.delayStatus === "DELAYED";
            const needsProduction = !isStockOrder && order.status === "APPROVED";
            const conf = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;

            const timelineSteps = isStockOrder
              ? ["PENDING", "APPROVED", "DISPATCHED", "DELIVERED"]
              : ["PENDING", "APPROVED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED"];

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
                      {isStockOrder ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800 text-[10px] font-bold uppercase tracking-wider">
                          <Warehouse size={10} /> Check Stock &amp; Order
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800 text-[10px] font-bold uppercase tracking-wider">
                          <ClipboardList size={10} /> Request / Make to Order
                        </span>
                      )}
                      {order.priority === "URGENT" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm shadow-rose-500/20">
                          <AlertTriangle size={10} /> Urgent
                        </span>
                      )}
                      {order.paymentStatus === "PAID" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 size={10} /> Paid
                        </span>
                      ) : order.paymentStatus === "PARTIAL" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          <Clock size={10} /> Partially Paid
                        </span>
                      ) : order.paymentType === "CREDIT" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                          Credit (Unpaid)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          Unpaid
                        </span>
                      )}
                      {order.hasInvoice && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                          <Receipt size={10} /> {order.invoiceNum || "Invoice Created"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {order.franchise?.name} · Ordered: {formatDate(order.createdAt)}
                    </p>
                  </div>
                  
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {order.status === "PENDING" ? "Order Price" : "Approved Price"}
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                      ₹{order.totalAmount.toLocaleString("en-IN")}
                    </p>
                    {order.status !== "PENDING" && order.subtotal > 0 && order.subtotal !== order.totalAmount && (
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        Base Order: ₹{order.subtotal.toLocaleString("en-IN")}
                      </p>
                    )}
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
                      {order.items?.map((item: any) => {
                        const prod = item.product || item;
                        const packSize = getProductPackSize(prod);
                        const sku = getProductSku(prod);
                        const unit = getProductUnit(prod);
                        return (
                          <div key={item.id || item.productId} className={clsx(
                            "inline-flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all",
                            item.productType === "MADE_TO_ORDER" || !isStockOrder
                              ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
                              : "bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-sm"
                          )}>
                            <div className="flex items-center gap-1.5">
                              <span>{item.product?.name || item.name || item.productName}</span>
                              {packSize && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100/70 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 font-bold">
                                  {packSize}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              {sku !== "N/A" && <span className="font-mono text-[10px] text-slate-400">({sku})</span>}
                              <span className="text-slate-400">×</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{item.quantity} {unit || "Units"}</span>
                            </div>
                            {item.productType === "MADE_TO_ORDER" && <span className="text-[10px] font-bold uppercase opacity-60 ml-1">MTO</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Timeline / Progress */}
                    {order.status !== "CANCELLED" && (
                      <div className="flex items-center gap-0 overflow-hidden max-w-sm pt-2">
                        {timelineSteps.map((step, idx, arr) => {
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

                    {/* Material Shortfall Notice - ONLY FOR SUPER_ADMIN / HQ, NEVER EXPOSED TO FRANCHISE USERS */}
                    {isSuperAdmin && needsProduction && Array.isArray(order.materialsShortfall) && (
                      <div className={clsx(
                        "p-3 rounded-lg border text-xs mt-2",
                        order.materialsReady
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-700/20 dark:text-emerald-400"
                          : "bg-red-50 border-red-100 text-red-700 dark:bg-red-900/10 dark:border-red-700/20 dark:text-red-400"
                      )}>
                        {order.materialsReady ? (
                          <p className="font-bold">Materials Available — Production can start.</p>
                        ) : (
                          <div className="space-y-2">
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
                            <button
                              onClick={() => router.push(`/production?franchiseOrderId=${order.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer mt-1"
                            >
                              <ChefHat size={14} /> Go to Production <ArrowRight size={14} />
                            </button>
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
                        {isSuperAdmin && (
                          <>
                            {order.status === "PENDING" && (
                              isStockOrder ? (
                                <button
                                  onClick={() => router.push(`/sales/invoices/new?franchiseOrderId=${order.id}&source=FRANCHISE`)}
                                  className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                >
                                  Mark Approved <ArrowRight size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAdvanceStatus(order.id, "APPROVED")}
                                  className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                >
                                  Mark Approved <ArrowRight size={14} />
                                </button>
                              )
                            )}

                            {order.status === "APPROVED" && (
                              isStockOrder ? (
                                <button
                                  disabled={advancingOrderId === order.id}
                                  onClick={() => handleAdvanceStatus(order.id, "DISPATCHED")}
                                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                >
                                  {advancingOrderId === order.id ? (
                                    <>Dispatching... <Loader2 size={14} className="animate-spin" /></>
                                  ) : (
                                    <>Mark Dispatched <Truck size={14} /></>
                                  )}
                                </button>
                              ) : (
                                needsProduction && !order.materialsReady ? (
                                  <div className="space-y-1.5 w-full">
                                    <button disabled className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                                      Mark In Production
                                    </button>
                                    <button
                                      onClick={() => router.push(`/production?franchiseOrderId=${order.id}`)}
                                      className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                    >
                                      <ChefHat size={14} /> Go to Production <ArrowRight size={14} />
                                    </button>
                                    <p className="text-[10px] font-bold text-red-500 text-center">Blocked by materials</p>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleAdvanceStatus(order.id, "IN_PRODUCTION")}
                                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                  >
                                    Mark In Production <Package size={14} />
                                  </button>
                                )
                              )
                            )}

                            {order.status === "IN_PRODUCTION" && (
                              <div className="space-y-2 w-full">
                                {order.hasInvoice ? (
                                  <button
                                    disabled={advancingOrderId === order.id}
                                    onClick={() => handleAdvanceStatus(order.id, "DISPATCHED")}
                                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                  >
                                    {advancingOrderId === order.id ? (
                                      <>Dispatching... <Loader2 size={14} className="animate-spin" /></>
                                    ) : (
                                      <>Mark Dispatched <Truck size={14} /></>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => router.push(`/sales/invoices/new?franchiseOrderId=${order.id}&source=FRANCHISE`)}
                                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                  >
                                    <Receipt size={14} /> Create Invoice
                                  </button>
                                )}
                              </div>
                            )}

                            {order.status === "DISPATCHED" && (
                              <div className="space-y-2 w-full">
                                {isSuperAdmin && (
                                  order.hqReceived ? (
                                    <button
                                      onClick={() => openPayModal(order)}
                                      className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                                    >
                                      <CheckCircle2 size={14} className="text-emerald-500" /> Payment Received
                                    </button>
                                  ) : order.franchisePaid ? (
                                    <button
                                      onClick={() => openPayModal(order)}
                                      className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                                    >
                                      <Banknote size={14} /> Mark Payment
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openPayModal(order)}
                                      className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                      <Clock size={14} /> Franchise payment pending
                                    </button>
                                  )
                                )}
                                <button
                                  disabled={advancingOrderId === order.id}
                                  onClick={() => handleAdvanceStatus(order.id, "DELIVERED")}
                                  className={clsx(
                                    "w-full px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
                                    isSuperAdmin && !order.hqReceived
                                      ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white hover:opacity-90"
                                  )}
                                >
                                  {advancingOrderId === order.id ? (
                                    <>Delivering... <Loader2 size={14} className="animate-spin" /></>
                                  ) : (
                                    <>Mark Delivered <PackageCheck size={14} /></>
                                  )}
                                </button>
                              </div>
                            )}
                          </>
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

                    {order.status === "DELIVERED" && (
                      isSuperAdmin ? (
                        order.hqReceived ? (
                          <div className="space-y-1.5 w-full">
                            <button
                              onClick={() => handleInvoice(order.id)}
                              className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                            >
                              <Receipt size={14} /> View Invoice
                            </button>
                            <button
                              onClick={() => openPayModal(order)}
                              className="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            >
                              <CheckCircle2 size={14} /> Payment Details
                            </button>
                          </div>
                        ) : order.franchisePaid ? (
                          <button
                            onClick={() => openPayModal(order)}
                            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            <Banknote size={14} /> Mark Payment
                          </button>
                        ) : (
                          <button
                            onClick={() => openPayModal(order)}
                            className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Clock size={14} /> Franchise payment pending
                          </button>
                        )
                      ) : (
                        order.paymentStatus === "PAID" || (order.balanceDue !== undefined && order.balanceDue <= 0.001) ? (
                          <div className="space-y-1.5 w-full">
                            <button
                              onClick={() => handleInvoice(order.id)}
                              className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                            >
                              <Receipt size={14} /> View Invoice
                            </button>
                            <button
                              onClick={() => openPayModal(order)}
                              className="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            >
                              <CheckCircle2 size={14} /> Payment Details
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openPayModal(order)}
                            className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            <Banknote size={14} /> {order.paymentStatus === "PARTIAL" ? "Pay Remaining to HQ" : "Pay HQ"}
                          </button>
                        )
                      )
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
                  <div className="flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30 shadow-sm">
                    <ClipboardList size={14} /> Request / Make to Order
                  </div>
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Products
                  </label>
                  <button
                    type="button"
                    onClick={() => setOrderItems(prev => [...prev, { productId: "", quantity: 1 }])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:underline transition-all"
                  >
                    <Plus size={14} /> Add Product
                  </button>
                </div>

                <div className="space-y-3">
                  {orderItems.map((item, idx) => {
                    const isSelectedInOtherRow = (prodId: string) =>
                      orderItems.some((otherItem, oIdx) => oIdx !== idx && otherItem.productId === prodId);

                    const selectedProduct = products.find(p => p.id === item.productId);
                    const currentSearch = (itemSearches[idx] || "").toLowerCase().trim();
                    const currentSearchNoSpace = currentSearch.replace(/\s+/g, "");

                    const filteredProducts = products.filter(p => {
                      if (!currentSearch) return true;
                      const name = (p.name || "").toLowerCase();
                      const sku = getProductSku(p).toLowerCase();
                      const packSize = (getProductPackSize(p) || "").toLowerCase();
                      const packSizeNoSpace = packSize.replace(/\s+/g, "");
                      const code = (p.code || p.productCode || "").toLowerCase();
                      const category = (p.category || "").toLowerCase();

                      return (
                        name.includes(currentSearch) ||
                        sku.includes(currentSearch) ||
                        sku.includes(currentSearchNoSpace) ||
                        packSize.includes(currentSearch) ||
                        packSizeNoSpace.includes(currentSearchNoSpace) ||
                        code.includes(currentSearch) ||
                        category.includes(currentSearch)
                      );
                    });

                    // 1. When a product is selected: Show the Clean Product Card
                    if (selectedProduct) {
                      const packSize = getProductPackSize(selectedProduct);
                      const sku = getProductSku(selectedProduct);

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-orange-200 dark:border-orange-500/30 shadow-sm space-y-3 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 min-w-0">
                              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                                {selectedProduct.name}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 dark:text-slate-500 font-semibold">SKU:</span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    {sku}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 dark:text-slate-500 font-semibold">Pack Size:</span>
                                  <span className={clsx(
                                    "font-bold",
                                    packSize
                                      ? "text-slate-800 dark:text-slate-100"
                                      : "text-amber-600 dark:text-amber-400 italic font-normal"
                                  )}>
                                    {packSize || "Pack size not configured"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (orderItems.length > 1) {
                                  setOrderItems(prev => prev.filter((_, i) => i !== idx));
                                } else {
                                  setOrderItems([{ productId: "", quantity: 1 }]);
                                }
                              }}
                              title="Remove line"
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Order Quantity Control */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              Order Quantity
                            </span>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={item.quantity || ""}
                                onChange={e => {
                                  const val = e.target.value === "" ? 0 : Math.max(1, parseInt(e.target.value, 10) || 1);
                                  const updated = [...orderItems];
                                  updated[idx].quantity = val;
                                  setOrderItems(updated);
                                }}
                                onBlur={() => {
                                  if (!item.quantity || item.quantity < 1) {
                                    const updated = [...orderItems];
                                    updated[idx].quantity = 1;
                                    setOrderItems(updated);
                                  }
                                }}
                                className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-lg border-r-0 text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-orange-500 outline-none text-center"
                                placeholder="1"
                              />
                              <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-r-lg text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
                                Units
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 2. When NO product is selected: Show the Searchable Product Selector
                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-50/90 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Select Product {orderItems.length > 1 && `(Line #${idx + 1})`}
                          </span>
                          {orderItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}
                              title="Remove line"
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search by product name, SKU, pack size (e.g. 500G), or code..."
                            value={itemSearches[idx] || ""}
                            onChange={e => setItemSearches(prev => ({ ...prev, [idx]: e.target.value }))}
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-orange-500 outline-none"
                          />
                        </div>

                        {/* Searchable Options List */}
                        <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredProducts.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              No products match your search
                            </div>
                          ) : (
                            filteredProducts.map(p => {
                              const isDuplicate = isSelectedInOtherRow(p.id);
                              const packSize = getProductPackSize(p);
                              const sku = getProductSku(p);

                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={isDuplicate}
                                  onClick={() => {
                                    const updated = [...orderItems];
                                    updated[idx].productId = p.id;
                                    setOrderItems(updated);
                                    setItemSearches(prev => {
                                      const copy = { ...prev };
                                      delete copy[idx];
                                      return copy;
                                    });
                                  }}
                                  className={clsx(
                                    "w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between gap-3 text-xs",
                                    isDuplicate
                                      ? "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-900"
                                      : "hover:bg-orange-50 dark:hover:bg-orange-950/20 cursor-pointer"
                                  )}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="font-bold text-slate-900 dark:text-white truncate">
                                      {p.name}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      <span className="font-mono text-slate-600 dark:text-slate-300">
                                        SKU: {sku}
                                      </span>
                                      <span>·</span>
                                      <span className={packSize ? "text-slate-700 dark:text-slate-200 font-semibold" : "italic text-slate-400"}>
                                        {packSize || "Pack size not configured"}
                                      </span>
                                    </div>
                                  </div>
                                  {isDuplicate ? (
                                    <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                                      Selected
                                    </span>
                                  ) : (
                                    <span className="shrink-0 text-orange-600 dark:text-orange-400 font-bold text-xs">
                                      Select →
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add More Button */}
                <button
                  type="button"
                  onClick={() => setOrderItems(prev => [...prev, { productId: "", quantity: 1 }])}
                  className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-500/10 text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                >
                  <Plus size={15} /> Add More
                </button>
              </div>

              {/* Delivery info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {(() => {
                const validItems = orderItems.filter(i => i.productId && i.quantity > 0);

                return (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-sm font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Total Ordered</span>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {validItems.map((item, i) => {
                        const prod = products.find(p => p.id === item.productId);
                        const packSize = getProductPackSize(prod);
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span>{prod?.name || "Product"}</span>
                            {packSize && (
                              <span className="text-orange-600 dark:text-orange-400 font-semibold">
                                ({packSize})
                              </span>
                            )}
                            <span className="text-slate-400 font-normal">·</span>
                            <span>{item.quantity} Units</span>
                          </span>
                        );
                      })}
                      {validItems.length === 0 && (
                        <span className="text-slate-400 text-xs font-medium">No products selected</span>
                      )}
                    </div>
                  </div>
                );
              })()}



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

      {/* Pay HQ / Record Payment / Payment Details Modal */}
      {payModalOrder && mounted && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            {(() => {
              const isAlreadyPaid = payModalOrder.paymentStatus === "PAID" || (payModalOrder.balanceDue !== undefined && payModalOrder.balanceDue <= 0.001);
              const orderTotal = Number(payModalOrder.totalAmount || 0);
              const alreadyPaid = Number(payModalOrder.paidAmount || (isAlreadyPaid ? orderTotal : 0));
              const outstandingAmount = Math.max(0, payModalOrder.balanceDue !== undefined ? Number(payModalOrder.balanceDue) : (isAlreadyPaid ? 0 : orderTotal - alreadyPaid));
              const paymentsList = Array.isArray(payModalOrder.payments) ? payModalOrder.payments : [];

              const isSuperAdminMarkPayment = isSuperAdmin && payModalOrder.franchisePaid && !payModalOrder.hqReceived;
              const isFranchisePayingHq = isFranchiseAdmin && !isAlreadyPaid;

              return (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        payModalOrder.hqReceived || isAlreadyPaid
                          ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : isSuperAdminMarkPayment
                          ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                      )}>
                        {payModalOrder.hqReceived || isAlreadyPaid ? <CheckCircle2 size={22} /> : <Banknote size={22} />}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {isSuperAdminMarkPayment
                            ? "Confirm Payment Received"
                            : isFranchisePayingHq
                            ? "Pay HQ"
                            : "Payment Details"}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500">
                          {payModalOrder.franchise?.name
                            ? `${payModalOrder.franchise.name} · ${payModalOrder.orderNumber || `FO-${String(payModalOrder.id).slice(0, 6).toUpperCase()}`}`
                            : `Order: ${payModalOrder.orderNumber || `FO-${String(payModalOrder.id).slice(0, 6).toUpperCase()}`}`
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPayModalOrder(null)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* ── STATE 1: SUPER ADMIN CONFIRMS HQ RECEIPT OF FRANCHISE'S EXISTING PAYMENT ── */}
                  {isSuperAdminMarkPayment ? (
                    <div className="space-y-5">
                      {/* Franchise Paid Source Info Card */}
                      <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                            Amount Paid by Franchise
                          </p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 size={12} /> PAID BY FRANCHISE
                          </span>
                        </div>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                          ₹{alreadyPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-800/30 text-xs text-slate-500 dark:text-slate-400">
                          <span>Order: {payModalOrder.orderNumber}</span>
                          {payModalOrder.invoiceNum && (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Invoice: {payModalOrder.invoiceNum}</span>
                          )}
                        </div>
                      </div>

                      {/* Error Message if any */}
                      {payHqError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium">
                          <AlertCircle size={16} className="shrink-0 mt-0.5" />
                          <span>{payHqError}</span>
                        </div>
                      )}

                      {/* HQ Account Selection */}
                      {loadingAccounts ? (
                        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <RefreshCw size={24} className="animate-spin text-orange-500" />
                          <p className="text-xs font-medium">Fetching HQ Accounts...</p>
                        </div>
                      ) : franchiseAccounts.length === 0 ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-3">
                          <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                            <div>
                              <p className="font-bold">No HQ Accounts Configured</p>
                              <p className="mt-0.5 text-amber-700 dark:text-amber-400 text-[11px]">
                                Please configure an HQ Cash or Bank account in Banking & Accounts to receive payments.
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/accounting/accounts"
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <Plus size={14} /> Configure Bank Accounts
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                              Select HQ Receiving Account (Cash / Bank / UPI)
                            </label>
                            <select
                              value={selectedAccountId}
                              onChange={(e) => {
                                setSelectedAccountId(e.target.value);
                                setPayHqError("");
                              }}
                              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            >
                              {franchiseAccounts.map((acc: any) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name} ({acc.type}) — Balance: ₹{Number(acc.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Live Balance Preview */}
                          {(() => {
                            const sel = franchiseAccounts.find((a: any) => a.id === selectedAccountId);
                            if (!sel) return null;
                            const currentBal = Number(sel.balance || 0);
                            const balanceAfter = currentBal + alreadyPaid;
                            return (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                  <span>HQ Account Balance:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    ₹{currentBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                  <span>Amount Received (+):</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    +₹{alreadyPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex justify-between items-center">
                                  <span className="font-bold text-slate-700 dark:text-slate-300">Estimated Balance After (+):</span>
                                  <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                                    ₹{balanceAfter.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setPayModalOrder(null)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={payingHq || loadingAccounts || franchiseAccounts.length === 0 || !selectedAccountId}
                          onClick={handleConfirmPayHq}
                          className="flex-[1.5] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {payingHq ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" /> Confirming...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Confirm Payment Received (₹{alreadyPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : isFranchisePayingHq ? (
                    /* ── STATE 2: FRANCHISE ADMIN PAYS HQ ── */
                    <div className="space-y-5">
                      <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                            Outstanding Amount Due
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                            {alreadyPaid > 0 ? "PARTIAL DUE" : "UNPAID DUE"}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                          ₹{outstandingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                        {alreadyPaid > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-800/30 text-xs text-slate-500 dark:text-slate-400">
                            <span>Order Total: ₹{orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Already Paid: ₹{alreadyPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>

                      {/* Error Message if any */}
                      {payHqError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium">
                          <AlertCircle size={16} className="shrink-0 mt-0.5" />
                          <span>{payHqError}</span>
                        </div>
                      )}

                      {/* Account Selection */}
                      {loadingAccounts ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <RefreshCw size={24} className="animate-spin text-orange-500" />
                          <p className="text-xs font-medium">Fetching Franchise Accounts...</p>
                        </div>
                      ) : franchiseAccounts.length === 0 ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-3">
                          <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                            <div>
                              <p className="font-bold">No Franchise Accounts Configured</p>
                              <p className="mt-0.5 text-amber-700 dark:text-amber-400 text-[11px]">
                                You must add a Franchise Cash or Bank account before making payments to HQ.
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/franchise/bank-accounts"
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <Plus size={14} /> Configure Bank Accounts
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                              Select Payment Account (Franchise Source)
                            </label>
                            <select
                              value={selectedAccountId}
                              onChange={(e) => {
                                setSelectedAccountId(e.target.value);
                                setPayHqError("");
                              }}
                              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            >
                              {franchiseAccounts.map((acc: any) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name} ({acc.type}) — Balance: ₹{Number(acc.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Live Balance Preview */}
                          {(() => {
                            const sel = franchiseAccounts.find((a: any) => a.id === selectedAccountId);
                            if (!sel) return null;
                            const currentBal = Number(sel.balance || 0);
                            const remBal = currentBal - outstandingAmount;
                            const isInsufficient = remBal < 0;

                            return (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                  <span>Current Account Balance:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    ₹{currentBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                  <span>Payment Deduction:</span>
                                  <span className="font-bold text-rose-600 dark:text-rose-400">
                                    -₹{outstandingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex justify-between items-center">
                                  <span className="font-bold text-slate-700 dark:text-slate-300">Estimated Balance After:</span>
                                  <span className={clsx("font-extrabold text-sm", isInsufficient ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                                    ₹{remBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                {isInsufficient && (
                                  <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1.5">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span>Insufficient Franchise Account Balance. Please fund account or pick another source.</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setPayModalOrder(null)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            payingHq ||
                            loadingAccounts ||
                            franchiseAccounts.length === 0 ||
                            !selectedAccountId ||
                            Boolean(franchiseAccounts.find((a: any) => a.id === selectedAccountId)?.balance < outstandingAmount)
                          }
                          onClick={handleConfirmPayHq}
                          className="flex-[1.5] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {payingHq ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" /> Processing...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Confirm & Pay HQ (₹{outstandingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── STATE 3: READ-ONLY PAYMENT DETAILS & STATUS SUMMARY ── */
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Payment Status
                          </span>
                          {payModalOrder.hqReceived ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 size={12} /> PAYMENT RECEIVED
                            </span>
                          ) : isAlreadyPaid || alreadyPaid > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                              <Clock size={12} /> PAID BY FRANCHISE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                              <Clock size={12} /> AWAITING FRANCHISE PAYMENT
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                          <div className="space-y-0.5">
                            <p className="text-slate-500 dark:text-slate-400 text-[11px]">Total Amount</p>
                            <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                              ₹{orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-slate-500 dark:text-slate-400 text-[11px]">Total Received</p>
                            <p className={clsx(
                              "font-extrabold text-sm",
                              alreadyPaid > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                            )}>
                              ₹{alreadyPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-slate-500 dark:text-slate-400 text-[11px]">Balance Due</p>
                            <p className={clsx(
                              "font-extrabold text-sm",
                              outstandingAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                            )}>
                              ₹{outstandingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Payment Transactions Record */}
                      {paymentsList.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Payment History ({paymentsList.length} transaction{paymentsList.length > 1 ? "s" : ""})
                          </p>
                          <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                            {paymentsList.map((p: any, idx: number) => (
                              <div key={p.id || idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-slate-800 dark:text-slate-200">
                                    {p.paymentMode || "PAYMENT"}
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                                    ₹{Number(p.paidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>{p.accountName ? `Account: ${p.accountName}` : (p.createdBy ? `Recorded by: ${p.createdBy}` : "Received at HQ")}</span>
                                  <span>{formatDate(p.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                        {payModalOrder.hqReceived ? (
                          <>
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                            <span>
                              Payment receipt has been confirmed into HQ account. No further actions needed.
                            </span>
                          </>
                        ) : alreadyPaid > 0 ? (
                          <>
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-blue-600" />
                            <span>
                              Payment has been made by the franchise. HQ Super Admin can confirm receipt into an HQ account using the &ldquo;Mark Payment&rdquo; action.
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                            <span>
                              Franchise payment has not been received yet. The franchise must pay the order amount before HQ can confirm receipt.
                            </span>
                          </>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setPayModalOrder(null)}
                          className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {invoiceModalData && (
        <GSTInvoice
          order={invoiceModalData.order}
          vendor={invoiceModalData.vendor}
          companyDetails={companyDetails || FALLBACK_COMPANY}
          documentType="FRANCHISE_ORDER"
          onClose={() => setInvoiceModalData(null)}
        />
      )}
    </div>
  );
}
