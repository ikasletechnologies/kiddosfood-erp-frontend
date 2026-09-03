'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { customersApi } from '@/lib/api';
import {  Search, User, ArrowUpRight, ArrowDownLeft, FileText , X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LedgerSummary {
  customerId: string;
  totalSales: number;
  totalPaid: number;
  balance: number;
}

export default function CustomerLedgerPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [ledgerByCustomerId, setLedgerByCustomerId] = useState<Record<string, LedgerSummary>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [customersRes, ledgerRes] = await Promise.all([
          customersApi.getAll(),
          customersApi.getLedgerSummary(),
        ]);
        setCustomers(customersRes.data);
        const byId: Record<string, LedgerSummary> = {};
        (ledgerRes.data || []).forEach((row: LedgerSummary) => { byId[row.customerId] = row; });
        setLedgerByCustomerId(byId);
      } catch (err) {
        console.error('Failed to fetch customer ledger data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const formatAmount = (amount: number) => `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Customer Ledgers</h1>
          <p className="text-slate-500">Track individual buyer balances and payment history</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search customer name or phone..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
            {searchTerm && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchTerm("")} 
              />
            )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Customer Details</TableHead>
                <TableHead>Total Sales</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Current Position</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading accounts...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No customers found.</TableCell></TableRow>
              ) : filtered.map((c) => {
                const ledger = ledgerByCustomerId[c.id];
                const totalSales = ledger?.totalSales || 0;
                const totalPaid = ledger?.totalPaid || 0;
                // Balance here follows CustomerLedger convention: DEBIT (sales) - CREDIT
                // (payments). Positive = customer owes us (Outstanding); negative =
                // customer has overpaid / has an advance with us.
                const balance = ledger?.balance || 0;

                return (
                  <TableRow key={c.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.phone || 'No phone'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{formatAmount(totalSales)}</TableCell>
                    <TableCell className="font-mono">{formatAmount(totalPaid)}</TableCell>
                    <TableCell>
                      {balance < 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                          <ArrowUpRight className="w-3 h-3 mr-1" /> {formatAmount(Math.abs(balance))} Advance
                        </Badge>
                      ) : balance > 0 ? (
                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">
                          <ArrowDownLeft className="w-3 h-3 mr-1" /> {formatAmount(balance)} Outstanding
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">Settle</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => window.open(`/reports?report=Party Statement`, '_blank')}
                      >
                        <FileText className="w-4 h-4 mr-2" /> View Statement
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
