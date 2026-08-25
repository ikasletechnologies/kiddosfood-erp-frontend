"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Check, X } from "lucide-react";
import api, { accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function PayslipClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/api/payroll/payslips/${id}`).then(r => setPayslip(r.data)).catch(() => {}).finally(() => setLoading(false));
    }
    accountsApi.getAll().then((res) => {
      setAccounts(res.data || []);
      if (res.data?.length > 0) setSelectedAccountId(res.data[0].id);
    }).catch(() => {});
  }, [id]);

  async function markPaid() {
    if (!selectedAccountId) return;
    setPaying(true);
    try {
      await api.patch(`/api/payroll/payslips/${id}/mark-paid`, { accountId: selectedAccountId });
      setPayslip((p: any) => ({ ...p, status: "PAID", paidAt: new Date().toISOString() }));
      setShowPayModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!payslip) return <div className="p-6 text-gray-400">Payslip not found</div>;

  const earnings = (payslip.components || []).filter((c: any) => c.type === "EARNING");
  const deductions = (payslip.components || []).filter((c: any) => c.type === "DEDUCTION");

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Payslip</h1>
        <div className="flex gap-2">
          {payslip.status === "PENDING" && (
            <button onClick={() => setShowPayModal(true)} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">
              <Check className="w-4 h-4" /> Mark as Paid
            </button>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm print:shadow-none print:border-0">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Salary Slip</h2>
            <p className="text-sm text-gray-500">{MONTHS[payslip.month - 1]} {payslip.year}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${payslip.status === "PAID" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{payslip.status}</span>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Employee Details</h3>
              <p className="font-semibold text-gray-900">{payslip.employee?.user?.fullName}</p>
              <p className="text-sm text-gray-500">{payslip.employee?.user?.email}</p>
              <p className="text-sm text-gray-500">{payslip.employee?.employeeCode}</p>
              {payslip.employee?.designation && <p className="text-sm text-gray-500">{payslip.employee.designation}</p>}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment Details</h3>
              <p className="text-sm text-gray-600">Pay Period: {MONTHS[payslip.month - 1]} {payslip.year}</p>
              {payslip.paidAt && <p className="text-sm text-gray-600">Paid on: {formatDate(payslip.paidAt)}</p>}
              {payslip.otHours > 0 && <p className="text-sm text-gray-600">OT Hours: {payslip.otHours}h (₹{payslip.otAmount})</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-green-700 uppercase mb-3">Earnings</h3>
              <div className="space-y-2">
                {earnings.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{c.name}</span>
                    <span className="font-medium text-gray-800">₹{c.amount?.toLocaleString()}</span>
                  </div>
                ))}
                {payslip.otAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Overtime</span>
                    <span className="font-medium text-gray-800">₹{payslip.otAmount?.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Total Earnings</span>
                <span className="text-green-600">₹{payslip.totalEarnings?.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-red-600 uppercase mb-3">Deductions</h3>
              <div className="space-y-2">
                {deductions.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{c.name}</span>
                    <span className="font-medium text-gray-800">₹{c.amount?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Total Deductions</span>
                <span className="text-red-500">₹{payslip.totalDeductions?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 text-white rounded-xl p-5 flex items-center justify-between">
            <span className="font-semibold text-lg">Net Salary</span>
            <span className="text-2xl font-bold">₹{payslip.netSalary?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pay ₹{payslip.netSalary?.toLocaleString()}</h2>
              <button onClick={() => setShowPayModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pay From Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} (₹{(a.balance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={markPaid}
                  disabled={paying || !selectedAccountId}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                >
                  {paying ? "Processing..." : "Confirm Payment"}
                </button>
                <button type="button" onClick={() => setShowPayModal(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
