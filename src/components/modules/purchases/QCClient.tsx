'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, CheckCircle2, XCircle, ClipboardCheck, RefreshCw, ShieldCheck, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { productionApi } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function QCClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Production State — a plain table + a dialog for the actual inspection.
  // Only one number is entered (rejected qty); accepted is always
  // produced - rejected.
  const [prodBatches, setProdBatches] = useState<any[]>([]);
  const [qcModalBatch, setQcModalBatch] = useState<any>(null);
  const [qcDecision, setQcDecision] = useState<'ACCEPT' | 'REJECT'>('ACCEPT');
  const [qcRejectedQty, setQcRejectedQty] = useState<number>(0);
  const [qcRemarks, setQcRemarks] = useState('');
  const [autoOpenedBatchId, setAutoOpenedBatchId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // QC History Batch Details SlideOver / Drawer
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<any | null>(null);
  const [showBatchDetails, setShowBatchDetails] = useState(false);

  const STAGE_LABELS: Record<string, string> = {
    QUEUED: 'Queued',
    IN_PROGRESS: 'Cooking',
    QUALITY_CHECK: 'Quality Check',
    COMPLETED: 'Completed',
    STOPPED: 'Stopped',
  };

  const formatDurationMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      // Pull every batch (not just pending) so already-inspected batches
      // still show up here as QC history instead of vanishing from the
      // page the moment they're inspected.
      const res = await productionApi.getAllBatches();
      setProdBatches(res.data || []);
    } catch (err) {
      toast.error('Failed to load pending quality checks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Arriving from Batch Registry with ?batchId=... jumps straight to that
  // batch's inspection dialog, instead of making the user find it again.
  useEffect(() => {
    const batchId = searchParams.get('batchId');
    if (!batchId || batchId === autoOpenedBatchId) return;
    const match = prodBatches.find((b) => b.id === batchId);
    if (match) {
      openInspect(match);
      setAutoOpenedBatchId(batchId);
    }
  }, [prodBatches, searchParams, autoOpenedBatchId]);

  const openInspect = (batch: any) => {
    setQcModalBatch(batch);
    setQcDecision('ACCEPT');
    setQcRejectedQty(0);
    setQcRemarks('');
  };

  const handleProdSubmit = async () => {
    if (!qcModalBatch) return;

    try {
      setIsSubmitting(true);
      await productionApi.inspectBatch(qcModalBatch.id, {
        rejectionQty: qcDecision === 'REJECT' ? Number(qcRejectedQty) : 0,
        qcRemarks: qcRemarks.trim() || undefined,
      });

      toast.success('QC recorded successfully');
      setQcModalBatch(null);
      fetchPending();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit QC');
    } finally {
      setIsSubmitting(false);
    }
  };

  const prodBatchName = (batch: any) => batch.product?.name || batch.production?.recipe?.name || 'Unknown';

  const searchedProdBatches = prodBatches.filter(batch =>
    prodBatchName(batch).toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.batchCode.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredProdBatches = searchedProdBatches.filter(batch => batch.qcStatus === 'PENDING');
  const filteredProdHistory = searchedProdBatches
    .filter(batch => batch.qcStatus && batch.qcStatus !== 'PENDING')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const qcStatusBadge: Record<string, { label: string; className: string }> = {
    APPROVED: { label: 'Passed', className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40' },
    PARTIALLY_APPROVED: { label: 'Partial', className: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40' },
    REJECTED: { label: 'Failed', className: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40' },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground -m-4 md:-m-6">
      {/* Page Header Toolbar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center justify-end">
        <button onClick={fetchPending} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Refresh">
          <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-5 w-full min-w-0">
        {/* Production Batches */}
        <div className="space-y-4 w-full min-w-0">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search finished goods or batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-card text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>

          {loading && prodBatches.length === 0 ? (
            <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
          ) : filteredProdBatches.length === 0 ? (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg py-20 px-4 flex flex-col items-center justify-center text-center space-y-4 shadow-sm w-full min-w-0">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-950/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-[#f58220]" />
              </div>
              <p className="text-gray-800 dark:text-white font-semibold">Queue is completely clear!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm text-left border-collapse min-w-[670px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                      <th className="text-left px-4 py-3 min-w-[180px]">Batch</th>
                      <th className="text-left px-4 py-3 min-w-[150px]">Product</th>
                      <th className="text-right px-4 py-3 min-w-[120px] whitespace-nowrap">Produced Qty</th>
                      <th className="text-left px-4 py-3 min-w-[120px] whitespace-nowrap">Status</th>
                      <th className="text-right px-4 py-3 min-w-[100px] whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredProdBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800 dark:text-white text-xs whitespace-nowrap">{batch.batchCode || "—"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">{prodBatchName(batch)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300 text-right whitespace-nowrap font-medium">{batch.quantity} {batch.production?.recipe?.yieldUnit || 'KG'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded text-[11px] font-semibold border text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40">
                            QC Pending
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => openInspect(batch)}
                            className="px-3.5 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QC History — batches already inspected. */}
          <div className="pt-2 w-full min-w-0">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white mb-3">QC History</h2>
            {loading && prodBatches.length === 0 ? null : filteredProdHistory.length === 0 ? (
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg py-12 px-4 flex flex-col items-center justify-center text-center shadow-sm w-full min-w-0">
                <p className="text-sm text-gray-400 dark:text-slate-500">No batches have been QC inspected yet.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
                <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                  <table className="w-full text-sm text-left border-collapse min-w-[830px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                        <th className="text-left px-4 py-3 min-w-[180px]">Batch</th>
                        <th className="text-left px-4 py-3 min-w-[150px]">Product</th>
                        <th className="text-right px-4 py-3 min-w-[100px] whitespace-nowrap">Approved</th>
                        <th className="text-right px-4 py-3 min-w-[100px] whitespace-nowrap">Rejected</th>
                        <th className="text-left px-4 py-3 min-w-[100px] whitespace-nowrap">Result</th>
                        <th className="text-left px-4 py-3 min-w-[120px] whitespace-nowrap">Inspected</th>
                        <th className="text-right px-4 py-3 min-w-[80px] whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredProdHistory.map((batch) => {
                        const badge = qcStatusBadge[batch.qcStatus] || { label: batch.qcStatus, className: 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10' };
                        return (
                          <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-gray-800 dark:text-white text-xs whitespace-nowrap">{batch.batchCode || "—"}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">{prodBatchName(batch)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300 text-right whitespace-nowrap font-medium">{batch.approvedQty ?? 0} {batch.production?.recipe?.yieldUnit || 'KG'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300 text-right whitespace-nowrap font-medium">{batch.rejectionQty ?? 0} {batch.production?.recipe?.yieldUnit || 'KG'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={clsx("inline-block px-2.5 py-1 rounded text-[11px] font-semibold border", badge.className)}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                              {formatDate(batch.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBatchDetails(batch);
                                  setShowBatchDetails(true);
                                }}
                                className="px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              >
                                View
                              </button>
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
        </div>
      </div>

      {/* Batch Details Drawer / Side Panel */}
      {showBatchDetails && selectedBatchDetails && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowBatchDetails(false)}
          />
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f1117] shadow-2xl h-full flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300 z-10">
            {/* Drawer Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-white">Batch Details</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-mono font-semibold text-[#f58220]">
                    {selectedBatchDetails.batchCode || "—"}
                  </span>
                  <span className={clsx(
                    "px-2 py-0.5 rounded-full text-xs font-semibold",
                    selectedBatchDetails.qcStatus === 'APPROVED' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                    selectedBatchDetails.qcStatus === 'PARTIALLY_APPROVED' ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" :
                    selectedBatchDetails.qcStatus === 'REJECTED' ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400" :
                    "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                  )}>
                    {qcStatusBadge[selectedBatchDetails.qcStatus]?.label || "Active"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchDetails(false)}
                className="p-2 hover:bg-gray-200/70 dark:hover:bg-white/10 rounded-lg transition-colors font-semibold text-gray-500 dark:text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar">
              {/* Product Header & Timeline */}
              <div className="bg-gray-50 dark:bg-white/[0.02] p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-white/5">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Product</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">{prodBatchName(selectedBatchDetails)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Recipe Version</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                      {selectedBatchDetails.production?.recipe?.version ? `v${selectedBatchDetails.production.recipe.version}` : "v1.2 (Standard)"}
                    </p>
                  </div>
                </div>
                
                {/* Production Timeline */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4">Production Timeline</h4>
                  {(() => {
                    const production = selectedBatchDetails.production;
                    const stageLogs = production?.stageLogs ?? [];
                    const points: { key: string; label: string; time: string }[] = stageLogs.map((log: any) => ({
                      key: log.id,
                      label: STAGE_LABELS[log.stage] ?? log.stage,
                      time: log.enteredAt,
                    }));
                    if (production?.status === 'COMPLETED' && production?.endTime) {
                      points.push({ key: 'completed', label: 'Completed', time: production.endTime });
                    } else if (production?.status === 'STOPPED' && production?.endTime) {
                      points.push({ key: 'stopped', label: 'Paused', time: production.endTime });
                    }

                    if (points.length === 0) {
                      const start = selectedBatchDetails.createdAt || selectedBatchDetails.production?.startTime;
                      const end = selectedBatchDetails.production?.endTime || selectedBatchDetails.updatedAt;
                      return (
                        <div className="flex items-center gap-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 flex-wrap">
                          {start && <span>Start: <span className="text-gray-800 dark:text-white">{new Date(start).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span></span>}
                          {end && <span>End: <span className="text-gray-800 dark:text-white">{new Date(end).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span></span>}
                        </div>
                      );
                    }

                    const start = points[0]?.time;
                    const end = points.length > 1 ? points[points.length - 1].time : null;
                    const durationMinutes = start && end
                      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
                      : null;

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300 relative before:absolute before:top-1.5 before:left-0 before:right-0 before:h-0.5 before:bg-gray-200 dark:before:bg-white/10 overflow-x-auto pb-1 custom-scrollbar">
                          {points.map((p, idx) => (
                            <div key={p.key ?? idx} className="relative flex flex-col items-center gap-2 group z-10 shrink-0">
                              <div className="w-3 h-3 rounded-full bg-[#f58220] border-2 border-white dark:border-[#0f1117] shadow-sm" />
                              <span className="w-16 text-center leading-tight bg-gray-50 dark:bg-[#0f1117]">
                                {new Date(p.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                <br />
                                {p.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400 flex-wrap">
                          <span>Start: <span className="text-gray-800 dark:text-white">{new Date(start).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span></span>
                          <span>End: <span className="text-gray-800 dark:text-white">{end ? new Date(end).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "In Progress"}</span></span>
                          {durationMinutes !== null && <span>Duration: <span className="text-gray-800 dark:text-white">{formatDurationMinutes(durationMinutes)}</span></span>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Yield & Cost */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-3">Production Yield &amp; Cost</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                  <div className="p-3.5 sm:p-4 bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Produced</p>
                    <p className="text-sm sm:text-base font-bold text-gray-850 dark:text-white mt-1 tabular-nums">
                      {selectedBatchDetails.quantity ?? 0} <span className="text-xs text-gray-400 dark:text-slate-500">{selectedBatchDetails.production?.recipe?.yieldUnit || "KG"}</span>
                    </p>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Approved / Rejected</p>
                    <p className="text-sm sm:text-base font-bold text-gray-850 dark:text-white mt-1 tabular-nums">
                      {selectedBatchDetails.approvedQty ?? 0} <span className="text-xs text-rose-500 dark:text-rose-400">/ {selectedBatchDetails.rejectionQty ?? 0}</span>
                    </p>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-[#f58220] font-semibold">Material Cost</p>
                    <p className="text-sm sm:text-base font-bold text-[#e8740e] dark:text-orange-400 mt-1 tabular-nums">
                      ₹{(selectedBatchDetails.production?.materialCost ?? selectedBatchDetails.totalCost ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Unit Cost</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                      ₹{(selectedBatchDetails.unitCost ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">QC Wastage Cost</p>
                    <p className="text-sm sm:text-base font-bold text-rose-700 dark:text-rose-400 mt-1 tabular-nums">
                      ₹{((selectedBatchDetails.rejectionQty ?? 0) * (selectedBatchDetails.unitCost ?? 0)).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-rose-400 mt-0.5">
                      {selectedBatchDetails.rejectionQty ?? 0} {selectedBatchDetails.production?.recipe?.yieldUnit || "KG"} rejected
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                  Unit cost reflects the real price on whichever purchase bill(s) this run actually consumed (FIFO) — it can differ run-to-run of the same recipe as older, cheaper bills run out and newer purchase prices take over.
                </p>
              </div>

              {/* QC Remarks / Details if available */}
              {selectedBatchDetails.qcRemarks && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">QC Inspection Remarks</h4>
                  <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">{selectedBatchDetails.qcRemarks}</p>
                </div>
              )}

              {/* Ingredients Used */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-3">Ingredients Consumption</h3>
                <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg overflow-hidden shadow-sm w-full min-w-0">
                  <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                    <table className="w-full text-left min-w-[500px]">
                      <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                        <tr>
                          <th className="px-4 py-2">Ingredient</th>
                          <th className="px-4 py-2">Purchase Bill</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Rate</th>
                          <th className="px-4 py-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 dark:divide-white/5 text-sm text-gray-700 dark:text-slate-300">
                        {(selectedBatchDetails.production?.items ?? []).map((pi: any) => {
                          const breakdown: any[] = Array.isArray(pi.batchBreakdown) ? pi.batchBreakdown : [];
                          return (
                            <React.Fragment key={pi.id}>
                              <tr className="bg-gray-50/70 dark:bg-white/[0.02] font-semibold text-gray-800 dark:text-white">
                                <td className="px-4 py-2.5 whitespace-nowrap">{pi.inventoryItem?.name ?? "—"}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-slate-500 normal-case">
                                  {breakdown.length > 1 ? `Blended across ${breakdown.length} bills` : ""}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{pi.usedQuantity} {pi.inventoryItem?.unit}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">₹{(pi.unitCost ?? 0).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold">₹{(pi.totalCost ?? 0).toFixed(2)}</td>
                              </tr>
                              {breakdown.length > 0 ? (
                                breakdown.map((b: any, idx: number) => {
                                  const isFallback = !b.batchId;
                                  return (
                                    <tr key={idx} className="text-xs text-gray-500 dark:text-slate-400">
                                      <td className="px-4 py-2"></td>
                                      <td className="px-4 py-2 normal-case whitespace-nowrap">
                                        <span className={isFallback ? "font-semibold text-amber-600 dark:text-amber-400" : "font-mono font-semibold text-gray-600 dark:text-slate-300"}>
                                          {b.billNumber || "—"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{b.qty} {pi.inventoryItem?.unit}</td>
                                      <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">₹{(b.unitCost ?? 0).toFixed(2)}</td>
                                      <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">₹{(b.totalCost ?? 0).toFixed(2)}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr className="text-xs text-gray-400 dark:text-slate-500">
                                  <td className="px-4 py-2"></td>
                                  <td className="px-4 py-2 normal-case" colSpan={4}>No purchase bill on record for this consumption</td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {(!selectedBatchDetails.production?.items || selectedBatchDetails.production.items.length === 0) && (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-slate-500">No ingredient data recorded for this run</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QC Inspection Dialog */}
      {qcModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-[#13151f] rounded-lg border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[calc(100dvh-24px)] sm:max-h-[90vh] flex flex-col my-auto">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0e1017] flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">QC Inspection</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-mono">Batch: {qcModalBatch.batchCode || "—"}</p>
              </div>
              <button
                onClick={() => setQcModalBatch(null)}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-white transition-colors p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Product</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{prodBatchName(qcModalBatch)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Produced Quantity</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{qcModalBatch.quantity} {qcModalBatch.production?.recipe?.yieldUnit || 'KG'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">QC Decision</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setQcDecision('ACCEPT'); setQcRejectedQty(0); setQcRemarks(''); }}
                    className={clsx(
                      "py-2.5 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                      qcDecision === 'ACCEPT' ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400" : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept
                  </button>
                  <button
                    onClick={() => { setQcDecision('REJECT'); setQcRejectedQty(qcModalBatch.quantity); }}
                    className={clsx(
                      "py-2.5 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                      qcDecision === 'REJECT' ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400" : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
                    )}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>

              {qcDecision === 'REJECT' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Rejection Quantity (KG)</label>
                    <input
                      type="number"
                      min={0}
                      max={qcModalBatch.quantity}
                      value={qcRejectedQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setQcRejectedQty(Math.max(0, Math.min(val, qcModalBatch.quantity)));
                      }}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-white/5"
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">Accepted: {(qcModalBatch.quantity - qcRejectedQty).toFixed(2)} {qcModalBatch.production?.recipe?.yieldUnit || 'KG'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={qcRemarks}
                      onChange={(e) => setQcRemarks(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-white/5 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg p-4">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Accepted Quantity</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">{qcModalBatch.quantity} <span className="text-sm text-gray-400 dark:text-slate-500">{qcModalBatch.production?.recipe?.yieldUnit || 'KG'}</span></p>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-5 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0e1017] flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setQcModalBatch(null)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProdSubmit}
                disabled={isSubmitting || (qcDecision === 'REJECT' && !qcRemarks.trim())}
                className="px-5 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Confirm QC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
