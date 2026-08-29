"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Read-only print view of a party's transaction list — used by both the
// Customers and Dealers pages so the two stay on one shared statement
// layout/behavior instead of drifting apart. Never mutates data; it only
// renders what the page already fetched.
export interface PartyStatementTxn {
  type: string;
  number: string;
  date: string;
  total: number;
  balance: number;
}

interface PartyStatementProps {
  title: string; // e.g. "Customer Transaction Statement"
  party: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    branch?: string;
  };
  transactions: PartyStatementTxn[];
  onClose: () => void;
}

export default function PartyStatement({ title, party, transactions, onClose }: PartyStatementProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const totalAmount = transactions.reduce((s, t) => s + (Number(t.total) || 0), 0);
  const totalBalance = transactions.reduce((s, t) => s + (Number(t.balance) || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 p-4 md:p-8 overflow-y-auto print:p-0 print:bg-white">
      {/* Action Bar */}
      <div className="fixed top-4 right-6 flex gap-2 print:hidden z-[110]">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#F97316] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-orange-600 transition-colors"
        >
          <Printer size={16} /> Print Statement
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-gray-50 transition-colors"
        >
          <X size={16} /> Close
        </button>
      </div>

      {/* Statement Document (A4 format) */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-gray-800 shadow-2xl my-10 print:my-0 print:shadow-none p-10 md:p-14 relative">
        <h1 className="text-2xl font-bold text-[#F97316] mb-1">{title}</h1>
        <p className="text-xs text-gray-500 mb-8">Generated {formatDate(new Date())}</p>

        <div className="bg-[#f8f9fa] p-6 rounded-xl mb-8 max-w-md">
          <p className="font-bold text-gray-900 text-base mb-2">{party.name}</p>
          <div className="text-xs text-gray-600 space-y-1">
            {party.phone && <p>Phone: {party.phone}</p>}
            {party.email && <p>Email: {party.email}</p>}
            {party.branch && <p>Branch: {party.branch}</p>}
            {party.address && <p>Address: {party.address}</p>}
          </div>
        </div>

        <table className="w-full text-xs mb-6 border-collapse">
          <thead>
            <tr className="bg-[#F97316] text-white">
              <th className="py-3 px-4 text-left font-medium rounded-tl-lg">Type</th>
              <th className="py-3 px-4 text-left font-medium">Number</th>
              <th className="py-3 px-4 text-left font-medium">Date</th>
              <th className="py-3 px-4 text-right font-medium">Total</th>
              <th className="py-3 px-4 text-right font-medium rounded-tr-lg">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">No transactions</td>
              </tr>
            ) : (
              transactions.map((t, idx) => (
                <tr key={idx} className="bg-gray-50/50 border-b-4 border-white">
                  <td className="py-3 px-4 text-gray-900 font-medium">{t.type}</td>
                  <td className="py-3 px-4 text-gray-600">{t.number}</td>
                  <td className="py-3 px-4 text-gray-600">{formatDate(t.date)}</td>
                  <td className="py-3 px-4 text-right text-gray-900">₹{Number(t.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right text-gray-900">₹{Number(t.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="w-[280px] ml-auto">
          <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-semibold text-gray-900">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-gray-600">Total Balance</span>
            <span className="font-semibold text-gray-900">₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
