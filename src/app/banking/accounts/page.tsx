'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { accountsApi } from '@/lib/api';
import {
  Plus,
  Trash2,
  Wallet,
  Building2,
  Smartphone,
  ChevronRight,
  Landmark,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { SlideOver } from '@/components/ui/SlideOver';
import clsx from 'clsx';

const MAX_ACCOUNT_BALANCE = 1_000_000_000_000; // ₹1 trillion — matches backend guard

export default function AccountsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'CASH',
    balance: ''
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await accountsApi.getAll();
      setAccounts(res.data || []);
    } catch (e) {
      showToast("Failed to load accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return showToast("Account name is required", "error");

    const balance = Number(formData.balance) || 0;
    if (Math.abs(balance) > MAX_ACCOUNT_BALANCE) {
      return showToast(`Opening balance looks too large — please check for extra digits (max ₹${MAX_ACCOUNT_BALANCE.toLocaleString("en-IN")})`, "error");
    }

    try {
      await accountsApi.create({
        name: formData.name,
        type: formData.type as any,
        balance
      });
      showToast("Financial account active", "success");
      setShowAddForm(false);
      setFormData({ name: '', type: 'CASH', balance: '' });
      fetchAccounts();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to create account", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This cannot be undone if the account has history.")) return;
    try {
      await accountsApi.delete(id);
      showToast("Account decommissioned", "success");
      fetchAccounts();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Cannot delete active account", "error");
    }
  };

  const totalLiquidity = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const bankHoldings = accounts.filter(a => a.type === 'BANK').reduce((acc, curr) => acc + curr.balance, 0);
  const cashDigital = accounts.filter(a => a.type !== 'BANK').reduce((acc, curr) => acc + curr.balance, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#f58220]" />
          Business Accounts
        </h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Account
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Liquidity", value: `₹${totalLiquidity.toLocaleString("en-IN")}`, color: "text-gray-700", dot: "bg-gray-400" },
            { label: "Bank Holdings", value: `₹${bankHoldings.toLocaleString("en-IN")}`, sub: `${accounts.filter(a => a.type === 'BANK').length} accounts`, color: "text-blue-600", dot: "bg-blue-500" },
            { label: "Cash & Digital", value: `₹${cashDigital.toLocaleString("en-IN")}`, sub: `${accounts.filter(a => a.type !== 'BANK').length} wallets`, color: "text-emerald-600", dot: "bg-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}{s.sub ? ` · ${s.sub}` : ''}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Accounts List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading accounts…</div>
        ) : accounts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Landmark className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Financial Accounts Found</p>
              <p className="text-gray-500 text-sm mt-1">Create your first one to begin operations.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => (
              <div
                key={acc.id}
                onClick={() => router.push(`/banking/accounts/${acc.id}`)}
                className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 hover:shadow-sm transition-shadow group cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className={clsx(
                    "p-2.5 rounded-lg",
                    acc.type === 'CASH' ? "bg-orange-50 text-[#f58220]" :
                    acc.type === 'BANK' ? "bg-blue-50 text-blue-600" :
                    "bg-indigo-50 text-indigo-600"
                  )}>
                    {acc.type === 'CASH' ? <Wallet size={18} /> :
                     acc.type === 'BANK' ? <Building2 size={18} /> :
                     <Smartphone size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      acc.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
                    )}>
                      {acc.status}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }}
                      className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{acc.accountCode}</span>
                  <h3 className="text-base font-bold text-gray-800 mt-1.5">{acc.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {acc.type === 'BANK' ? 'Bank Account' : acc.type === 'CASH' ? 'Cash Drawer' : 'Digital Wallet'}
                  </p>
                </div>

                {/* Last Transaction Preview */}
                <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                  <p className="text-[10px] text-gray-400">Last Activity</p>
                  {acc.lastTransaction ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 truncate max-w-[120px]">{acc.lastTransaction.note}</span>
                      <span className={clsx(
                        "text-xs font-bold",
                        acc.lastTransaction.type === 'INFLOW' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {acc.lastTransaction.type === 'INFLOW' ? '+' : '-'}₹{acc.lastTransaction.amount.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No recent activity</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">System Balance</p>
                    <p className="text-lg font-bold text-gray-800">₹{acc.balance.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Account Slide-over */}
      <SlideOver
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="Create Financial Account"
      >
        <div className="space-y-6">
          <p className="text-sm text-gray-500">Define a new money container for your business.</p>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Account Name</label>
              <input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Operating Bank, Office Petty Cash"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Account Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220] appearance-none"
              >
                <option value="BANK">Bank Account</option>
                <option value="CASH">Cash Drawer</option>
                <option value="UPI">Digital Wallet (UPI)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Opening Balance</label>
              <input
                type="number"
                value={formData.balance}
                onChange={e => setFormData({ ...formData, balance: e.target.value })}
                placeholder="0.00"
                min={-MAX_ACCOUNT_BALANCE}
                max={MAX_ACCOUNT_BALANCE}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220] transition-colors"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      </SlideOver>
    </div>
  );
}
