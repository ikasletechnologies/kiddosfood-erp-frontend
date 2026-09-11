"use client";

import { useState, useEffect } from "react";
import {
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
  Plus as PlusIcon,
  ChevronDown as ChevronDownIcon,
  X as XIcon,
  IndianRupee as IndianRupeeIcon,
  FileText as FileTextIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";

interface LoanAccount {
  id: string;
  accountName: string;
  accountNumber?: string;
  lenderName?: string;
  loanType: string; // RECEIVED or GIVEN
  principalAmount: number;
  interestRate: number;
  loanDate: string;
  outstandingBalance: number;
  principalPaid: number;
  interestPaid: number;
}

interface LoanTransaction {
  id: string;
  date: string;
  type: string; // DISBURSEMENT, PRINCIPAL_PAID, INTEREST_CHARGED, INTEREST_PAID
  amount: number;
  endingBalance: number;
  note?: string;
}

interface LoanStatementData {
  loans: { id: string; accountName: string; loanType: string }[];
  loanAccount?: LoanAccount;
  transactions: LoanTransaction[];
  summary: {
    openingBalance: number;
    balanceDue: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
  };
}

export default function CentralLoanStatementReport({
  reportData,
  loading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const [period, setPeriod] = useState("This Month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [data, setData] = useState<LoanStatementData | null>(null);
  const [fetching, setFetching] = useState(false);

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);

  // Add Account form fields
  const [newAccName, setNewAccName] = useState("");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newLenderName, setNewLenderName] = useState("");
  const [newLoanType, setNewLoanType] = useState("RECEIVED");
  const [newPrincipal, setNewPrincipal] = useState("");
  const [newInterestRate, setNewInterestRate] = useState("");
  const [newLoanDate, setNewLoanDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Add Transaction form fields
  const [txnType, setTxnType] = useState("PRINCIPAL_PAID");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnDate, setTxnDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [txnNote, setTxnNote] = useState("");

  const fetchStatement = () => {
    setFetching(true);
    reportsApi
      .getLoanStatement({
        loanAccountId: selectedLoanId || undefined,
        startDate,
        endDate,
      })
      .then((res: any) => {
        setData(res.data);
        if (res.data?.loans?.length > 0 && !selectedLoanId) {
          // Default to first account if none selected
          setSelectedLoanId(res.data.loans[0].id);
        }
      })
      .catch(() => {
        toast.error("Failed to load loan statement");
      })
      .finally(() => {
        setFetching(false);
      });
  };

  useEffect(() => {
    fetchStatement();
  }, [selectedLoanId, startDate, endDate]);

  const handlePrint = () => {
    toast.success("Preparing print layout...");
    window.print();
  };

  const handleExcel = () => {
    toast.success("Excel report exported successfully!");
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) {
      toast.error("Please provide an Account Name");
      return;
    }
    const principal = parseFloat(newPrincipal);
    if (isNaN(principal) || principal <= 0) {
      toast.error("Please provide a valid Principal Amount");
      return;
    }

    try {
      const res = await reportsApi.addLoanAccount({
        accountName: newAccName,
        accountNumber: newAccNumber || undefined,
        lenderName: newLenderName || undefined,
        loanType: newLoanType,
        principalAmount: principal,
        interestRate: parseFloat(newInterestRate) || 0,
        loanDate: newLoanDate,
      });
      toast.success("Loan Account created successfully!");
      setIsAccountModalOpen(false);
      
      // Reset fields
      setNewAccName("");
      setNewAccNumber("");
      setNewLenderName("");
      setNewPrincipal("");
      setNewInterestRate("");
      
      // Set created account as active and refetch
      setSelectedLoanId(res.data.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create Loan Account");
    }
  };

  const handleCreateTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    const amount = parseFloat(txnAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid Amount");
      return;
    }

    try {
      await reportsApi.addLoanTransaction(selectedLoanId, {
        type: txnType,
        amount,
        date: txnDate,
        note: txnNote || undefined,
      });
      toast.success("Transaction recorded successfully!");
      setIsTxnModalOpen(false);
      
      // Reset fields
      setTxnAmount("");
      setTxnNote("");
      
      // Refetch data
      fetchStatement();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to record transaction");
    }
  };

  const fmt = (val: number) =>
    `₹ ${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* ─── FILTERS & CONTROLS PANEL ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Account Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Account:</span>
              <div className="relative">
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="pl-3 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="">No Active Account</option>
                  {(data?.loans || []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.accountName} ({l.loanType === "RECEIVED" ? "Lender" : "Borrower"})
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
              <CalendarIcon size={14} className="text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28"
              />
              <span className="text-slate-400">TO</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExcel}
              className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Export Excel"
            >
              <ExcelIcon size={15} className="text-green-600" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Print Statement"
            >
              <PrinterIcon size={15} className="text-slate-600 dark:text-slate-400" />
            </button>
            {selectedLoanId && (
              <button
                onClick={() => setIsTxnModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1.5"
              >
                <PlusIcon size={13} /> Add Txn
              </button>
            )}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <PlusIcon size={13} /> Add Loan A/C
            </button>
          </div>
        </div>
      </div>

      {/* ─── PRINT-ONLY HEADER ─── */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Loan Account Statement</h2>
        {data?.loanAccount && (
          <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
            <div>
              <p className="font-bold">Account Name: <span className="font-normal">{data.loanAccount.accountName}</span></p>
              <p className="font-bold">Lender Name: <span className="font-normal">{data.loanAccount.lenderName || "—"}</span></p>
            </div>
            <div>
              <p className="font-bold">Interest Rate: <span className="font-normal">{data.loanAccount.interestRate}% P.A.</span></p>
              <p className="font-bold">Period: <span className="font-normal">{startDate} To {endDate}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* ─── STATEMENT TRANSACTION TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ending Balance</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {fetching || loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching statement records...</p>
                  </td>
                </tr>
              ) : (!data || !data.transactions || data.transactions.length === 0) ? (
                <tr>
                  <td colSpan={5} className="text-center py-32 text-slate-400 text-xs font-semibold">
                    <FileTextIcon size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    No transactions to show
                  </td>
                </tr>
              ) : (
                data.transactions.map((t, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">{t.date}</td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-blue-600 dark:text-blue-400">
                      {t.type.replace("_", " ")}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white tabular-nums">
                      {fmt(t.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                      {fmt(t.endingBalance)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-slate-500 dark:text-slate-400">{t.note || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── SUMMARY FOOTER ─── */}
        {data?.loanAccount && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            {/* Bottom Left Summary */}
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Loan Account Summary</h4>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                <div>
                  Opening Balance: <span className="font-extrabold text-slate-900 dark:text-white">{fmt(data.summary.openingBalance)}</span>
                </div>
                <div className="border-l border-slate-350 dark:border-slate-700 pl-4">
                  Balance Due: <span className="font-extrabold text-blue-600 dark:text-blue-400">{fmt(data.summary.balanceDue)}</span>
                </div>
              </div>
            </div>

            {/* Bottom Right Summary */}
            <div className="flex gap-6 text-xs font-bold text-slate-700 dark:text-slate-300 md:text-right pr-4">
              <div>
                <p className="text-slate-400 uppercase tracking-widest text-[9px] font-black">Total Principal Paid</p>
                <p className="font-black text-slate-900 dark:text-white">{fmt(data.summary.totalPrincipalPaid)}</p>
              </div>
              <div className="border-l border-slate-350 dark:border-slate-700 pl-4 md:text-right">
                <p className="text-slate-400 uppercase tracking-widest text-[9px] font-black">Total Interest Paid</p>
                <p className="font-black text-slate-900 dark:text-white">{fmt(data.summary.totalInterestPaid)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── ADD LOAN ACCOUNT MODAL ─── */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Create Loan Account</h3>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label>Account Name (e.g. Bank Name / Lender Name) *</label>
                  <input
                    type="text"
                    required
                    placeholder="HDFC Business Loan"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label>Account Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="99988887777"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label>Lenders Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="HDFC Bank"
                    value={newLenderName}
                    onChange={(e) => setNewLenderName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label>Loan Type</label>
                  <select
                    value={newLoanType}
                    onChange={(e) => setNewLoanType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="RECEIVED">Loans Taken (Lenders)</option>
                    <option value="GIVEN">Loans Given (Borrowers)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label>Principal Amount (Loan Amount) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="5,00,000"
                    value={newPrincipal}
                    onChange={(e) => setNewPrincipal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label>Interest Rate (% P.A.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10.5"
                    value={newInterestRate}
                    onChange={(e) => setNewInterestRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label>Loan Date</label>
                  <input
                    type="date"
                    value={newLoanDate}
                    onChange={(e) => setNewLoanDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Save Loan A/C
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD TRANSACTION MODAL ─── */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Add Loan Transaction</h3>
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTxn} className="space-y-4 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="space-y-1">
                <label>Transaction Type *</label>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="PRINCIPAL_PAID">Principal Repayment (Paid)</option>
                  <option value="INTEREST_CHARGED">Interest Accrued (Charged)</option>
                  <option value="INTEREST_PAID">Interest Paid</option>
                </select>
              </div>

              <div className="space-y-1">
                <label>Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="50,000"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label>Transaction Date</label>
                <input
                  type="date"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label>Remarks / Note (Optional)</label>
                <input
                  type="text"
                  placeholder="EMI Payment for May"
                  value={txnNote}
                  onChange={(e) => setTxnNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTxnModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
