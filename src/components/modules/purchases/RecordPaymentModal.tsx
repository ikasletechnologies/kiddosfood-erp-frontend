"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, Wallet, CheckCircle2, RefreshCw, 
  ArrowRight, Landmark, CreditCard, Banknote 
} from "lucide-react";
import { vendorsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import Link from "next/link";


interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payingPO: any;
  accounts: any[];
  defaultAccountId?: string;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  payingPO,
  accounts,
  defaultAccountId
}: RecordPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE">("CASH");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccountId || "");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [vendorDetails, setVendorDetails] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [bankName, setBankName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen && payingPO) {
      const balance = Math.max(0, (payingPO.totalAmount ?? 0) - (payingPO.paid ?? 0));
      setPaymentAmount(balance);
      setIdempotencyKey(`po-pay-${payingPO.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setPaymentDate(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local format
      setBankName("");
      setReferenceNumber("");
      setPaymentMode("CASH");

      vendorsApi.getById(payingPO.vendorId).then(res => {
        setVendorDetails(res.data);
      }).catch(err => {
        console.error("Failed to load vendor details", err);
      });
    }
  }, [isOpen, payingPO]);

  if (!isOpen || !mounted || !payingPO) return null;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const currentBalance = selectedAccount?.balance || 0;
  const balanceAfter = currentBalance - paymentAmount;
  const isInsufficient = balanceAfter < 0;

  // Calculate outstanding bills
  const outstandingBills = vendorDetails?.invoices?.filter((inv: any) => inv.status !== 'PAID') || [];
  const outstandingBillsTotal = outstandingBills.reduce((sum: number, inv: any) => sum + (inv.amount - (inv.paid || 0)), 0);

  const handleRecordPayment = async () => {
    if (paymentAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Please select a withdrawal account");
      return;
    }

    let transactionRef = "";
    if (paymentMode === "BANK_TRANSFER" || paymentMode === "CHEQUE") {
      if (!bankName.trim() || !referenceNumber.trim()) {
        toast.error(`Please enter bank name and ${paymentMode === "CHEQUE" ? "cheque number" : "reference details"}`);
        return;
      }
      transactionRef = `${bankName} - Ref: ${referenceNumber}`;
    }

    setSaving(true);
    try {
      await vendorsApi.recordPayment(payingPO.vendorId, {
        amount: paymentAmount,
        accountId: selectedAccountId,
        type: "INVOICE_LINKED",
        note: paymentNote || `Payment for PO #${payingPO.id.substring(0, 8)}`,
        paymentMode,
        referenceId: payingPO.id,
        transactionRef: transactionRef || undefined,
        idempotencyKey,
        date: paymentDate || undefined
      });
      
      toast.success("Payment recorded successfully!");
      onSuccess();
      onClose();
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || "Failed to record payment.";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'CASH': return <Banknote size={16} />;
      case 'UPI': return <ArrowRight size={16} />;
      case 'BANK_TRANSFER': return <Landmark size={16} />;
      case 'CHEQUE': return <CreditCard size={16} />;
      default: return <Wallet size={16} />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'CASH': return 'Cash';
      case 'UPI': return 'UPI';
      case 'BANK_TRANSFER': return 'Bank Transfer';
      case 'CHEQUE': return 'Cheque';
      default: return mode;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="bg-white dark:bg-[#0f1117] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden animate-in zoom-in-95 duration-300 relative flex flex-col">
        {/* Header */}
        <div className="p-8 pb-6 border-b border-slate-50 dark:border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/20">
                <Wallet size={26} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Record Payment</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{payingPO.vendor?.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-300 hover:text-slate-500 transition-all">
              <X size={24} />
            </button>
          </div>

          {/* Vendor Financial Details & PO remaining */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Vendor Balance Due</p>
              <p className="text-sm font-black text-rose-500 mt-0.5">{formatCurrency(vendorDetails?.due ?? 0)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Vendor Advance Available</p>
              <p className="text-sm font-black text-emerald-500 mt-0.5">{formatCurrency(vendorDetails?.advance ?? 0)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Outstanding Bills</p>
              <p className="text-sm font-black text-slate-700 dark:text-slate-300 mt-0.5">
                {outstandingBills.length} ({formatCurrency(outstandingBillsTotal)})
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">This PO Remaining</p>
              <p className="text-sm font-black text-red-500 mt-0.5">
                {formatCurrency(Math.max(0, (payingPO.totalAmount ?? 0) - (payingPO.paid ?? 0)))}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar max-h-[50vh]">
          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Payment Amount</label>
            <div className="relative group">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300 dark:text-slate-700 transition-colors group-focus-within:text-orange-500">₹</span>
              <input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full pl-14 pr-8 py-5 text-3xl font-black bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-orange-500/20 rounded-[1.5rem] outline-none dark:text-white transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Date Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-6 py-4 text-xs font-black bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-slate-200 dark:focus:border-white/10 rounded-2xl outline-none dark:text-white transition-all"
            />
          </div>

          {/* Payment Mode */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Payment Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={clsx(
                    "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2",
                    paymentMode === mode
                      ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20 scale-[1.01]"
                      : "bg-white dark:bg-white/5 text-slate-400 border-slate-100 dark:border-white/5 hover:border-orange-500/30"
                  )}
                >
                  {getModeIcon(mode)}
                  {getModeLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          {/* Bank / Cheque Reference Details */}
          {(paymentMode === "BANK_TRANSFER" || paymentMode === "CHEQUE") && (
            <div className="p-5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {paymentMode === "CHEQUE" ? "Cheque Details" : "Bank Transfer Details"}
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Bank Name (e.g. HDFC Bank)"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-4 py-3 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 focus:border-orange-500 rounded-xl outline-none dark:text-white transition-all"
                />
                <input
                  type="text"
                  placeholder={paymentMode === "CHEQUE" ? "Cheque Number" : "Transaction Reference ID"}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-4 py-3 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 focus:border-orange-500 rounded-xl outline-none dark:text-white transition-all"
                />
              </div>
            </div>
          )}

          {/* Account Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Withdraw From Account</label>
              <Link 
                href="/banking/accounts" 
                target="_blank"
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 transition-all"
              >
                Add Money <ArrowRight size={10} />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {accounts.map(acc => {
                const isActive = selectedAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={clsx(
                      "p-4 rounded-[1.2rem] border-2 transition-all flex items-center justify-between group",
                      isActive 
                        ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/25" 
                        : "bg-slate-50 dark:bg-white/5 border-transparent hover:bg-slate-100 dark:hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-9 h-9 rounded-lg flex items-center justify-center",
                        isActive ? "bg-white/20" : "bg-white dark:bg-white/10 text-indigo-500"
                      )}>
                        {acc.type === 'BANK' ? <Landmark size={18} /> : <Banknote size={18} />}
                      </div>
                      <div className="text-left">
                        <p className={clsx("text-xs font-black uppercase tracking-tight", isActive ? "text-white" : "text-slate-900 dark:text-white")}>{acc.name}</p>
                        <p className={clsx("text-[9px] font-bold mt-0.5", isActive ? "text-indigo-100" : "text-slate-400")}>{acc.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={clsx("text-xs font-black", isActive ? "text-white" : "text-slate-900 dark:text-white")}>{formatCurrency(acc.balance || 0)}</p>
                      <p className={clsx("text-[8px] font-black uppercase tracking-tighter mt-0.5", isActive ? "text-indigo-200" : "text-slate-400")}>Available</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Balance Preview */}
          {selectedAccount && (
            <div className={clsx(
              "p-5 rounded-[1.5rem] border-2 flex items-center justify-between animate-in slide-in-from-top-4 duration-300",
              isInsufficient 
                ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30" 
                : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30"
            )}>
              <div>
                <p className={clsx("text-[9px] font-black uppercase tracking-widest mb-1", isInsufficient ? "text-red-600" : "text-emerald-600")}>
                  Balance After Payment
                </p>
                <p className={clsx("text-lg font-black", isInsufficient ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                  {formatCurrency(balanceAfter)}
                </p>
              </div>
              {isInsufficient ? (
                <div className="text-right">
                  <span className="bg-red-500 text-white text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg shadow-red-500/30">Insufficient Funds</span>
                </div>
              ) : (
                <CheckCircle2 className="text-emerald-500" size={28} />
              )}
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Note <span className="normal-case opacity-50 font-bold">(Optional)</span></label>
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder={`Payment for PO-${payingPO.id?.slice(0, 8).toUpperCase()}`}
              className="w-full px-5 py-4 text-xs font-black bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-slate-200 dark:focus:border-white/10 rounded-xl outline-none dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-white/10"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-4 border-t border-slate-50 dark:border-white/5 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleRecordPayment}
            disabled={saving || paymentAmount <= 0 || !selectedAccountId || isInsufficient}
            className="flex-[2] py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:grayscale text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            {saving ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {saving ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
