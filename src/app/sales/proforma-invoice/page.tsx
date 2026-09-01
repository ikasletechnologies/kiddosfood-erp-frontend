"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Search, RefreshCw, Check, Printer, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api/base";
import { settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";
import EstimationsPageClient from "@/app/sales/estimation/EstimationsPageClient";

// No hardcoded state here — the seller's GST registration state must come
// from the real HQ franchise (see SettingsService.getCompanyProfile),
// never a guessed default, or CGST+SGST vs IGST silently disagrees with
// what Sales Order/Tax Invoice compute for the same document.
const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: ""
};

// Proforma Invoice status styling
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:     { label: "Draft",     color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-white/5",   border: "border-slate-200 dark:border-white/10" },
  SENT:      { label: "Sent",      color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-200 dark:border-blue-500/20" },
  CONVERTED: { label: "Converted", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  CANCELLED: { label: "Cancelled", color: "text-slate-400 dark:text-slate-500",   bg: "bg-slate-100 dark:bg-white/5",  border: "border-slate-200 dark:border-white/10" },
};

export default function ProformaInvoicePage() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [proformas, setProformas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "create">("list");
  const [initialDraftData, setInitialDraftData] = useState<any>(null);

  // GSTInvoice preview/print modal
  const [previewProforma, setPreviewProforma] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

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

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => setCompanyProfile(res.data))
      .catch(() => {});
  }, []);

  // Deep-link from Sales Order's "View Proforma Invoice" (?id=<id>).
  const deepLinkedId = searchParams.get("id");
  useEffect(() => {
    if (!deepLinkedId) return;

    const loadLinked = async () => {
      try {
        const res = await api.get(`/api/sales/proforma-invoices/${deepLinkedId}`);
        if (res.data) {
          setInitialDraftData(res.data);
          setView("create");
        }
      } catch (err) {
        console.error("Failed to load deep-linked Proforma Invoice", err);
        showToast("Failed to open Proforma Invoice", "error");
      }
    };
    loadLinked();
  }, [deepLinkedId, showToast]);

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

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/api/sales/proforma-invoices/${id}/status`, { status });
      showToast(`Proforma marked as ${status}`, "success");
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.error || `Failed to mark as ${status}`, "error");
    }
  };

  const filtered = proformas.filter((p) => {
    const matchSearch = !search ||
      (p.proformaNumber || "").toLowerCase().includes(search.toLowerCase()) ||
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

  if (view === "create") {
    return (
      <EstimationsPageClient
        documentType="PROFORMA"
        initialView="create"
        initialDraftData={initialDraftData}
        onCancel={() => {
          setView("list");
          setInitialDraftData(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0">
      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Proforma Invoices
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Manage, track, and convert proforma invoices to tax invoices
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setInitialDraftData(null);
            setView("create");
          }}
          className="flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span>New Proforma Invoice</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">
        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total", value: stats.total, color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400" },
            { label: "Draft", value: stats.draft, color: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
            { label: "Sent", value: stats.sent, color: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
            { label: "Converted", value: stats.converted, color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3.5 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-2xs">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-xl font-bold truncate", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search proforma or party..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 max-w-full justify-between sm:justify-end">
            <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-[calc(100%-48px)] sm:max-w-none custom-scrollbar p-0.5 bg-white dark:bg-card shrink-0">
              {["ALL", "DRAFT", "SENT", "CONVERTED", "CANCELLED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors rounded-lg whitespace-nowrap shrink-0",
                    statusFilter === s ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  {s === "ALL" ? "All" : STATUS_STYLES[s]?.label || s}
                </button>
              ))}
            </div>

            <button 
              onClick={fetchData} 
              className="p-2 sm:p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors shrink-0" 
              title="Refresh"
              aria-label="Refresh Proforma Invoices"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-70" />
            <p className="text-xs text-gray-500 dark:text-slate-400">Loading proforma invoices...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs w-full min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center">
              <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-[#f58220]" />
            </div>
            <div className="max-w-md">
              <p className="text-gray-900 dark:text-white font-bold text-base sm:text-lg">No Proforma Invoices Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
                {search || statusFilter !== "ALL"
                  ? "No proforma invoices match your search or filter criteria."
                  : "Create a new proforma invoice or convert one from a Sales Order to get started."}
              </p>
            </div>
            <button
              onClick={() => {
                setInitialDraftData(null);
                setView("create");
              }}
              className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> New Proforma Invoice
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Proforma No.</th>
                    <th className="text-left px-4 py-3">Party</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filtered.map((p) => {
                    const style = STATUS_STYLES[p.status] || STATUS_STYLES.DRAFT;
                    return (
                      <tr key={p.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-orange-600 dark:text-orange-400 text-xs whitespace-nowrap">
                          {p.proformaNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1 max-w-[200px] sm:max-w-[260px]">
                            <div className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate w-full" title={p.customer?.name || p.customerName || "—"}>
                              {p.customer?.name || p.customerName || "—"}
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                              {p.partyType || (p.customerId ? "CUSTOMER" : "UNKNOWN")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-gray-900 dark:text-white text-xs sm:text-sm whitespace-nowrap">
                          ₹{Number(p.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPreviewProforma(p)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-colors"
                              title="Print / Preview Proforma Invoice"
                              aria-label="Print / Preview"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            {(p.status === "DRAFT" || p.status === "SENT") && (
                              <button
                                onClick={() => handleConvert(p)}
                                disabled={convertingId === p.id}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20 transition-colors disabled:opacity-50"
                              >
                                {convertingId === p.id ? "Converting..." : "Convert to Tax Invoice"}
                              </button>
                            )}
                            {p.status === "DRAFT" && (
                              <button
                                onClick={() => handleUpdateStatus(p.id, "SENT")}
                                className="px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20 transition-colors"
                              >
                                Mark as Sent
                              </button>
                            )}
                            {(p.status === "DRAFT" || p.status === "SENT") && (
                              <button
                                onClick={() => handleUpdateStatus(p.id, "CANCELLED")}
                                className="px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                            {p.status === "CONVERTED" && (
                              <a
                                href={`/sales/invoices?id=${p.convertedInvoiceId}`}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-colors inline-flex items-center gap-1"
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
          </div>
        )}
      </div>

      {previewProforma && (
        <GSTInvoice
          order={{
            poNumber: previewProforma.proformaNumber,
            sourceSalesOrderNumber: previewProforma.sourceSalesOrderNumber,
            createdAt: previewProforma.createdAt,
            stateOfSupply: previewProforma.stateOfSupply,
            discount: previewProforma.discountAmount || previewProforma.discount || 0,
            items: (previewProforma.items || []).map((it: any, idx: number) => ({
              itemName: it.productName || it.description || it.itemName || it.name || `Item #${idx + 1}`,
              quantity: it.quantity ?? it.qty ?? 0,
              price: it.rate ?? it.price ?? it.unitPrice ?? 0,
              gstRate: it.taxPercent ?? it.taxPct ?? it.gstRate ?? 0,
              hsnCode: it.hsnCode,
            })),
          }}
          vendor={previewProforma.customer || { name: previewProforma.customerName || "Customer" }}
          // companyProfile resolves to {} (truthy, not falsy) when the
          // fetch succeeds but returns no state — `|| FALLBACK_COMPANY`
          // alone never catches that case, so check the field that
          // actually matters for tax classification.
          companyDetails={companyProfile?.state ? companyProfile : FALLBACK_COMPANY}
          documentType="PROFORMA_INVOICE"
          dueDateDays={(() => {
            if (!previewProforma.validUntil || !previewProforma.createdAt) return 15;
            const created = new Date(previewProforma.createdAt).getTime();
            const validUntil = new Date(previewProforma.validUntil).getTime();
            if (Number.isNaN(created) || Number.isNaN(validUntil)) return 15;
            const days = Math.round((validUntil - created) / (1000 * 60 * 60 * 24));
            return days > 0 ? days : 15;
          })()}
          onClose={() => setPreviewProforma(null)}
        />
      )}
    </div>
  );
}
