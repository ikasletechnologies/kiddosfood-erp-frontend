'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, CheckCircle2, XCircle, Thermometer, Package,
  ArrowRight, ClipboardCheck, Trash2, RefreshCw, ShieldCheck, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { qcApi, productionApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function QCClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'GRN' | 'PRODUCTION'>('GRN');

  // GRN State
  const [grnItems, setGrnItems] = useState<any[]>([]);
  const [selectedGrnItem, setSelectedGrnItem] = useState<any>(null);

  // Production State — a plain table + a dialog for the actual inspection,
  // not the split list/detail panel GRN uses. Only one number is entered
  // (rejected qty); accepted is always produced - rejected.
  const [prodBatches, setProdBatches] = useState<any[]>([]);
  const [qcModalBatch, setQcModalBatch] = useState<any>(null);
  const [qcRejectedQty, setQcRejectedQty] = useState<number>(0);
  const [qcRemarks, setQcRemarks] = useState('');
  const [autoOpenedBatchId, setAutoOpenedBatchId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // GRN Form State
  const [grnInspection, setGrnInspection] = useState({
    approvedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    actionTaken: 'APPROVE' as any,
    remarks: '',
    temperature: '',
    moistureContent: '',
    packagingOk: true
  });

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'GRN') {
        const res = await qcApi.getPending();
        setGrnItems(res.data || []);
        if (res.data?.length > 0 && !selectedGrnItem) {
          setSelectedGrnItem(res.data[0]);
        }
      } else {
        const res = await productionApi.getPendingQC();
        setProdBatches(res.data || []);
      }
    } catch (err) {
      toast.error('Failed to load pending quality checks');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedGrnItem]);

  useEffect(() => {
    fetchPending();
  }, [activeTab]);

  // Arriving from Batch Registry with ?batchId=... — jump straight to the
  // Production tab and open that batch's inspection dialog, instead of
  // landing on the generic queue and making the user find it again.
  useEffect(() => {
    const batchId = searchParams.get('batchId');
    if (batchId) setActiveTab('PRODUCTION');
  }, [searchParams]);

  useEffect(() => {
    const batchId = searchParams.get('batchId');
    if (!batchId || batchId === autoOpenedBatchId) return;
    const match = prodBatches.find((b) => b.id === batchId);
    if (match) {
      openInspect(match);
      setAutoOpenedBatchId(batchId);
    }
  }, [prodBatches, searchParams, autoOpenedBatchId]);

  // Sync GRN form when item changes
  useEffect(() => {
    if (selectedGrnItem) {
      setGrnInspection(prev => ({
        ...prev,
        approvedQty: selectedGrnItem.receivedQty,
        rejectedQty: 0,
        scrapQty: 0,
        actionTaken: 'APPROVE'
      }));
    }
  }, [selectedGrnItem]);

  const openInspect = (batch: any) => {
    setQcModalBatch(batch);
    setQcRejectedQty(0);
    setQcRemarks('');
  };

  const handleGrnQtyChange = (field: string, val: number) => {
    const total = selectedGrnItem?.receivedQty || 0;
    let newApproved = grnInspection.approvedQty;
    let newRejected = grnInspection.rejectedQty;

    if (field === 'approvedQty') {
      newApproved = val;
      newRejected = Math.max(0, total - val);
    } else {
      newRejected = val;
      newApproved = Math.max(0, total - val);
    }

    setGrnInspection(prev => ({
      ...prev,
      approvedQty: newApproved,
      rejectedQty: newRejected,
      actionTaken: newRejected > 0 ? (prev.actionTaken === 'APPROVE' ? 'REJECT_RETURN' : prev.actionTaken) : 'APPROVE'
    }));
  };

  const handleGrnSubmit = async () => {
    if (!selectedGrnItem) return;

    try {
      setIsSubmitting(true);
      await qcApi.inspect({
        grnItemId: selectedGrnItem.id,
        approvedQty: Number(grnInspection.approvedQty),
        rejectedQty: Number(grnInspection.rejectedQty),
        actionTaken: grnInspection.actionTaken,
        remarks: grnInspection.remarks,
        temperature: grnInspection.temperature ? Number(grnInspection.temperature) : undefined,
        moistureContent: grnInspection.moistureContent ? Number(grnInspection.moistureContent) : undefined,
        packagingOk: grnInspection.packagingOk
      });

      toast.success('Material inspection recorded successfully');
      setSelectedGrnItem(null);
      fetchPending();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record material inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProdSubmit = async () => {
    if (!qcModalBatch) return;

    try {
      setIsSubmitting(true);
      await productionApi.inspectBatch(qcModalBatch.id, {
        rejectionQty: Number(qcRejectedQty),
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

  // Filter items
  const filteredGrnItems = grnItems.filter(item =>
    item.inventoryItem?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.vendorBatchNo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProdBatches = prodBatches.filter(batch =>
    batch.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.batchCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        {/* Tab Bar */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white w-fit">
          <button
            onClick={() => { setActiveTab('GRN'); setSelectedGrnItem(null); setSearchQuery(''); }}
            className={clsx(
              "px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap",
              activeTab === 'GRN' ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            Inward Materials
          </button>
          <button
            onClick={() => { setActiveTab('PRODUCTION'); setQcModalBatch(null); setSearchQuery(''); }}
            className={clsx(
              "px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap",
              activeTab === 'PRODUCTION' ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            Production Batches
          </button>
        </div>

        {activeTab === 'GRN' ? (
          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Left Side: List Panel */}
            <div className="w-full md:w-1/3 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search materials or batches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {loading && grnItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-orange-400 opacity-60" />
                    <p className="text-xs text-gray-400">Retrieving queue...</p>
                  </div>
                ) : filteredGrnItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
                    <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-[#f58220]" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Queue is completely clear!</p>
                  </div>
                ) : (
                  filteredGrnItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedGrnItem(item)}
                      className={clsx(
                        "w-full text-left p-3 transition-colors hover:bg-gray-50",
                        selectedGrnItem?.id === item.id && "bg-orange-50"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[11px] font-mono text-gray-400">GRN-{item.grn?.id.substring(0, 8)}</span>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] rounded font-semibold">M-Hold</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{item.inventoryItem?.name}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <Package className="h-3 w-3 text-gray-400" />
                        {item.receivedQty} {item.inventoryItem?.unit}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right Side: Form Panel */}
            <div className="flex-1 w-full bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
              {!selectedGrnItem ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                  <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                    <ClipboardCheck className="h-8 w-8 text-[#f58220]" />
                  </div>
                  <p className="text-gray-800 font-semibold">Ready for Material QC</p>
                  <p className="text-gray-500 text-sm mt-1 max-w-xs">Select an inward GRN material consignment to inspect.</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1 text-xs">
                        <span className="font-semibold text-[#f58220]">Material Verification</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-500">{selectedGrnItem.grn?.procurementOrder?.vendor?.name}</span>
                      </div>
                      <h2 className="text-lg font-bold text-gray-800">{selectedGrnItem.inventoryItem?.name}</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[11px] font-mono text-gray-500">Batch: {selectedGrnItem.vendorBatchNo || 'N/A'}</span>
                        <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[11px] font-mono text-gray-500">PO: {selectedGrnItem.grn?.procurementOrder?.poNumber || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">Total Received</p>
                      <p className="text-xl font-bold text-gray-800">{selectedGrnItem.receivedQty} <span className="text-sm text-gray-400">{selectedGrnItem.inventoryItem?.unit}</span></p>
                    </div>
                  </div>

                  {/* Form Content */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6">

                    {/* Physical Parameters */}
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Thermometer className="h-3.5 w-3.5 text-[#f58220]" /> Physical Parameters
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Temperature (°C)</label>
                          <input
                            type="number"
                            placeholder="24.5"
                            value={grnInspection.temperature}
                            onChange={(e) => setGrnInspection({ ...grnInspection, temperature: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Moisture Content (%)</label>
                          <input
                            type="number"
                            placeholder="12.0"
                            value={grnInspection.moistureContent}
                            onChange={(e) => setGrnInspection({ ...grnInspection, moistureContent: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Packaging Integrity</label>
                          <button
                            onClick={() => setGrnInspection({ ...grnInspection, packagingOk: !grnInspection.packagingOk })}
                            className={clsx(
                              "w-full py-2 px-3 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                              grnInspection.packagingOk ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
                            )}
                          >
                            {grnInspection.packagingOk ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            {grnInspection.packagingOk ? 'Intact & Sealed' : 'Damaged / Leaked'}
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Quantity Tally */}
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-[#f58220]" /> Accepted vs Rejected
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div>
                          <div className="flex justify-between items-center text-xs font-medium text-gray-500 mb-2">
                            <span className="text-[#f58220]">Accepted Quantity</span>
                            <span>Usable Stock</span>
                          </div>
                          <input
                            type="number"
                            value={grnInspection.approvedQty}
                            onChange={(e) => handleGrnQtyChange('approvedQty', Number(e.target.value))}
                            className="w-full text-2xl font-bold bg-transparent outline-none text-gray-800"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center text-xs font-medium text-gray-500 mb-2">
                            <span className="text-rose-500">Rejected Quantity</span>
                            <span>Deducted Stock</span>
                          </div>
                          <input
                            type="number"
                            value={grnInspection.rejectedQty}
                            onChange={(e) => handleGrnQtyChange('rejectedQty', Number(e.target.value))}
                            className="w-full text-2xl font-bold bg-transparent outline-none text-gray-800"
                          />
                        </div>
                      </div>
                    </section>

                    {/* Final Disposition */}
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 text-[#f58220]" /> Final Disposition
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { id: 'APPROVE', label: 'Release Stock', icon: CheckCircle2, activeColor: 'border-[#f58220] text-[#f58220] bg-orange-50' },
                          { id: 'REJECT_RETURN', label: 'Return Vendor', icon: Trash2, activeColor: 'border-amber-500 text-amber-600 bg-amber-50' },
                          { id: 'REJECT_SCRAP', label: 'Scrap/Destroy', icon: XCircle, activeColor: 'border-rose-500 text-rose-600 bg-rose-50' },
                          { id: 'REWORK', label: 'Internal Rework', icon: RefreshCw, activeColor: 'border-sky-500 text-sky-600 bg-sky-50' }
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => setGrnInspection({ ...grnInspection, actionTaken: btn.id })}
                            className={clsx(
                              "flex flex-col items-center gap-2 p-3 border rounded-lg text-[11px] font-semibold transition-colors",
                              grnInspection.actionTaken === btn.id ? btn.activeColor : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                            )}
                          >
                            <btn.icon className="h-4 w-4" />
                            <span>{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Remarks */}
                    <section>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Inspection Remarks</label>
                      <textarea
                        rows={3}
                        placeholder="Enter remarks..."
                        value={grnInspection.remarks}
                        onChange={(e) => setGrnInspection({ ...grnInspection, remarks: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white resize-none"
                      />
                    </section>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setSelectedGrnItem(null)}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white transition-colors"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={handleGrnSubmit}
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-60 transition-colors flex items-center gap-2"
                    >
                      {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      Record Inspection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Production Batches — a plain table + an Inspect dialog. Not a
             lab QMS screen: no moisture/color/texture parameters, no
             multi-way disposition toggle — just accept/reject quantities
             against what was actually produced. */
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
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">{batch.batchCode}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{batch.product?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{batch.quantity} {batch.product?.unit || 'units'}</td>
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
          </div>
        )}
      </div>

      {/* QC Inspection Dialog */}
      {qcModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">QC Inspection</h3>
                <p className="text-xs text-gray-500 mt-0.5">Batch: {qcModalBatch.batchCode}</p>
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
                  <p className="text-sm font-semibold text-gray-800">{qcModalBatch.product?.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Produced Quantity</p>
                  <p className="text-sm font-semibold text-gray-800">{qcModalBatch.quantity} {qcModalBatch.product?.unit || 'units'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">QC Decision</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setQcRejectedQty(0); setQcRemarks(''); }}
                    className={clsx(
                      "py-2.5 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                      qcRejectedQty === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept
                  </button>
                  <button
                    onClick={() => setQcRejectedQty(qcModalBatch.quantity)}
                    className={clsx(
                      "py-2.5 border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                      qcRejectedQty > 0 ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>

              {qcRejectedQty > 0 ? (
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
                    <p className="text-xs text-gray-500 mt-1.5">Accepted: {(qcModalBatch.quantity - qcRejectedQty).toFixed(2)} {qcModalBatch.product?.unit || 'units'}</p>
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
                  <p className="text-xl font-bold text-gray-800">{qcModalBatch.quantity} <span className="text-sm text-gray-400">{qcModalBatch.product?.unit || 'units'}</span></p>
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
                disabled={isSubmitting || (qcRejectedQty > 0 && !qcRemarks.trim())}
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
