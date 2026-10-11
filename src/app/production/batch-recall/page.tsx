"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldAlert, RefreshCw, Search, AlertTriangle, CheckCircle2, ChevronRight, X,
  Paperclip, Undo2, Trash2, ClipboardCheck, Lock, Ban, Package, MapPin, History,
  XCircle, FileText, Truck, Store, Receipt, Box, Plus,
} from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { recallApi, productionApi, attachmentsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getBatchStage } from "@/config/production-features";

const REASONS = ["Failed safety test", "Contamination", "Packaging defect", "Incorrect labeling", "Customer complaint", "Expiry issue", "Other"];
const SEVERITIES = [
  { value: "CRITICAL", label: "Critical", hint: "Serious health risk", cls: "bg-rose-600 text-white border-rose-600" },
  { value: "HIGH", label: "High", hint: "Possible health risk", cls: "bg-orange-500 text-white border-orange-500" },
  { value: "MEDIUM", label: "Medium", hint: "Unlikely health risk", cls: "bg-amber-400 text-amber-950 border-amber-400" },
  { value: "LOW", label: "Low", hint: "Quality / precautionary", cls: "bg-slate-500 text-white border-slate-500" },
];
const LIFECYCLE: Record<string, { label: string; cls: string }> = {
  INITIATED: { label: "Initiated", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20" },
  RECONCILED: { label: "Reconciled", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20" },
  CLOSED: { label: "Closed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20" },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10" },
};
// Recall Workflow Pipeline — progress comes from the recall's own event log.
const PIPELINE = [
  { event: "RECALL_INITIATED", label: "Identify Defective Batch", icon: Search },
  { event: "DISTRIBUTION_LOCATED", label: "Locate Distribution", icon: MapPin },
  { event: "SALES_BLOCKED", label: "Block Sales", icon: XCircle },
  { event: "REPORT_GENERATED", label: "Generate Recall Report", icon: FileText },
  { event: "RETURN_COLLECTED", label: "Collect Returned Stock", icon: Package },
];
const EVENT_LABEL: Record<string, string> = {
  RECALL_INITIATED: "Recall initiated — stock quarantined",
  DISTRIBUTION_LOCATED: "Distribution traced",
  SALES_BLOCKED: "Sale / dispatch block confirmed",
  REPORT_GENERATED: "Recall report generated",
  RETURN_COLLECTED: "Stock recovered",
  STOCK_DISPOSED: "Quarantined stock disposed",
  RECALL_RECONCILED: "Reconciliation recorded",
  RECALL_COMPLETED: "Recall closed",
  RECALL_CANCELLED: "Recall cancelled — stock released",
};
const QC_LABEL: Record<string, string> = {
  APPROVED: "Approved", PARTIALLY_APPROVED: "Partially approved", REJECTED: "Rejected",
  QC_NOT_REQUIRED: "Not required", PENDING: "Pending",
};

const fmt = (n: number) => (Number.isFinite(n) ? Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "0");
const fmtDate = (d?: string | null, withTime = false) => (d ? format(new Date(d), withTime ? "dd MMM yyyy, HH:mm" : "dd/MM/yyyy") : "—");
const inputCls = "w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]";
const labelCls = "block text-[11px] font-bold text-gray-600 dark:text-slate-300 mb-1";
const EVIDENCE_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

// Sum a SKU field per unit — SKUs in different units are never added together.
function byUnit(skus: any[], key: string): string {
  const totals: Record<string, number> = {};
  for (const s of skus) totals[s.unit] = (totals[s.unit] || 0) + (s[key] || 0);
  const parts = Object.entries(totals).filter(([, v]) => v > 0).map(([u, v]) => `${fmt(v)} ${u}`);
  return parts.length ? parts.join(" · ") : "0";
}

function SeverityBadge({ value }: { value?: string | null }) {
  const s = SEVERITIES.find((x) => x.value === value);
  if (!s) return null;
  return <span className={clsx("inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border", s.cls)}>{s.label}</span>;
}
function LifecycleBadge({ value }: { value?: string }) {
  const l = LIFECYCLE[value || ""] || LIFECYCLE.IN_PROGRESS;
  return <span className={clsx("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", l.cls)}>{l.label}</span>;
}

function batchRecallBadge(b: any): { label: string; cls: string } {
  const st = b.recall?.status;
  if (st === "IN_PROGRESS") return { label: "Recall Active", cls: "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20" };
  if (st === "COMPLETED") return { label: "Recalled", cls: "text-rose-700 bg-white border-rose-300 dark:bg-transparent dark:text-rose-300" };
  if (st === "CANCELLED") return { label: "Recall Cancelled", cls: "text-gray-600 bg-gray-50 border-gray-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10" };
  const stage = getBatchStage(b);
  return {
    label: stage.label,
    cls: stage.key === "STOCK_UPDATED" ? "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20"
      : stage.key === "READY_FOR_PACKAGING" || stage.key === "PARTIALLY_PACKED" ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
      : "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function uploadEvidence(recallId: string, files: File[]) {
  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} is larger than 5 MB`); continue; }
    await attachmentsApi.upload({
      entityType: "BATCH_RECALL", entityId: recallId,
      kind: f.type.startsWith("image/") ? "IMAGE" : "DOCUMENT",
      fileName: f.name, mimeType: f.type || "application/octet-stream", dataBase64: await fileToBase64(f),
    });
  }
}

function Section({ title, icon: Icon, children, right }: { title: string; icon: any; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-[#f58220]" /> {title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}

function SkuTable({ skus, showRecall }: { skus: any[]; showRecall: boolean }) {
  if (!skus.length) {
    return <p className="text-xs text-gray-500 dark:text-slate-400 p-4">No stock has been created from this batch yet (nothing packed). A recall keeps its bulk out of packaging.</p>;
  }
  const cols = showRecall
    ? ["Packed", "Quarantined", "Sold / Dispatched", "Recovered", "Disposed", "Outstanding"]
    : ["Packed", "On hand", "Sold / Dispatched"];
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm min-w-[620px]">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/5">
            <th className="text-left px-4 py-2">SKU</th>
            {cols.map((c) => <th key={c} className="text-right px-3 py-2">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {skus.map((s) => (
            <tr key={s.inventoryItemId}>
              <td className="px-4 py-2">
                <div className="font-semibold text-gray-900 dark:text-white">{s.name}</div>
                <div className="text-[10px] font-mono text-gray-400">
                  {s.sku || "—"} · {s.category === "SEMI_FINISHED" ? "Bulk" : "Finished good"}
                  {s.crossBatch && <span className="ml-1 text-amber-600 font-bold">· via shared bulk</span>}
                </div>
                {s.destinations?.length > 0 && (
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{s.destinations.map((d: any) => `${d.label}: ${fmt(d.qty)}`).join(" · ")}</div>
                )}
              </td>
              {(showRecall
                ? [s.packedQty, s.quarantinedQty, s.distributedQty, s.recoveredQty, s.disposedQty, s.outstandingQty]
                : [s.packedQty, s.onHandQty, s.distributedQty]
              ).map((v: number, i: number) => (
                <td key={i} className={clsx("px-3 py-2 text-right tabular-nums font-semibold",
                  showRecall && i === 1 && v > 0 && "text-rose-600",
                  showRecall && i === 5 && v > 0 && "text-amber-600",
                  showRecall && i === 5 && v === 0 && "text-emerald-600")}>
                  {fmt(v)} <span className="text-[10px] font-normal text-gray-400">{s.unit}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationTable({ lots }: { lots: any[] }) {
  const held = lots.filter((l) => l.currentQty > 0);
  if (!held.length) return <p className="text-xs text-gray-500 dark:text-slate-400 p-4">No stock of this batch is held anywhere right now.</p>;
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-white/5">
            <th className="text-left px-4 py-2">Location</th>
            <th className="text-left px-3 py-2">SKU / Lot</th>
            <th className="text-center px-3 py-2">Status</th>
            <th className="text-right px-4 py-2">Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {held.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-2">
                <div className="font-semibold text-gray-800 dark:text-white">{l.scope}</div>
                <div className="text-[11px] text-gray-500">{l.warehouse || "No warehouse"}</div>
              </td>
              <td className="px-3 py-2">
                <div className="text-gray-800 dark:text-slate-200">{l.name}</div>
                <div className="text-[10px] font-mono text-gray-400">{l.lotNumber || l.id.slice(0, 8)}{l.returnLot ? " · recovered" : ""}{l.crossBatch ? ` · ${l.productBatchCode}` : ""}</div>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={clsx("inline-block px-2 py-0.5 rounded text-[10px] font-bold border",
                  l.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20")}>
                  {l.status === "APPROVED" ? "Saleable" : l.status === "RETURNED" ? "Quarantined (returned)" : "Quarantined"}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-bold tabular-nums">{fmt(l.currentQty)} <span className="text-[10px] font-normal text-gray-400">{l.unit}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Recall Workflow Pipeline ───────────────────────────────────────────────
function Pipeline({ details }: { details: any | null }) {
  const recall = details?.recall;
  const events: any[] = details?.events || [];
  const initiatedAt = [...events].reverse().find((e) => e.event === "RECALL_INITIATED")?.createdAt;
  const done = new Set(events.filter((e) => !initiatedAt || e.createdAt >= initiatedAt).map((e) => e.event));
  const active = recall?.status === "IN_PROGRESS" || recall?.status === "COMPLETED";
  const firstOpen = PIPELINE.findIndex((p) => !done.has(p.event));
  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">Recall Workflow Pipeline</h3>
        {recall && (
          <span className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="font-mono font-bold text-gray-800 dark:text-white">{recall.recallNumber}</span>
            <LifecycleBadge value={recall.lifecycle} />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PIPELINE.map((p, i) => {
          const isDone = active && done.has(p.event);
          const isCurrent = active && recall?.status === "IN_PROGRESS" && i === firstOpen;
          return (
            <div key={p.event} className="flex items-center gap-2">
              <span className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold",
                isDone ? "bg-[#f58220] text-white border-[#f58220]"
                  : isCurrent ? "border-[#f58220] text-[#f58220] bg-orange-50 dark:bg-orange-500/10"
                  : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400")}>
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <p.icon className="h-3.5 w-3.5" />} {p.label}
              </span>
              {i < PIPELINE.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
            </div>
          );
        })}
      </div>
      {!recall && <p className="text-[11px] text-gray-400 mt-2">Initiating a recall quarantines the batch&apos;s stock immediately — distribution, blocking and the report follow automatically.</p>}
    </div>
  );
}

// ── Inline Initiate Recall form ────────────────────────────────────────────
function InitiateForm({ batch, details, onCancel, onDone }: { batch: any; details: any; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const errors = {
    reason: !reason ? "Select a recall reason" : "",
    severity: !severity ? "Select a severity" : "",
    description: description.trim().length < 10 ? "Describe the issue (at least 10 characters)" : "",
  };
  const valid = !errors.reason && !errors.severity && !errors.description;
  const onHand = (details?.skus || []).filter((s: any) => s.onHandQty > 0);

  const submit = async () => {
    setSubmitting(true);
    try {
      const recall = (await recallApi.initiate(batch.id, { reason, severity, description: description.trim() })).data;
      // Stock is already quarantined by the initiation itself; the remaining
      // pipeline stages run automatically.
      try {
        await recallApi.locateDistribution(batch.id);
        await recallApi.blockSales(batch.id);
        await recallApi.generateReport(batch.id);
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Recall created; use Trace distribution to finish the pipeline");
      }
      toast.success(`${recall.recallNumber} initiated — affected stock quarantined`);
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Recall could not be initiated");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  const err = (k: keyof typeof errors) => touched && errors[k] ? <p className="text-[11px] text-rose-600 mt-1">{errors[k]}</p> : null;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Recall Reason (required)</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={clsx(inputCls, "cursor-pointer")}>
            <option value="">Select a reason…</option>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {err("reason")}
        </div>
        <div>
          <label className={labelCls}>Severity (required)</label>
          <div className="grid grid-cols-4 gap-1.5">
            {SEVERITIES.map((s) => (
              <button key={s.value} type="button" title={s.hint} onClick={() => setSeverity(s.value)}
                className={clsx("py-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer",
                  severity === s.value ? s.cls : "bg-white dark:bg-transparent text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-gray-400")}>
                {s.label}
              </button>
            ))}
          </div>
          {err("severity")}
        </div>
      </div>
      <div>
        <label className={labelCls}>Recall Description / Remarks (required)</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="What was found, how it was detected, affected scope…" className={clsx(inputCls, "resize-none")} />
        {err("description")}
      </div>
      <div className="flex gap-2">
        <button onClick={() => { setTouched(true); if (valid) setConfirming(true); }}
          className="px-4 py-2 rounded-lg bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-bold shadow-sm">Confirm Initiate Recall</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent text-sm font-semibold text-gray-700 dark:text-slate-300">Cancel</button>
      </div>

      <Modal isOpen={confirming} onClose={() => !submitting && setConfirming(false)} title="Confirm batch recall" size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={() => setConfirming(false)} disabled={submitting} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-semibold">Go back</button>
            <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold min-w-[150px] flex items-center justify-center gap-1.5">
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Initiate Recall
            </button>
          </div>
        }>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>All stock of <strong>{batch.batchCode}</strong> is quarantined immediately and blocked from POS, sales, dispatch, delivery challans, stock transfers and packaging. Other batches are not affected.</p>
          </div>
          {onHand.length > 0 ? (
            <ul className="text-xs space-y-1">
              {onHand.map((s: any) => <li key={s.inventoryItemId} className="flex justify-between"><span>{s.name}</span><strong>{fmt(s.onHandQty)} {s.unit}</strong></li>)}
            </ul>
          ) : <p className="text-xs text-gray-500">No stock of this batch is on hand — nothing to quarantine, but its bulk will be kept out of packaging.</p>}
          <p className="text-xs text-gray-500 flex items-center gap-2"><SeverityBadge value={severity} /> {reason}</p>
        </div>
      </Modal>
    </div>
  );
}

// ── Recall management actions (shown when the batch has a recall) ─────────
type ActionKind = "recover" | "dispose" | "reconcile" | "close" | "cancel";

function RecallActions({ batchId, details, reload }: { batchId: string; details: any; reload: () => Promise<void> }) {
  const [action, setAction] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [skuId, setSkuId] = useState("");
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [unavailable, setUnavailable] = useState<Record<string, string>>({});
  const recall = details.recall;
  const skus: any[] = details.skus || [];
  const traced = recall.step !== "INITIATED";
  const recoverable = skus.filter((s) => s.outstandingQty > 0);
  const quarantinedLots = (details.lots || []).filter((l: any) => (l.status === "BLOCKED" || l.status === "RETURNED") && l.currentQty > 0);
  const recon = recall.reconciliation;
  const canClose = recall.lifecycle === "RECONCILED" && (recon?.outstandingTotal || 0) === 0;
  const reconOutstanding = skus.reduce((t, s) => t + Math.max(0, s.outstandingQty - Number(unavailable[s.inventoryItemId] || 0)), 0);

  const open = (k: ActionKind) => {
    setAction(k); setQty(""); setNote("");
    if (k === "recover") setSkuId(recoverable[0]?.inventoryItemId || "");
    if (k === "dispose") setLotId(quarantinedLots[0]?.id || "");
    if (k === "reconcile") {
      const prev: any[] = recon?.lines || [];
      setUnavailable(Object.fromEntries(skus.map((s) => [s.inventoryItemId, String(prev.find((l) => l.inventoryItemId === s.inventoryItemId)?.unavailableQty ?? 0)])));
    }
  };
  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setAction(null); await reload(); }
    catch (err: any) { toast.error(err?.response?.data?.error || "Action failed"); }
    finally { setBusy(false); }
  };
  const submit = () => {
    if (action === "recover") {
      const lots: any[] = details.lots || [];
      const lot = lots.find((l) => l.inventoryItemId === skuId && !l.returnLot) || lots.find((l) => l.inventoryItemId === skuId);
      if (!lot) return toast.error("Select a SKU");
      return run(() => recallApi.recover(batchId, { inventoryBatchId: lot.id, returnedQty: Number(qty), note: note.trim() || undefined }), "Recovered stock recorded in quarantine");
    }
    if (action === "dispose") return run(() => recallApi.dispose(batchId, { inventoryBatchId: lotId, quantity: Number(qty), note: note.trim() }), "Disposal recorded");
    if (action === "reconcile") {
      return run(() => recallApi.reconcile(batchId, {
        lines: skus.map((s) => ({ inventoryItemId: s.inventoryItemId, unavailableQty: Number(unavailable[s.inventoryItemId] || 0) })),
        notes: note.trim(),
      }), "Reconciliation recorded");
    }
    if (action === "close") return run(() => recallApi.complete(batchId, note.trim()), "Recall closed");
    if (action === "cancel") return run(() => recallApi.cancel(batchId, note.trim()), "Recall cancelled — blocked stock released");
  };
  const retryTrace = () => run(async () => {
    await recallApi.locateDistribution(batchId);
    await recallApi.blockSales(batchId);
    await recallApi.generateReport(batchId);
  }, "Distribution traced");

  const btn = "px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:border-[#f58220]";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!traced && <button onClick={retryTrace} disabled={busy} className="px-3 py-1.5 rounded-lg bg-[#f58220] text-white text-xs font-bold flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Trace distribution</button>}
        {traced && <button onClick={() => open("recover")} disabled={!recoverable.length} className={btn}><Undo2 className="h-3.5 w-3.5" /> Record Recovery</button>}
        <button onClick={() => open("dispose")} disabled={!quarantinedLots.length} className={btn}><Trash2 className="h-3.5 w-3.5" /> Dispose</button>
        {traced && <button onClick={() => open("reconcile")} className={clsx(btn, "text-blue-700 dark:text-blue-300")}><ClipboardCheck className="h-3.5 w-3.5" /> Reconcile</button>}
        <button onClick={() => open("close")} disabled={!canClose} title={!canClose ? "Reconcile with nothing outstanding first" : undefined}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"><Lock className="h-3.5 w-3.5" /> Close Recall</button>
        <button onClick={() => open("cancel")} className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> Cancel Recall</button>
      </div>
      {recon && (
        <p className={clsx("mt-2 text-xs flex items-center gap-1.5", recon.current ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-400")}>
          <ClipboardCheck className="h-3.5 w-3.5" />
          {recon.current
            ? `Reconciled ${fmtDate(recon.at, true)} — ${recon.outstandingTotal > 0 ? `${fmt(recon.outstandingTotal)} still outstanding` : "nothing outstanding, ready to close"}.`
            : "Stock has changed since the last reconciliation — reconcile again before closing."}
        </p>
      )}

      <Modal isOpen={!!action} onClose={() => !busy && setAction(null)} size={action === "reconcile" ? "lg" : "md"}
        title={action === "recover" ? "Record recovered stock" : action === "dispose" ? "Dispose quarantined stock" : action === "reconcile" ? "Reconcile recall" : action === "close" ? "Close recall" : "Cancel recall & release stock"}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button onClick={() => setAction(null)} disabled={busy} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-semibold">Back</button>
            <button onClick={submit} disabled={busy}
              className={clsx("px-4 py-2 rounded-lg text-white text-sm font-bold min-w-[120px] flex items-center justify-center gap-1.5",
                action === "cancel" || action === "dispose" ? "bg-rose-600 hover:bg-rose-700" : action === "close" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#f58220] hover:bg-[#e8740e]")}>
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm
            </button>
          </div>
        }>
        <div className="space-y-3 text-sm">
          {action === "recover" && (
            <>
              <p className="text-xs text-gray-500">Recovered units come back into quarantine — they are never made saleable automatically.</p>
              <div><label className={labelCls}>SKU</label>
                <select value={skuId} onChange={(e) => setSkuId(e.target.value)} className={inputCls}>
                  {recoverable.map((s) => <option key={s.inventoryItemId} value={s.inventoryItemId}>{s.name} — {fmt(s.outstandingQty)} {s.unit} outstanding</option>)}
                </select></div>
              <div><label className={labelCls}>Quantity recovered</label><input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Recovered from (customer / franchise / distributor)</label><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></div>
            </>
          )}
          {action === "dispose" && (
            <>
              <p className="text-xs text-gray-500">Deducts the stock and records it as recall wastage. Only quarantined stock can be disposed.</p>
              <div><label className={labelCls}>Quarantined lot</label>
                <select value={lotId} onChange={(e) => setLotId(e.target.value)} className={inputCls}>
                  {quarantinedLots.map((l: any) => <option key={l.id} value={l.id}>{l.name} · {l.warehouse || l.scope} — {fmt(l.currentQty)} {l.unit}{l.returnLot ? " (recovered)" : ""}</option>)}
                </select></div>
              <div><label className={labelCls}>Quantity disposed</label><input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Disposal method / witness *</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Destroyed under supervision of QA head" className={inputCls} /></div>
            </>
          )}
          {action === "reconcile" && (
            <>
              <p className="text-xs text-gray-500">For each SKU, enter how much distributed stock can no longer be recovered (sold and consumed). Outstanding must be 0 to close.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[560px]">
                  <thead><tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100 dark:border-white/5">
                    <th className="text-left py-2">SKU</th><th className="text-right">Dispatched</th><th className="text-right">Recovered</th><th className="text-right">Disposed</th><th className="text-right">Quarantined</th><th className="text-right w-28">Unavailable</th><th className="text-right">Outstanding</th>
                  </tr></thead>
                  <tbody>
                    {skus.map((s) => {
                      const out = Math.max(0, s.outstandingQty - Number(unavailable[s.inventoryItemId] || 0));
                      return (
                        <tr key={s.inventoryItemId} className="border-b border-gray-50 dark:border-white/5">
                          <td className="py-2 font-semibold">{s.name}<span className="block text-[10px] text-gray-400">{s.unit}</span></td>
                          <td className="text-right tabular-nums">{fmt(s.distributedQty)}</td>
                          <td className="text-right tabular-nums">{fmt(s.recoveredQty)}</td>
                          <td className="text-right tabular-nums">{fmt(s.disposedQty)}</td>
                          <td className="text-right tabular-nums">{fmt(s.quarantinedQty)}</td>
                          <td className="text-right">
                            <input type="number" min="0" max={s.outstandingQty} step="any" disabled={s.outstandingQty <= 0}
                              value={unavailable[s.inventoryItemId] ?? "0"} onChange={(e) => setUnavailable((p) => ({ ...p, [s.inventoryItemId]: e.target.value }))}
                              className="w-24 border border-gray-200 dark:border-white/10 rounded px-2 py-1 text-right bg-white dark:bg-[#13151f] disabled:opacity-40" />
                          </td>
                          <td className={clsx("text-right font-bold tabular-nums", out > 0 ? "text-amber-600" : "text-emerald-600")}>{fmt(out)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={clsx("text-xs font-semibold", reconOutstanding > 0 ? "text-amber-700" : "text-emerald-700")}>
                {reconOutstanding > 0 ? `${fmt(reconOutstanding)} will remain outstanding — the recall cannot be closed yet.` : "Nothing outstanding — the recall can be closed after this."}
              </p>
              <div><label className={labelCls}>Reconciliation notes *</label><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How unavailable quantities were confirmed, decision on remaining quarantined stock…" className={clsx(inputCls, "resize-none")} /></div>
            </>
          )}
          {action === "close" && (
            <>
              <p className="text-xs text-gray-500">Closing documents the recall as complete. Any stock still quarantined stays blocked and can never be sold or packed.</p>
              <div><label className={labelCls}>Closure note *</label><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Outcome, regulator / customer notifications sent…" className={clsx(inputCls, "resize-none")} /></div>
            </>
          )}
          {action === "cancel" && (
            <>
              <div className="flex gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Releases blocked stock of this batch back to sale. Recovered (returned) stock stays quarantined. Use only when the recall is withdrawn on documented evidence.
              </div>
              <div><label className={labelCls}>Documented reason *</label><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lab retest negative — report ref…" className={clsx(inputCls, "resize-none")} /></div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

// ── Right panel: Batch Details ─────────────────────────────────────────────
function BatchDetails({ batch, details, eligibility, loading, reload }: { batch: any; details: any; eligibility: any; loading: boolean; reload: () => Promise<void> }) {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { setShowForm(false); }, [batch.id]);

  if (loading && !details) {
    return <div className="py-24 flex justify-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-400" /></div>;
  }
  if (!details) return <p className="p-6 text-sm text-gray-500">Could not load this batch.</p>;

  const b = details.batch;
  const skus: any[] = details.skus || [];
  const recall = details.recall;
  const hasRecall = !!recall && recall.status !== "CANCELLED";
  const active = recall?.status === "IN_PROGRESS";
  const eligible = !!eligibility?.eligible;
  const qcHistorical = b.qcStatus === "APPROVED" || b.qcStatus === "PARTIALLY_APPROVED";

  const stats: { label: string; value: string; cls?: string }[] = [
    { label: "Produced Qty", value: `${fmt(b.producedQty)} ${b.unit}` },
    { label: qcHistorical ? "Approved Qty" : "Released Qty", value: b.qcStatus === "PENDING" ? "—" : `${fmt(b.releasedQty)} ${b.unit}` },
    { label: "QC Status", value: QC_LABEL[b.qcStatus] || b.qcStatus || "—" },
    { label: "Production Date", value: fmtDate(b.mfgDate) },
    { label: "Rejected Qty", value: `${fmt(b.rejectedQty)} ${b.unit}` },
    { label: "Packed Qty", value: `${fmt(b.packagedQty)} ${b.unit}` },
    { label: "Wasted Qty", value: byUnit(skus, "wastedQty") },
    { label: "Dispatched Qty", value: byUnit(skus, "distributedQty") },
    { label: hasRecall ? "Available (Warehouse, quarantined)" : "Available (Warehouse)", value: byUnit(skus, "onHandQty"), cls: hasRecall ? "text-rose-600" : undefined },
  ];
  if (b.expiryDate) stats.splice(4, 0, { label: "Expiry Date", value: fmtDate(b.expiryDate) });

  const dests = skus.flatMap((s) => (s.destinations || []).map((d: any) => ({ ...d, unit: s.unit })));
  const outlet = dests.filter((d) => d.type === "FRANCHISE_DISPATCH" || d.type === "TRANSFER");
  const sales = dests.filter((d) => d.type === "POS_SALE" || d.type === "DELIVERY_CHALLAN" || d.type === "SALE");
  const sumDest = (list: any[]) => {
    const t: Record<string, number> = {};
    for (const d of list) t[d.unit] = (t[d.unit] || 0) + d.qty;
    return Object.entries(t).map(([u, v]) => `${fmt(v)} ${u}`).join(" · ");
  };
  const tracks = [
    { icon: Truck, title: "Batch Movement", sub: "GRN → Production → Warehouse → DC", value: `${details.lots.filter((l: any) => l.currentQty > 0).length} stock location(s) · ${details.packagings.length} packaging run(s)` },
    { icon: Store, title: "Outlet Distribution", sub: "Franchise outlets that actually received this batch", value: outlet.length ? `${outlet.length} outlet(s) · ${sumDest(outlet)}` : "Not dispatched to outlets" },
    { icon: Receipt, title: "Sales Linkage", sub: "POS invoices and challans referencing this batch", value: sales.length ? `${sales.length} reference(s) · ${sumDest(sales)}` : "No sales recorded" },
    { icon: Undo2, title: "Return Quantity", sub: "Collected stock from affected outlets", value: byUnit(skus, "recoveredQty") === "0" ? "Nothing recovered" : `${byUnit(skus, "recoveredQty")} recovered` },
  ];

  const openFile = async (id: string) => {
    try { window.open(URL.createObjectURL((await attachmentsApi.getFile(id)).data as Blob), "_blank"); }
    catch { toast.error("Could not open file"); }
  };
  const addEvidence = async (files: FileList | null) => {
    if (!files?.length || !recall) return;
    try { await uploadEvidence(recall.id, Array.from(files)); toast.success("Evidence added"); await reload(); }
    catch (err: any) { toast.error(err?.response?.data?.error || "Upload failed"); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-white/5">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white font-mono">{b.batchCode}</h2>
          <p className="text-xs text-gray-500">{b.productName}</p>
          {hasRecall && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-mono text-xs font-bold text-rose-600">{recall.recallNumber}</span>
              <LifecycleBadge value={recall.lifecycle} />
              <SeverityBadge value={recall.severity} />
              <span className="text-[11px] text-gray-500">{recall.reason}</span>
            </div>
          )}
        </div>
        {!hasRecall && isSuper && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            disabled={!eligible}
            title={!eligible ? (eligibility?.reasons || []).join(" ") : undefined}
            className="px-4 py-2 rounded-lg bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
            <ShieldAlert className="h-4 w-4" /> Initiate Recall
          </button>
        )}
      </div>
      {!hasRecall && eligibility && !eligible && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {(eligibility.reasons || []).join(" ")}</p>
      )}
      {recall?.status === "CANCELLED" && (
        <p className="text-xs text-gray-500">A previous recall ({recall.recallNumber}) was cancelled and its stock released.</p>
      )}

      {/* Quantities */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] px-3.5 py-2.5">
            <p className="text-[11px] text-gray-500 dark:text-slate-400">{s.label}</p>
            <p className={clsx("text-sm font-bold mt-0.5 tabular-nums", s.cls || "text-gray-900 dark:text-white")}>{s.value}</p>
          </div>
        ))}
      </div>

      {showForm && !hasRecall && (
        <InitiateForm batch={b} details={details} onCancel={() => setShowForm(false)} onDone={async () => { setShowForm(false); await reload(); }} />
      )}

      {hasRecall && (
        <>
          {recall.description && <p className="text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">{recall.description}<span className="block text-[10px] text-gray-400 mt-0.5">Initiated {fmtDate(recall.initiatedAt, true)}{recall.initiatedBy ? ` by ${recall.initiatedBy}` : ""}</span></p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Quarantined", key: "quarantinedQty", cls: "text-rose-600" },
              { label: "Recovered", key: "recoveredQty", cls: "text-blue-600" },
              { label: "Disposed", key: "disposedQty" },
              { label: "Outstanding", key: "outstandingQty", cls: "text-amber-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-rose-100 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5 px-3.5 py-2.5">
                <p className="text-[11px] text-gray-500">{s.label}</p>
                <p className={clsx("text-sm font-bold tabular-nums mt-0.5", s.cls || "text-gray-900 dark:text-white")}>{byUnit(skus, s.key)}</p>
              </div>
            ))}
          </div>
          {active && isSuper && <RecallActions batchId={b.id} details={details} reload={reload} />}
          {details.crossBatchCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {details.crossBatchCount} other batch(es) drew on this batch&apos;s bulk while packing — their stock is included and quarantined too.</p>
          )}
        </>
      )}

      <Section title={`Affected SKUs (${skus.length})`} icon={Box}><SkuTable skus={skus} showRecall={hasRecall} /></Section>
      <Section title="Location-wise Tracking" icon={MapPin}><LocationTable lots={details.lots} /></Section>

      <div>
        <h4 className="text-[11px] font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide mb-2">ERP Tracks</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {tracks.map((t) => (
            <div key={t.title} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-[#f58220] h-fit"><t.icon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-white">{t.title}</p>
                <p className="text-[11px] text-gray-500">{t.sub}</p>
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mt-1">{t.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasRecall && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Section title="Stock Activity" icon={History}>
            {details.activity.length === 0 ? <p className="p-4 text-xs text-gray-500">No sales, dispatches, recoveries or disposals recorded.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-72 overflow-y-auto custom-scrollbar">
                {[...details.activity].reverse().map((a: any) => (
                  <li key={a.id} className="px-4 py-2 text-xs flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className={clsx("font-bold", a.kind === "RECOVERED" ? "text-blue-600" : a.kind === "DISPOSED" ? "text-rose-600" : "text-gray-700 dark:text-slate-200")}>{a.kind.charAt(0) + a.kind.slice(1).toLowerCase()}</span>
                      {" · "}{a.name}<span className="block text-[11px] text-gray-500 truncate">{a.reference}{a.by ? ` · ${a.by}` : ""}</span>
                    </span>
                    <span className="text-right shrink-0"><span className="font-bold tabular-nums">{fmt(a.qty)} {a.unit}</span><span className="block text-[10px] text-gray-400">{fmtDate(a.at, true)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Recall Activity History" icon={ShieldAlert}>
            <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-72 overflow-y-auto custom-scrollbar">
              {[...details.events].reverse().map((e: any) => (
                <li key={e.id} className="px-4 py-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-gray-800 dark:text-slate-200">{EVENT_LABEL[e.event] || e.event}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{fmtDate(e.createdAt, true)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {e.actorName || "System"}
                    {e.details?.message ? ` — ${e.details.message}` : ""}
                    {e.details?.note ? ` — “${e.details.note}”` : ""}
                    {e.details?.notes ? ` — “${e.details.notes}”` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
          <div className="xl:col-span-2">
            <Section title="Supporting Evidence" icon={Paperclip} right={isSuper ? (
              <label className="text-[11px] font-bold text-[#f58220] cursor-pointer flex items-center gap-1"><Plus className="h-3 w-3" /> Add
                <input type="file" multiple className="hidden" accept={EVIDENCE_ACCEPT} onChange={(e) => addEvidence(e.target.files)} />
              </label>
            ) : null}>
              {details.attachments.length === 0 ? <p className="p-4 text-xs text-gray-500">No evidence attached.</p> : (
                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {details.attachments.map((f: any) => (
                    <li key={f.id} className="px-4 py-2 text-xs flex items-center justify-between gap-2">
                      <button onClick={() => openFile(f.id)} className="text-[#f58220] font-semibold hover:underline truncate">{f.fileName}</button>
                      <span className="text-gray-400 shrink-0">{Math.round(f.size / 1024)} KB · {fmtDate(f.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Recall Active" },
  { key: "RECALLED", label: "Recalled" },
  { key: "NONE", label: "No Recall" },
] as const;

function BatchRecallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("batch") || "";
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const [details, setDetails] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Production batches only — raw-material GRN lots are not recalled here.
  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productionApi.getAllBatches();
      setBatches((res.data || []).filter((b: any) => b.production && (b.quantity || 0) > 0));
    } catch {
      toast.error("Failed to load production batches");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  const loadDetails = useCallback(async () => {
    if (!selectedId) { setDetails(null); setEligibility(null); return; }
    setDetailsLoading(true);
    try {
      const [d, e] = await Promise.all([
        recallApi.getDetails(selectedId),
        recallApi.getEligibility(selectedId).catch(() => ({ data: null })),
      ]);
      setDetails(d.data);
      setEligibility(e.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load batch");
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedId]);
  useEffect(() => { setDetails(null); loadDetails(); }, [loadDetails]);

  const reload = useCallback(async () => { await Promise.all([loadDetails(), loadBatches()]); }, [loadDetails, loadBatches]);

  const select = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("batch", id);
    router.push(`/production/batch-recall?${p}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) => {
      const st = b.recall?.status;
      const matchFilter = filter === "ALL"
        || (filter === "ACTIVE" && st === "IN_PROGRESS")
        || (filter === "RECALLED" && st === "COMPLETED")
        || (filter === "NONE" && (!st || st === "CANCELLED"));
      const name = (b.product?.name || b.production?.recipe?.name || "").toLowerCase();
      return matchFilter && (!q || b.batchCode?.toLowerCase().includes(q) || name.includes(q));
    });
  }, [batches, search, filter]);

  const selectedBatch = batches.find((b) => b.id === selectedId) || (details ? { id: selectedId } : null);
  const activeCount = batches.filter((b) => b.recall?.status === "IN_PROGRESS").length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Top bar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-rose-600" />
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Batch Recall</h1>
            <p className="text-[11px] text-gray-500">{activeCount} active recall{activeCount === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch code or product…" className={clsx(inputCls, "pl-9 pr-8")} />
          {search && <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer" onClick={() => setSearch("")} />}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 py-5 space-y-5">
        <Pipeline details={details} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Batch Registry */}
          <div className="lg:col-span-4 bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5"><Package className="h-4 w-4 text-[#f58220]" /> Batch Registry</h3>
                  <p className="text-[11px] text-gray-400">{filtered.length} batch{filtered.length === 1 ? "" : "es"} found</p>
                </div>
                <button onClick={loadBatches} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5" title="Refresh"><RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={clsx("px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer",
                      filter === f.key ? "bg-[#f58220] text-white border-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-[#f58220]")}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {loading && batches.length === 0 ? (
              <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-orange-400" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-xs text-gray-400">No production batches match.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {filtered.map((b) => {
                  const badge = batchRecallBadge(b);
                  const unit = b.production?.recipe?.yieldUnit || "KG";
                  return (
                    <li key={b.id}>
                      <button onClick={() => select(b.id)}
                        className={clsx("w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer border-l-4",
                          b.id === selectedId ? "bg-orange-50 dark:bg-orange-500/10 border-[#f58220]" : "border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.02]")}>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-mono font-bold text-gray-700 dark:text-slate-300">{b.batchCode}</span>
                          <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{b.product?.name || b.production?.recipe?.name}</span>
                          <span className="block text-[11px] text-gray-400">{fmt(b.quantity)} {unit} · {fmtDate(b.production?.startTime || b.createdAt)}</span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap", badge.cls)}>{badge.label}</span>
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Batch Details */}
          <div className="lg:col-span-8 bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-4 sm:p-5">
            {!selectedId || !selectedBatch ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShieldAlert className="h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-500">Select a batch from the registry</p>
                <p className="text-xs text-gray-400 mt-1">Its quantities, SKUs, stock locations and recall status appear here.</p>
              </div>
            ) : (
              <BatchDetails batch={selectedBatch} details={details} eligibility={eligibility} loading={detailsLoading} reload={reload} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BatchRecallPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-400" /></div>}>
      <BatchRecallContent />
    </Suspense>
  );
}
