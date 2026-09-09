"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Plus, Minus, Trash2, Search, CreditCard, Banknote, QrCode,
  User, X, Percent, ShoppingBag, ArrowRight, Tag,
  Building2, Store, Printer, RefreshCw, Scan, Barcode, RotateCcw,
  CheckCircle2, AlertCircle, FileText, Loader2, ArrowUpRight
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, franchiseApi, accountsApi, posApi, salesApi, franchiseOrdersApi } from "@/lib/api";
import api from "@/lib/api/base";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

// ── Party types ────────────────────────────────────────────────────────────────

type PartyType = "CUSTOMER" | "DEALER" | "FRANCHISE";

const PARTY_TABS: { type: PartyType; label: string; icon: any }[] = [
  { type: "CUSTOMER",  label: "Customer",  icon: User      },
  { type: "DEALER",    label: "Dealer",    icon: Store     },
  { type: "FRANCHISE", label: "Franchise", icon: Building2 },
];

const BRAND_ORANGE = "#f58220";

// ── Cart item ──────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  taxPercent: number;
  stock: number | null;
}

// ── Receipt data ───────────────────────────────────────────────────────────────

interface ReceiptData {
  orderId: string;
  invoiceNum: string;
  party: any;
  partyType: PartyType;
  items: CartItem[];
  subtotal: number;
  gst: number;
  discount: number;
  deliveryCharge: number;
  total: number;
  paymentMode: string;
  // true when this was a Franchise Counter Billing order — billed to the
  // franchise's credit ledger, not an actual payment. The receipt/print UI
  // must not claim "Payment Successful" for these (see BUG 2).
  isCredit: boolean;
  timestamp: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const UNIT_LABEL: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PCS: "pcs", PC: "pc" };
const formatPackSize = (p?: { qty: number; unit: string } | null) =>
  p ? `${p.qty % 1 === 0 ? p.qty : p.qty.toFixed(2)}${UNIT_LABEL[p.unit] || p.unit.toLowerCase()}` : null;

export default function POSPage() {
  const router = useRouter();

  // Party
  const [partyType, setPartyType]         = useState<PartyType>("CUSTOMER");
  const [partySearch, setPartySearch]     = useState("");
  const [partyResults, setPartyResults]   = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [showPartyDrop, setShowPartyDrop] = useState(false);

  // Products
  const [products, setProducts]           = useState<any[]>([]);
  const [categories, setCategories]       = useState<string[]>(["All"]);
  const [activeCategory, setActiveCat]    = useState("All");
  const [search, setSearch]               = useState("");
  const [productsLoading, setProdsLoad]   = useState(true);

  // Cart
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [discount, setDiscount]           = useState("");
  const [paidAmount, setPaidAmount]       = useState("");

  // Payment
  const [payMode, setPayMode]             = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [accounts, setAccounts]           = useState<any[]>([]);
  const [accountId, setAccountId]         = useState("");
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccName, setNewAccName]       = useState("");
  const [newAccType, setNewAccType]       = useState<"CASH" | "BANK" | "UPI">("CASH");
  const [newAccBalance, setNewAccBalance] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Return Product Modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState("");
  const [returnSearching, setReturnSearching] = useState(false);
  const [returnSearchResults, setReturnSearchResults] = useState<any[]>([]);
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<any>(null);
  const [returnSearchError, setReturnSearchError] = useState("");
  const returnSearchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      toast.error("Please enter account name");
      return;
    }
    setCreatingAccount(true);
    try {
      const res = await accountsApi.create({
        name: newAccName.trim(),
        type: newAccType,
        balance: newAccBalance ? Number(newAccBalance) : 0,
      });
      toast.success("Account created successfully");
      setShowAddAccountModal(false);
      setNewAccName("");
      setNewAccBalance("");
      await fetchAccounts();
      if (res.data?.id) {
        setAccountId(res.data.id);
        if (newAccType === "CASH") setPayMode("CASH");
        else if (newAccType === "UPI") setPayMode("UPI");
        else if (newAccType === "BANK") setPayMode("CARD");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create account");
    } finally {
      setCreatingAccount(false);
    }
  };

  // UI state
  const [loading, setLoading]             = useState(false);
  const [receipt, setReceipt]             = useState<ReceiptData | null>(null);
  const [showScanner, setShowScanner]     = useState(false);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);

  // Return Search
  const searchReturnInvoices = useCallback(async (query: string) => {
    const rawQuery = query.trim();
    if (!rawQuery) {
      setReturnSearchResults([]);
      setReturnSearchError("");
      return;
    }

    setReturnSearching(true);
    setReturnSearchError("");

    const cleanQuery = rawQuery.replace(/^#+/, "").trim().toLowerCase();
    const rawQueryLower = rawQuery.toLowerCase();

    try {
      const [posRes, soRes, foRes] = await Promise.all([
        posApi.getOrders({ search: cleanQuery }).catch(() => ({ data: [] })),
        salesApi.getSalesOrders({ search: cleanQuery }).catch(() => ({ data: [] })),
        franchiseOrdersApi.getAll().catch(() => ({ data: [] })),
      ]);

      const allPos = posRes.data?.data || posRes.data || [];
      const allSo = soRes.data?.data || soRes.data || [];
      const allFo = foRes.data?.data || foRes.data || [];

      const matchedPos = allPos
        .filter((o: any) => {
          if (o.status === 'CANCELLED') return false;
          const inv = (o.invoiceNum || '').toLowerCase();
          const id = (o.id || '').toLowerCase();
          const custName = (o.customer?.name || o.customerName || '').toLowerCase();
          return inv.includes(cleanQuery) ||
            ('#' + inv).includes(rawQueryLower) ||
            id === cleanQuery ||
            custName.includes(cleanQuery);
        })
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.invoiceNum || o.id,
          _source: 'POS',
          partyName: o.customer?.name || o.customerName || (o.partyType === 'DEALER' ? 'Dealer' : 'Walk-in Customer'),
          partyType: o.partyType || (o.customerId ? 'CUSTOMER' : 'CUSTOMER'),
          totalAmount: Number(o.totalAmount || 0),
          createdAt: o.createdAt,
          itemsCount: (o.orderItems || []).length,
          raw: o,
        }));

      const matchedSo = allSo
        .filter((o: any) => {
          if (o.status === 'CANCELLED') return false;
          const num = (o.orderNumber || '').toLowerCase();
          const id = (o.id || '').toLowerCase();
          const custName = (o.customer?.name || '').toLowerCase();
          return num.includes(cleanQuery) ||
            ('#' + num).includes(rawQueryLower) ||
            id === cleanQuery ||
            custName.includes(cleanQuery);
        })
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id,
          _source: 'SALES_ORDER',
          partyName: o.customer?.name || 'Customer',
          partyType: 'CUSTOMER',
          totalAmount: Number(o.totalAmount || 0),
          createdAt: o.createdAt,
          itemsCount: (o.items || []).length,
          raw: o,
        }));

      const matchedFo = allFo
        .filter((o: any) => {
          if (o.status === 'CANCELLED') return false;
          const num = (o.orderNumber || '').toLowerCase();
          const id = (o.id || '').toLowerCase();
          const fName = (o.franchise?.name || '').toLowerCase();
          return num.includes(cleanQuery) ||
            ('#' + num).includes(rawQueryLower) ||
            id === cleanQuery ||
            fName.includes(cleanQuery);
        })
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id,
          _source: 'FRANCHISE',
          partyName: o.franchise?.name || 'Franchise',
          partyType: 'FRANCHISE',
          totalAmount: Number(o.totalAmount || 0),
          createdAt: o.createdAt,
          itemsCount: (o.items || []).length,
          raw: o,
        }));

      const combined = [...matchedPos, ...matchedSo, ...matchedFo];
      setReturnSearchResults(combined);

      if (combined.length === 0) {
        setReturnSearchError(`No active sale invoices found matching "${rawQuery}".`);
      } else {
        // Auto-select exact match if present
        const exact = combined.find(c =>
          c.orderNumber.toLowerCase() === cleanQuery ||
          ('#' + c.orderNumber).toLowerCase() === rawQueryLower ||
          c.id.toLowerCase() === cleanQuery
        );
        if (exact) {
          setSelectedReturnInvoice(exact);
        }
      }
    } catch (err) {
      setReturnSearchError("Failed to search invoices. Please try again.");
    } finally {
      setReturnSearching(false);
    }
  }, []);

  const handleReturnProduct = () => {
    setShowReturnModal(true);
    setReturnSearchQuery("");
    setReturnSearchResults([]);
    setSelectedReturnInvoice(null);
    setReturnSearchError("");
  };

  const handleReturnSearchChange = (val: string) => {
    setReturnSearchQuery(val);
    setSelectedReturnInvoice(null);
    if (returnSearchDebounceRef.current) {
      clearTimeout(returnSearchDebounceRef.current);
    }
    if (val.trim().length >= 2) {
      returnSearchDebounceRef.current = setTimeout(() => {
        searchReturnInvoices(val);
      }, 300);
    } else {
      setReturnSearchResults([]);
      setReturnSearchError("");
    }
  };

  const handleProceedToReturn = () => {
    if (!selectedReturnInvoice) {
      toast.error("Please select a valid sale invoice");
      return;
    }
    setShowReturnModal(false);
    router.push(
      `/sales/returns?invoiceNum=${encodeURIComponent(selectedReturnInvoice.orderNumber)}&orderId=${encodeURIComponent(selectedReturnInvoice.id)}&source=${encodeURIComponent(selectedReturnInvoice._source)}`
    );
  };

  const searchRef    = useRef<HTMLInputElement>(null);
  const partyDropRef = useRef<HTMLDivElement>(null);

  // ── Fetch products & accounts ─────────────────────────────────────────────

  const fetchProducts = useCallback(() => {
    setProdsLoad(true);
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const user = userStr ? JSON.parse(userStr) : null;
    const params: any = { take: 300 };
    if (user?.franchiseId) {
      params.franchiseId = user.franchiseId;
    }
    api.get("/api/products", { params })
      .then(res => {
        const data: any[] = res.data?.data || res.data || [];
        const mapped = data.map(p => ({
          id: p.id,
          name: p.name,
          price: p.inventoryBasePrice ?? p.basePrice ?? p.price ?? 0,
          franchisePrice: p.franchisePrice,
          dealerPrice: p.dealerPrice,
          taxPercent: p.taxPercent ?? p.gstRate ?? 0,
          category: p.category || p.categoryName || "General",
          stock: p.currentStock ?? p.stock ?? null,
          noPrice: (p.inventoryBasePrice ?? p.basePrice ?? p.price ?? 0) <= 0,
          packSize: p.packSize as { qty: number; unit: string } | null | undefined,
        }));
        setProducts(mapped);
        const cats = Array.from(new Set(mapped.map(p => p.category).filter(Boolean))) as string[];
        setCategories(["All", ...cats]);
      })
      .finally(() => setProdsLoad(false));
  }, []);

  const fetchAccounts = useCallback(() => {
    accountsApi.getAll().then(res => {
      const data: any[] = res.data?.data || res.data || [];
      setAccounts(data);
      if (data.length) setAccountId(data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchProducts(); fetchAccounts(); }, [fetchProducts, fetchAccounts]);

  // Auto-select matching account for payment mode
  useEffect(() => {
    if (!accounts.length) return;
    const typeMap: Record<string, string> = { CASH: "CASH", UPI: "UPI", CARD: "BANK" };
    const target = typeMap[payMode];
    const cur = accounts.find(a => a.id === accountId);
    if (!cur || cur.type !== target) {
      const match = accounts.find(a => a.type === target);
      if (match) setAccountId(match.id);
    }
  }, [payMode, accounts]);

  // ── Party search ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (partySearch.trim().length < 2) { setPartyResults([]); return; }
    const q = partySearch.trim();
    let req: Promise<any>;
    if (partyType === "CUSTOMER") {
      req = customersApi.search(q);
    } else if (partyType === "FRANCHISE") {
      req = franchiseApi.getAll({ search: q });
    } else {
      req = api.get("/api/dealers", { params: { search: q } });
    }
    req.then(res => {
      const data = res.data?.data || res.data || [];
      setPartyResults(Array.isArray(data) ? data.slice(0, 6) : []);
    }).catch(() => setPartyResults([]));
  }, [partySearch, partyType]);

  // Close party dropdown on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (partyDropRef.current && !partyDropRef.current.contains(e.target as Node))
        setShowPartyDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ESC clears cart
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !receipt) {
        setCart([]); setSelectedParty(null); setPartySearch(""); setDiscount(""); setPaidAmount(""); setSearch("");
        searchRef.current?.focus();
      }
      if (e.key === " " && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [receipt]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const getPrice = (p: any, type: string) => {
    if (type === "DEALER" && p.dealerPrice != null) return p.dealerPrice;
    if (type === "FRANCHISE" && p.franchisePrice != null) return p.franchisePrice;
    return p.price || 0;
  };

  const addToCart = (p: any) => {
    if (p.noPrice) { toast.error(`"${p.name}" has no selling price`); return; }
    const ex = cart.find(i => i.id === p.id);
    const cur = ex?.quantity || 0;
    if (p.stock !== null && cur >= p.stock) { toast.error(`Only ${p.stock} left in stock`); return; }
    const actualPrice = getPrice(p, partyType);
    setCart(prev => ex
      ? prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      : [...prev, { id: p.id, name: p.name, price: actualPrice, quantity: 1, taxPercent: p.taxPercent, stock: p.stock }]
    );
  };

  const updateQty = (id: string, delta: number) => {
    const p = products.find(x => x.id === id);
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const q = i.quantity + delta;
      if (delta > 0 && p?.stock !== null && q > p.stock) { toast.error(`Only ${p.stock} available`); return i; }
      return q <= 0 ? null as any : { ...i, quantity: q };
    }).filter(Boolean));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  // ── Totals ─────────────────────────────────────────────────────────────────

  const subtotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const gst        = parseFloat(cart.reduce((s, i) => s + i.price * i.quantity * ((i.taxPercent || 0) / 100), 0).toFixed(2));
  const discAmt    = Math.max(0, parseFloat(discount) || 0);
  const total      = Math.max(0, subtotal + gst - discAmt);
  const changeDue  = paidAmount ? parseFloat(paidAmount) - total : 0;

  // ── Checkout ───────────────────────────────────────────────────────────────

  const handleCheckout = async () => {
    if (!cart.length) { toast.error("Cart is empty"); return; }
    if (!accountId) { toast.error("Select a payment account"); return; }

    setLoading(true);
    try {
      let orderId = "";
      let invoiceNum = "";
      let isCredit = false;
      // Franchise credit orders are recomputed server-side (real per-product
      // GST, plus a flat delivery charge never shown in this UI) — the
      // receipt must reflect what the franchise is actually billed, not the
      // locally-computed Counter Billing totals (see BUG 2).
      let receiptSubtotal = subtotal;
      let receiptGst = gst;
      let receiptDelivery = 0;
      let receiptTotal = total;

      if (partyType === "FRANCHISE" && selectedParty) {
        // Franchise order flow — this books an order against the
        // franchise's credit ledger (see FranchiseOrderService.createOrder);
        // it is NOT a payment, and the discount entered below is not
        // honored by that endpoint (no discount field exists on
        // FranchiseOrder), so it's intentionally not sent here — the UI
        // warns the cashier separately when a discount is present.
        const res = await api.post("/api/franchise-orders", {
          franchiseId: selectedParty.id,
          items: cart.map(i => ({ productId: i.id, productName: i.name, quantity: i.quantity, unitPrice: i.price, totalPrice: i.price * i.quantity })),
          notes: `POS Sale - Franchise Credit`,
        });
        orderId = res.data?.id || res.data?.orderId || "";
        invoiceNum = res.data?.orderNumber || orderId;
        isCredit = true;
        receiptSubtotal = res.data?.subtotal ?? subtotal;
        receiptGst = res.data?.taxAmount ?? gst;
        receiptDelivery = res.data?.deliveryCharges ?? 0;
        receiptTotal = res.data?.totalAmount ?? (receiptSubtotal + receiptGst + receiptDelivery);
      } else {
        // Customer / Dealer → POS checkout (real payment)
        const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        const user = userStr ? JSON.parse(userStr) : null;
        const displayName = selectedParty?.name || "Walk-in Customer";
        const res = await posApi.checkout({
          franchiseId: user?.franchiseId || null,
          customerId: partyType === "CUSTOMER" ? selectedParty?.id : undefined,
          // Dealer sales have no Customer.id, but they do have a real
          // Dealer.id — pass it separately (Order.partyId/partyType) so the
          // backend can attribute the sale/payment to the actual dealer
          // instead of silently discarding the selection (see BUG 1).
          partyType,
          partyId: partyType === "DEALER" ? selectedParty?.id : undefined,
          accountId,
          customerName: displayName,
          customerPhone: selectedParty?.phone || selectedParty?.contactNum,
          paymentMode: payMode,
          orderType: partyType === "DEALER" ? "wholesale" : "counter",
          subTotal: subtotal,
          taxAmount: gst,
          discountAmount: discAmt,
          totalAmount: total,
          items: cart.map(i => ({
            productId: i.id,
            quantity: i.quantity,
            unitPrice: i.price,
            totalPrice: i.price * i.quantity,
            taxPercent: i.taxPercent,
          })),
        });
        orderId = res.data?.id || res.data?.orderId || "";
        invoiceNum = res.data?.invoiceNum || orderId;
      }

      setReceipt({
        orderId,
        invoiceNum,
        party: selectedParty,
        partyType,
        items: [...cart],
        subtotal: receiptSubtotal,
        gst: receiptGst,
        discount: isCredit ? 0 : discAmt,
        deliveryCharge: receiptDelivery,
        total: receiptTotal,
        paymentMode: payMode,
        isCredit,
        timestamp: new Date(),
      });

      // Stock numbers shown on-screen go stale after a sale (server-side
      // re-validation already prevents overselling — this is purely
      // cosmetic) — refresh so the grid reflects the just-sold quantities.
      fetchProducts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:refresh-inventory"));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNewOrder = () => {
    setReceipt(null);
    setCart([]);
    setSelectedParty(null);
    setPartySearch("");
    setDiscount("");
    setPaidAmount("");
    searchRef.current?.focus();
  };

  // ── Print ──────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    if (!receipt) return;
    const w = window.open("", "_blank", "width=420,height=700");
    if (!w) return;
    const rows = receipt.items.map(i =>
      `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${i.price}</td><td style="text-align:right">₹${(i.price * i.quantity).toLocaleString()}</td></tr>`
    ).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;max-width:300px;margin:auto;padding:16px;font-size:12px}
      h1{text-align:center;font-size:18px;margin-bottom:4px}
      .center{text-align:center}.line{border-top:1px dashed #000;margin:10px 0}
      table{width:100%}th{border-bottom:1px solid #000;padding:4px 0;font-size:10px}td{padding:4px 0;font-size:11px}
      .total{display:flex;justify-content:space-between;margin:3px 0}.bold{font-weight:bold;font-size:14px}
      @media print{body{padding:0}}
    </style></head><body>
      <h1>HQ POS</h1>
      ${receipt.isCredit ? `<div class="center" style="font-size:10px;font-weight:bold;margin-bottom:4px">*** BILLED TO FRANCHISE CREDIT — NOT PAID ***</div>` : ""}
      <div class="center" style="font-size:10px;margin-bottom:8px">
        Bill #${receipt.invoiceNum} &nbsp;·&nbsp;
        ${formatDate(receipt.timestamp)} ${new Date(receipt.timestamp).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
      </div>
      <div class="center" style="font-size:11px;margin-bottom:8px">
        ${receipt.partyType}: ${receipt.party?.name || "Walk-in Customer"}
      </div>
      <div class="line"></div>
      <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="line"></div>
      <div class="total"><span>Subtotal</span><span>₹${receipt.subtotal.toLocaleString()}</span></div>
      <div class="total"><span>GST</span><span>₹${receipt.gst.toLocaleString()}</span></div>
      ${receipt.deliveryCharge > 0 ? `<div class="total"><span>Delivery</span><span>₹${receipt.deliveryCharge.toLocaleString()}</span></div>` : ""}
      ${receipt.discount > 0 ? `<div class="total"><span>Discount</span><span>-₹${receipt.discount.toLocaleString()}</span></div>` : ""}
      <div class="total bold" style="border-top:1px solid #000;margin-top:6px;padding-top:6px"><span>TOTAL</span><span>₹${receipt.total.toLocaleString()}</span></div>
      <div class="center" style="margin-top:20px;font-size:11px;font-weight:bold">${receipt.isCredit ? "*** CREDIT ORDER — PAYMENT DUE FROM FRANCHISE ***" : "*** THANK YOU ***"}</div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
    </body></html>`);
    w.document.close();
  };

  // ── Filtered products ──────────────────────────────────────────────────────

  const filtered = products.filter(p =>
    (activeCategory === "All" || p.category === activeCategory) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RECEIPT VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (receipt) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gray-50 dark:bg-background p-4 w-full min-w-0">
        <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 w-full max-w-sm mx-auto overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 text-center text-white" style={{ background: receipt.isCredit ? "#8b5cf6" : BRAND_ORANGE }}>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={28} />
            </div>
            <div className="text-lg font-bold">{receipt.isCredit ? "Order Placed — Billed to Franchise Credit" : "Payment Successful"}</div>
            <div className="text-2xl font-black mt-1">{fmt(receipt.total)}</div>
            <div className="text-xs opacity-80 mt-1">
              {receipt.isCredit ? `Franchise Credit · ${receipt.partyType}` : `${receipt.paymentMode} · ${receipt.partyType}`}
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-slate-400">Bill No</span>
              <span className="font-semibold text-gray-800 dark:text-white">#{receipt.invoiceNum}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-slate-400">{receipt.partyType}</span>
              <span className="font-semibold text-gray-800 dark:text-white">{receipt.party?.name || "Walk-in Customer"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-slate-400">Items</span>
              <span className="font-semibold text-gray-800 dark:text-white">{receipt.items.length} items · {receipt.items.reduce((s, i) => s + i.quantity, 0)} qty</span>
            </div>
            <div className="border-t border-gray-100 dark:border-white/5 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400"><span>Subtotal</span><span className="dark:text-slate-200">{fmt(receipt.subtotal)}</span></div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400"><span>GST</span><span className="dark:text-slate-200">{fmt(receipt.gst)}</span></div>
              {receipt.deliveryCharge > 0 && <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400"><span>Delivery</span><span className="dark:text-slate-200">{fmt(receipt.deliveryCharge)}</span></div>}
              {receipt.discount > 0 && <div className="flex justify-between text-xs text-green-600 dark:text-green-400"><span>Discount</span><span>-{fmt(receipt.discount)}</span></div>}
              <div className="flex justify-between text-sm font-bold text-gray-800 dark:text-white pt-1 border-t border-gray-100 dark:border-white/5"><span>Total</span><span>{fmt(receipt.total)}</span></div>
            </div>
            {receipt.isCredit && (
              <div className="text-[11px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-lg px-3 py-2">
                This was not a cash/card/UPI payment — it was billed to the franchise's outstanding credit balance. Collect payment separately via Franchise Orders.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-2">
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Printer size={15} /> Print
            </button>
            <button onClick={handleNewOrder} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              New Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN POS VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const activeTab = PARTY_TABS.find(t => t.type === partyType)!;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-[calc(100vh-3.5rem)] bg-[#F5F6FA] dark:bg-background -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">

      {/* ── LEFT: Products ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Search bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 py-3 shrink-0 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products (Space to focus)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
            </div>
            <button
              onClick={() => { setShowScanner(true); setScannedProduct(null); }}
              className="p-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 dark:text-slate-300 hover:text-[#f58220] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 font-bold text-xs shrink-0"
            >
              <Barcode size={15} /> Scan Barcode
            </button>
            <button
              onClick={handleReturnProduct}
              className="p-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 dark:text-slate-300 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 font-bold text-xs shrink-0"
            >
              <RotateCcw size={15} /> Return Product
            </button>
            <button onClick={fetchProducts} className="p-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0">
              <RefreshCw size={15} className={productsLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1 max-w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={clsx(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {productsLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-slate-500">
              <ShoppingBag size={32} strokeWidth={1} className="mb-2" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {filtered.map(p => {
                const inCart = cart.find(i => i.id === p.id);

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    style={inCart ? { borderColor: BRAND_ORANGE, borderWidth: "1.5px" } : {}}
                    className={clsx(
                      "group relative bg-white dark:bg-card border rounded-2xl p-3 sm:p-4 text-left transition-all hover:shadow-md active:scale-95",
                      inCart ? "shadow-md" : "border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10",
                      p.noPrice && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {/* Stock badge */}
                    {p.stock !== null && (
                      <div className={clsx(
                        "absolute top-2.5 right-2.5 text-[11px] font-bold px-2 py-1 rounded-full",
                        p.stock === 0 ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" : p.stock <= 5 ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" : "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                      )}>
                        {p.stock === 0 ? "OUT" : `${p.stock}`}
                      </div>
                    )}

                    {/* Cart qty badge */}
                    {inCart && (
                      <div className="absolute -top-2 -left-2 w-6 h-6 text-white text-xs font-black rounded-full flex items-center justify-center shadow-sm" style={{ background: BRAND_ORANGE }}>
                        {inCart.quantity}
                      </div>
                    )}

                    <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight line-clamp-2 mb-2">
                      {p.name}
                      {formatPackSize(p.packSize) && (
                        <span className="ml-1 font-bold text-gray-400 dark:text-slate-500">· {formatPackSize(p.packSize)}</span>
                      )}
                    </p>
                    <p className="text-base font-bold mt-1" style={{ color: BRAND_ORANGE }}>₹{getPrice(p, partyType).toLocaleString()}</p>
                    {p.taxPercent > 0 && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">GST {p.taxPercent}%</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom hint */}
        <div className="bg-white dark:bg-card border-t border-gray-100 dark:border-white/5 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
          <span><kbd className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-400 font-mono">ESC</kbd> Clear</span>
          <span><kbd className="bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-400 font-mono">SPACE</kbd> Focus Search</span>
          <span className="ml-auto">{cart.length} items · {fmt(total)}</span>
        </div>
      </div>

      {/* ── RIGHT: Order Panel ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-80 xl:w-96 bg-white dark:bg-card border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden shrink-0 min-w-0">

        {/* Party type tabs */}
        <div className="border-b border-gray-100 dark:border-white/5 px-3 pt-3 pb-0 shrink-0">
          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
            {PARTY_TABS.map(tab => {
              const Icon = tab.icon;
              const active = partyType === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => { setPartyType(tab.type); setSelectedParty(null); setPartySearch(""); setPartyResults([]); setCart([]); }}
                  style={active ? { background: BRAND_ORANGE } : {}}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all",
                    active ? "text-white shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white"
                  )}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Party search */}
        <div className="px-3 py-2.5 border-b border-gray-100 dark:border-white/5 shrink-0" ref={partyDropRef}>
          {selectedParty ? (
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border dark:bg-orange-500/10 dark:border-orange-500/20" style={{ background: "#fff8f2", borderColor: "#f9c89a" }}>
              <div className="w-8 h-8 text-white rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: BRAND_ORANGE }}>
                {selectedParty.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{selectedParty.name}</p>
                <p className="text-[10px]" style={{ color: BRAND_ORANGE }}>{selectedParty.phone || selectedParty.contactNum || selectedParty.location || partyType}</p>
              </div>
              <button onClick={() => { setSelectedParty(null); setPartySearch(""); }} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder={`Search ${activeTab.label}...`}
                value={partySearch}
                onChange={e => { setPartySearch(e.target.value); setShowPartyDrop(true); }}
                onFocus={() => setShowPartyDrop(true)}
                className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 transition-colors text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            {partySearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setPartySearch("")} 
              />
            )}
              {showPartyDrop && partyResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-lg overflow-hidden">
                  {partyResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedParty(p); setPartySearch(p.name); setShowPartyDrop(false); setPartyResults([]); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 text-left transition-colors"
                    >
                      <div className="w-7 h-7 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center font-semibold text-xs text-gray-600 dark:text-slate-300 shrink-0">
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{p.phone || p.contactNum || p.location || ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showPartyDrop && partySearch.length >= 2 && partyResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-lg px-3 py-3 text-xs text-gray-400 dark:text-slate-500 text-center">
                  No {activeTab.label.toLowerCase()} found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order header */}
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">Active Order</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">{cart.length} items added</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-slate-600 py-8">
              <ShoppingBag size={32} strokeWidth={1} className="mb-2" />
              <p className="text-xs font-medium text-gray-400 dark:text-slate-500">Add products to start billing</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-3 py-2.5 hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">₹{item.price} {item.taxPercent > 0 && `· GST ${item.taxPercent}%`}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-card flex items-center justify-center text-gray-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    <Minus size={10} strokeWidth={3} />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-gray-800 dark:text-white">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-card flex items-center justify-center text-gray-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    <Plus size={10} strokeWidth={3} />
                  </button>
                  <button onClick={() => removeItem(item.id)} className="w-6 h-6 ml-1 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                </div>
                <div className="text-xs font-bold text-gray-800 dark:text-white w-14 text-right shrink-0">
                  ₹{(item.price * item.quantity).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Billing panel */}
        <div className="border-t border-gray-100 dark:border-white/5 px-4 py-3 space-y-3 bg-gray-50/60 dark:bg-white/[0.02] shrink-0">

          {/* Paid & Change */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mb-1">PAID AMOUNT</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm font-semibold">₹</span>
                <input
                  type="number"
                  placeholder="0"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg pl-7 pr-2 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-colors text-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-medium text-red-400 mb-1">CHANGE DUE</p>
              <p className={clsx("text-xl font-black mt-1", changeDue >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                ₹{Math.max(0, changeDue).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white dark:bg-[#13151f] border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2.5 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Percent size={10} className="text-blue-500" /> Subtotal</span>
              <span className="font-medium text-gray-700 dark:text-slate-200">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Percent size={10} className="text-blue-500" /> Tax (GST)</span>
              <span className="font-medium text-gray-700 dark:text-slate-200">{fmt(gst)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400"><Tag size={10} className="text-green-500" /> Discount</span>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg pl-5 pr-2 py-1 text-xs font-semibold text-right outline-none focus:border-blue-400 transition-colors text-gray-800 dark:text-white"
                />
              </div>
            </div>
            {partyType === "FRANCHISE" && discAmt > 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
                Discount is not applied to Franchise credit orders — this order will be billed at full price.
              </p>
            )}
            {partyType === "FRANCHISE" && (
              <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-snug">
                A delivery charge is added by the system for Franchise orders and isn't reflected in the total above until confirmed.
              </p>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-white/10">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">PAYABLE TOTAL</span>
              <span className="text-xl font-black text-gray-900 dark:text-white">{fmt(total)}</span>
            </div>
          </div>

          {/* Account */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500">SOURCE ACCOUNT</p>
              <button
                onClick={() => fetchAccounts()}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium cursor-pointer"
              >
                Refresh
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={accountId}
                onChange={e => {
                  setAccountId(e.target.value);
                  const acc = accounts.find(a => a.id === e.target.value);
                  if (acc?.type === "CASH") setPayMode("CASH");
                  else if (acc?.type === "UPI") setPayMode("UPI");
                  else if (acc?.type === "BANK") setPayMode("CARD");
                }}
                className="flex-1 min-w-0 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
              >
                {accounts.length === 0
                  ? <option>No accounts — set up in Finance</option>
                  : accounts.map(a => <option key={a.id} value={a.id} className="dark:bg-card">{a.name} ({a.type}) · ₹{a.balance?.toLocaleString()}</option>)
                }
              </select>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(true)}
                className="p-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl transition-all shadow-2xs shrink-0 flex items-center justify-center cursor-pointer"
                title="Add New Source Account"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Payment modes */}
          <div className="grid grid-cols-3 gap-2">
            {(["CASH", "UPI", "CARD"] as const).map(mode => {
              const Icon = mode === "CASH" ? Banknote : mode === "UPI" ? QrCode : CreditCard;
              const active = payMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setPayMode(mode)}
                  className={clsx(
                    "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                    active
                      ? mode === "CASH" ? "bg-green-500 text-white border-green-500"
                        : mode === "UPI" ? "bg-blue-500 text-white border-blue-500"
                          : "bg-violet-500 text-white border-violet-500"
                      : "bg-white dark:bg-white/5 text-gray-500 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                  )}
                >
                  <Icon size={16} />
                  {mode}
                </button>
              );
            })}
          </div>

          {/* Confirm button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading || !accountId}
            className="w-full flex items-center justify-center gap-2 disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
            style={cart.length > 0 && accountId ? { background: BRAND_ORANGE } : {}}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
            ) : partyType === "FRANCHISE" ? (
              <>Place Order · Franchise Credit <ArrowRight size={16} /></>
            ) : (
              <>Confirm Payment · {payMode} <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 p-8 text-white space-y-6">
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <h3 className="text-xl font-black tracking-tight uppercase">POS Barcode Scanner</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Simulated camera laser decoder</p>
            </div>

            {!scannedProduct ? (
              <div className="relative h-48 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-[posScan_2s_ease-in-out_infinite] z-20" />
                <div className="absolute top-6 left-6.5 w-4 h-4 border-t-2 border-l-2 border-red-500 rounded-tl" />
                <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-red-500 rounded-tr" />
                <div className="absolute bottom-6 left-6.5 w-4 h-4 border-b-2 border-l-2 border-red-500 rounded-bl" />
                <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-red-500 rounded-br" />

                {isScanProcessing ? (
                  <div className="text-center space-y-3 z-10">
                    <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Decoding UPC barcode...</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2 z-10">
                    <Barcode size={40} className="text-slate-700 animate-pulse mx-auto" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Align product UPC under laser line</p>
                  </div>
                )}
                <style dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes posScan {
                      0% { top: 10%; }
                      50% { top: 90%; }
                      100% { top: 10%; }
                    }
                  `}} />
              </div>
            ) : (
              <div className="bg-slate-950 border border-emerald-500/20 p-6 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">✓</div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Product Decoded</p>
                  <h4 className="text-lg font-black text-white uppercase">{scannedProduct.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Price: ₹{scannedProduct.price} · Stock: {scannedProduct.stock ?? "N/A"}</p>
                </div>
              </div>
            )}

            {!scannedProduct && (
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Simulate product scans:</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {products.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setIsScanProcessing(true);
                        setTimeout(() => {
                          setIsScanProcessing(false);
                          setScannedProduct(p);
                          toast.success(`Scanned: ${p.name}`);
                        }, 850);
                      }}
                      className="text-left px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold truncate uppercase transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scannedProduct && (
              <div className="flex gap-3">
                <button
                  onClick={() => setScannedProduct(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black uppercase text-slate-300"
                >
                  Scan Another
                </button>
                <button
                  onClick={() => {
                    addToCart(scannedProduct);
                    setShowScanner(false);
                  }}
                  className="flex-1 py-3 bg-[#f58220] rounded-2xl text-[10px] font-black uppercase text-white hover:opacity-90"
                >
                  Add to Cart
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Financial Account Full-Height Side Panel */}
      {showAddAccountModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end">
          {/* Backdrop Overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowAddAccountModal(false)}
          />

          {/* Full-Height Right Side Panel */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#020617] h-full shadow-2xl border-l border-slate-100 dark:border-slate-800 flex flex-col z-10 animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">CREATE FINANCIAL ACCOUNT</h2>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Add a new payment account for Counter Billing</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                title="Close Panel"
              >
                <X size={20} />
              </button>
            </div>

            {/* Panel Body Form */}
            <form onSubmit={handleCreateAccount} className="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Account Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Counter Cash Box, HDFC Bank"
                    value={newAccName}
                    onChange={e => setNewAccName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#f58220] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Account Type
                  </label>
                  <select
                    value={newAccType}
                    onChange={e => setNewAccType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#f58220] transition-colors cursor-pointer"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK">BANK</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newAccBalance}
                    onChange={e => setNewAccBalance(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#f58220] transition-colors"
                  />
                </div>
              </div>

              {/* Panel Footer */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="px-6 py-3 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  {creatingAccount ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Return Product / Sale Modal ── */}
      {showReturnModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-[#f58220] shrink-0 border border-orange-200/50 dark:border-orange-500/20">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Return Sale
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Enter or search the Sale Invoice Number to process a return.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Search input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                  Sale Invoice / Bill Number
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search by Invoice # (e.g. POS-2026-00001, SO-001) or Party Name..."
                    value={returnSearchQuery}
                    onChange={(e) => handleReturnSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (selectedReturnInvoice) {
                          handleProceedToReturn();
                        } else {
                          searchReturnInvoices(returnSearchQuery);
                        }
                      }
                    }}
                    className="w-full pl-10 pr-9 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-[#f58220] transition-colors"
                  />
                  {returnSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setReturnSearchQuery("");
                        setReturnSearchResults([]);
                        setSelectedReturnInvoice(null);
                        setReturnSearchError("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status / Loading / Error indicator */}
              {returnSearching && (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-500 dark:text-slate-400">
                  <RefreshCw className="animate-spin text-[#f58220]" size={16} />
                  <span>Searching active sales records...</span>
                </div>
              )}

              {returnSearchError && !returnSearching && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{returnSearchError}</span>
                </div>
              )}

              {/* Search Results List */}
              {returnSearchResults.length > 0 && !returnSearching && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    Matching Invoices ({returnSearchResults.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {returnSearchResults.map((inv) => {
                      const isSelected = selectedReturnInvoice?.id === inv.id;
                      return (
                        <div
                          key={inv.id}
                          onClick={() => setSelectedReturnInvoice(inv)}
                          className={clsx(
                            "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3",
                            isSelected
                              ? "bg-orange-50/80 dark:bg-orange-500/10 border-[#f58220] shadow-2xs"
                              : "bg-white dark:bg-card border-gray-200 dark:border-white/10 hover:border-orange-300 dark:hover:border-white/20 hover:bg-gray-50/60 dark:hover:bg-white/[0.02]"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#f58220]">
                                #{inv.orderNumber}
                              </span>
                              <span className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                inv.partyType === "DEALER"
                                  ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                                  : inv.partyType === "FRANCHISE"
                                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              )}>
                                {inv.partyType}
                              </span>
                              <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                {formatDate(inv.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1 text-xs">
                              <span className="font-semibold text-gray-800 dark:text-slate-200 truncate">
                                {inv.partyName}
                              </span>
                              <span className="font-mono font-bold text-gray-900 dark:text-white shrink-0">
                                ₹{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <div className={clsx(
                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                            isSelected
                              ? "border-[#f58220] bg-[#f58220] text-white"
                              : "border-gray-300 dark:border-white/20 text-transparent"
                          )}>
                            <CheckCircle2 size={14} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Invoice Details Callout */}
              {selectedReturnInvoice && (
                <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-slate-400">Selected Invoice:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">#{selectedReturnInvoice.orderNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-slate-400">Billed Party:</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{selectedReturnInvoice.partyName} ({selectedReturnInvoice.partyType})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-200/60 dark:border-white/5">
                    <span className="text-gray-500 dark:text-slate-400">Bill Amount:</span>
                    <span className="font-mono font-bold text-[#f58220]">₹{selectedReturnInvoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToReturn}
                disabled={!selectedReturnInvoice}
                className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Continue to Return</span>
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
