"use client";

import { useState, useEffect } from "react";
import { Plus, Play, FileText, DollarSign, Settings, X } from "lucide-react";
import Link from "next/link";
import api, { accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [payingPayslip, setPayingPayslip] = useState<any>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [paying, setPaying] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [prRes, psRes] = await Promise.all([
        api.get("/api/payroll/runs"),
        api.get("/api/payroll/payslips")
      ]);
      setPayrolls(prRes.data);
      setPayslips(psRes.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    accountsApi.getAll().then((res) => {
      setAccounts(res.data || []);
      if (res.data?.length > 0) setSelectedAccountId(res.data[0].id);
    }).catch(() => {});
  }, []);

  async function handleConfirmPay() {
    if (!payingPayslip || !selectedAccountId) return;
    setPaying(true);
    try {
      await api.patch(`/api/payroll/payslips/${payingPayslip.id}/mark-paid`, { accountId: selectedAccountId });
      toast.success("Payslip marked as paid");
      setPayingPayslip(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/payroll/runs", form);
      setShowForm(false);
      loadData();
    } catch {}
  }

  async function handleProcess(id: string) {
    setProcessing(id);
    try {
      await api.post(`/api/payroll/runs/${id}/process`);
      loadData();
    } catch {}
    setProcessing(null);
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-wrap items-center justify-end gap-2 w-full min-w-0">
        <div className="flex flex-wrap gap-2">
          <Link href="/hr/payroll/components" className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 bg-white dark:bg-card px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1 transition-colors"><Settings className="w-4 h-4" />Components</Link>
          <Link href="/hr/payroll/structures" className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 bg-white dark:bg-card px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Structures</Link>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Payroll
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
        <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm p-4 text-center min-w-0">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{payrolls.length}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Total Runs</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm p-4 text-center min-w-0">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{payrolls.filter(p => p.status === "PROCESSED").length}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Processed</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm p-4 text-center min-w-0">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{payslips.length}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Total Payslips</div>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden w-full min-w-0">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 font-semibold text-gray-900 dark:text-white">Payroll Runs</div>
        <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
          <table className="w-full text-sm min-w-[650px]">
            <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
              <tr>
                {["Period","Status","Payslips","Processed At","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No payroll runs yet</td></tr>
              ) : payrolls.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{MONTHS[p.month - 1]} {p.year}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === "PROCESSED" ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400" :
                      p.status === "PAID" ? "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                      "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{p._count?.payslips || 0}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{p.processedAt ? new Date(p.processedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {p.status === "DRAFT" && (
                        <button onClick={() => handleProcess(p.id)} disabled={processing === p.id} className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-60">
                          <Play className="w-3 h-3" />{processing === p.id ? "Processing..." : "Process"}
                        </button>
                      )}
                      <Link href={`/hr/payroll/${p.id}`} className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-200 px-2 py-1 rounded text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                        <FileText className="w-3 h-3" />View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden w-full min-w-0">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 font-semibold text-gray-900 dark:text-white">Recent Payslips</div>
        <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
          <table className="w-full text-sm min-w-[650px]">
          <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
            <tr>
              {["Employee","Period","Earnings","Deductions","Net Salary","Status","Action"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {payslips.slice(0, 10).map((ps) => (
              <tr key={ps.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{ps.employee?.user?.fullName}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{MONTHS[ps.month - 1]} {ps.year}</td>
                <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">₹{ps.totalEarnings?.toLocaleString()}</td>
                <td className="px-4 py-3 text-red-500 dark:text-red-400">₹{ps.totalDeductions?.toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">₹{ps.netSalary?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ps.status === "PAID" ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"}`}>{ps.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/hr/payroll/payslips/view?id=${ps.id}`} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">View</Link>
                    {ps.status !== "PAID" && (
                      <button
                        onClick={() => setPayingPayslip(ps)}
                        className="text-green-600 dark:text-green-400 hover:underline text-xs font-bold"
                      >
                        Pay Now
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-card text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 dark:border-white/5">
            <div className="p-5 border-b border-gray-100 dark:border-white/5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Payroll Run</h2></div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Month</label>
                <select value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1} className="dark:bg-card">{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Year</label>
                <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payingPayslip && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-card text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 dark:border-white/5">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pay ₹{payingPayslip.netSalary?.toLocaleString()}</h2>
              <button onClick={() => setPayingPayslip(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">To {payingPayslip.employee?.user?.fullName}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Pay From Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="dark:bg-card">{a.name} (₹{(a.balance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmPay}
                  disabled={paying || !selectedAccountId}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {paying ? "Processing..." : "Confirm Payment"}
                </button>
                <button type="button" onClick={() => setPayingPayslip(null)} className="flex-1 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
