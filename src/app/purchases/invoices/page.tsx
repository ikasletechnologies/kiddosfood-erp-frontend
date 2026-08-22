"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt, Plus, Search, RefreshCw, X,
  Printer, ChevronDown, Trash2, Share2, Calendar,
  AlignLeft, FileText, ArrowLeft, Upload,
} from "lucide-react";
import { clsx } from "clsx";
import { vendorsApi, vendorInvoicesApi, grnApi, accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import AccountFormModal from "@/components/modals/AccountFormModal";


// ── Constants ────────────────────────────────────────────────────────────────

const UNITS = [
  { label: "None",             short: "None", code: "NONE" },
  { label: "Bags (Bag)",       short: "Bag",  code: "BAG" },
  { label: "Box (Box)",        short: "Box",  code: "BOX" },
  { label: "Grams (Grm)",      short: "Grm",  code: "GRM" },
  { label: "Kilograms (Kgs)",  short: "Kgs",  code: "KGS" },
  { label: "Liters (Ltr)",     short: "Ltr",  code: "LTR" },
  { label: "Meters (Mtr)",     short: "Mtr",  code: "MTR" },
  { label: "Numbers (Nos)",    short: "Nos",  code: "NOS" },
  { label: "Packs (Pkt)",      short: "Pkt",  code: "PKT" },
  { label: "Pieces (Pcs)",     short: "Pcs",  code: "PCS" },
];

const TAX_OPTIONS = [
  { label: "NONE", value: 0 },
  { label: "GST@0%", value: 0 },
  { label: "GST@5%", value: 5 },
  { label: "GST@12%", value: 12 },
  { label: "GST@18%", value: 18 },
  { label: "GST@28%", value: 28 },
  { label: "IGST@5%", value: 5 },
  { label: "IGST@12%", value: 12 },
  { label: "IGST@18%", value: 18 },
  { label: "IGST@28%", value: 28 },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu & Kashmir","Ladakh",
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: "Pending",  color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  MATCHED:  { label: "Matched",  color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  APPROVED: { label: "Approved", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  MISMATCH: { label: "Mismatch", color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
  PAID:     { label: "Paid",     color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  rate: number;
  taxPct: number;
  taxLabel: string;
}

function makeItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), name: "", qty: 1, unit: "NONE", rate: 0, taxPct: 0, taxLabel: "NONE" };
}

function computeRow(item: LineItem) {
  const base = item.qty * item.rate;
  const taxAmt = parseFloat((base * item.taxPct / 100).toFixed(2));
  return { taxAmt, amount: parseFloat((base + taxAmt).toFixed(2)) };
}

// ── MiniCalendar ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const isSelected = (d: number) => selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronDown size={14} className="rotate-90" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i}
            onClick={() => { onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); onClose(); }}
            className={clsx("w-full aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors",
              isSelected(d) && "bg-orange-500 text-white",
              !isSelected(d) && isToday(d) && "bg-orange-100 text-orange-600",
              !isSelected(d) && !isToday(d) && "text-gray-700 hover:bg-gray-100"
            )}
          >{d}</button>
        ))}
      </div>
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 pt-2">
        <button onClick={() => { const t = new Date(); onChange(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`); onClose(); }} className="text-[11px] font-semibold text-orange-500 hover:text-orange-700">Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-600">Close</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PurchaseBillsPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [bills, setBills] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState("");

  // form
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [vendorPhone, setVendorPhone] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billNumber, setBillNumber] = useState("Auto");
  const [stateOfSupply, setStateOfSupply] = useState("");
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [showPriceDrop, setShowPriceDrop] = useState(false);
  const [openUnitDrop, setOpenUnitDrop] = useState<string | null>(null);
  const [unitDropRect, setUnitDropRect] = useState<{ top: number; left: number } | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [sourcePoId, setSourcePoId] = useState<string | null>(null);
  const [sourceGrnId, setSourceGrnId] = useState<string | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);
  const vendorDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);

  // date filter
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

  const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, accRes, vRes] = await Promise.all([
        vendorInvoicesApi.getAll(),
        accountsApi.getAll().catch(() => ({ data: [] })),
        vendorsApi.getAll()
      ]);
      setBills(res.data?.invoices || res.data || []);
      setAccounts(accRes.data || []);
      setVendors(vRes.data?.vendors || vRes.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const grnId = urlParams.get('grnId');
    if (grnId) {
      grnApi.getById(grnId).then(res => {
        const grn = res.data;
        if (grn) {
           setView("create");
           if (grn.procurementOrder?.vendor) {
              const v = grn.procurementOrder.vendor;
              setSelectedVendor(v);
              setVendorSearch(v.name);
              setVendorPhone(v.contact || v.phone || "");
              if (v.state) setStateOfSupply(v.state);
           }
           setSourcePoId(grn.poId);
           setSourceGrnId(grn.id);
            if (grn.items && grn.items.length > 0) {
               const newItems = grn.items.map((item: any) => {
                  const rate = item.gstRate || 0;
                  return {
                     id: Math.random().toString(36).slice(2),
                     name: item.inventoryItem?.name || "Material",
                     qty: item.acceptedQty,
                     unit: item.inventoryItem?.unit || "KGS",
                     rate: item.price || 0,
                     taxPct: rate,
                     taxLabel: rate > 0 ? `GST@${rate}%` : "NONE"
                  };
               });
               setItems(newItems);
            }
           setDescription(`Auto-generated from GRN: ${grnId} / PO: ${grn.procurementOrder?.poNumber || ''}`);
           setShowDesc(true);
           toast.success("Bill auto-filled from GRN!");
        }
      }).catch(err => {
         console.error("Failed to load GRN for auto-fill", err);
      });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vendorDropRef.current && !vendorDropRef.current.contains(e.target as Node)) setShowVendorDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node)) setShowShareDrop(false);
      if (priceDropRef.current && !priceDropRef.current.contains(e.target as Node)) setShowPriceDrop(false);
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setShowCalendar(false);
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node)) setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node)) setShowToCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Computed
  const rowData = items.map(item => ({ item, ...computeRow(item) }));
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const totalAmount = parseFloat(rowData.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(totalAmount) - totalAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((totalAmount + roundOff).toFixed(2));

  const updateItem = (idx: number, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const addRow = () => setItems(prev => [...prev, makeItem()]);
  const removeRow = (idx: number) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  const openCreate = () => {
    setSelectedVendor(null); setVendorSearch(""); setVendorPhone("");
    setBillDate(new Date().toISOString().split("T")[0]); setBillNumber("Auto");
    setStateOfSupply(""); setPaymentType("CASH");
    setItems([makeItem(), makeItem()]); setPriceMode("without_tax");
    setTermsText(""); setShowTerms(false); setDescription(""); setShowDesc(false);
    setRoundOffEnabled(true); setView("create");
    setSourcePoId(null); setSourceGrnId(null);
  };

  const handleSave = async () => {
    if (!selectedVendor) { toast.error("Please select a vendor"); return; }
    const validItems = items.filter(i => i.name && i.qty > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      await vendorInvoicesApi.create({
        vendorId: selectedVendor.id,
        poId: sourcePoId || undefined,
        grnId: sourceGrnId || undefined,
        invoiceNumber: billNumber !== "Auto" ? billNumber : `BILL-${Date.now().toString().slice(-6)}`,
        billDate,
        stateOfSupply: stateOfSupply || undefined,
        paymentType,
        amount: finalTotal,
        items: validItems.map(i => ({
          name: i.name, qty: i.qty, unit: i.unit,
          rate: i.rate, taxPct: i.taxPct, taxAmount: computeRow(i).taxAmt, amount: computeRow(i).amount,
        })),
        termsAndConditions: termsText || undefined,
        description: description || undefined,
        roundOff,
      });
      toast.success("Bill saved successfully");
      setView("list");
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save bill");
    } finally { setSaving(false); }
  };

  const getFilteredAccounts = () => {
    if (paymentMode === "CASH") {
      return accounts.filter(a => a.type === "CASH");
    } else {
      return accounts.filter(a => a.type === "BANK" || a.type === "UPI");
    }
  };

  const handlePaymentModeChange = (mode: string) => {
    setPaymentMode(mode);
    const filtered = mode === "CASH" 
      ? accounts.filter(a => a.type === "CASH")
      : accounts.filter(a => a.type === "BANK" || a.type === "UPI");
    
    const isStillValid = filtered.some(a => a.id === paymentAccount);
    if (!isStillValid) {
      setPaymentAccount("");
    }
  };

  const handleMakePayment = async () => {
    if (!paymentBill || !paymentAccount) {
      if (accounts.length === 0) {
        toast.error("No account found. Please add a financial account first.");
        setShowAccountModal(true);
        return;
      }
      return toast.error("Please select an account.");
    }
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) return toast.error("Valid amount required.");

    const outstanding = paymentBill.outstanding ?? Math.max(0, (paymentBill.amount || 0) - (paymentBill.advanceApplied || 0) - (paymentBill.paidAmount || 0));
    if (Number(paymentAmount) > outstanding + 0.01) {
      return toast.error(`Payment amount of ₹${paymentAmount} cannot exceed outstanding balance of ₹${outstanding.toFixed(2)}.`);
    }
    
    try {
      setSubmittingPayment(true);
      await vendorsApi.recordPayment(paymentBill.vendorId, {
        amount: Number(paymentAmount),
        note: paymentNote || `Payment for ${paymentBill.invoiceNumber || 'Bill'}`,
        accountId: paymentAccount,
        paymentMode,
        type: "PAYMENT",
        vendorInvoiceId: paymentBill.id,
        idempotencyKey: paymentIdempotencyKey
      });
      toast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openPaymentModal = (bill: any) => {
    setPaymentBill(bill);
    const outstanding = bill.outstanding ?? Math.max(0, (bill.amount || 0) - (bill.advanceApplied || 0) - (bill.paidAmount || 0));
    setPaymentAmount(outstanding.toString());
    setPaymentNote(`Payment for ${bill.invoiceNumber || 'Bill'}`);
    setPaymentMode("CASH");
    setPaymentAccount(""); // Default to "Select Account"
    setPaymentIdempotencyKey(`bill-pay-${bill.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    setShowPaymentModal(true);
  };

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const filtered = bills.filter(b => {
    const matchSearch = !search ||
      b.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      b.vendor?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalBillAmt = filtered.reduce((s, b) => s + (b.amount || 0), 0);
  const totalApproved = filtered.filter(b => b.status === "APPROVED" || b.status === "PAID").reduce((s, b) => s + (b.amount || 0), 0);
  const totalPending = filtered.filter(b => b.status === "PENDING").reduce((s, b) => s + (b.amount || 0), 0);

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 104px)" }}>
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ArrowLeft size={17} />
            </button>
            <h2 className="text-base font-semibold text-gray-800">New Purchase Bill</h2>
          </div>
          <span className="text-xs text-gray-400">Bill No: <span className="text-orange-500 font-semibold">Auto</span></span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">

          {/* Vendor + Bill Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-8">
              {/* Left: Vendor */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Vendor / Party *</label>
                  <div className="relative" ref={vendorDropRef}>
                    <div
                      className={clsx(
                        "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white transition-colors",
                        showVendorDrop ? "border-orange-400 ring-1 ring-orange-100" : "border-gray-300 hover:border-gray-400"
                      )}
                      onClick={() => setShowVendorDrop(v => !v)}
                    >
                      <input
                        className="flex-1 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                        placeholder="Search by vendor name..."
                        value={vendorSearch}
                        onChange={e => { setVendorSearch(e.target.value); setShowVendorDrop(true); }}
                        onClick={e => { e.stopPropagation(); setShowVendorDrop(true); }}
                      />
            {vendorSearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setVendorSearch("")} 
              />
            )}
                      <ChevronDown size={13} className="text-gray-400 shrink-0" />
                    </div>
                    {showVendorDrop && (
                      <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          {filteredVendors.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-400 text-center">No vendors found</div>
                          ) : filteredVendors.map(v => (
                            <button key={v.id}
                              className="w-full flex items-start px-3 py-2 hover:bg-orange-50/50 border-b border-gray-50 last:border-0 text-left"
                              onClick={() => { 
                                setSelectedVendor(v); 
                                setVendorSearch(v.name); 
                                setVendorPhone(v.contact || v.phone || ""); 
                                if (v.state) setStateOfSupply(v.state);
                                setShowVendorDrop(false); 
                              }}
                            >
                              <div>
                                <div className="text-sm font-medium text-gray-800">{v.name}</div>
                                <div className="text-xs text-gray-400">{v.contact || v.phone || "—"}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors"
                    placeholder="Phone Number"
                    value={vendorPhone}
                    onChange={e => setVendorPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Right: Bill Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-gray-500">Bill Number</span>
                  <span className="text-sm font-semibold text-gray-700">Auto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Bill Date</span>
                  <div className="relative" ref={calendarRef}>
                    <button
                      onClick={() => setShowCalendar(v => !v)}
                      className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:border-orange-400 transition-colors"
                    >
                      <Calendar size={13} className="text-orange-500 shrink-0" />
                      {new Date(billDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-1 z-[200]">
                        <MiniCalendar value={billDate} onChange={setBillDate} onClose={() => setShowCalendar(false)} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">State of Supply</span>
                  <select
                    value={stateOfSupply}
                    onChange={e => setStateOfSupply(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-700 outline-none focus:border-orange-400 w-44 transition-colors"
                  >
                    <option value="">Select</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Payment Type</span>
                  <div className="flex gap-2">
                    {(["CASH", "CREDIT"] as const).map(pt => (
                      <button key={pt} onClick={() => setPaymentType(pt)}
                        className={clsx("px-3 py-1 rounded-lg text-xs font-semibold border transition-colors",
                          paymentType === pt ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                        )}
                      >{pt}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</span>
              <div className="relative" ref={priceDropRef}>
                <button onClick={() => setShowPriceDrop(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1 bg-white hover:border-gray-400 transition-colors"
                >
                  Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
                  <ChevronDown size={11} />
                </button>
                {showPriceDrop && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg text-xs w-44 z-50">
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-700" onClick={() => { setPriceMode("without_tax"); setShowPriceDrop(false); }}>Excl. Tax (Without Tax)</button>
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-700" onClick={() => { setPriceMode("with_tax"); setShowPriceDrop(false); }}>Incl. Tax (With Tax)</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                    <th className="w-8 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5 text-left">Item / Description</th>
                    <th className="w-16 px-2 py-2.5 text-center">Qty</th>
                    <th className="w-20 px-2 py-2.5 text-center">Unit</th>
                    <th className="w-28 px-3 py-2.5 text-right">Price/Unit</th>
                    <th className="w-36 px-2 py-2.5 text-center">Tax</th>
                    <th className="w-24 px-3 py-2.5 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const { taxAmt, amount } = computeRow(item);
                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-orange-50/30 group">
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                            placeholder="Enter item name..."
                            value={item.name}
                            onChange={e => updateItem(idx, "name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.qty}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 text-center outline-none bg-transparent"
                          />
                        </td>
                        <td style={{ position: "relative", overflow: "visible" }}>
                          <button
                            className="w-full flex items-center justify-center gap-0.5 px-2 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                            onClick={e => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setUnitDropRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                              setOpenUnitDrop(v => v === item.id ? null : item.id);
                            }}
                          >
                            <span>{UNITS.find(u => u.code === item.unit)?.short ?? item.unit}</span>
                            <ChevronDown size={9} className="text-gray-400 shrink-0" />
                          </button>
                          {openUnitDrop === item.id && unitDropRect && (
                            <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto"
                              style={{ position: "fixed", top: unitDropRect.top + 2, left: unitDropRect.left, width: 180, maxHeight: 220, zIndex: 9999 }}
                            >
                              {UNITS.map(u => (
                                <button key={u.code}
                                  className={clsx("w-full text-left px-3 py-2 text-xs border-b border-gray-50 last:border-0 hover:bg-orange-50",
                                    item.unit === u.code ? "text-orange-600 font-semibold bg-orange-50" : "text-gray-700"
                                  )}
                                  onMouseDown={() => { updateItem(idx, "unit", u.code); setOpenUnitDrop(null); }}
                                >
                                  <span className="font-medium">{u.short}</span>
                                  <span className="text-gray-400 ml-1">– {u.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.rate || ""}
                            placeholder="0"
                            onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 text-right outline-none bg-transparent"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <select
                            value={item.taxLabel}
                            onChange={e => {
                              const label = e.target.value;
                              const opt = TAX_OPTIONS.find(o => o.label === label);
                              updateItem(idx, "taxLabel", label);
                              updateItem(idx, "taxPct", opt?.value ?? 0);
                            }}
                            className="w-full text-xs text-gray-700 outline-none bg-transparent cursor-pointer"
                          >
                            {TAX_OPTIONS.map((t, i) => <option key={i} value={t.label}>{t.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                          {amount > 0 ? amount.toFixed(2) : "—"}
                        </td>
                        <td className="pr-2">
                          <button onClick={() => removeRow(idx)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
              <button onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Row
              </button>
              <span className="text-xs text-gray-500">
                Total Tax: <span className="font-semibold text-gray-700">₹ {totalTax.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex gap-4 items-start pb-2">
            <div className="flex-1 space-y-2">
              {!showTerms ? (
                <button onClick={() => setShowTerms(true)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors">
                  <AlignLeft size={13} /> Add Terms &amp; Conditions
                </button>
              ) : (
                <textarea value={termsText} onChange={e => setTermsText(e.target.value)} rows={3} placeholder="Terms and conditions..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none" />
              )}
              {!showDesc ? (
                <button onClick={() => setShowDesc(true)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors">
                  <FileText size={13} /> Add Description
                </button>
              ) : (
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Description..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none" />
              )}
              <div className="flex gap-2">
                <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors">
                  <Upload size={13} /> Upload Bill
                </button>
                <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors">
                  <FileText size={13} /> Add Document
                </button>
              </div>
            </div>

            {/* Summary Panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 w-64 shrink-0 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>₹ {totalAmount.toFixed(2)}</span>
              </div>
              {totalTax > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Tax (GST)</span>
                  <span>+ ₹ {totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm text-gray-500 border-t border-gray-100 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={roundOffEnabled} onChange={e => setRoundOffEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs">Round Off</span>
                </label>
                <span className="text-xs">{roundOff >= 0 ? "+" : ""}{roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                <span className="text-sm font-semibold text-gray-800">Total</span>
                <span className="text-lg font-bold text-orange-500">₹ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button onClick={() => setView("list")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
            Cancel
          </button>
          <div className="relative" ref={shareDropRef}>
            <div className="flex rounded-lg overflow-hidden">
              <button onClick={() => toast.success("Share feature coming soon")}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 border-r border-orange-400"
              >
                Share
              </button>
              <button onClick={() => setShowShareDrop(v => !v)}
                className="px-2 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            {showShareDrop && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg text-sm min-w-[160px] z-50">
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Share2 size={13} /> Share</button>
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Printer size={13} /> Print</button>
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#f58220]" />
          Purchase Bills
        </h1>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Bill
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Bills",     value: `₹${totalBillAmt.toLocaleString("en-IN")}`,  color: "text-gray-700",    dot: "bg-gray-400" },
            { label: "Approved / Paid", value: `₹${totalApproved.toLocaleString("en-IN")}`, color: "text-emerald-600", dot: "bg-emerald-500" },
            { label: "Pending",         value: `₹${totalPending.toLocaleString("en-IN")}`,  color: "text-amber-600",   dot: "bg-amber-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search bill no. or vendor..."
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
            {["ALL", "PENDING", "MATCHED", "APPROVED"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={clsx("px-3 py-2 text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >{s === "ALL" ? "All" : s}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 relative">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900" onClick={() => setShowFromCal(v => !v)}>
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{fmtD(dateFrom)}</span>
            </div>
            {showFromCal && (
              <div className="absolute top-full left-0 mt-1 z-50" ref={fromCalRef}>
                <MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} />
              </div>
            )}
            <span className="text-gray-300 px-1">to</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900" onClick={() => setShowToCal(v => !v)}>
              <span className="font-medium">{fmtD(dateTo)}</span>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            {showToCal && (
              <div className="absolute top-full right-0 mt-1 z-50" ref={toCalRef}>
                <MiniCalendar value={dateTo} onChange={setDateTo} onClose={() => setShowToCal(false)} />
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Empty State */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Receipt className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Purchase Bills Found</p>
              <p className="text-gray-500 text-sm mt-1">Create your first supplier bill to start tracking purchases.</p>
            </div>
            <button onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Create Purchase Bill
            </button>
          </div>
        ) : (
          /* Table */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Bill No</th>
                  <th className="text-left px-4 py-3">Vendor / Party</th>
                  <th className="text-left px-4 py-3">Pay Type</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(b => {
                  const style = STATUS_STYLES[b.status] || STATUS_STYLES.PENDING;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {b.billDate ? new Date(b.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : new Date(b.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {b.invoiceNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {b.vendor?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {b.paymentType || "Cash"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹ {(b.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {b.status !== "PAID" && (b.outstanding ?? 0) > 0.01 && (
                            <button onClick={() => openPaymentModal(b)} className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold rounded text-xs transition-colors">
                              Make Payment
                            </button>
                          )}
                          <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Printer className="h-4 w-4" /></button>
                          <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Share2 className="h-4 w-4" /></button>
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

      <Modal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)}
        title="Make Payment"
        size="md"
        footer={
          <>
            <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleMakePayment} disabled={submittingPayment} className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg shadow disabled:opacity-50">
              {submittingPayment ? "Processing..." : "Save Payment"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-orange-500 bg-gray-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Mode</label>
              <select value={paymentMode} onChange={e => handlePaymentModeChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-orange-500 bg-gray-50">
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Source Account</label>
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                >
                  + Add New
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={paymentAccount}
                  onChange={e => {
                    if (e.target.value === "ADD_NEW") {
                      setShowAccountModal(true);
                    } else {
                      setPaymentAccount(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-orange-500 bg-gray-50 text-sm font-medium text-gray-700"
                >
                  <option value="">Select Account</option>
                  {getFilteredAccounts().map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                  <option value="ADD_NEW" className="font-bold text-orange-600">+ Add New Account...</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="p-2 border border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-gray-500 hover:text-orange-600 rounded-lg transition-all"
                  title="Add New Account"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Note (Optional)</label>
            <textarea value={paymentNote} onChange={e => setPaymentNote(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-orange-500 bg-gray-50 resize-none"
            />
          </div>
        </div>
      </Modal>

      <AccountFormModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onSuccess={(newAccount) => {
          setAccounts(prev => [...prev, newAccount]);
          setPaymentAccount(newAccount.id);
        }}
      />
    </div>
  );
}
