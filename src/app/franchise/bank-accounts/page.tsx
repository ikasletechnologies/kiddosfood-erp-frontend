'use client';

import React, { useState, useEffect } from 'react';
import { accountsApi } from '@/lib/api';
import {
  Plus,
  Trash2,
  Wallet,
  Building2,
  Smartphone,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { SlideOver } from '@/components/ui/SlideOver';
import clsx from 'clsx';

const MAX_ACCOUNT_BALANCE = 1_000_000_000_000; // ₹1 trillion guard

export default function FranchiseBankAccountsPage() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'CASH',
    balance: ''
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await accountsApi.getAll();
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch {
      showToast("Failed to load franchise accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast("Account name is required", "error");

    const balance = Number(formData.balance) || 0;
    if (Math.abs(balance) > MAX_ACCOUNT_BALANCE) {
      return showToast(`Opening balance looks too large (max ₹${MAX_ACCOUNT_BALANCE.toLocaleString("en-IN")})`, "error");
    }

    setSubmitting(true);
    try {
      await accountsApi.create({
        name: formData.name.trim(),
        type: formData.type as any,
        balance
      });
      showToast("Franchise financial account created successfully", "success");
      setShowAddForm(false);
      setFormData({ name: '', type: 'CASH', balance: '' });
      fetchAccounts();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to create account", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete account "${name}"? This cannot be undone.`)) return;
    try {
      await accountsApi.delete(id);
      showToast("Account deleted successfully", "success");
      fetchAccounts();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Cannot delete account with existing transactions", "error");
    }
  };

  const totalLiquidity = accounts.reduce((sum, curr) => sum + (Number(curr.balance) || 0), 0);
  const bankHoldings = accounts.filter(a => a.type === 'BANK').reduce((sum, curr) => sum + (Number(curr.balance) || 0), 0);
  const cashDigital = accounts.filter(a => a.type !== 'BANK').reduce((sum, curr) => sum + (Number(curr.balance) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 sm:p-6 space-y-5 w-full min-w-0 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-[#f58220] flex items-center justify-center shrink-0">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Franchise Bank Accounts</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your branch cash drawers, bank accounts, and payment sources for HQ order settlements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh accounts"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Franchise Balance</p>
            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              ₹{totalLiquidity.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bank Holdings</p>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">
              ₹{bankHoldings.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cash &amp; Digital</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
              ₹{cashDigital.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Account List Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-400">Loading franchise accounts…</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-[#f58220]">
            <Landmark size={28} />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="text-base font-bold text-slate-800 dark:text-white">No Franchise Accounts Configured</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create your branch Cash or Bank account to enable &quot;Pay HQ&quot; order settlements and track your outlet finances.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} /> Add First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => {
            const isBank = acc.type === 'BANK';
            const isCash = acc.type === 'CASH';

            return (
              <div
                key={acc.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={clsx(
                        "p-2.5 rounded-xl shrink-0",
                        isCash ? "bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" :
                        isBank ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                        "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      )}>
                        {isCash ? <Wallet size={18} /> : isBank ? <Building2 size={18} /> : <Smartphone size={18} />}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{acc.accountCode}</span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{acc.name}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        acc.status === 'ACTIVE'
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800"
                      )}>
                        {acc.status}
                      </span>
                      <button
                        onClick={() => handleDelete(acc.id, acc.name)}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                        title="Delete account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {isBank ? 'Bank Account' : isCash ? 'Franchise Cash Drawer' : 'Digital Wallet / UPI'}
                    </p>
                  </div>
                </div>

                {/* Balance & Activity */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                  {acc.lastTransaction ? (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[140px] font-medium">
                        {acc.lastTransaction.note}
                      </span>
                      <span className={clsx(
                        "font-bold flex items-center gap-0.5",
                        acc.lastTransaction.type === 'INFLOW' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {acc.lastTransaction.type === 'INFLOW' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        ₹{Number(acc.lastTransaction.amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl text-center">
                      <p className="text-[11px] text-slate-400 italic">No recent transactions</p>
                    </div>
                  )}

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Balance</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                        ₹{(Number(acc.balance) || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      <ShieldCheck size={14} /> Ready
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Account Slide-Over */}
      <SlideOver
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="Create Franchise Account"
      >
        <div className="space-y-6 p-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure a payment account for your franchise. This account will be used when settling orders with HQ via &quot;Pay HQ&quot;.
          </p>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Name *</label>
              <input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Franchise Cash Drawer, Outlet Bank A/C"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-[#f58220] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Type *</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-[#f58220] transition-colors"
              >
                <option value="CASH">Franchise Cash Drawer</option>
                <option value="BANK">Bank Account (Current / Savings)</option>
                <option value="UPI">Digital Wallet / UPI</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Opening Balance (₹)</label>
              <input
                type="number"
                value={formData.balance}
                onChange={e => setFormData({ ...formData, balance: e.target.value })}
                placeholder="0.00"
                min="0"
                step="any"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-[#f58220] transition-colors"
              />
              <p className="text-[11px] text-slate-400">Initial funds loaded into this account.</p>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save Account"}
              </button>
            </div>
          </form>
        </div>
      </SlideOver>
    </div>
  );
}
