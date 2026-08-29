"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Calendar, ChevronDown, X,
  Share2, ArrowLeft, TrendingUp, FileText,
  RefreshCw, Search, Printer,
} from "lucide-react";
import { clsx } from "clsx";
import { accountingApi, accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// ── Types & Constants ─────────────────────────────────────────────────────────

interface LineItem { id: string; item: string; qty: number; rate: number; }

const CATEGORIES = ["RENT", "SALARY", "TRANSPORT", "UTILITIES", "MARKETING", "MAINTENANCE", "OTHER"];
const PAYMENT_TYPES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];

// Which Account.type a chosen Payment Type can draw from — matches the
// mapping the backend already uses for payment-mode classification
// (Cheque/Card settle out of a bank account, same as Bank Transfer).
function compatibleAccountType(paymentType: string): "CASH" | "BANK" | "UPI" {
  if (paymentType === "Cash") return "CASH";
  if (paymentType === "UPI") return "UPI";
  return "BANK";
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PAID:    { label: "Paid",    color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  PENDING: { label: "Pending", color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
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
  const prev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const isSel = (d: number) => selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isTod = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;
  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400"><ChevronDown size={14} className="rotate-90" /></button>
        <span className="text-sm font-semibold text-gray-800 dark:text-white">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400"><ChevronDown size={14} className="-rotate-90" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 py-0.5">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i} onClick={() => { onChange(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`); onClose(); }}
            className={clsx("w-full aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors",
              isSel(d) ? "bg-orange-500 text-white" : isTod(d) ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >{d}</button>
        ))}
      </div>
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 dark:border-white/5 pt-2">
        <button onClick={() => { const t = new Date(); onChange(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`); onClose(); }} className="text-[11px] font-semibold text-orange-500 hover:text-orange-700">Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Close</button>
      </div>
    </div>
  );
}

function makeItem(): LineItem { return { id: Math.random().toString(36).slice(2), item: "", qty: 1, rate: 0 }; }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return formatDate(d);
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // form
  const [category, setCategory] = useState("OTHER");
  const [showCatDrop, setShowCatDrop] = useState(false);
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [showDateCal, setShowDateCal] = useState(false);
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [paymentType, setPaymentType] = useState("Cash");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [isGstEnabled, setIsGstEnabled] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showShareDrop, setShowShareDrop] = useState(false);

  const catDropRef = useRef<HTMLDivElement>(null);
  const dateCalRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (catDropRef.current && !catDropRef.current.contains(t)) setShowCatDrop(false);
      if (dateCalRef.current && !dateCalRef.current.contains(t)) setShowDateCal(false);
      if (shareDropRef.current && !shareDropRef.current.contains(t)) setShowShareDrop(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, accRes] = await Promise.all([
        accountingApi.getExpenses(),
        accountsApi.getAll()
      ]);
      setExpenses(expRes.data?.expenses ?? expRes.data ?? []);
      setAccounts(accRes.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const compatibleAccounts = accounts.filter(
    a => a.status === "ACTIVE" && a.type === compatibleAccountType(paymentType)
  );

  // Whenever the payment type changes (or accounts load), make sure the
  // selected account is still one of the compatible ones — auto-pick the
  // first compatible account, but never silently fall back to some other
  // unrelated account the way the old hardcoded default did.
  useEffect(() => {
    if (!compatibleAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(compatibleAccounts[0]?.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType, accounts]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const totalUnrounded = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const roundOffAmt = roundOffEnabled ? Math.round(totalUnrounded) - totalUnrounded : 0;
  const grandTotal = totalUnrounded + roundOffAmt;
  const totalQty = items.reduce((s, it) => s + it.qty, 0);

  const updateItem = (id: string, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  const addRow = () => setItems(prev => [...prev, makeItem()]);
  const removeRow = (id: string) => { if (items.length > 1) setItems(prev => prev.filter(it => it.id !== id)); };

  const resetForm = () => {
    setCategory("OTHER"); setExpenseDate(todayStr()); setItems([makeItem(), makeItem()]);
    setPaymentType("Cash"); setSelectedAccountId(""); setRoundOffEnabled(true); setIsGstEnabled(false);
    setNoteText(""); setShowNote(false);
  };

  const openCreate = () => { resetForm(); setView("create"); };

  const handleSave = async () => {
    const valid = items.filter(it => it.item.trim() || it.rate > 0);
    if (!valid.length) { toast.error("Add at least one item"); return; }
    if (!selectedAccountId) { toast.error("Select a payment account to pay from"); return; }
    if (selectedAccount && selectedAccount.balance < grandTotal) {
      toast.error(`Insufficient balance in ${selectedAccount.name}. Available: ₹${selectedAccount.balance.toLocaleString("en-IN")}`);
      return;
    }
    setSaving(true);
    try {
      await accountingApi.recordExpense({
        category,
        payee: valid[0].item.trim() || category,
        amount: grandTotal,
        note: JSON.stringify({ items: valid, isGstEnabled, noteText }),
        date: expenseDate,
        isPaidImmediately: true,
        accountId: selectedAccountId,
        paymentMode: paymentType.toUpperCase(),
      });
      toast.success("Expense saved");
      setView("list");
      resetForm();
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save expense");
    } finally { setSaving(false); }
  };

  const filtered = expenses.filter(e =>
    !search || e.category?.toLowerCase().includes(search.toLowerCase()) || e.payee?.toLowerCase().includes(search.toLowerCase())
  );
  const totalExpenses = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  // ── CREATE VIEW ────────────────────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="flex flex-col bg-slate-50 dark:bg-background p-4 sm:p-6 min-h-screen space-y-4 animate-in fade-in duration-500 text-slate-800 dark:text-slate-100">
        {/* Top Bar */}
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 p-4 flex items-center justify-between z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView("list"); resetForm(); }} className="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Purchase & Expense</p>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">New Expense</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">GST</span>
              <button
                onClick={() => setIsGstEnabled(v => !v)}
                className={clsx("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", isGstEnabled ? "bg-orange-500" : "bg-gray-200 dark:bg-white/20")}
              >
                <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", isGstEnabled ? "translate-x-4" : "translate-x-1")} />
              </button>
            </label>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Header Fields */}
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full min-w-0">
              {/* Left: Category */}
              <div className="space-y-3 min-w-0">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Expense Category *</label>
                  <button
                    onClick={() => setShowCatDrop(v => !v)}
                    className="w-full flex items-center justify-between border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white bg-white dark:bg-white/5 hover:border-orange-400 transition-colors"
                  >
                    <span className="font-medium">{category}</span>
                    <ChevronDown size={14} className="text-gray-400 dark:text-slate-500" />
                  </button>
                  {showCatDrop && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1">
                      {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => { setCategory(cat); setShowCatDrop(false); }}
                          className={clsx("w-full text-left px-4 py-2 text-sm hover:bg-orange-50 dark:hover:bg-white/5 transition-colors", cat === category ? "text-orange-600 font-semibold" : "text-gray-700 dark:text-slate-300")}
                        >{cat}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm min-w-0">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">Expense No.</p>
                  <p className="font-semibold text-gray-400 dark:text-slate-500 text-sm">Auto</p>
                </div>
                <div className="relative" ref={dateCalRef}>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">Date</p>
                  <button
                    onClick={() => setShowDateCal(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors font-medium"
                  >
                    <Calendar size={13} className="text-orange-400" />
                    {fmtDate(expenseDate)}
                  </button>
                  {showDateCal && (
                    <div className="absolute top-full right-0 mt-1 z-50">
                      <MiniCalendar value={expenseDate} onChange={setExpenseDate} onClose={() => setShowDateCal(false)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[650px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide w-8">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Item / Description</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide w-24">Qty</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide w-36">Price / Unit</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide w-32">Amount</th>
                    <th className="px-3 py-3 w-8">
                      <button onClick={addRow} className="text-orange-500 hover:text-orange-700 transition-colors"><Plus size={15} /></button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="group hover:bg-orange-50/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-gray-300 dark:text-slate-600 text-center text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <input
                          value={item.item}
                          onChange={e => updateItem(item.id, "item", e.target.value)}
                          className="w-full outline-none bg-transparent text-gray-800 dark:text-white text-sm placeholder-gray-300 dark:placeholder-slate-600"
                          placeholder="Enter item description..."
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number" min="1"
                          value={item.qty || ""}
                          onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                          className="w-full outline-none bg-transparent text-center text-sm text-gray-800 dark:text-white"
                          placeholder="1"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number" min="0"
                          value={item.rate || ""}
                          onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                          className="w-full outline-none bg-transparent text-center text-sm text-gray-800 dark:text-white"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800 dark:text-white">
                        {item.qty * item.rate > 0 ? `₹${(item.qty * item.rate).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-1 py-2.5">
                        {items.length > 1 && (
                          <button onClick={() => removeRow(item.id)} className="text-gray-200 dark:text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                            <X size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Table footer totals */}
            <div className="flex border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-sm">
              <div className="flex-1 px-4 py-3">
                <button onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-700 transition-colors">
                  <Plus size={13} /> Add Row
                </button>
              </div>
              <div className="w-24 px-3 py-3 text-center text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Total</div>
              <div className="w-24 px-3 py-3 text-center text-sm font-bold text-gray-800 dark:text-white">{totalQty}</div>
              <div className="w-36 px-3 py-3" />
              <div className="w-32 px-3 py-3 text-right text-sm font-bold text-gray-800 dark:text-white">₹{totalUnrounded.toFixed(2)}</div>
              <div className="w-8" />
            </div>
          </div>

          {/* Bottom: Payment + Note + Summary */}
          <div className="flex gap-4 flex-col lg:flex-row pb-6">
            {/* Left */}
            <div className="flex-1 space-y-3">
              <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Payment Type</p>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value)}
                  className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-slate-200 bg-white dark:bg-[#13151f] outline-none w-full focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                >
                  {PAYMENT_TYPES.map(t => <option key={t} value={t} className="dark:bg-card">{t}</option>)}
                </select>

                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-4 mb-2">Paid From</p>
                {compatibleAccounts.length === 0 ? (
                  <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-lg px-3 py-2">
                    No active {compatibleAccountType(paymentType)} account found. Create one under Business Accounts.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {compatibleAccounts.map(acc => {
                      const insufficient = grandTotal > 0 && acc.balance < grandTotal;
                      const isSelected = acc.id === selectedAccountId;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={clsx(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors",
                            isSelected ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10" : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{acc.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">{acc.accountCode}</p>
                          </div>
                          <div className="text-right">
                            <p className={clsx("text-sm font-semibold", insufficient ? "text-rose-500 dark:text-rose-400" : "text-gray-700 dark:text-slate-300")}>
                              ₹{acc.balance.toLocaleString("en-IN")}
                            </p>
                            {insufficient && <p className="text-[10px] font-semibold text-rose-500 dark:text-rose-400">Insufficient Funds</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {!showNote ? (
                <button onClick={() => setShowNote(true)} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-orange-500 transition-colors">
                  <FileText size={13} /> Add note / description
                </button>
              ) : (
                <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Note</p>
                    <button onClick={() => { setShowNote(false); setNoteText(""); }} className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-300"><X size={13} /></button>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note about this expense..."
                    rows={3}
                    className="w-full text-sm text-gray-700 dark:text-slate-200 bg-transparent outline-none resize-none placeholder-gray-300 dark:placeholder-slate-600"
                  />
                </div>
              )}
            </div>

            {/* Right: Summary */}
            <div className="w-64 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 self-start">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-800 dark:text-white">₹{totalUnrounded.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roundOffEnabled}
                      onChange={e => setRoundOffEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-orange-500"
                    />
                    <span className="text-xs">Round off</span>
                  </label>
                  <span className={clsx("text-sm font-medium", roundOffAmt >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                    {roundOffAmt >= 0 ? "+" : ""}{roundOffAmt.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-gray-100 dark:border-white/5 pt-2 flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold" style={{ color: "#f58220" }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 p-4 flex items-center justify-between gap-3 sticky bottom-4 z-20 shadow-sm">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {category} · {fmtDate(expenseDate)}
            {grandTotal > 0 && ` · ₹${grandTotal.toFixed(2)}`}
          </span>
          <div className="flex items-center gap-2">
            <div className="relative" ref={shareDropRef}>
              <button
                onClick={() => setShowShareDrop(v => !v)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <Share2 size={14} /> Share <ChevronDown size={12} className="text-gray-400 dark:text-slate-500" />
              </button>
              {showShareDrop && (
                <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 min-w-[140px]">
                  {["WhatsApp", "Email", "PDF"].map(opt => (
                    <button key={opt} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-white/5 transition-colors">{opt}</button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !selectedAccountId || (!!selectedAccount && grandTotal > 0 && selectedAccount.balance < grandTotal)}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-sm"
              style={{ background: saving ? "#f5a050" : "linear-gradient(135deg, #f58220, #e8740e)" }}
            >
              {saving && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>}
              Save Expense
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 sm:p-6 space-y-4 animate-in fade-in duration-500 text-slate-800 dark:text-slate-100">
      {/* Page Header */}
      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50 dark:bg-orange-500/10 text-orange-600 border border-orange-100 dark:border-orange-500/20">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Expenses</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Track & record business expenses</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 shadow-sm transition-all"
        >
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Expenses", value: `₹${totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, dot: "bg-orange-400" },
          { label: "This Month", value: `₹${filtered.filter(e => new Date(e.date).getMonth() === new Date().getMonth()).reduce((s, e) => s + (e.amount || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, dot: "bg-blue-400" },
          { label: "Pending", value: `${filtered.filter(e => e.status !== "PAID").length}`, dot: "bg-amber-400" },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={clsx("w-2 h-2 rounded-full shrink-0", card.dot)} />
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-400 font-medium">{card.label}</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search category, payee..."
              className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white outline-none w-52 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <button onClick={fetchData} className="p-2.5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-white/5 transition-colors shadow-sm" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full min-w-0">
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 dark:text-slate-500">Loading expenses...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
                <TrendingUp size={28} className="text-[#f58220]" />
              </div>
              <div className="text-center">
                <p className="text-gray-700 dark:text-slate-300 font-semibold text-sm">No expenses yet</p>
                <p className="text-gray-400 dark:text-slate-500 text-xs mt-1 max-w-xs">Record your business expenses to track your real profitability.</p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-sm"
                style={{ background: "linear-gradient(135deg, #f58220, #e8740e)" }}
              >
                <Plus size={14} /> Add Expense
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                      {["#", "Date", "Category", "Payee", "Payment Mode", "Status", "Amount"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filtered.map((exp, i) => {
                      const statusKey = (exp.status || "PENDING").toUpperCase();
                      const s = STATUS_STYLES[statusKey] || STATUS_STYLES.PENDING;
                      return (
                        <tr key={exp.id} className="hover:bg-orange-50/30 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{fmtDate(exp.date)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 border border-orange-200 dark:border-orange-500/20">
                              {exp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 dark:text-white font-medium">{exp.payee || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{exp.paymentMode || "Cash"}</td>
                          <td className="px-4 py-3">
                            <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", s.bg, s.color, s.border)}>{s.label}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                            ₹{(exp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 dark:border-white/5 px-4 py-3 flex items-center justify-between text-sm bg-gray-50/50 dark:bg-white/[0.02]">
                <span className="text-gray-500 dark:text-slate-400 text-xs">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
                <span className="text-xs font-semibold" style={{ color: "#f58220" }}>
                  Total: ₹{totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
