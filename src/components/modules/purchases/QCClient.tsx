'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, CheckCircle2, XCircle, ClipboardCheck, RefreshCw, ShieldCheck, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { productionApi } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { formatERPNumber } from '@/lib/utils';

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
    APPROVED: { label: 'Passed', className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    PARTIALLY_APPROVED: { label: 'Partial', className: 'text-amber-600 bg-amber-50 border-amber-200' },
    REJECTED: { label: 'Failed', className: 'text-rose-600 bg-rose-50 border-rose-200' },
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 -m-4 md:-m-6">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#f58220]" />
          Quality Control
        </h1>
        <button onClick={fetchPending} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* Production Batches — a plain table + an Inspect dialog. Not a
            lab QMS screen: no moisture/color/texture parameters, no
            multi-way disposition toggle — just accept/reject quantities
            against what was actually produced. */}
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search finished goods or batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
            />
          {searchQuery && (
            <X
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
              onClick={() => setSearchQuery("")}
            />
          )}
          </div>

          {loading && prodBatches.length === 0 ? (
            <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
          ) : filteredProdBatches.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-[#f58220]" />
              </div>
              <p className="text-gray-800 font-semibold">Queue is completely clear!</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                    <th className="text-left px-4 py-3">Batch</th>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-right px-4 py-3">Produced Qty</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProdBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">{formatERPNumber("PRD", batch.batchCode, batch.createdAt)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{prodBatchName(batch)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">{batch.quantity} {batch.production?.recipe?.yieldUnit || 'KG'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border text-amber-600 bg-amber-50 border-amber-200">
                          QC Pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openInspect(batch)}
                          className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* QC History — batches already inspected. Without this, a batch
              dropped out of view entirely the moment it was QC'd (the queue
              only ever showed PENDING), leaving no record of past decisions
              on this screen. */}
          <div className="pt-2">
            <h2 className="text-sm font-bold text-gray-800 mb-3">QC History</h2>
            {loading && prodBatches.length === 0 ? null : filteredProdHistory.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg py-12 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-gray-400">No batches have been QC inspected yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                      <th className="text-left px-4 py-3">Batch</th>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-right px-4 py-3">Approved</th>
                      <th className="text-right px-4 py-3">Rejected</th>
                      <th className="text-left px-4 py-3">Result</th>
                      <th className="text-left px-4 py-3">Inspected</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProdHistory.map((batch) => {
                      const badge = qcStatusBadge[batch.qcStatus] || { label: batch.qcStatus, className: 'text-gray-600 bg-gray-50 border-gray-200' };
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">{formatERPNumber("PRD", batch.batchCode, batch.createdAt)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{prodBatchName(batch)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{batch.approvedQty ?? 0} {batch.production?.recipe?.yieldUnit || 'KG'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{batch.rejectionQty ?? 0} {batch.production?.recipe?.yieldUnit || 'KG'}</td>
                          <td className="px-4 py-3">
                            <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", badge.className)}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => router.push(`/production/batches?tab=REGISTRY&batchId=${batch.id}`)}
                              className="px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-600 rounded-lg text-xs font-semibold transition-colors"
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
            )}
          </div>
        </div>
      </div>

      {/* QC Inspection Dialog */}
      {qcModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">QC Inspection</h3>
                <p className="text-xs text-gray-500 mt-0.5">Batch: {formatERPNumber("PRD", qcModalBatch.batchCode, qcModalBatch.createdAt)}</p>
              </div>
              <button
                onClick={() => setQcModalBatch(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Product</p>
                  <p className="text-sm font-semibold text-gray-800">{prodBatchName(qcModalBatch)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Produced Quantity</p>
                  <p className="text-sm font-semibold text-gray-800">{qcModalBatch.quantity} {qcModalBatch.production?.recipe?.yieldUnit || 'KG'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">QC Decision</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setQcDecision('ACCEPT'); setQcRejectedQty(0); setQcRemarks(''); }}
                    className={clsx(
                      "py-2.5 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                      qcDecision === 'ACCEPT' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept
                  </button>
                  <button
                    onClick={() => { setQcDecision('REJECT'); setQcRejectedQty(qcModalBatch.quantity); }}
                    className={clsx(
                      "py-2.5 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                      qcDecision === 'REJECT' ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>

              {qcDecision === 'REJECT' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Rejection Quantity (KG)</label>
                    <input
                      type="number"
                      min={0}
                      max={qcModalBatch.quantity}
                      value={qcRejectedQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setQcRejectedQty(Math.max(0, Math.min(val, qcModalBatch.quantity)));
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#f58220] bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Accepted: {(qcModalBatch.quantity - qcRejectedQty).toFixed(2)} {qcModalBatch.production?.recipe?.yieldUnit || 'KG'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={qcRemarks}
                      onChange={(e) => setQcRemarks(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-emerald-600 mb-1">Accepted Quantity</p>
                  <p className="text-xl font-bold text-gray-800">{qcModalBatch.quantity} <span className="text-sm text-gray-400">{qcModalBatch.production?.recipe?.yieldUnit || 'KG'}</span></p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setQcModalBatch(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white transition-colors"
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
