import { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "@/lib/api/base";
import { vendorsApi } from "@/lib/api/procurement.api";
import { useToast } from "@/context/ToastContext";

interface ReturnableMaterial {
  materialId: string;
  name: string;
  sku?: string;
  unit: string;
  rate: number;
  availableQty: number;
}

interface ReturnRow {
  materialId: string;
  itemName: string;
  quantity: string;
  unit: string;
  rate: number;
}

const emptyRow = (): ReturnRow => ({ materialId: "", itemName: "", quantity: "1", unit: "", rate: 0 });

export default function NewPurchaseReturnModal({ vendors, onClose, onSuccess }: { vendors: any[], onClose: () => void, onSuccess: () => void }) {
  const [vendorId, setVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<ReturnRow[]>([emptyRow()]);
  const [materials, setMaterials] = useState<ReturnableMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Selecting a vendor loads what they've actually supplied via completed
  // GRNs (actual received qty, actual weighted price) minus whatever is
  // already claimed by an earlier return — not an open-ended free-text
  // field. This is the same data the backend re-validates against on
  // submit, so what the user sees here can't drift from what's authoritative.
  useEffect(() => {
    if (!vendorId) {
      setMaterials([]);
      setRows([emptyRow()]);
      return;
    }
    setLoadingMaterials(true);
    vendorsApi.getReturnableMaterials(vendorId)
      .then(res => setMaterials(res.data || []))
      .catch(() => {
        showToast("Failed to load this vendor's returnable materials", "error");
        setMaterials([]);
      })
      .finally(() => setLoadingMaterials(false));
    setRows([emptyRow()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // How much of each material is still free across the OTHER rows already
  // in this form, so picking the same material twice can't let each row
  // independently claim the full available quantity.
  function remainingFor(materialId: string, excludeIndex: number): number {
    const material = materials.find(m => m.materialId === materialId);
    if (!material) return 0;
    const claimedElsewhere = rows.reduce((sum, r, idx) => {
      if (idx === excludeIndex || r.materialId !== materialId) return sum;
      return sum + (Number(r.quantity) || 0);
    }, 0);
    return Math.max(0, material.availableQty - claimedElsewhere);
  }

  function addRow() {
    setRows([...rows, emptyRow()]);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }
  function selectMaterial(i: number, materialId: string) {
    const material = materials.find(m => m.materialId === materialId);
    const next = [...rows];
    next[i] = material
      ? { materialId, itemName: material.name, unit: material.unit, rate: material.rate, quantity: "1" }
      : emptyRow();
    setRows(next);
  }
  function updateQuantity(i: number, value: string) {
    const next = [...rows];
    next[i] = { ...next[i], quantity: value };
    setRows(next);
  }

  const refundTotal = rows.reduce((s, r) => s + (Number(r.quantity) * r.rate || 0), 0);

  const rowErrors = rows.map((r, i) => {
    if (!r.materialId) return null;
    const qty = Number(r.quantity);
    if (!r.quantity || isNaN(qty) || qty <= 0) return "Enter a valid quantity";
    const max = remainingFor(r.materialId, i);
    if (qty > max + 0.0001) return `Only ${max} ${r.unit} available`;
    return null;
  });
  const hasErrors = rowErrors.some(e => e !== null) || rows.every(r => !r.materialId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (hasErrors) return;
    setSubmitting(true);
    try {
      await api.post("/api/purchase/returns", {
        vendorId,
        reason,
        returnSource: "MANUAL",
        items: rows.filter(r => r.materialId).map(r => ({
          itemName: r.itemName,
          quantity: Number(r.quantity),
          unit: r.unit,
          rate: r.rate
        }))
      });
      showToast("Purchase Return created successfully!", "success");
      onSuccess();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to create return", "error");
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <form
        onSubmit={handleCreate}
        className="flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors">
              <X size={17} />
            </button>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">New Purchase Return</h2>
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500">Return No: <span className="text-orange-500 font-semibold">Auto</span></span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 sm:py-5 space-y-4 custom-scrollbar w-full min-w-0">

          {/* Vendor + Reason */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-sm w-full min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full min-w-0">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Vendor *</label>
                <select
                  required
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors"
                >
                  <option value="" className="dark:bg-[#13151f]">Select vendor...</option>
                  {vendors.map((v: any) => <option key={v.id} value={v.id} className="dark:bg-[#13151f]">{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Reason *</label>
                <input
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Quality issue"
                  className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Returned Items */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Returned Items</span>
            </div>

            {!vendorId ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                Select a vendor to see what can be returned.
              </div>
            ) : loadingMaterials ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                Loading returnable materials...
              </div>
            ) : materials.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                No eligible materials for return — this vendor has no completed receipts (or everything received has already been returned).
              </div>
            ) : (
              <>
                <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                  <table className="w-full text-sm border-collapse min-w-[640px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                        <th className="w-8 px-3 py-2.5 text-center">#</th>
                        <th className="px-3 py-2.5 text-left">Material</th>
                        <th className="w-24 px-2 py-2.5 text-center">Qty</th>
                        <th className="w-20 px-2 py-2.5 text-center">Unit</th>
                        <th className="w-28 px-3 py-2.5 text-right">Rate</th>
                        <th className="w-28 px-3 py-2.5 text-right">Amount</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {rows.map((row, i) => {
                        const max = row.materialId ? remainingFor(row.materialId, i) : 0;
                        const error = rowErrors[i];
                        const amount = (Number(row.quantity) || 0) * row.rate;
                        return (
                          <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-orange-50/30 dark:hover:bg-white/[0.02] group align-top">
                            <td className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-slate-500">{i + 1}</td>
                            <td className="px-3 py-2">
                              <select
                                required
                                value={row.materialId}
                                onChange={(e) => selectMaterial(i, e.target.value)}
                                className="w-full text-sm text-gray-700 dark:text-white outline-none bg-transparent"
                              >
                                <option value="" className="dark:bg-[#13151f]">Select material...</option>
                                {materials.map(m => (
                                  <option key={m.materialId} value={m.materialId} className="dark:bg-[#13151f]">
                                    {m.name} ({m.availableQty} {m.unit} available)
                                  </option>
                                ))}
                              </select>
                              {error && <p className="text-[11px] font-medium text-rose-500 mt-0.5">{error}</p>}
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number" min="0.01" step="0.01" max={max || undefined}
                                value={row.quantity} onChange={(e) => updateQuantity(i, e.target.value)}
                                disabled={!row.materialId}
                                className="w-full text-sm text-gray-700 dark:text-white text-center outline-none bg-transparent disabled:opacity-40"
                                required
                              />
                            </td>
                            <td className="px-2 py-2.5 text-center text-xs text-gray-500 dark:text-slate-400">{row.unit || "—"}</td>
                            <td className="px-3 py-2.5 text-right text-sm text-gray-700 dark:text-white">{row.materialId ? row.rate.toFixed(2) : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800 dark:text-white">{amount > 0 ? amount.toFixed(2) : "—"}</td>
                            <td className="pr-2">
                              {rows.length > 1 && (
                                <button type="button" onClick={() => removeRow(i)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.01]">
                  <button type="button" onClick={addRow}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 border border-orange-200 dark:border-orange-900/40 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Add Row
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Summary */}
          <div className="flex justify-end w-full min-w-0">
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 w-full lg:w-72 shrink-0 space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-slate-300 font-medium">Refund Value</span>
                <span className="font-semibold text-gray-900 dark:text-white">₹ {refundTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg">
            Cancel
          </button>
          <button type="submit" disabled={submitting || hasErrors}
            className="px-6 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-60 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Return Claim"}
          </button>
        </div>
      </form>
    </div>
  );
}
