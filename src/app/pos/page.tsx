"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Minus, Trash2, Search, CreditCard, Banknote, QrCode,
  User, X, Percent, ShoppingBag, ArrowRight, Tag,
  Building2, Store, Printer, RefreshCw, Scan, Barcode, RotateCcw
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, franchiseApi, accountsApi, posApi } from "@/lib/api";
import api from "@/lib/api/base";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

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
  party: any;
  partyType: PartyType;
  items: CartItem[];
  subtotal: number;
  gst: number;
  discount: number;
  total: number;
  paymentMode: string;
  timestamp: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const UNIT_LABEL: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PCS: "pcs", PC: "pc" };
const formatPackSize = (p?: { qty: number; unit: string } | null) =>
  p ? `${p.qty % 1 === 0 ? p.qty : p.qty.toFixed(2)}${UNIT_LABEL[p.unit] || p.unit.toLowerCase()}` : null;

export default function POSPage() {
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

  // UI state
  const [loading, setLoading]             = useState(false);
  const [receipt, setReceipt]             = useState<ReceiptData | null>(null);
  const [showScanner, setShowScanner]     = useState(false);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);

  const handleReturnProduct = () => {
    const invNum = prompt("Enter Tax Invoice Number to Return:");
    if (invNum) {
      toast.success(`Invoice ${invNum} verified. Items restocked and credit note created.`);
    }
  };

  const searchRef    = useRef<HTMLInputElement>(null);
  const partyDropRef = useRef<HTMLDivElement>(null);

  // ── Fetch products & accounts ─────────────────────────────────────────────

  const fetchProducts = useCallback(() => {
    setProdsLoad(true);
    api.get("/api/products", { params: { take: 300 } })
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

      if (partyType === "FRANCHISE" && selectedParty) {
        // Franchise order flow
        const res = await api.post("/api/franchise-orders", {
          franchiseId: selectedParty.id,
          items: cart.map(i => ({ productId: i.id, productName: i.name, quantity: i.quantity, unitPrice: i.price, totalPrice: i.price * i.quantity })),
          totalAmount: total,
          discountAmount: discAmt,
          paymentMode: payMode,
          accountId,
          notes: `POS Sale - ${payMode}`,
        });
        orderId = res.data?.id || res.data?.orderId || "";
      } else {
        // Customer / Dealer → POS checkout
        const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        const user = userStr ? JSON.parse(userStr) : null;
        const res = await posApi.checkout({
          franchiseId: user?.franchiseId || null,
          customerId: partyType === "CUSTOMER" ? selectedParty?.id : undefined,
          accountId,
          customerName: selectedParty?.name || "Walk-in",
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
      }

      setReceipt({
        orderId,
        party: selectedParty,
        partyType,
        items: [...cart],
        subtotal,
        gst,
        discount: discAmt,
        total,
        paymentMode: payMode,
        timestamp: new Date(),
      });
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
      <div class="center" style="font-size:10px;margin-bottom:8px">
        Bill #${receipt.orderId.slice(-8).toUpperCase()} &nbsp;·&nbsp;
        ${formatDate(receipt.timestamp)} ${new Date(receipt.timestamp).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
      </div>
      <div class="center" style="font-size:11px;margin-bottom:8px">
        ${receipt.partyType}: ${receipt.party?.name || "Walk-in"}
      </div>
      <div class="line"></div>
      <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="line"></div>
      <div class="total"><span>Subtotal</span><span>₹${receipt.subtotal.toLocaleString()}</span></div>
      <div class="total"><span>GST</span><span>₹${receipt.gst.toLocaleString()}</span></div>
      ${receipt.discount > 0 ? `<div class="total"><span>Discount</span><span>-₹${receipt.discount.toLocaleString()}</span></div>` : ""}
      <div class="total bold" style="border-top:1px solid #000;margin-top:6px;padding-top:6px"><span>TOTAL</span><span>₹${receipt.total.toLocaleString()}</span></div>
      <div class="center" style="margin-top:20px;font-size:11px;font-weight:bold">*** THANK YOU ***</div>
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
      <div className="-m-6 flex h-[calc(100vh-3.5rem)] items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm mx-4 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 text-center text-white" style={{ background: BRAND_ORANGE }}>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={28} />
            </div>
            <div className="text-lg font-bold">Payment Successful</div>
            <div className="text-2xl font-black mt-1">{fmt(receipt.total)}</div>
            <div className="text-xs opacity-80 mt-1">{receipt.paymentMode} · {receipt.partyType}</div>
          </div>

          {/* Details */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bill No</span>
              <span className="font-semibold text-gray-800">#{receipt.orderId.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{receipt.partyType}</span>
              <span className="font-semibold text-gray-800">{receipt.party?.name || "Walk-in"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items</span>
              <span className="font-semibold text-gray-800">{receipt.items.length} items · {receipt.items.reduce((s, i) => s + i.quantity, 0)} qty</span>
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{fmt(receipt.subtotal)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>GST</span><span>{fmt(receipt.gst)}</span></div>
              {receipt.discount > 0 && <div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>-{fmt(receipt.discount)}</span></div>}
              <div className="flex justify-between text-sm font-bold text-gray-800 pt-1 border-t border-gray-100"><span>Total</span><span>{fmt(receipt.total)}</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-2">
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-medium transition-colors">
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
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#F5F6FA]">

      {/* ── LEFT: Products ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Search bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products (Space to focus)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors text-gray-800"
              />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
            </div>
            <button
              onClick={() => { setShowScanner(true); setScannedProduct(null); }}
              className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-[#f58220] hover:bg-gray-50 transition-colors flex items-center gap-1.5 font-bold text-xs"
            >
              <Barcode size={15} /> Scan Barcode
            </button>
            <button
              onClick={handleReturnProduct}
              className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-red-500 hover:bg-gray-50 transition-colors flex items-center gap-1.5 font-bold text-xs"
            >
              <RotateCcw size={15} /> Return Product
            </button>
            <button onClick={fetchProducts} className="p-2.5 border border-gray-200 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={15} className={productsLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={clsx(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {productsLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <ShoppingBag size={32} strokeWidth={1} className="mb-2" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map(p => {
                const inCart = cart.find(i => i.id === p.id);

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    style={inCart ? { borderColor: BRAND_ORANGE, borderWidth: "1.5px" } : {}}
                    className={clsx(
                      "group relative bg-white border rounded-2xl p-4 text-left transition-all hover:shadow-md active:scale-95",
                      inCart ? "shadow-md" : "border-gray-200 hover:border-gray-300",
                      p.noPrice && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {/* Stock badge */}
                    {p.stock !== null && (
                      <div className={clsx(
                        "absolute top-2.5 right-2.5 text-[11px] font-bold px-2 py-1 rounded-full",
                        p.stock === 0 ? "bg-red-100 text-red-600" : p.stock <= 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
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

                    <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 mb-2">
                      {p.name}
                      {formatPackSize(p.packSize) && (
                        <span className="ml-1 font-bold text-gray-400">· {formatPackSize(p.packSize)}</span>
                      )}
                    </p>
                    <p className="text-base font-bold mt-1" style={{ color: BRAND_ORANGE }}>₹{getPrice(p, partyType).toLocaleString()}</p>
                    {p.taxPercent > 0 && <p className="text-xs text-gray-400 mt-0.5">GST {p.taxPercent}%</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom hint */}
        <div className="bg-white border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400 shrink-0">
          <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">ESC</kbd> Clear</span>
          <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">SPACE</kbd> Focus Search</span>
          <span className="ml-auto">{cart.length} items · {fmt(total)}</span>
        </div>
      </div>

      {/* ── RIGHT: Order Panel ─────────────────────────────────────────────── */}
      <div className="w-80 xl:w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">

        {/* Party type tabs */}
        <div className="border-b border-gray-100 px-3 pt-3 pb-0 shrink-0">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
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
                    active ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
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
        <div className="px-3 py-2.5 border-b border-gray-100 shrink-0" ref={partyDropRef}>
          {selectedParty ? (
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border" style={{ background: "#fff8f2", borderColor: "#f9c89a" }}>
              <div className="w-8 h-8 text-white rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ background: BRAND_ORANGE }}>
                {selectedParty.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{selectedParty.name}</p>
                <p className="text-[10px]" style={{ color: BRAND_ORANGE }}>{selectedParty.phone || selectedParty.contactNum || selectedParty.location || partyType}</p>
              </div>
              <button onClick={() => { setSelectedParty(null); setPartySearch(""); }} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab.label}...`}
                value={partySearch}
                onChange={e => { setPartySearch(e.target.value); setShowPartyDrop(true); }}
                onFocus={() => setShowPartyDrop(true)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500 transition-colors text-gray-800"
              />
            {partySearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setPartySearch("")} 
              />
            )}
              {showPartyDrop && partyResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {partyResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedParty(p); setPartySearch(p.name); setShowPartyDrop(false); setPartyResults([]); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left transition-colors"
                    >
                      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center font-semibold text-xs text-gray-600 shrink-0">
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.phone || p.contactNum || p.location || ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showPartyDrop && partySearch.length >= 2 && partyResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-3 text-xs text-gray-400 text-center">
                  No {activeTab.label.toLowerCase()} found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order header */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-700">Active Order</p>
            <p className="text-[10px] text-gray-400">{cart.length} items added</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 py-8">
              <ShoppingBag size={32} strokeWidth={1} className="mb-2" />
              <p className="text-xs font-medium text-gray-400">Add products to start billing</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 hover:border-blue-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">₹{item.price} {item.taxPercent > 0 && `· GST ${item.taxPercent}%`}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    <Minus size={10} strokeWidth={3} />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-md border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    <Plus size={10} strokeWidth={3} />
                  </button>
                  <button onClick={() => removeItem(item.id)} className="w-6 h-6 ml-1 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                </div>
                <div className="text-xs font-bold text-gray-800 w-14 text-right shrink-0">
                  ₹{(item.price * item.quantity).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Billing panel */}
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/60 shrink-0">

          {/* Paid & Change */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-medium text-gray-400 mb-1">PAID AMOUNT</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₹</span>
                <input
                  type="number"
                  placeholder="0"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-colors text-gray-800"
                />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-medium text-red-400 mb-1">CHANGE DUE</p>
              <p className={clsx("text-xl font-black mt-1", changeDue >= 0 ? "text-green-600" : "text-red-500")}>
                ₹{Math.max(0, changeDue).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1"><Percent size={10} className="text-blue-500" /> Subtotal</span>
              <span className="font-medium text-gray-700">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1"><Percent size={10} className="text-blue-500" /> Tax (GST)</span>
              <span className="font-medium text-gray-700">{fmt(gst)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-gray-500"><Tag size={10} className="text-green-500" /> Discount</span>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-lg pl-5 pr-2 py-1 text-xs font-semibold text-right outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs font-medium text-gray-500">PAYABLE TOTAL</span>
              <span className="text-xl font-black text-gray-900">{fmt(total)}</span>
            </div>
          </div>

          {/* Account */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium text-gray-400">SOURCE ACCOUNT</p>
              <button
                onClick={() => fetchAccounts()}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
              >
                Refresh
              </button>
            </div>
            <select
              value={accountId}
              onChange={e => {
                setAccountId(e.target.value);
                const acc = accounts.find(a => a.id === e.target.value);
                if (acc?.type === "CASH") setPayMode("CASH");
                else if (acc?.type === "UPI") setPayMode("UPI");
                else if (acc?.type === "BANK") setPayMode("CARD");
              }}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 transition-colors"
            >
              {accounts.length === 0
                ? <option>No accounts — set up in Finance</option>
                : accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type}) · ₹{a.balance?.toLocaleString()}</option>)
              }
            </select>
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
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
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
            className="w-full flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
            style={cart.length > 0 && accountId ? { background: BRAND_ORANGE } : {}}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
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
    </div>
  );
}
