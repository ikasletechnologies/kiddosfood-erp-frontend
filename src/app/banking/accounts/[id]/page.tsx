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

// Human-readable label for Payment.entityType / Order.partyType — same
// mechanism for all three party kinds, no per-type special casing.
const PARTY_TYPE_LABEL: Record<string, string> = {
  CUSTOMER: 'Customer',
  DEALER: 'Dealer',
  FRANCHISE: 'Franchise',
};

interface LedgerRow {
  id: string;
  date: string;
  particulars: string;
  type: 'INFLOW' | 'OUTFLOW';
  amount: number;
  // POS-traceability reference fields (undefined for non-POS rows e.g.
  // expenses/vendor/customer ledger entries, which keep the plain layout).
  billNumber?: string | null;
  partyType?: string | null;
  partyName?: string | null;
  method?: string | null;
  // Expense-traceability reference fields (undefined for non-expense rows).
  expenseId?: string | null;
  expenseNumber?: string | null;
  category?: string | null;
}

function toRows(account: any): LedgerRow[] {
  const rows: LedgerRow[] = [];

  // A paid Expense's only real money-movement record is the Payment below
  // (sourceModule: 'EXPENSE') — the backend deliberately no longer sends a
  // separate `account.expenses` list here, so there is nothing left to loop
  // over and no risk of rendering the same outflow twice.
  for (const p of account.payments || []) {
    const isOutflow = p.entityType === 'VENDOR' || p.sourceModule === 'EXPENSE' || p.type === 'INTERNAL_TRANSFER';
    const isPos = p.sourceModule === 'POS';
    const isExpense = p.sourceModule === 'EXPENSE';
    rows.push({
      id: `payment-${p.id}`,
      date: p.createdAt,
      particulars: isPos
        ? 'POS Payment Received'
        : isExpense
          ? `Expense Paid${p.payee ? ` - ${p.payee}` : ''}`
          : (p.transactionRef || (isOutflow ? 'Payment Made' : 'Payment Received')),
      type: isOutflow ? 'OUTFLOW' : 'INFLOW',
      amount: p.paidAmount,
      billNumber: isPos ? p.billNumber : null,
      partyType: isPos ? p.partyType : null,
      partyName: isPos ? p.partyName : null,
      method: isPos ? p.paymentMode : null,
      expenseId: isExpense ? p.expenseId : null,
      expenseNumber: isExpense ? p.expenseNumber : null,
      category: isExpense ? p.category : null,
    });
  }

  // VendorLedger/CustomerLedger entries are deliberately NOT merged in here.
  // Every payment already appears once via `account.payments` above;
  // FinanceService.createPayment additionally writes a vendor/customer
  // ledger row carrying this same accountId for the SAME event (the
  // vendor/customer-side mirror, not a second real transaction) — merging
  // both doubled every payment as a +/- pair with the same amount. See
  // AccountService.getAccountById for the backend side of this fix.

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
    return <div className="min-h-screen bg-gray-50 dark:bg-background py-20 text-center text-sm text-gray-400 dark:text-slate-500">Loading account…</div>;
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background py-20 flex flex-col items-center gap-3">
        <p className="text-gray-600 dark:text-slate-300 font-semibold">Account not found</p>
        <button onClick={() => router.push('/banking/accounts')} className="text-sm text-[#f58220] font-semibold">
          Back to Business Accounts
        </button>
      </div>
    );
  }

  const rows = toRows(account);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/banking/accounts')}
          className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#f58220]" />
          {account.name}
        </h1>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className={clsx(
              "p-3 rounded-lg",
              account.type === 'CASH' ? "bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" :
              account.type === 'BANK' ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
              "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            )}>
              {account.type === 'CASH' ? <Wallet size={22} /> :
               account.type === 'BANK' ? <Building2 size={22} /> :
               <Smartphone size={22} />}
            </div>
            <div>
              <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">{account.accountCode}</span>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {account.type === 'BANK' ? 'Bank Account' : account.type === 'CASH' ? 'Cash Drawer' : 'Digital Wallet'} · {account.status}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">System Balance</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">₹{account.balance.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Transaction History</h2>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-slate-500">No transactions yet</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  <th className="px-5 py-2.5 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Particulars</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap align-top">{new Date(r.date).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-xs font-medium text-gray-700 dark:text-slate-300 align-top">
                      <div>{r.particulars}</div>
                      {(r.billNumber || r.partyName || r.method || r.expenseNumber || r.category) && (
                        <div className="mt-1 space-y-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                          {r.billNumber && <div>Bill: #{r.billNumber}</div>}
                          {r.partyName && <div>{PARTY_TYPE_LABEL[r.partyType || ''] || 'Party'}: {r.partyName}</div>}
                          {r.method && <div>Method: {r.method}</div>}
                          {r.expenseNumber && <div>Ref: {r.expenseNumber}</div>}
                          {r.category && <div>Category: {r.category}</div>}
                        </div>
                      )}
                    </td>
                    <td className={clsx(
                      "px-5 py-3 text-xs font-bold text-right align-top whitespace-nowrap",
                      r.type === 'INFLOW' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
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
