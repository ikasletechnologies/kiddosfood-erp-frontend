"use client";

import { useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, Download, Printer, CheckCircle2, Truck, Clock, XCircle, Loader2, ExternalLink, AlertTriangle, History,
} from "lucide-react";
import { clsx } from "clsx";
import { ewayBillApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/ui/Modal";

import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  S, GST_STATES, Masters, STATUS_BADGE, STATUS_LABEL, SOURCE_LABELS, TRANSACTION_TYPES,
  stateName, timeLeft, apiError, formatEwbNo, downloadJson, nowLocalInput,
} from "./ewaybill-ui";

type Action = null | "generate" | "vehicle" | "extend" | "cancel" | "delete";

interface Props {
  masters: Masters;
  row: any;
  onBack: () => void;
  onEdit: () => void;
  onChanged: (row: any | null) => void;
}

const HOUR = 3_600_000;

export default function EWayBillDetail({ masters, row, onBack, onEdit, onChanged }: Props) {
  const { showToast } = useToast();
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});

  const status: string = row.displayStatus || row.status;
  const now = Date.now();
  const validUntil = row.validUntil ? new Date(row.validUntil).getTime() : null;
  const canCancel = row.status === "GENERATED" && row.ewbDate && now - new Date(row.ewbDate).getTime() <= 24 * HOUR;
  const canExtend = row.status === "GENERATED" && validUntil && now >= validUntil - 8 * HOUR && now <= validUntil + 8 * HOUR;
  const canUpdateVehicle = row.status === "GENERATED" && (!validUntil || validUntil > now);
  const interState = row.actFromStateCode !== row.actToStateCode;

  const open = (a: Action, init: any = {}) => { setF(init); setAction(a); };

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      const res = await fn();
      showToast(ok, "success");
      setAction(null);
      // delete returns { success } rather than a row
      onChanged(res?.data?.id ? res.data : null);
    } catch (e) {
      showToast(apiError(e, "Action failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    try {
      const res = await ewayBillApi.exportJson([row.id]);
      downloadJson(res.data, `ewaybill-${row.refNumber}.json`);
      showToast("JSON downloaded — upload it on the e-way bill portal (Bulk Generation)", "success");
    } catch (e) {
      showToast(apiError(e, "Export failed"), "error");
    }
  };

  return (
    <div className={S.page}>
      <div className={clsx(S.pageHeader, "print:hidden")}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={S.btnIcon} aria-label="Back"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={S.pageTitle}>{row.ewbNumber ? `EWB ${formatEwbNo(row.ewbNumber)}` : row.refNumber}</h1>
              <span className={clsx(S.badgeBase, STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>
            </div>
            <p className={S.pageSubtitle}>{row.refNumber} · {SOURCE_LABELS[row.sourceType]} · {masters.docTypes[row.docType]} {row.docNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {row.status === "DRAFT" && (
            <>
              <button onClick={() => open("delete")} className={S.btnDanger}><Trash2 className="h-4 w-4" /> Delete</button>
              <button onClick={onEdit} className={S.btnSecondary}><Pencil className="h-4 w-4" /> Edit</button>
              <button onClick={exportJson} className={S.btnSecondary}><Download className="h-4 w-4" /> Download JSON</button>
              <button onClick={() => open("generate", { ewbDate: nowLocalInput() })} className={S.btnPrimary}><CheckCircle2 className="h-4 w-4" /> Record EWB No.</button>
            </>
          )}
          {canCancel && <button onClick={() => open("cancel")} className={S.btnDanger}><XCircle className="h-4 w-4" /> Cancel EWB</button>}
          {canExtend && (
            <button onClick={() => open("extend", { fromStateCode: String(row.actFromStateCode) })} className={S.btnSecondary}>
              <Clock className="h-4 w-4" /> Extend Validity
            </button>
          )}
          {canUpdateVehicle && (
            <button onClick={() => open("vehicle", { transMode: row.transMode || "1", fromStateCode: String(row.actFromStateCode), fromPlace: row.fromPlace || "" })} className={S.btnSecondary}>
              <Truck className="h-4 w-4" /> Update Vehicle
            </button>
          )}
          <button onClick={() => window.print()} className={S.btnSecondary}><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>

      <div className="print:p-0">
        <div className={clsx(S.container, "print:p-0 print:max-w-none")}>
          {/* Status banner */}
          {row.status === "DRAFT" && (
            <div className="print:hidden bg-orange-50/60 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl px-4 py-3 text-sm text-orange-900 dark:text-orange-200">
              <div className="font-semibold mb-1">Next step: generate on the e-way bill portal</div>
              <ol className="list-decimal pl-5 text-xs space-y-0.5 text-orange-800 dark:text-orange-300">
                <li>Click <b>Download JSON</b> and upload it at <a className="underline inline-flex items-center gap-0.5" href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer">ewaybillgst.gov.in <ExternalLink className="h-3 w-3" /></a> → e-Waybill → Generate Bulk.</li>
                <li>Copy the 12-digit E-Way Bill number the portal issues.</li>
                <li>Click <b>Record EWB No.</b> and enter it here to activate tracking.</li>
              </ol>
            </div>
          )}
          {status === "GENERATED" && validUntil && (
            <div className={clsx("print:hidden rounded-xl px-4 py-3 text-sm border flex items-center gap-2",
              validUntil - now < 24 * HOUR ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300" : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300")}>
              <Clock className="h-4 w-4" />
              Valid until <b>{formatDateTime(row.validUntil)}</b> · {timeLeft(row.validUntil)}
              {canExtend && <span className="ml-auto text-xs">Extension window open</span>}
            </div>
          )}
          {status === "GENERATED" && !validUntil && (
            <div className="print:hidden rounded-xl px-4 py-3 text-sm border bg-amber-50 border-amber-200 text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Part B not entered — the goods cannot move until vehicle details are updated.
            </div>
          )}
          {status === "EXPIRED" && (
            <div className="print:hidden rounded-xl px-4 py-3 text-sm border bg-amber-50 border-amber-200 text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Expired on {formatDateTime(row.validUntil)}.
              {canExtend ? " You can still extend it (within 8 hours of expiry)." : " The extension window has closed — generate a new E-Way Bill."}
            </div>
          )}
          {row.status === "CANCELLED" && (
            <div className="print:hidden rounded-xl px-4 py-3 text-sm border bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Cancelled on {formatDateTime(row.cancelledAt)} — {masters.cancelReasons[row.cancelReason] || row.cancelReason}
              {row.cancelRemarks ? ` (${row.cancelRemarks})` : ""}
            </div>
          )}

          {/* EWB-01 printable layout */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl shadow-2xs print:shadow-none print:border-0 print:rounded-none print:bg-white print:text-black">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-[#f58220]">e-Way Bill</div>
                <div className="text-xs text-gray-500 dark:text-slate-400">Form GST EWB-01 · Rule 138</div>
              </div>
              <div className="text-right text-sm">
                <div><span className="text-gray-500 dark:text-slate-400">E-Way Bill No: </span><span className="font-bold font-mono text-orange-600 dark:text-orange-400 tracking-wide">{formatEwbNo(row.ewbNumber)}</span></div>
                <div><span className="text-gray-500 dark:text-slate-400">Generated: </span>{row.ewbDate ? formatDateTime(row.ewbDate) : "—"}</div>
                <div><span className="text-gray-500 dark:text-slate-400">Valid Upto: </span>{row.validUntil ? formatDateTime(row.validUntil) : "—"}</div>
              </div>
            </div>

            <Block title="Part A">
              <Grid>
                <KV k="Supply Type" v={`${row.supplyType === "O" ? "Outward" : "Inward"} - ${masters.subSupplyTypes[row.subSupplyType] || ""}${row.subSupplyDesc ? ` (${row.subSupplyDesc})` : ""}`} />
                <KV k="Document" v={`${masters.docTypes[row.docType]} - ${row.docNo} - ${formatDate(row.docDate)}`} />
                <KV k="Transaction Type" v={TRANSACTION_TYPES[String(row.transactionType)]} />
                <KV k="Value of Goods" v={formatCurrency(row.totInvValue)} />
              </Grid>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <Party title="From" gstin={row.fromGstin} name={row.fromTradeName} addr={[row.fromAddr1, row.fromAddr2, row.fromPlace].filter(Boolean).join(", ")}
                  pin={row.fromPincode} state={stateName(row.fromStateCode)} act={row.actFromStateCode !== row.fromStateCode ? `Dispatch from: ${stateName(row.actFromStateCode)}` : null} />
                <Party title="To" gstin={row.toGstin} name={row.toTradeName} addr={[row.toAddr1, row.toAddr2, row.toPlace].filter(Boolean).join(", ")}
                  pin={row.toPincode} state={stateName(row.toStateCode)} act={row.actToStateCode !== row.toStateCode ? `Ship to: ${stateName(row.actToStateCode)}` : null} />
              </div>
            </Block>

            <Block title="Goods">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] uppercase text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/10">
                      <th className="text-left py-2 pr-2">#</th>
                      <th className="text-left py-2 pr-2">Product</th>
                      <th className="text-left py-2 pr-2">HSN</th>
                      <th className="text-right py-2 pr-2">Qty</th>
                      <th className="text-right py-2 pr-2">Taxable</th>
                      <th className="text-right py-2">Tax Rate ({interState ? "IGST" : "C+S"}{row.cessValue ? "+Cess" : ""})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items?.map((i: any) => (
                      <tr key={i.id} className="border-b border-gray-50 dark:border-white/5">
                        <td className="py-2 pr-2 text-gray-400 dark:text-slate-500">{i.itemNo}</td>
                        <td className="py-2 pr-2 text-gray-800 dark:text-slate-200">{i.productName}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{i.hsnCode}</td>
                        <td className="py-2 pr-2 text-right">{i.quantity} {i.qtyUnit}</td>
                        <td className="py-2 pr-2 text-right">{formatCurrency(i.taxableAmount)}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-slate-300">
                          {interState ? `${i.igstRate}%` : `${i.cgstRate}% + ${i.sgstRate}%`}{i.cessRate ? ` + ${i.cessRate}%` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3 text-xs">
                <Amt k="Taxable" v={row.totalValue} />
                <Amt k="CGST" v={row.cgstValue} />
                <Amt k="SGST" v={row.sgstValue} />
                <Amt k="IGST" v={row.igstValue} />
                <Amt k="Cess + Other" v={(row.cessValue || 0) + (row.otherValue || 0)} />
                <Amt k="Total Inv. Value" v={row.totInvValue} strong />
              </div>
            </Block>

            <Block title="Part B" last>
              <Grid>
                <KV k="Mode" v={row.transMode ? masters.transModes[row.transMode] : "Not entered"} />
                <KV k="Approx Distance" v={`${row.transDistance} km`} />
                <KV k={row.transMode && row.transMode !== "1" ? "Transport Doc" : "Vehicle No."}
                  v={row.transMode && row.transMode !== "1" ? `${row.transDocNo || "—"} ${row.transDocDate ? `- ${formatDate(row.transDocDate)}` : ""}` : `${row.vehicleNo || "—"}${row.vehicleType === "O" ? " (ODC)" : ""}`} />
                <KV k="Transporter" v={[row.transporterName, row.transporterId].filter(Boolean).join(" · ") || "—"} />
              </Grid>
            </Block>
          </div>

          {row.vehicleUpdates?.length > 0 && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl shadow-2xs overflow-hidden print:hidden">
              <div className={S.cardHead}>
                <span className={S.cardHeadTitle}><History className="h-3.5 w-3.5 text-[#f58220]" /> Part B History</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {row.vehicleUpdates.map((u: any) => (
                  <li key={u.id} className="px-5 py-3 text-sm flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-slate-200">
                        {u.kind === "EXTENSION"
                          ? `Validity extended to ${formatDateTime(u.validUntil)} (${u.remainingKm} km remaining)`
                          : `Vehicle ${u.vehicleNo || u.transDocNo || "—"} · ${masters.transModes[u.transMode] || ""}`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {u.kind === "EXTENSION" ? masters.extensionReasons[u.reasonCode] : masters.vehicleUpdateReasons[u.reasonCode]}
                        {u.reasonRemarks ? ` — ${u.reasonRemarks}` : ""} · from {u.fromPlace}, {stateName(u.fromStateCode)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{formatDateTime(u.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {row.notes && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl shadow-2xs p-4 sm:p-5 text-sm text-gray-600 dark:text-slate-300 print:hidden">
              <div className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase mb-1">Internal Notes</div>
              {row.notes}
            </div>
          )}
        </div>
      </div>

      {/* ── Action modals ─────────────────────────────────────────────── */}
      <Modal isOpen={action === "generate"} onClose={() => setAction(null)} title="Record E-Way Bill Number" size="sm"
        footer={<Footer busy={busy} onCancel={() => setAction(null)} label="Mark as Generated"
          onOk={() => run(() => ewayBillApi.markGenerated(row.id, {
            ewbNumber: f.ewbNumber, ewbDate: f.ewbDate ? new Date(f.ewbDate).toISOString() : undefined,
            validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : undefined,
          }), "E-Way Bill marked as generated")} />}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">Enter the number issued by the e-way bill portal for {row.docType} {row.docNo}.</p>
          <L label="E-Way Bill No. (12 digits)" required>
            <input className={clsx(S.input, "font-mono tracking-wider")} inputMode="numeric" maxLength={14} autoFocus
              value={f.ewbNumber || ""} onChange={(e) => setF({ ...f, ewbNumber: e.target.value.replace(/[^\d]/g, "") })} placeholder="3410 1234 5678" />
          </L>
          <L label="Generated Date & Time">
            <input type="datetime-local" className={S.input} value={f.ewbDate || ""} onChange={(e) => setF({ ...f, ewbDate: e.target.value })} />
          </L>
          <L label="Valid Upto (optional — as printed by portal)">
            <input type="datetime-local" className={S.input} value={f.validUntil || ""} onChange={(e) => setF({ ...f, validUntil: e.target.value })} />
          </L>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">Leave blank to calculate from distance: {row.transDistance} km → {Math.max(1, Math.ceil(row.transDistance / (row.vehicleType === "O" ? 20 : 200)))} day(s).</p>
        </div>
      </Modal>

      <Modal isOpen={action === "vehicle"} onClose={() => setAction(null)} title="Update Vehicle (Part B)" size="sm"
        footer={<Footer busy={busy} onCancel={() => setAction(null)} label="Update"
          onOk={() => run(() => ewayBillApi.updateVehicle(row.id, { ...f, fromStateCode: Number(f.fromStateCode) }), "Vehicle updated")} />}>
        <div className="space-y-3">
          <L label="Mode">
            <select className={S.select} value={f.transMode} onChange={(e) => setF({ ...f, transMode: e.target.value })}>
              {Object.entries(masters.transModes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          {f.transMode === "1" ? (
            <L label="New Vehicle No." required>
              <input className={S.input} value={f.vehicleNo || ""} onChange={(e) => setF({ ...f, vehicleNo: e.target.value.toUpperCase() })} placeholder="TN01AB1234" />
            </L>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <L label="Transport Doc No." required><input className={S.input} value={f.transDocNo || ""} onChange={(e) => setF({ ...f, transDocNo: e.target.value })} /></L>
              <L label="Doc Date" required><input type="date" className={S.input} value={f.transDocDate || ""} onChange={(e) => setF({ ...f, transDocDate: e.target.value })} /></L>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <L label="Current Place" required><input className={S.input} value={f.fromPlace || ""} onChange={(e) => setF({ ...f, fromPlace: e.target.value })} /></L>
            <L label="Current State" required><StateSelect value={f.fromStateCode} onChange={(v) => setF({ ...f, fromStateCode: v })} /></L>
          </div>
          <L label="Reason" required>
            <select className={S.select} value={f.reasonCode || ""} onChange={(e) => setF({ ...f, reasonCode: e.target.value })}>
              <option value="">Select reason</option>
              {Object.entries(masters.vehicleUpdateReasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L label="Remarks"><input className={S.input} value={f.reasonRemarks || ""} onChange={(e) => setF({ ...f, reasonRemarks: e.target.value })} /></L>
        </div>
      </Modal>

      <Modal isOpen={action === "extend"} onClose={() => setAction(null)} title="Extend Validity" size="sm"
        footer={<Footer busy={busy} onCancel={() => setAction(null)} label="Extend"
          onOk={() => run(() => ewayBillApi.extendValidity(row.id, { ...f, remainingKm: Number(f.remainingKm), fromStateCode: Number(f.fromStateCode) }), "Validity extended")} />}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">Allowed from 8 hours before to 8 hours after expiry. New validity is counted from now over the remaining distance.</p>
          <div className="grid grid-cols-2 gap-3">
            <L label="Current Place" required><input className={S.input} value={f.fromPlace || ""} onChange={(e) => setF({ ...f, fromPlace: e.target.value })} /></L>
            <L label="Current State" required><StateSelect value={f.fromStateCode} onChange={(v) => setF({ ...f, fromStateCode: v })} /></L>
          </div>
          <L label="Remaining Distance (km)" required>
            <input type="number" min={1} className={S.input} value={f.remainingKm || ""} onChange={(e) => setF({ ...f, remainingKm: e.target.value })} />
          </L>
          <L label="Reason" required>
            <select className={S.select} value={f.reasonCode || ""} onChange={(e) => setF({ ...f, reasonCode: e.target.value })}>
              <option value="">Select reason</option>
              {Object.entries(masters.extensionReasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L label="Remarks"><input className={S.input} value={f.reasonRemarks || ""} onChange={(e) => setF({ ...f, reasonRemarks: e.target.value })} /></L>
        </div>
      </Modal>

      <Modal isOpen={action === "cancel"} onClose={() => setAction(null)} title="Cancel E-Way Bill" size="sm"
        footer={<Footer busy={busy} onCancel={() => setAction(null)} label="Cancel E-Way Bill" danger
          onOk={() => run(() => ewayBillApi.cancel(row.id, f), "E-Way Bill cancelled")} />}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Cancel it on the portal as well. Cancellation is only allowed within 24 hours of generation
            {row.ewbDate ? ` (until ${formatDateTime(new Date(new Date(row.ewbDate).getTime() + 24 * HOUR))})` : ""}.
          </p>
          <L label="Reason" required>
            <select className={S.select} value={f.reasonCode || ""} onChange={(e) => setF({ ...f, reasonCode: e.target.value })}>
              <option value="">Select reason</option>
              {Object.entries(masters.cancelReasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L label="Remarks"><input className={S.input} value={f.remarks || ""} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></L>
        </div>
      </Modal>

      <Modal isOpen={action === "delete"} onClose={() => setAction(null)} title="Delete Draft" size="sm"
        footer={<Footer busy={busy} onCancel={() => setAction(null)} label="Delete" danger
          onOk={() => run(() => ewayBillApi.remove(row.id), "Draft deleted")} />}>
        <p className="text-sm text-gray-600 dark:text-slate-300">Delete draft {row.refNumber} for {row.docType} {row.docNo}? This cannot be undone.</p>
      </Modal>
    </div>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────
function Block({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={clsx("px-6 py-4", !last && "border-b border-gray-200 dark:border-white/10")}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">{title}</div>
      {children}
    </div>
  );
}
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>;
const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div><div className="text-[11px] text-gray-400 dark:text-slate-500">{k}</div><div className="text-sm text-gray-800 dark:text-slate-200">{v || "—"}</div></div>
);
const Amt = ({ k, v, strong }: { k: string; v: number; strong?: boolean }) => (
  <div className={clsx("rounded-lg px-3 py-2", strong ? "bg-orange-50 dark:bg-orange-500/10" : "bg-gray-50 dark:bg-white/[0.03]")}>
    <div className="text-gray-400 dark:text-slate-500">{k}</div>
    <div className={clsx("text-sm", strong ? "font-bold font-mono text-[#f58220]" : "font-mono font-semibold text-gray-800 dark:text-white")}>{formatCurrency(v)}</div>
  </div>
);
function Party({ title, gstin, name, addr, pin, state, act }: { title: string; gstin: string; name: string; addr: string; pin: string; state: string; act: string | null }) {
  return (
    <div className="border border-gray-100 dark:border-white/5 rounded-lg p-3">
      <div className="text-[11px] text-gray-400 dark:text-slate-500 mb-1">{title}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{name}</div>
      <div className="text-xs font-mono text-gray-600 dark:text-slate-300">GSTIN: {gstin}</div>
      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{addr}{addr ? ", " : ""}{state} - {pin}</div>
      {act && <div className="text-xs text-gray-500 dark:text-slate-400">{act}</div>}
    </div>
  );
}
function L({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className={S.label}>{label}{required && <span className="text-red-500"> *</span>}</span>{children}</label>;
}
function StateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className={S.select} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select</option>
      {GST_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
    </select>
  );
}
function Footer({ busy, onCancel, onOk, label, danger }: { busy: boolean; onCancel: () => void; onOk: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className={S.btnSecondary}>Close</button>
      <button onClick={onOk} disabled={busy} className={danger ? S.btnDangerSolid : S.btnPrimary}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </button>
    </div>
  );
}
