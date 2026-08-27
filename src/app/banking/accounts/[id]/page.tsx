'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { accountsApi } from '@/lib/api';
import {
  ArrowLeft,
  Wallet,
  Building2,
  Smartphone,
  Landmark,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import clsx from 'clsx';

interface LedgerRow {
  id: string;
  date: string;
  particulars: string;
  type: 'INFLOW' | 'OUTFLOW';
  amount: number;
}

function toRows(account: any): LedgerRow[] {
  const rows: LedgerRow[] = [];

  for (const p of account.payments || []) {
    const isOutflow = p.entityType === 'VENDOR' || p.sourceModule === 'EXPENSE' || p.type === 'INTERNAL_TRANSFER';
    rows.push({
      id: `payment-${p.id}`,
      date: p.createdAt,
      particulars: p.transactionRef || (isOutflow ? (p.sourceModule === 'EXPENSE' ? 'Expense Paid' : 'Payment Made') : 'Payment Received'),
      type: isOutflow ? 'OUTFLOW' : 'INFLOW',
      amount: p.paidAmount,
    });
  }

  for (const e of account.expenses || []) {
    rows.push({
      id: `expense-${e.id}`,
      date: e.date || e.createdAt,
      particulars: e.description || e.category || 'Business Expense',
      type: 'OUTFLOW',
      amount: e.paidAmount || e.amount,
    });
  }

  for (const v of account.vendorLedgers || []) {
    rows.push({
      id: `vendor-${v.id}`,
      date: v.createdAt,
      particulars: v.note || 'Vendor Ledger Entry',
      type: v.type === 'CREDIT' ? 'OUTFLOW' : 'INFLOW',
      amount: v.amount,
    });
  }

  for (const c of account.customerLedgers || []) {
    rows.push({
      id: `customer-${c.id}`,
      date: c.createdAt,
      particulars: c.note || 'Customer Ledger Entry',
      type: c.type === 'DEBIT' ? 'INFLOW' : 'OUTFLOW',
      amount: c.amount,
    });
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const id = params?.id as string;

  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await accountsApi.getById(id);
        setAccount(res.data);
      } catch (e) {
        showToast("Failed to load account", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 py-20 text-center text-sm text-gray-400">Loading account…</div>;
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 py-20 flex flex-col items-center gap-3">
        <p className="text-gray-600 font-semibold">Account not found</p>
        <button onClick={() => router.push('/banking/accounts')} className="text-sm text-[#f58220] font-semibold">
          Back to Business Accounts
        </button>
      </div>
    );
  }

  const rows = toRows(account);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/banking/accounts')}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#f58220]" />
          {account.name}
        </h1>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx(
              "p-3 rounded-lg",
              account.type === 'CASH' ? "bg-orange-50 text-[#f58220]" :
              account.type === 'BANK' ? "bg-blue-50 text-blue-600" :
              "bg-indigo-50 text-indigo-600"
            )}>
              {account.type === 'CASH' ? <Wallet size={22} /> :
               account.type === 'BANK' ? <Building2 size={22} /> :
               <Smartphone size={22} />}
            </div>
            <div>
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{account.accountCode}</span>
              <p className="text-sm text-gray-500 mt-1">
                {account.type === 'BANK' ? 'Bank Account' : account.type === 'CASH' ? 'Cash Drawer' : 'Digital Wallet'} · {account.status}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">System Balance</p>
            <p className="text-2xl font-bold text-gray-800">₹{account.balance.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Transaction History</h2>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">No transactions yet</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Particulars</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-xs text-gray-500">{new Date(r.date).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-xs font-medium text-gray-700">{r.particulars}</td>
                    <td className={clsx(
                      "px-5 py-3 text-xs font-bold text-right",
                      r.type === 'INFLOW' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {r.type === 'INFLOW' ? '+' : '-'}₹{r.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
