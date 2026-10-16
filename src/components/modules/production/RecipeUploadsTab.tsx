"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FileText, RefreshCw, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { recipeImportsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

type UploadSession = {
  id: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  total: number;
  imported: number;
  pending: number;
  skipped: number;
  recipes?: Array<{ recipeId: string; state: string }>;
};

type StatusFilter = "ALL" | "PROCESSING" | "SUCCESS";

const statusOf = (session: UploadSession) => {
  if (session.total > 0 && session.pending === 0) {
    return { key: "SUCCESS" as const, label: "Success", classes: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" };
  }
  return { key: "PROCESSING" as const, label: "Processing", classes: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" };
};

export default function RecipeUploadsTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await recipeImportsApi.list();
      setSessions(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || "Could not load recipe uploads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions.filter((session) => {
      const matchesSearch = !query || session.fileName.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || statusOf(session).key === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, sessions, statusFilter]);

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-card sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Recipe Uploads</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">Upload Word recipe documents and inspect their actual import results.</p>
          </div>
          <button onClick={() => router.push("/production/recipes/import")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#f58220] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#e8740e]">
            <Upload size={14} /> Upload Recipe
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/5 dark:bg-card">
        <div className="flex flex-col gap-2 border-b border-gray-100 p-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search document name..." className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#f58220] dark:border-white/10 dark:bg-white/5" />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/5">
            {(["ALL", "PROCESSING", "SUCCESS"] as const).map((status) => (
              <button key={status} onClick={() => setStatusFilter(status)} className={clsx("rounded-md px-2.5 py-1.5 text-[10px] font-bold", statusFilter === status ? "bg-white text-[#f58220] shadow-sm dark:bg-card" : "text-gray-500 dark:text-slate-400")}>{status === "ALL" ? "All" : status === "PROCESSING" ? "Processing" : "Success"}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs text-gray-400"><RefreshCw size={14} className="animate-spin" /> Loading uploads...</div>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-center gap-3 p-10 text-xs"><AlertTriangle size={15} className="text-rose-500" /><span className="font-semibold text-rose-600">{error}</span><button onClick={load} className="font-bold text-[#f58220] hover:underline">Try again</button></div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center"><FileText size={24} className="mx-auto text-gray-300" /><p className="mt-2 text-xs font-semibold text-gray-600 dark:text-slate-300">No recipe uploads yet</p><p className="mt-1 text-[11px] text-gray-400">Upload a Word document to start an import review.</p></div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-xs text-gray-400">No uploads match the selected search or status.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead><tr className="border-b border-gray-100 text-[10px] font-bold uppercase text-gray-400 dark:border-white/5"><th className="px-4 py-3 text-left">Document</th><th className="px-4 py-3 text-left">Uploaded</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Detected</th><th className="px-4 py-3 text-right">Imported</th><th className="px-4 py-3 text-right">Pending</th><th className="px-4 py-3 text-right">Skipped</th><th className="px-4 py-3"><span className="sr-only">Action</span></th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {rows.map((session) => {
                  const status = statusOf(session);
                  return <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]"><td className="max-w-[260px] px-4 py-3"><span className="flex min-w-0 items-center gap-2"><FileText size={14} className="shrink-0 text-sky-500" /><span className="min-w-0"><span className="block truncate font-semibold" title={session.fileName}>{session.fileName}</span><span className="text-[10px] text-gray-400">Word document</span></span></span></td><td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDateTime(session.createdAt)}</td><td className="px-4 py-3"><span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-bold", status.classes)}>{status.label}</span></td><td className="px-4 py-3 text-right font-semibold tabular-nums">{session.total}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">{session.imported}</td><td className="px-4 py-3 text-right tabular-nums text-amber-600">{session.pending}</td><td className="px-4 py-3 text-right tabular-nums text-gray-500">{session.skipped}</td><td className="px-4 py-3 text-right"><button onClick={() => router.push(`/production/recipes/import?importId=${encodeURIComponent(session.id)}`)} className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-bold text-[#f58220] hover:underline">View Details <ChevronRight size={12} /></button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
