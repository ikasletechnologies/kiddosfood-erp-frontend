"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Undo2, Plus, Search, RefreshCw, X,
  Printer, ChevronDown, Share2, Calendar,
  FileText, ArrowLeft,
} from "lucide-react";
import { clsx } from "clsx";
import { vendorsApi, purchaseReturnsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

// ── Types & Constants ─────────────────────────────────────────────────────────

interface Vendor { id: string; name: string; phone?: string; gst?: string; }

interface DebitNote {
  id: string;
  returnNo?: string;
  date: string;
  billDate?: string;
  billNumber?: string;
  vendorId: string;
  vendor?: { name: string };
  reason?: string;
  total: number;
  receivedPaid?: number;
  balance?: number;
  type?: string;
  status?: string;
}

interface LineItem {
  id: string;
  name: string;
  qty: string;
  unit: string;
  priceWithoutTax: string;
  taxPercent: string;
  taxAmount: number;
  amount: number;
}

const UNITS = ["NONE","KGS","GRM","LTR","MLT","PCS","BOX","BAG","DZN","MTR","NOS","PKT"];
const TAX_RATES = [
  { label: "NONE", value: "0" },
  { label: "GST@5%", value: "5" },
  { label: "GST@12%", value: "12" },
  { label: "GST@18%", value: "18" },
  { label: "GST@28%", value: "28" },
];
const PAYMENT_TYPES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];
const NOTE_TYPES = ["All", "Debit Note", "Purchase Return"];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: "Pending",  color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  SETTLED:  { label: "Settled",  color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  PARTIAL:  { label: "Partial",  color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  REJECTED: { label: "Rejected", color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
};

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const isSelected = (d: number) => selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"><ChevronDown size={14} className="rotate-90" /></button>
        <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"><ChevronDown size={14} className="-rotate-90" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i} onClick={() => { onChange(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`); onClose(); }}
            className={clsx("w-full aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors",
              isSelected(d) ? "bg-orange-500 text-white" :
              isToday(d) ? "bg-orange-100 text-orange-600" :
              "text-gray-700 hover:bg-gray-100"
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function newItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), name: "", qty: "", unit: "NONE", priceWithoutTax: "", taxPercent: "0", taxAmount: 0, amount: 0 };
}
function recalc(item: LineItem): LineItem {
  const qty = parseFloat(item.qty) || 0;
  const price = parseFloat(item.priceWithoutTax) || 0;
  const taxPct = parseFloat(item.taxPercent) || 0;
  const base = qty * price;
  const tax = (base * taxPct) / 100;
  return { ...item, taxAmount: tax, amount: base + tax };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DebitNotesPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [notes, setNotes] = useState<DebitNote[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  // form state
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [returnNo, setReturnNo] = useState("1");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [date, setDate] = useState(todayStr());
  const [noteType, setNoteType] = useState("Debit Note");
  const [paymentType, setPaymentType] = useState("Cash");
  const [roundOff, setRoundOff] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [items, setItems] = useState<LineItem[]>([newItem(), newItem()]);
  const [showShareDrop, setShowShareDrop] = useState(false);

  // date range filter
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const [showDateCal, setShowDateCal] = useState(false);
  const [showBillDateCal, setShowBillDateCal] = useState(false);

  // refs for click-outside
  const vendorDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);
  const datCalRef = useRef<HTMLDivElement>(null);
  const billDateCalRef = useRef<HTMLDivElement>(null);

  // unit portal
  const [openUnitRow, setOpenUnitRow] = useState<string | null>(null);
  const [unitPortalPos, setUnitPortalPos] = useState({ top: 0, left: 0, width: 0 });
  const unitTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (vendorDropRef.current && !vendorDropRef.current.contains(t)) setShowVendorDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(t)) setShowShareDrop(false);
      if (fromCalRef.current && !fromCalRef.current.contains(t)) setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(t)) setShowToCal(false);
      if (datCalRef.current && !datCalRef.current.contains(t)) setShowDateCal(false);
      if (billDateCalRef.current && !billDateCalRef.current.contains(t)) setShowBillDateCal(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, vendorRes] = await Promise.all([
        purchaseReturnsApi.getAll({}),
        vendorsApi.getAll(),
      ]);
      const allNotes = notesRes.data?.returns || notesRes.data || [];
      setNotes(allNotes);
      setVendors(vendorRes.data?.vendors || vendorRes.data || []);
      setReturnNo(String(allNotes.length + 1));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateItem = (id: string, field: keyof LineItem, val: string) =>
    setItems(prev => prev.map(it => it.id === id ? recalc({ ...it, [field]: val }) : it));

  const addRow = () => setItems(prev => [...prev, newItem()]);
  const removeRow = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const totalTax = items.reduce((s, it) => s + it.taxAmount, 0);
  const roundAmt = roundOff ? Math.round(subtotal) - subtotal : 0;
  const grandTotal = subtotal + roundAmt;

  const resetForm = () => {
    setSelectedVendor(null); setVendorSearch(""); setBillNumber(""); setBillDate("");
    setDate(todayStr()); setNoteType("Debit Note"); setPaymentType("Cash");
    setRoundOff(true); setNoteText(""); setShowNote(false);
    setItems([newItem(), newItem()]);
  };

  const handleSave = async () => {
    if (!selectedVendor) { toast.error("Select a vendor"); return; }
    const validItems = items.filter(it => it.name && parseFloat(it.qty) > 0);
    if (!validItems.length) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      await purchaseReturnsApi.create({
        vendorId: selectedVendor.id,
        reason: `${noteType} ${returnNo}`,
        items: validItems.map(it => ({
          name: it.name,
          qty: parseFloat(it.qty) || 0,
          unit: it.unit,
          priceWithoutTax: parseFloat(it.priceWithoutTax) || 0,
          taxPercent: parseFloat(it.taxPercent) || 0,
          taxAmount: it.taxAmount,
          amount: it.amount,
        })),
      });
      toast.success(`${noteType} saved`);
      setView("list");
      resetForm();
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const openCreate = () => { resetForm(); setView("create"); };

  const filtered = notes.filter(n => {
    const matchSearch = !search ||
      n.returnNo?.toLowerCase().includes(search.toLowerCase()) ||
      n.vendor?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "All" || !typeFilter;
    return matchSearch && matchType;
  });

  const totalAmt = filtered.reduce((s, n) => s + n.total, 0);
  const totalBalance = filtered.reduce((s, n) => s + (n.balance ?? n.total), 0);
  const totalSettled = filtered.reduce((s, n) => s + (n.receivedPaid || 0), 0);

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  // ── CREATE VIEW ──────────────────────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50 -m-8" style={{ minHeight: "100vh" }}>
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView("list"); resetForm(); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Purchase</p>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">{noteType}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 text-xs"># {returnNo}</span>
            <select
              value={noteType}
              onChange={e => setNoteType(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            >
              <option value="Debit Note">Debit Note</option>
              <option value="Purchase Return">Purchase Return</option>
            </select>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Vendor + Meta Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-5">
            <div className="flex flex-col lg:flex-row gap-6 justify-between">
              {/* Left: Vendor */}
              <div className="flex-1 max-w-sm">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vendor / Party</label>
                <div className="relative" ref={vendorDropRef}>
                  <div
                    className={clsx(
                      "flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white cursor-pointer transition-all",
                      showVendorDrop ? "border-orange-400 ring-2 ring-orange-100" : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setShowVendorDrop(true)}
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <span className="text-orange-600 font-bold text-xs">
                        {selectedVendor ? selectedVendor.name[0].toUpperCase() : "V"}
                      </span>
                    </div>
                    <input
                      value={showVendorDrop ? vendorSearch : (selectedVendor?.name || "")}
                      onChange={e => { setVendorSearch(e.target.value); setShowVendorDrop(true); }}
                      onFocus={() => setShowVendorDrop(true)}
                      placeholder="Search or select vendor..."
                      className="flex-1 text-sm text-gray-800 outline-none bg-transparent placeholder-gray-400"
                    />
            {showVendorDrop ? vendorSearch : (selectedVendor?.name || "") && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setVendorSearch("")} 
              />
            )}
                    {selectedVendor && (
                      <button onClick={e => { e.stopPropagation(); setSelectedVendor(null); setVendorSearch(""); }} className="text-gray-300 hover:text-gray-500">
                        <X size={13} />
                      </button>
                    )}
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  </div>
                  {showVendorDrop && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
                      {filteredVendors.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">No vendors found</div>
                      ) : filteredVendors.map(v => (
                        <button key={v.id} onClick={() => { setSelectedVendor(v); setVendorSearch(""); setShowVendorDrop(false); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-orange-50 text-sm transition-colors flex items-center gap-2"
                        >
                          <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                            <span className="text-orange-600 font-bold text-[10px]">{v.name[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{v.name}</p>
                            {v.phone && <p className="text-xs text-gray-400">{v.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedVendor?.gst && (
                  <p className="mt-1 text-xs text-gray-400">GST: {selectedVendor.gst}</p>
                )}
              </div>

              {/* Right: Meta */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-1">Return No.</p>
                  <p className="font-semibold text-gray-800">{returnNo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-1">Bill Number</p>
                  <input
                    value={billNumber}
                    onChange={e => setBillNumber(e.target.value)}
                    placeholder="Enter bill no."
                    className="border-b border-gray-200 focus:border-orange-400 outline-none text-sm text-gray-800 bg-transparent py-0.5 w-36 transition-colors"
                  />
                </div>
                <div className="relative" ref={billDateCalRef}>
                  <p className="text-xs text-gray-400 font-medium mb-1">Bill Date</p>
                  <button
                    onClick={() => setShowBillDateCal(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-orange-600 transition-colors"
                  >
                    <Calendar size={13} className="text-orange-400" />
                    {billDate ? fmtDate(billDate) : <span className="text-gray-300">DD MMM YYYY</span>}
                  </button>
                  {showBillDateCal && (
                    <div className="absolute top-full left-0 mt-1 z-50">
                      <MiniCalendar value={billDate} onChange={setBillDate} onClose={() => setShowBillDateCal(false)} />
                    </div>
                  )}
                </div>
                <div className="relative" ref={datCalRef}>
                  <p className="text-xs text-gray-400 font-medium mb-1">Return Date</p>
                  <button
                    onClick={() => setShowDateCal(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-orange-600 transition-colors"
                  >
                    <Calendar size={13} className="text-orange-400" />
                    {fmtDate(date)}
                  </button>
                  {showDateCal && (
                    <div className="absolute top-full left-0 mt-1 z-50">
                      <MiniCalendar value={date} onChange={setDate} onClose={() => setShowDateCal(false)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Unit</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Price / Unit</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Tax</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Amount</th>
                    <th className="px-3 py-3 w-8">
                      <button onClick={addRow} className="text-orange-500 hover:text-orange-700 transition-colors">
                        <Plus size={15} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="group hover:bg-orange-50/30 transition-colors">
                      <td className="px-3 py-2.5 text-gray-300 text-center text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <input
                          value={item.name}
                          onChange={e => updateItem(item.id, "name", e.target.value)}
                          className="w-full outline-none bg-transparent text-gray-800 text-sm placeholder-gray-300"
                          placeholder="Type item name..."
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={e => updateItem(item.id, "qty", e.target.value)}
                          className="w-full outline-none bg-transparent text-center text-sm text-gray-800"
                          min="0"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="relative">
                          <button
                            ref={el => { unitTriggerRefs.current[item.id] = el; }}
                            onClick={() => {
                              if (openUnitRow === item.id) { setOpenUnitRow(null); return; }
                              const el = unitTriggerRefs.current[item.id];
                              if (el) {
                                const rect = el.getBoundingClientRect();
                                setUnitPortalPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: 120 });
                              }
                              setOpenUnitRow(item.id);
                            }}
                            className="flex items-center justify-between gap-1 border border-gray-200 rounded-lg px-2 py-1 w-full text-xs text-gray-700 hover:border-orange-300 transition-colors"
                          >
                            <span>{item.unit}</span>
                            <ChevronDown size={10} className="text-gray-400 shrink-0" />
                          </button>
                          {openUnitRow === item.id && (
                            <div
                              className="fixed bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] max-h-44 overflow-y-auto py-1"
                              style={{ top: unitPortalPos.top, left: unitPortalPos.left, minWidth: unitPortalPos.width }}
                            >
                              {UNITS.map(u => (
                                <button key={u} onClick={() => { updateItem(item.id, "unit", u); setOpenUnitRow(null); }}
                                  className={clsx("w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 transition-colors",
                                    item.unit === u ? "text-orange-600 font-semibold" : "text-gray-700"
                                  )}
                                >{u}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="number"
                          value={item.priceWithoutTax}
                          onChange={e => updateItem(item.id, "priceWithoutTax", e.target.value)}
                          className="w-full outline-none bg-transparent text-center text-sm text-gray-800"
                          min="0"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <select
                          value={item.taxPercent}
                          onChange={e => updateItem(item.id, "taxPercent", e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white outline-none hover:border-orange-300 focus:border-orange-400 transition-colors"
                        >
                          {TAX_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                        {item.amount > 0 ? `₹${item.amount.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-1 py-2.5">
                        {items.length > 1 && (
                          <button onClick={() => removeRow(item.id)}
                            className="text-gray-200 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-50">
              <button onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-700 transition-colors">
                <Plus size={13} /> Add Row
              </button>
            </div>
          </div>

          {/* Bottom Section: Payment Type + Summary */}
          <div className="mx-6 mb-6 flex gap-4 flex-col lg:flex-row">
            {/* Left: Notes + Payment */}
            <div className="flex-1 space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Type</p>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white outline-none w-full focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                >
                  {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {!showNote ? (
                <button onClick={() => setShowNote(true)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 transition-colors">
                  <FileText size={13} /> Add note / description
                </button>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</p>
                    <button onClick={() => { setShowNote(false); setNoteText(""); }} className="text-gray-300 hover:text-gray-500"><X size={13} /></button>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note or reason for this return..."
                    rows={3}
                    className="w-full text-sm text-gray-700 outline-none resize-none placeholder-gray-300"
                  />
                </div>
              )}
            </div>

            {/* Right: Summary */}
            <div className="w-64 bg-white rounded-xl border border-gray-200 p-4 self-start">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-800">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span className="font-medium text-gray-800">₹{totalTax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roundOff}
                      onChange={e => setRoundOff(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-orange-500"
                    />
                    <span className="text-xs">Round off</span>
                  </label>
                  <span className={clsx("text-sm font-medium", roundAmt >= 0 ? "text-emerald-600" : "text-rose-500")}>
                    {roundAmt >= 0 ? "+" : ""}{roundAmt.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold" style={{ color: "#f58220" }}>
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <span className="text-xs text-gray-400">
            {selectedVendor ? `Vendor: ${selectedVendor.name}` : "No vendor selected"}
            {grandTotal > 0 && ` · ₹${grandTotal.toFixed(2)}`}
          </span>
          <div className="flex items-center gap-2">
            <div className="relative" ref={shareDropRef}>
              <button
                onClick={() => setShowShareDrop(v => !v)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Share2 size={14} /> Share
                <ChevronDown size={12} className="text-gray-400" />
              </button>
              {showShareDrop && (
                <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[140px]">
                  {["WhatsApp", "Email", "PDF"].map(opt => (
                    <button key={opt} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors">{opt}</button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: saving ? "#f5a050" : "linear-gradient(135deg, #f58220, #e8740e)" }}
            >
              {saving ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              ) : null}
              Save {noteType}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 -m-8">
      {/* Page Header Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
          style={{ background: "linear-gradient(135deg, #f58220, #e8740e)" }}
        >
          <Plus size={15} /> New Return
        </button>
      </div>

      {/* Summary Strip */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4">
        {[
          { label: "Total Amount", value: `₹${totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, dot: "bg-orange-400" },
          { label: "Settled", value: `₹${totalSettled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, dot: "bg-emerald-400" },
          { label: "Balance", value: `₹${totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, dot: "bg-amber-400" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className={clsx("w-2 h-2 rounded-full shrink-0", card.dot)} />
            <div>
              <p className="text-xs text-gray-400 font-medium">{card.label}</p>
              <p className="text-base font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
        >
          {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Date From */}
        <div className="relative" ref={fromCalRef}>
          <button
            onClick={() => setShowFromCal(v => !v)}
            className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 hover:border-orange-300 transition-colors"
          >
            <Calendar size={13} className="text-orange-400" />
            {fmtDate(dateFrom)}
          </button>
          {showFromCal && (
            <div className="absolute top-full left-0 mt-1 z-50">
              <MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} />
            </div>
          )}
        </div>
        <span className="text-gray-400 text-sm">to</span>
        <div className="relative" ref={toCalRef}>
          <button
            onClick={() => setShowToCal(v => !v)}
            className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 hover:border-orange-300 transition-colors"
          >
            <Calendar size={13} className="text-orange-400" />
            {fmtDate(dateTo)}
          </button>
          {showToCal && (
            <div className="absolute top-full left-0 mt-1 z-50">
              <MiniCalendar value={dateTo} onChange={setDateTo} onClose={() => setShowToCal(false)} />
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor, ref no..."
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-800 outline-none w-52 focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <button onClick={fetchData} className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-orange-500 hover:border-orange-300 bg-white transition-colors" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-700 bg-white transition-colors" title="Print">
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading returns...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}>
                <Undo2 size={28} style={{ color: "#f58220" }} />
              </div>
              <div className="text-center">
                <p className="text-gray-700 font-semibold text-sm">No returns yet</p>
                <p className="text-gray-400 text-xs mt-1 max-w-xs">Create a debit note or purchase return when goods are sent back to a vendor.</p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #f58220, #e8740e)" }}
              >
                <Plus size={14} /> New Return
              </button>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["#", "Date", "Ref No.", "Vendor", "Type", "Status", "Total", "Settled", "Balance", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((n, i) => {
                    const statusKey = (n.status || "PENDING").toUpperCase();
                    const s = STATUS_STYLES[statusKey] || STATUS_STYLES.PENDING;
                    return (
                      <tr key={n.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(n.date)}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "#f58220" }}>{n.returnNo || `DN-${i + 1}`}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{n.vendor?.name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200">
                            {n.type || "Debit Note"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", s.bg, s.color, s.border)}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          ₹{n.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">
                          ₹{(n.receivedPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: "#f58220" }}>
                          ₹{(n.balance ?? n.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <button className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100 transition-colors" title="Print">
                            <Printer size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm bg-gray-50/50">
                <span className="text-gray-500 text-xs">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
                <div className="flex items-center gap-6 text-xs font-semibold">
                  <span className="text-gray-600">Total: <span className="text-gray-900">₹{totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></span>
                  <span className="text-emerald-600">Settled: ₹{totalSettled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span style={{ color: "#f58220" }}>Balance: ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
