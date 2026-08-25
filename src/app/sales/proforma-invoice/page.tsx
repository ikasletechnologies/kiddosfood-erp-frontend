"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Search, RefreshCw, Check } from "lucide-react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import api from "@/lib/api/base";
import { useToast } from "@/context/ToastContext";

// A genuinely distinct document from Estimate now (backed by
// /api/sales/proforma-invoices -> the ProformaInvoice model), created only
// via Sales Order -> "Create Proforma Invoice" — there's no manual-create
// flow here by design (matches the confirmed chain: Estimate -> Sales Order
// -> Proforma -> Tax Invoice, each step auto-fetching the one before it).
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:     { label: "Draft",     color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200" },
  SENT:      { label: "Sent",      color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  CONVERTED: { label: "Converted", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  CANCELLED: { label: "Cancelled", color: "text-slate-400",   bg: "bg-slate-100",  border: "border-slate-200" },
};

export default function ProformaInvoicePage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [proformas, setProformas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/sales/proforma-invoices");
      setProformas(res.data || []);
    } catch (e) {
      showToast("Failed to load Proforma Invoices", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Deep-link from Sales Order's "View Proforma Invoice" (?id=<id>).
  useEffect(() => {
    if (proformas.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const match = proformas.find((p) => p.id === id);
    if (match) setSearch(match.proformaNumber);
  }, [proformas]);

  const handleConvert = async (proforma: any) => {
    setConvertingId(proforma.id);
    try {
      const res = await api.post(`/api/sales/proforma-invoices/${proforma.id}/convert`);
      showToast("Tax Invoice created", "success");
      const invoiceId = res?.data?.id;
      router.push(invoiceId ? `/sales/invoices?id=${invoiceId}` : "/sales/invoices");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to convert to Tax Invoice", "error");
    } finally {
      setConvertingId(null);
    }
  };

  const filtered = proformas.filter((p) => {
    const matchSearch = !search ||
      p.proformaNumber?.toLowerCase().includes(search.toLowerCase()) ||
      (p.customer?.name || p.customerName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: proformas.length,
    draft: proformas.filter((p) => p.status === "DRAFT").length,
    sent: proformas.filter((p) => p.status === "SENT").length,
    converted: proformas.filter((p) => p.status === "CONVERTED").length,
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* ── Page Content ── */}

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, color: "text-gray-700", dot: "bg-gray-400" },
            { label: "Draft", value: stats.draft, color: "text-slate-600", dot: "bg-slate-400" },
            { label: "Sent", value: stats.sent, color: "text-blue-600", dot: "bg-blue-500" },
            { label: "Converted", value: stats.converted, color: "text-emerald-600", dot: "bg-emerald-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search proforma or party..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
            />
          </div>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            {["ALL", "DRAFT", "SENT", "CONVERTED", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {s === "ALL" ? "All" : STATUS_STYLES[s]?.label || s}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Proforma Invoices</p>
              <p className="text-gray-500 text-sm mt-1">Confirm a Sales Order and click "Create Proforma Invoice" to generate one.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Proforma No.</th>
                  <th className="text-left px-4 py-3">Party</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => {
                  const style = STATUS_STYLES[p.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {p.proformaNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-sm">{p.customer?.name || p.customerName || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">
                        ₹{Number(p.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(p.status === "DRAFT" || p.status === "SENT") && (
                            <button
                              onClick={() => handleConvert(p)}
                              disabled={convertingId === p.id}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            >
                              {convertingId === p.id ? "..." : "Convert to Tax Invoice"}
                            </button>
                          )}
                          {p.status === "CONVERTED" && (
                            <a
                              href={`/sales/invoices?id=${p.convertedInvoiceId}`}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" /> View Tax Invoice
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
