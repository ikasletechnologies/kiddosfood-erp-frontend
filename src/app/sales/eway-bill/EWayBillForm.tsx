"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Loader2, Search, FileText, Truck, Package, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { clsx } from "clsx";
import { ewayBillApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  S, GST_STATES, UQC_OPTIONS, TRANSACTION_TYPES, SOURCE_LABELS, Masters,
  round2, previewValidUntil, apiError,
} from "./ewaybill-ui";

interface FormItem {
  key: string;
  productName: string;
  productDesc: string;
  hsnCode: string;
  quantity: number;
  qtyUnit: string;
  taxableAmount: number;
  gstRate: number;
  cessRate: number;
}

const blankItem = (): FormItem => ({
  key: Math.random().toString(36).slice(2), productName: "", productDesc: "", hsnCode: "",
  quantity: 1, qtyUnit: "NOS", taxableAmount: 0, gstRate: 5, cessRate: 0,
});

const toFormItems = (items: any[] = []): FormItem[] =>
  items.map((i) => ({
    key: Math.random().toString(36).slice(2),
    productName: i.productName || "",
    productDesc: i.productDesc || "",
    hsnCode: i.hsnCode || "",
    quantity: Number(i.quantity) || 0,
    qtyUnit: i.qtyUnit || "NOS",
    taxableAmount: Number(i.taxableAmount) || 0,
    gstRate: Number(i.igstRate) || (Number(i.cgstRate) || 0) + (Number(i.sgstRate) || 0),
    cessRate: Number(i.cessRate) || 0,
  }));

const dateInput = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function emptyForm(consignor: any) {
  return {
    sourceType: "MANUAL", sourceId: "",
    supplyType: "O", subSupplyType: "1", subSupplyDesc: "", docType: "INV", docNo: "", docDate: dateInput(new Date()),
    transactionType: "1",
    fromGstin: consignor?.fromGstin || "", fromTradeName: consignor?.fromTradeName || "", fromAddr1: consignor?.fromAddr1 || "",
    fromAddr2: "", fromPlace: consignor?.fromPlace || "", fromPincode: consignor?.fromPincode || "",
    fromStateCode: consignor?.fromStateCode ? String(consignor.fromStateCode) : "", actFromStateCode: consignor?.actFromStateCode ? String(consignor.actFromStateCode) : "",
    toGstin: "URP", toTradeName: "", toAddr1: "", toAddr2: "", toPlace: "", toPincode: "", toStateCode: "", actToStateCode: "",
    otherValue: 0,
    transMode: "1", transDistance: 0, vehicleType: "R", vehicleNo: "", transporterId: "", transporterName: "", transDocNo: "", transDocDate: "",
    notes: "",
  };
}

type FormState = ReturnType<typeof emptyForm>;

function fromRecord(r: any): FormState {
  const s = (v: any) => (v === null || v === undefined ? "" : String(v));
  return {
    sourceType: r.sourceType || "MANUAL", sourceId: s(r.sourceId),
    supplyType: r.supplyType || "O", subSupplyType: s(r.subSupplyType) || "1", subSupplyDesc: s(r.subSupplyDesc),
    docType: r.docType || "INV", docNo: s(r.docNo), docDate: dateInput(r.docDate), transactionType: s(r.transactionType) || "1",
    fromGstin: s(r.fromGstin), fromTradeName: s(r.fromTradeName), fromAddr1: s(r.fromAddr1), fromAddr2: s(r.fromAddr2),
    fromPlace: s(r.fromPlace), fromPincode: s(r.fromPincode), fromStateCode: s(r.fromStateCode), actFromStateCode: s(r.actFromStateCode || r.fromStateCode),
    toGstin: s(r.toGstin) || "URP", toTradeName: s(r.toTradeName), toAddr1: s(r.toAddr1), toAddr2: s(r.toAddr2),
    toPlace: s(r.toPlace), toPincode: s(r.toPincode), toStateCode: s(r.toStateCode), actToStateCode: s(r.actToStateCode || r.toStateCode),
    otherValue: Number(r.otherValue) || 0,
    transMode: s(r.transMode), transDistance: Number(r.transDistance) || 0, vehicleType: r.vehicleType || "R",
    vehicleNo: s(r.vehicleNo), transporterId: s(r.transporterId), transporterName: s(r.transporterName),
    transDocNo: s(r.transDocNo), transDocDate: dateInput(r.transDocDate), notes: s(r.notes),
  };
}

interface Props {
  masters: Masters;
  editing?: any | null;
  onCancel: () => void;
  onSaved: (row: any) => void;
}

export default function EWayBillForm({ masters, editing, onCancel, onSaved }: Props) {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(() => (editing ? fromRecord(editing) : emptyForm(masters.consignor)));
  const [items, setItems] = useState<FormItem[]>(() => (editing ? toFormItems(editing.items) : [blankItem()]));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Source picker (create only)
  const [sourceTab, setSourceTab] = useState<string>(editing ? editing.sourceType : "SALE_INVOICE");
  const [sources, setSources] = useState<any[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [loadingSources, setLoadingSources] = useState(false);
  const [prefilling, setPrefilling] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (editing || sourceTab === "MANUAL") return;
    const t = setTimeout(async () => {
      setLoadingSources(true);
      try {
        const res = await ewayBillApi.getSources(sourceTab, sourceSearch || undefined);
        setSources(res.data || []);
      } catch (e) {
        showToast(apiError(e, "Failed to load documents"), "error");
      } finally {
        setLoadingSources(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [sourceTab, sourceSearch, editing]);

  const pickSource = async (doc: any) => {
    setPrefilling(doc.id);
    try {
      const res = await ewayBillApi.prefill(sourceTab, doc.id);
      const p = res.data;
      setForm(fromRecord(p));
      setItems(p.items?.length ? toFormItems(p.items) : [blankItem()]);
      setErrors([]);
      showToast(`Loaded ${SOURCE_LABELS[sourceTab]} ${doc.docNo}`, "success");
    } catch (e) {
      showToast(apiError(e, "Could not load document"), "error");
    } finally {
      setPrefilling(null);
    }
  };

  const startManual = () => {
    setSourceTab("MANUAL");
    setForm(emptyForm(masters.consignor));
    setItems([blankItem()]);
    setErrors([]);
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const allowedSubTypes = masters.supplyDocMatrix[form.supplyType] || {};
  const allowedDocs = allowedSubTypes[form.subSupplyType] || [];
  const actFrom = Number(form.actFromStateCode || form.fromStateCode);
  const actTo = Number(form.actToStateCode || form.toStateCode);
  const interState = !!actFrom && !!actTo && actFrom !== actTo;

  const totals = useMemo(() => {
    let taxable = 0, cgst = 0, sgst = 0, igst = 0, cess = 0;
    items.forEach((i) => {
      const t = Number(i.taxableAmount) || 0;
      taxable += t;
      if (interState) igst += (t * i.gstRate) / 100;
      else { cgst += (t * i.gstRate) / 200; sgst += (t * i.gstRate) / 200; }
      cess += (t * i.cessRate) / 100;
    });
    const other = Number(form.otherValue) || 0;
    const total = taxable + cgst + sgst + igst + cess + other;
    return { taxable: round2(taxable), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst), cess: round2(cess), other, total: round2(total) };
  }, [items, interState, form.otherValue]);

  const validityPreview = previewValidUntil(Number(form.transDistance), form.vehicleType);

  // Keep sub-type / doc-type combination valid when the parent changes.
  const changeSupplyType = (supplyType: string) => {
    const subs = Object.keys(masters.supplyDocMatrix[supplyType] || {});
    const sub = subs.includes(form.subSupplyType) ? form.subSupplyType : subs[0];
    const docs = masters.supplyDocMatrix[supplyType]?.[sub] || [];
    set({ supplyType, subSupplyType: sub, docType: docs.includes(form.docType) ? form.docType : docs[0] });
  };
  const changeSubType = (sub: string) => {
    const docs = allowedSubTypes[sub] || [];
    set({ subSupplyType: sub, docType: docs.includes(form.docType) ? form.docType : docs[0] });
  };

  // A registered GSTIN fixes the state; auto-select it.
  const changeGstin = (prefix: "from" | "to", raw: string) => {
    const v = raw.toUpperCase().replace(/\s/g, "");
    const patch: any = { [`${prefix}Gstin`]: v };
    const code = /^\d{2}/.test(v) ? Number(v.slice(0, 2)) : null;
    if (code && GST_STATES.some((s) => s.code === code)) {
      patch[`${prefix}StateCode`] = String(code);
      const actKey = prefix === "from" ? "actFromStateCode" : "actToStateCode";
      if (!(form as any)[actKey]) patch[actKey] = String(code);
    }
    set(patch);
  };

  const updateItem = (key: string, patch: Partial<FormItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  // ── Submit ──────────────────────────────────────────────────────────────
  const buildPayload = () => ({
    ...form,
    sourceId: form.sourceType === "MANUAL" ? null : form.sourceId,
    transactionType: Number(form.transactionType),
    fromStateCode: Number(form.fromStateCode) || null,
    actFromStateCode: Number(form.actFromStateCode || form.fromStateCode) || null,
    toStateCode: Number(form.toStateCode) || null,
    actToStateCode: Number(form.actToStateCode || form.toStateCode) || null,
    transMode: form.transMode || null,
    transDistance: Number(form.transDistance) || 0,
    transDocDate: form.transDocDate || null,
    items: items.map((i) => ({
      productName: i.productName, productDesc: i.productDesc, hsnCode: i.hsnCode.trim(),
      quantity: Number(i.quantity), qtyUnit: i.qtyUnit, taxableAmount: Number(i.taxableAmount),
      cgstRate: interState ? 0 : i.gstRate / 2, sgstRate: interState ? 0 : i.gstRate / 2,
      igstRate: interState ? i.gstRate : 0, cessRate: Number(i.cessRate) || 0,
    })),
  });

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const payload = buildPayload();
      const res = editing ? await ewayBillApi.update(editing.id, payload) : await ewayBillApi.create(payload);
      showToast(editing ? "E-Way Bill updated" : `Draft ${res.data.refNumber} saved`, "success");
      onSaved(res.data);
    } catch (e: any) {
      const msg = apiError(e, "Failed to save E-Way Bill");
      if (e?.response?.status === 422) {
        setErrors(String(msg).split("\n"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const hasSourceLoaded = form.sourceType !== "MANUAL" && !!form.sourceId;

  return (
    <div className={S.formPage}>
      <div className={S.formHeader}>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className={S.btnIcon} aria-label="Back"><ArrowLeft size={18} /></button>
          <div>
            <h1 className={S.pageTitle}>{editing ? `Edit ${editing.refNumber}` : "New E-Way Bill"}</h1>
            <p className={S.pageSubtitle}>Form EWB-01 · Part A (consignment) and Part B (transport)</p>
          </div>
        </div>
        {hasSourceLoaded && (
          <span className="text-xs font-semibold text-[#f58220] bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-full px-3 py-1">
            From {SOURCE_LABELS[form.sourceType]} · {form.docNo}
          </span>
        )}
      </div>

      <div id="ewb-form-body" className={S.formBody}>
        <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 w-full min-w-0">
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                <AlertTriangle className="h-4 w-4" /> Fix these before saving
              </div>
              <ul className="list-disc pl-6 text-xs text-red-600 dark:text-red-300 space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* ── Source picker ─────────────────────────────────────────── */}
          {!editing && (
            <div className={S.formCard}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Create from</span>
                <div className={S.segWrap}>
                  {["SALE_INVOICE", "DELIVERY_CHALLAN", "STOCK_TRANSFER", "MANUAL"].map((t) => (
                    <button
                      key={t}
                      onClick={() => (t === "MANUAL" ? startManual() : (setSourceTab(t), setSourceSearch("")))}
                      className={clsx(
                        S.seg,
                        sourceTab === t ? S.segOn : S.segOff
                      )}
                    >
                      {SOURCE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {sourceTab === "MANUAL" ? (
                <p className="text-xs text-gray-500 dark:text-slate-400">Enter all details below. Use this for purchases, job work, or any movement not recorded as a document in the ERP.</p>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="h-4 w-4 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      className={clsx(S.input, "pl-9")}
                      placeholder={`Search ${SOURCE_LABELS[sourceTab].toLowerCase()} number or party…`}
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                    />
                  </div>
                  <div className="border border-gray-200 dark:border-white/10 rounded-xl max-h-56 overflow-y-auto custom-scrollbar">
                    {loadingSources ? (
                      <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-slate-500" /></div>
                    ) : sources.length === 0 ? (
                      <p className="py-8 text-center text-xs text-gray-400 dark:text-slate-500">No {SOURCE_LABELS[sourceTab].toLowerCase()}s found</p>
                    ) : (
                      sources.map((d) => {
                        const selected = form.sourceId === d.id;
                        const below = d.amount < masters.threshold;
                        return (
                          <button
                            key={d.id}
                            disabled={!!d.existingEwb || prefilling === d.id}
                            onClick={() => pickSource(d)}
                            className={clsx(
                              "w-full flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-50 dark:border-white/5 last:border-0 text-left transition-colors",
                              selected ? "bg-orange-50 dark:bg-orange-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5",
                              d.existingEwb && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-semibold font-mono text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                {d.docNo}
                                {selected && <CheckCircle2 className="h-3.5 w-3.5 text-[#f58220]" />}
                              </div>
                              <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{d.partyName} · {formatDate(d.date)}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs sm:text-sm font-bold font-mono text-gray-900 dark:text-white">{formatCurrency(d.amount)}</div>
                              {d.existingEwb ? (
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400">EWB {d.existingEwb.ewbNumber || d.existingEwb.refNumber}</div>
                              ) : below ? (
                                <div className="text-[11px] text-gray-400 dark:text-slate-500">Below ₹{masters.threshold.toLocaleString("en-IN")} · optional</div>
                              ) : null}
                              {prefilling === d.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f58220] ml-auto" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Transaction details ───────────────────────────────────── */}
          <Section icon={FileText} title="Transaction Details">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Supply Type">
                <select className={S.select} value={form.supplyType} onChange={(e) => changeSupplyType(e.target.value)}>
                  <option value="O">Outward</option>
                  <option value="I">Inward</option>
                </select>
              </Field>
              <Field label="Sub Supply Type">
                <select className={S.select} value={form.subSupplyType} onChange={(e) => changeSubType(e.target.value)}>
                  {Object.keys(allowedSubTypes).map((k) => <option key={k} value={k}>{masters.subSupplyTypes[k]}</option>)}
                </select>
              </Field>
              <Field label="Document Type">
                <select className={S.select} value={form.docType} onChange={(e) => set({ docType: e.target.value })}>
                  {allowedDocs.map((k) => <option key={k} value={k}>{masters.docTypes[k]}</option>)}
                </select>
              </Field>
              <Field label="Transaction Type">
                <select className={S.select} value={form.transactionType} onChange={(e) => set({ transactionType: e.target.value })}>
                  {Object.entries(TRANSACTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Document No." required>
                <input className={S.input} maxLength={16} value={form.docNo} onChange={(e) => set({ docNo: e.target.value })} placeholder="INV-2026-00001" />
              </Field>
              <Field label="Document Date" required>
                <input type="date" className={S.input} value={form.docDate} max={dateInput(new Date())} onChange={(e) => set({ docDate: e.target.value })} />
              </Field>
              {form.subSupplyType === "8" && (
                <Field label="Sub Supply Description" required className="md:col-span-2">
                  <input className={S.input} maxLength={20} value={form.subSupplyDesc} onChange={(e) => set({ subSupplyDesc: e.target.value })} />
                </Field>
              )}
            </div>
          </Section>

          {/* ── Parties ───────────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-4">
            <PartyCard title="Bill From / Dispatch From" prefix="from" form={form} set={set} changeGstin={changeGstin} />
            <PartyCard title="Bill To / Ship To" prefix="to" form={form} set={set} changeGstin={changeGstin} />
          </div>

          {/* ── Items ─────────────────────────────────────────────────── */}
          <Section
            icon={Package}
            title="Item Details"
            right={
              <span className={clsx("text-[11px] font-medium px-2 py-0.5 rounded-full border", interState ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20" : "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/20")}>
                {actFrom && actTo ? (interState ? "Inter-state · IGST" : "Intra-state · CGST + SGST") : "Select states to determine tax"}
              </span>
            }
            flush
          >
            <div className="overflow-x-auto">
              <table className={clsx(S.itemsTable, "min-w-[900px]")}>
                <thead>
                  <tr className={S.itemsThRow}>
                    <th className={clsx(S.itemsTh, "w-8 text-center")}>#</th>
                    <th className={clsx(S.itemsTh, "text-left")}>Product Name</th>
                    <th className={clsx(S.itemsTh, "text-left w-28")}>HSN</th>
                    <th className={clsx(S.itemsTh, "text-right w-24")}>Qty</th>
                    <th className={clsx(S.itemsTh, "w-24")}>Unit</th>
                    <th className={clsx(S.itemsTh, "text-right w-32")}>Taxable Value</th>
                    <th className={clsx(S.itemsTh, "w-24")}>GST %</th>
                    <th className={clsx(S.itemsTh, "text-right w-20")}>Cess %</th>
                    <th className={clsx(S.itemsTh, "text-right w-28")}>Tax</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => {
                    const tax = round2((i.taxableAmount * (i.gstRate + i.cessRate)) / 100);
                    return (
                      <tr key={i.key} className={S.itemsRow}>
                        <td className={clsx(S.itemsTd, "text-center text-xs text-gray-400 dark:text-slate-500")}>{idx + 1}</td>
                        <td className={S.itemsTd}>
                          <input className={S.itemsInput} value={i.productName} placeholder="Product name" onChange={(e) => updateItem(i.key, { productName: e.target.value })} />
                        </td>
                        <td className={S.itemsTd}>
                          <input
                            className={clsx(S.itemsInput, i.hsnCode && !/^\d{4,8}$/.test(i.hsnCode) && "text-red-600")}
                            value={i.hsnCode} placeholder="e.g. 1904" inputMode="numeric" maxLength={8}
                            onChange={(e) => updateItem(i.key, { hsnCode: e.target.value.replace(/\D/g, "") })}
                          />
                        </td>
                        <td className={S.itemsTd}>
                          <input type="number" min={0} className={clsx(S.itemsInput, "text-right")} value={i.quantity} onChange={(e) => updateItem(i.key, { quantity: Number(e.target.value) })} />
                        </td>
                        <td className={S.itemsTd}>
                          <select className={clsx(S.itemsInput, "cursor-pointer")} value={i.qtyUnit} onChange={(e) => updateItem(i.key, { qtyUnit: e.target.value })}>
                            {(UQC_OPTIONS.includes(i.qtyUnit) ? UQC_OPTIONS : [i.qtyUnit, ...UQC_OPTIONS]).map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className={S.itemsTd}>
                          <input type="number" min={0} step="0.01" className={clsx(S.itemsInput, "text-right")} value={i.taxableAmount} onChange={(e) => updateItem(i.key, { taxableAmount: Number(e.target.value) })} />
                        </td>
                        <td className={S.itemsTd}>
                          <select className={clsx(S.itemsInput, "cursor-pointer")} value={i.gstRate} onChange={(e) => updateItem(i.key, { gstRate: Number(e.target.value) })}>
                            {Array.from(new Set([0, 0.25, 3, 5, 12, 18, 28, i.gstRate])).sort((a, b) => a - b).map((r) => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className={S.itemsTd}>
                          <input type="number" min={0} className={clsx(S.itemsInput, "text-right")} value={i.cessRate} onChange={(e) => updateItem(i.key, { cessRate: Number(e.target.value) })} />
                        </td>
                        <td className={clsx(S.itemsTd, "text-right text-xs font-mono text-gray-600 dark:text-slate-300 px-3")}>{formatCurrency(tax)}</td>
                        <td className="text-center">
                          <button
                            onClick={() => setItems((l) => (l.length > 1 ? l.filter((x) => x.key !== i.key) : l))}
                            className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 p-4 border-t border-gray-100 dark:border-white/5">
              <button onClick={() => setItems((l) => [...l, blankItem()])} className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#f58220] hover:text-[#e8740e] px-3 py-2 rounded-xl border border-dashed border-orange-300 dark:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors w-fit">
                <Plus className="h-4 w-4" /> Add Item
              </button>
              <div className="w-full lg:w-80 space-y-2.5 p-4 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5 text-xs sm:text-sm">
                <TotalRow label="Taxable Value" value={totals.taxable} />
                {interState ? (
                  <TotalRow label="IGST" value={totals.igst} />
                ) : (
                  <>
                    <TotalRow label="CGST" value={totals.cgst} />
                    <TotalRow label="SGST" value={totals.sgst} />
                  </>
                )}
                {totals.cess > 0 && <TotalRow label="Cess" value={totals.cess} />}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Other Charges</span>
                  <input
                    type="number" step="0.01" className="w-24 text-right font-mono font-semibold text-xs border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-orange-400"
                    value={form.otherValue} onChange={(e) => set({ otherValue: Number(e.target.value) as any })}
                  />
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Total Invoice Value</span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-[#f58220]">{formatCurrency(totals.total)}</span>
                </div>
                {totals.total > 0 && totals.total < masters.threshold && (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 flex items-start gap-1 pt-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Below ₹{masters.threshold.toLocaleString("en-IN")} — E-Way Bill is optional for intra-state movement in most states.
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* ── Part B ────────────────────────────────────────────────── */}
          <Section icon={Truck} title="Transportation Details (Part B)">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Mode">
                <select className={S.select} value={form.transMode} onChange={(e) => set({ transMode: e.target.value })}>
                  <option value="">Not yet known (Part A only)</option>
                  {Object.entries(masters.transModes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Approx. Distance (km)" required>
                <input type="number" min={1} max={4000} className={S.input} value={form.transDistance || ""} onChange={(e) => set({ transDistance: Number(e.target.value) as any })} />
              </Field>
              <Field label="Transporter ID (GSTIN/TRANSIN)">
                <input className={S.input} maxLength={15} value={form.transporterId} onChange={(e) => set({ transporterId: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Transporter Name">
                <input className={S.input} value={form.transporterName} onChange={(e) => set({ transporterName: e.target.value })} />
              </Field>
              {form.transMode === "1" && (
                <>
                  <Field label="Vehicle Type">
                    <select className={S.select} value={form.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })}>
                      <option value="R">Regular</option>
                      <option value="O">Over Dimensional Cargo</option>
                    </select>
                  </Field>
                  <Field label="Vehicle No." required>
                    <input className={S.input} value={form.vehicleNo} placeholder="TN01AB1234" onChange={(e) => set({ vehicleNo: e.target.value.toUpperCase() })} />
                  </Field>
                </>
              )}
              {form.transMode && form.transMode !== "1" && (
                <>
                  <Field label="Transport Doc No." required>
                    <input className={S.input} value={form.transDocNo} onChange={(e) => set({ transDocNo: e.target.value })} />
                  </Field>
                  <Field label="Transport Doc Date" required>
                    <input type="date" className={S.input} value={form.transDocDate} onChange={(e) => set({ transDocDate: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 bg-orange-50/50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-xl px-3 py-2">
              <Info className="h-3.5 w-3.5" />
              {validityPreview && (form.vehicleNo || form.transDocNo)
                ? <>If generated now, valid until <span className="font-semibold text-[#f58220]">{formatDateTime(validityPreview)}</span> (1 day per {form.vehicleType === "O" ? 20 : 200} km).</>
                : "Validity starts once vehicle / transport document details are entered."}
            </div>
          </Section>

          <Section title="Notes (internal)">
            <textarea className={clsx(S.input, "min-h-[64px]")} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Not sent to the portal" />
          </Section>
        </div>
      </div>

      <div className={S.formActionBar}>
        <button onClick={onCancel} className={S.btnSecondary}>Cancel</button>
        <button onClick={save} disabled={saving} className={S.btnPrimary}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Save Changes" : "Save Draft"}
        </button>
      </div>
    </div>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────
function Section({ icon: Icon, title, right, children, flush }: { icon?: any; title: string; right?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <div className={clsx(S.card, "overflow-hidden")}>
      <div className={S.cardHead}>
        <span className={S.cardHeadTitle}>
          {Icon && <Icon className="h-3.5 w-3.5 text-[#f58220]" />} {title}
        </span>
        {right}
      </div>
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </div>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className={S.label}>{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-gray-800 dark:text-white">{formatCurrency(value)}</span>
    </div>
  );
}

function PartyCard({ title, prefix, form, set, changeGstin }: {
  title: string; prefix: "from" | "to"; form: any; set: (p: any) => void; changeGstin: (p: "from" | "to", v: string) => void;
}) {
  const k = (f: string) => `${prefix}${f}`;
  const actKey = prefix === "from" ? "actFromStateCode" : "actToStateCode";
  const gstin = form[k("Gstin")];
  const registered = gstin && gstin !== "URP";
  const gstinBad = registered && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="GSTIN (URP if unregistered)" required>
          <input className={clsx(S.input, gstinBad && "!border-red-400")} maxLength={15} value={gstin} onChange={(e) => changeGstin(prefix, e.target.value)} />
        </Field>
        <Field label="Name" required>
          <input className={S.input} value={form[k("TradeName")]} onChange={(e) => set({ [k("TradeName")]: e.target.value })} />
        </Field>
        <Field label="Address Line 1" className="col-span-2">
          <input className={S.input} maxLength={120} value={form[k("Addr1")]} onChange={(e) => set({ [k("Addr1")]: e.target.value })} />
        </Field>
        <Field label="Address Line 2" className="col-span-2">
          <input className={S.input} maxLength={120} value={form[k("Addr2")]} onChange={(e) => set({ [k("Addr2")]: e.target.value })} />
        </Field>
        <Field label="Place">
          <input className={S.input} maxLength={50} value={form[k("Place")]} onChange={(e) => set({ [k("Place")]: e.target.value })} />
        </Field>
        <Field label="Pincode" required>
          <input className={S.input} maxLength={6} inputMode="numeric" value={form[k("Pincode")]} onChange={(e) => set({ [k("Pincode")]: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label={prefix === "from" ? "State (as per GSTIN)" : "State (Bill To)"} required>
          <select className={S.select} value={form[k("StateCode")]} disabled={registered && !gstinBad} onChange={(e) => set({ [k("StateCode")]: e.target.value })}>
            <option value="">Select state</option>
            {GST_STATES.map((s) => <option key={s.code} value={s.code}>{String(s.code).padStart(2, "0")} - {s.name}</option>)}
          </select>
        </Field>
        <Field label={prefix === "from" ? "Actual Dispatch State" : "Actual Ship-To State"} required>
          <select className={S.select} value={form[actKey]} onChange={(e) => set({ [actKey]: e.target.value })}>
            <option value="">Same as above</option>
            {GST_STATES.map((s) => <option key={s.code} value={s.code}>{String(s.code).padStart(2, "0")} - {s.name}</option>)}
          </select>
        </Field>
      </div>
    </Section>
  );
}
