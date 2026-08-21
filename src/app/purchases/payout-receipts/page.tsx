"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet, Plus, Search, RefreshCw, X,
  Printer, ChevronDown, Share2, Calendar,
  FileText, ArrowLeft,
} from "lucide-react";
import { clsx } from "clsx";
import { vendorsApi, accountsApi, accountingApi } from "@/lib/api";
import { toast } from "react-hot-toast";

// ── Types & Constants ─────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PAID:    { label: "Paid",    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  PARTIAL: { label: "Partial", color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  PENDING: { label: "Pending", color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
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

export default function PaymentOutPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [payments, setPayments] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // form
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [receiptNo] = useState("Auto");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");

  // date filter
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);

  const calRef = useRef<HTMLDivElement>(null);
  const vendorDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

  const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const vRes = await vendorsApi.getAll();
      const aRes = await accountsApi.getAll().catch(() => ({ data: [] }));
      const pRes = await accountingApi.getPayments().catch(() => ({ data: [] }));
      
      const allVendors = vRes.data?.vendors || vRes.data || [];
      const allAccounts = aRes.data?.accounts || aRes.data || [];
      const allPayments = pRes.data?.payments || pRes.data || [];
      
      setVendors(allVendors);
      setAccounts(allAccounts);
      if (allAccounts.length > 0 && !accountId) setAccountId(allAccounts[0].id);

      const vendorMap = new Map(allVendors.map((v: any) => [v.id, v.name]));

      const txns = allPayments
        .filter((p: any) => p.flow === "OUT" && (p.sourceModule === "PROCUREMENT" || p.entityType === "VENDOR" || p.type === "INVOICE_LINKED" || p.type === "ADVANCE"))
        .map((p: any) => ({
          id: p.id,
          vendorId: p.entity,
          vendorName: vendorMap.get(p.entity) || "Vendor",
          amount: p.amount || 0,
          paymentMode: p.method || "Cash",
          note: p.reference || "",
          date: p.date,
          receiptNo: p.paymentNumber || p.linkedDocId || "",
          status: p.status,
        }));

      setPayments(txns);
    } finally { setLoading(false); }
  }, [date, accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vendorDropRef.current && !vendorDropRef.current.contains(e.target as Node)) setShowVendorDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node)) setShowShareDrop(false);
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCalendar(false);
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node)) setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node)) setShowToCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const openCreate = () => {
    setSelectedVendor(null); setVendorSearch(""); setPaymentMode("Cash");
    setDate(new Date().toISOString().split("T")[0]); setAmount(""); setNote(""); setShowNote(false);
    setView("create");
  };

  const handleSave = async () => {
    if (!selectedVendor) { toast.error("Please select a vendor"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await vendorsApi.recordPayment(selectedVendor.id, {
        amount: amt,
        note: note || `Payment-Out — ${date}`,
        accountId: accountId,
        paymentMode: paymentMode.replace(/\s/g, "_").toUpperCase(),
      });
      toast.success("Payment-Out recorded");
      fetchData(); setView("list");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to record payment");
    } finally { setSaving(false); }
  };

  const filtered = payments.filter(p =>
    !search ||
    p.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    p.receiptNo?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPaid   = filtered.reduce((s, p) => s + p.amount, 0);
  const countPaid   = filtered.filter(p => p.status === "PAID").length;

  // ── CREATE VIEW ───────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 104px)" }}>
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ArrowLeft size={17} />
            </button>
            <h2 className="text-base font-semibold text-gray-800">New Payment-Out</h2>
          </div>
          <span className="text-xs text-gray-400">Receipt No: <span className="text-orange-500 font-semibold">Auto</span></span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">

          {/* Vendor + Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-8">
              {/* Left: Vendor */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Vendor / Party *</label>
                  <div className="relative" ref={vendorDropRef}>
                    <div
                      className={clsx("flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white transition-colors",
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
                              onClick={() => { setSelectedVendor(v); setVendorSearch(v.name); setShowVendorDrop(false); }}
                            >
                              <div>
                                <div className="text-sm font-medium text-gray-800">{v.name}</div>
                                <div className="text-xs text-gray-400">{v.phone || "—"}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                  >
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Source Account *</label>
                  <select
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                  >
                    <option value="" disabled>Select an account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
              </div>

              {/* Right: Meta */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-gray-500">Receipt No</span>
                  <span className="text-sm font-semibold text-gray-700">Auto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Date</span>
                  <div className="relative" ref={calRef}>
                    <button
                      onClick={() => setShowCalendar(v => !v)}
                      className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:border-orange-400 transition-colors"
                    >
                      <Calendar size={13} className="text-orange-500 shrink-0" />
                      {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-1 z-[200]">
                        <MiniCalendar value={date} onChange={setDate} onClose={() => setShowCalendar(false)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Amount + Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount Paid (₹) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-lg font-semibold text-gray-800 outline-none focus:border-orange-400 bg-white placeholder-gray-300 transition-colors"
              />
            </div>
            <div className="space-y-2">
              {!showNote ? (
                <button onClick={() => setShowNote(true)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 transition-colors">
                  <FileText size={13} /> Add Description / Note
                </button>
              ) : (
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Payment note or reference..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none" />
              )}
            </div>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total Payment Out</span>
              <span className="text-xl font-bold text-orange-500">₹ {parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button onClick={() => setView("list")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
          <div className="relative" ref={shareDropRef}>
            <div className="flex rounded-lg overflow-hidden">
              <button onClick={() => toast.success("Share feature coming soon")}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 border-r border-orange-400"
              >Share</button>
              <button onClick={() => setShowShareDrop(v => !v)} className="px-2 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600"><ChevronDown size={14} /></button>
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
          >{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#f58220]" />
          Payment-Out
        </h1>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Payment-Out
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Paid Out",  value: `₹${totalPaid.toLocaleString("en-IN")}`, color: "text-gray-700",    dot: "bg-gray-400" },
            { label: "This Month",      value: `₹${totalPaid.toLocaleString("en-IN")}`, color: "text-rose-600",    dot: "bg-rose-500" },
            { label: "Transactions",    value: `${countPaid} paid`,                      color: "text-emerald-600", dot: "bg-emerald-500" },
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by vendor or receipt..."
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
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 relative">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900" onClick={() => setShowFromCal(v => !v)}>
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{fmtD(dateFrom)}</span>
            </div>
            {showFromCal && (<div className="absolute top-full left-0 mt-1 z-50" ref={fromCalRef}><MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} /></div>)}
            <span className="text-gray-300 px-1">to</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900" onClick={() => setShowToCal(v => !v)}>
              <span className="font-medium">{fmtD(dateTo)}</span>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            {showToCal && (<div className="absolute top-full right-0 mt-1 z-50" ref={toCalRef}><MiniCalendar value={dateTo} onChange={setDateTo} onClose={() => setShowToCal(false)} /></div>)}
          </div>
          <div className="flex-1" />
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Empty / Table */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Wallet className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Payments Recorded</p>
              <p className="text-gray-500 text-sm mt-1">Record your first vendor payment to start tracking outflows.</p>
            </div>
            <button onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Add Payment-Out
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Receipt No</th>
                  <th className="text-left px-4 py-3">Vendor / Party</th>
                  <th className="text-left px-4 py-3">Payment Mode</th>
                  <th className="text-left px-4 py-3">Note</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p, i) => {
                  const style = STATUS_STYLES[p.status] || STATUS_STYLES.PAID;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {p.receiptNo || `REC-${String(i + 1).padStart(4, "0")}`}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{p.vendorName || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{p.paymentMode}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{p.note || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹ {p.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Printer className="h-4 w-4" /></button>
                          <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Share2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between text-sm">
              <span className="text-gray-500">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
              <span className="font-semibold text-gray-800">Total: ₹ {totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
