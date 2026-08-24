"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck, Search, RefreshCw, CheckCircle2, AlertTriangle, Package
} from "lucide-react";
import { clsx } from "clsx";
import { productionApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

interface PackagingTicket {
  id: string;
  packetSize: string;
  quantityPackets: number;
  totalWeight: number;
  barcode: string;
  createdAt: string;
  status: string;
  goodQty?: number | null;
  damagedQty?: number | null;
  spoiledQty?: number | null;
  confirmedAt?: string | null;
  batch: {
    batchCode: string;
    expiryDate: string;
    recall?: { status: string } | null;
    product: { name: string; sku: string; unit: string };
  };
}

const HISTORY_STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CONFIRMED: { label: "Confirmed", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  CANCELLED: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
};

// Confirms the COMPLETE physical packaging run reported by the operator —
// not individual stickers. Good + Damaged + Spoiled must equal the planned
// quantityPackets from Start Packaging exactly. Only Good ever becomes
// Finished Goods; Damaged/Spoiled become WasteEntry rows and never touch
// Finished Goods, even temporarily.
export default function ConfirmPackagingPage() {
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("id");

  const [tickets, setTickets] = useState<PackagingTicket[]>([]);
  const [historyTickets, setHistoryTickets] = useState<PackagingTicket[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<PackagingTicket | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [goodQty, setGoodQty] = useState<number>(0);
  const [damagedQty, setDamagedQty] = useState<number>(0);
  const [spoiledQty, setSpoiledQty] = useState<number>(0);

  useEffect(() => {
    async function initData() {
      try {
        const fRes = await franchiseApi.getAll();
        const list = fRes.data || [];
        setFranchises(list);
        if (list.length > 0) {
          const hq = list.find((f: any) => f.isHQ);
          const fallback = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setSelectedFranchiseId((hq || fallback).id);
        }
      } catch (err) {
        toast.error("Failed to load franchises");
      }
    }
    initData();
  }, []);

  const loadTickets = async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    try {
      const res = await productionApi.getPackagings(selectedFranchiseId);
      const all: PackagingTicket[] = res.data || [];
      const pending = all.filter((t) => t.status === "AWAITING_CONFIRMATION");
      setTickets(pending);
      // History: every run already confirmed or cancelled — this data was
      // already being fetched and then discarded, just never surfaced.
      const past = all
        .filter((t) => t.status === "CONFIRMED" || t.status === "CANCELLED")
        .sort((a, b) => new Date(b.confirmedAt || b.createdAt).getTime() - new Date(a.confirmedAt || a.createdAt).getTime());
      setHistoryTickets(past);
      if (preselectId) {
        const match = pending.find((t) => t.id === preselectId);
        if (match) selectTicket(match);
      }
    } catch (err) {
      toast.error("Failed to load pending packaging runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFranchiseId]);

  const selectTicket = (ticket: PackagingTicket) => {
    setSelectedTicket(ticket);
    setGoodQty(ticket.goodQty ?? 0);
    setDamagedQty(ticket.damagedQty ?? 0);
    setSpoiledQty(ticket.spoiledQty ?? 0);
  };

  const filteredTickets = tickets.filter((t) =>
    t.batch?.batchCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.batch?.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = historyTickets.filter((t) =>
    t.batch?.batchCode?.toLowerCase().includes(historyQuery.toLowerCase()) ||
    t.batch?.product?.name.toLowerCase().includes(historyQuery.toLowerCase())
  );

  const total = goodQty + damagedQty + spoiledQty;
  const planned = selectedTicket?.quantityPackets ?? 0;
  const isBalanced = selectedTicket ? total === planned : false;
  const isRecalled = selectedTicket?.batch?.recall?.status === "IN_PROGRESS";

  const handleConfirm = async () => {
    if (!selectedTicket) return;
    if (goodQty < 0 || damagedQty < 0 || spoiledQty < 0) {
      toast.error("Quantities cannot be negative");
      return;
    }
    if (!isBalanced) {
      toast.error(`Good + Damaged + Spoiled (${total}) must equal the planned quantity (${planned})`);
      return;
    }

    setSubmitting(true);
    try {
      await productionApi.confirmPackaging(selectedTicket.id, { goodQty, damagedQty, spoiledQty });
      toast.success(`Packaging confirmed — ${goodQty} packets added to Finished Goods.`);
      setSelectedTicket(null);
      loadTickets();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Error confirming packaging run.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-[#f58220]" />
          Confirm Packaging
        </h1>

        <select
          value={selectedFranchiseId}
          onChange={(e) => setSelectedFranchiseId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 outline-none focus:border-[#f58220]"
        >
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left 2 Columns: Pending tickets list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#f58220]" />
                  Awaiting Confirmation
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search packaging runs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  No packaging runs awaiting confirmation.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                        <th className="text-left px-4 py-3">Product / Batch</th>
                        <th className="text-center px-4 py-3">Pack Size</th>
                        <th className="text-right px-4 py-3">Planned Qty</th>
                        <th className="text-center px-4 py-3">Started</th>
                        <th className="text-center px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTickets.map((ticket) => {
                        const isSelected = selectedTicket?.id === ticket.id;
                        const recalled = ticket.batch?.recall?.status === "IN_PROGRESS";
                        return (
                          <tr key={ticket.id} className={clsx("transition-colors", isSelected ? "bg-orange-50" : "hover:bg-gray-50")}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{ticket.batch?.product?.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">Batch: {ticket.batch?.batchCode}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border text-gray-600 bg-gray-50 border-gray-200">
                                {ticket.packetSize}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {ticket.quantityPackets} packets
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {format(new Date(ticket.createdAt), "dd MMM, HH:mm")}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {recalled ? (
                                <span className="inline-block px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
                                  Recalled
                                </span>
                              ) : (
                                <button
                                  onClick={() => selectTicket(ticket)}
                                  className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                                >
                                  Confirm
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* History: past confirmed/cancelled packaging runs — read-only,
                does not affect the Awaiting Confirmation flow above. */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-5">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5 text-[#f58220]" />
                  History
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-16 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  No confirmed or cancelled packaging runs yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                        <th className="text-left px-4 py-3">Product / Batch</th>
                        <th className="text-center px-4 py-3">Pack Size</th>
                        <th className="text-right px-4 py-3">Good / Damaged / Spoiled</th>
                        <th className="text-center px-4 py-3">Confirmed</th>
                        <th className="text-center px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredHistory.map((ticket) => {
                        const style = HISTORY_STATUS_STYLES[ticket.status] || HISTORY_STATUS_STYLES.CANCELLED;
                        return (
                          <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{ticket.batch?.product?.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">Batch: {ticket.batch?.batchCode}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border text-gray-600 bg-gray-50 border-gray-200">
                                {ticket.packetSize}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs">
                              {ticket.goodQty !== null && ticket.goodQty !== undefined ? (
                                <span>
                                  <span className="text-emerald-600 font-semibold">{ticket.goodQty}</span>
                                  {" / "}
                                  <span className="text-amber-600 font-semibold">{ticket.damagedQty ?? 0}</span>
                                  {" / "}
                                  <span className="text-rose-600 font-semibold">{ticket.spoiledQty ?? 0}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {ticket.confirmedAt ? format(new Date(ticket.confirmedAt), "dd MMM, HH:mm") : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                                {style.label}
                              </span>
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

          {/* Right 1 Column: Confirmation form */}
          <div className="lg:col-span-1">
            {selectedTicket ? (
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-[#f58220]">Confirm Complete Packaging Run</span>
                    <h3 className="text-sm font-bold text-gray-800 mt-0.5">
                      {selectedTicket.batch?.product?.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Batch {selectedTicket.batch?.batchCode} · {selectedTicket.packetSize} · Planned {planned} packets
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Close
                  </button>
                </div>

                {isRecalled ? (
                  <div className="flex gap-2 text-xs text-rose-600 font-medium p-2.5 border border-rose-200 bg-rose-50 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>This batch is under recall — packaging cannot be confirmed.</span>
                  </div>
                ) : (
                  <>
                    {selectedTicket.goodQty !== null && selectedTicket.goodQty !== undefined ? (
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-800 text-sm">
                        <p className="font-semibold mb-1">Physical verification saved:</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          <li>{selectedTicket.goodQty} Good</li>
                          <li>{selectedTicket.damagedQty} Damaged</li>
                          <li>{selectedTicket.spoiledQty} Spoiled</li>
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-sm">
                        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Not physically verified yet</p>
                        <p className="text-xs mt-1">Quantities have not been physically verified on the Labels page.</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 leading-relaxed">
                      Finalize the complete physical outcome of this packaging run.
                      The three counts below must add up to exactly {planned} packets.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-emerald-600 mb-1.5">Good (→ Finished Goods)</label>
                        <input
                          type="number"
                          min="0"
                          value={goodQty}
                          onChange={(e) => setGoodQty(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-amber-600 mb-1.5">Damaged (→ Wastage)</label>
                        <input
                          type="number"
                          min="0"
                          value={damagedQty}
                          onChange={(e) => setDamagedQty(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-rose-600 mb-1.5">Spoiled (→ Wastage)</label>
                        <input
                          type="number"
                          min="0"
                          value={spoiledQty}
                          onChange={(e) => setSpoiledQty(Math.max(0, Number(e.target.value)))}
                          className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-rose-400 bg-white"
                        />
                      </div>
                    </div>

                    <div className={clsx(
                      "rounded-lg p-3 flex items-center justify-between text-sm border",
                      isBalanced ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-600"
                    )}>
                      <span className="font-medium">Total Reported</span>
                      <span className="font-bold">{total} / {planned}</span>
                    </div>

                    {!isBalanced && total < planned && (
                      <div className="flex gap-2 text-xs text-rose-600 font-medium p-2.5 border border-rose-200 bg-rose-50 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {planned - total} {planned - total === 1 ? 'packet' : 'packets'} still unaccounted for
                        </span>
                      </div>
                    )}

                    {!isBalanced && total > planned && (
                      <div className="flex gap-2 text-xs text-rose-600 font-medium p-2.5 border border-rose-200 bg-rose-50 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Quantity exceeds planned packaging by {total - planned} {total - planned === 1 ? 'packet' : 'packets'}</span>
                      </div>
                    )}

                    <button
                      onClick={handleConfirm}
                      disabled={submitting || !isBalanced}
                      className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Confirm Packaging
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 rounded-lg text-center p-6 bg-white">
                <ClipboardCheck className="h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">Select a packaging run to confirm</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
