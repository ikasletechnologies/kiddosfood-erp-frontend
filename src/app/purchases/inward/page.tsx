"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck as TruckIcon,
  Search as SearchIcon,
  PackageCheck as PackageCheckIcon,
  Calendar as CalendarIcon,
  Building2 as Building2Icon,
  Clock as ClockIcon,
  ArrowRight as ArrowRightIcon,
  Package as PackageIcon,
  FileText as FileTextIcon,
  Scan as ScanIcon,
  AlertTriangle as AlertTriangleIcon,
  CheckCircle2 as CheckCircle2Icon,
  RefreshCw as RefreshCwIcon,
  MoreVertical as MoreVerticalIcon,
  History as HistoryIcon
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";

interface DispatchedOrder {
  id: string;
  orderNumber: string;
  franchiseId: string;
  franchise?: any;
  status: string;
  totalAmount: number;
  expectedDispatchDate?: string;
  actualDispatchDate?: string;
  items: any[];
}

export default function IncomingStockPage() {
  const { user } = useAuth();
  const [dispatchedOrders, setDispatchedOrders] = useState<DispatchedOrder[]>([]);
  const [recentInwards, setRecentInwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);

  // Scanner Simulator States
  const [showScanner, setShowScanner] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<DispatchedOrder | null>(null);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [scanInput, setScanInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes] = await Promise.all([
        api.get("/api/franchise-orders")
      ]);

      const allOrders = ordersRes.data || [];
      // Orders waiting to be received
      setDispatchedOrders(allOrders.filter((o: any) => o.status === 'DISPATCHED'));
      // Recently received orders
      setRecentInwards(allOrders.filter((o: any) => o.status === 'DELIVERED').slice(0, 10));

    } catch (error) {
      toast.error("Failed to fetch incoming stock data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("erp:refresh-franchise-orders", handler);
    return () => window.removeEventListener("erp:refresh-franchise-orders", handler);
  }, [fetchData]);

  const handleReceiveStock = async (orderId: string) => {
    try {
      setReceivingOrderId(orderId);
      await api.patch(`/api/franchise-orders/${orderId}/status`, { status: 'DELIVERED' });
      toast.success("Stock Received! Inventory updated.");
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to receive stock");
    } finally {
      setReceivingOrderId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-700">

      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 pb-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 transition-all shadow-sm shrink-0"
          >
            <RefreshCwIcon size={18} className={clsx("text-slate-400", loading && "animate-spin")} />
          </button>
          {/*            
            * SCAN SHIPMENT LABEL TRIGGER
            * Opens the simulated barcode scanner modal to match dispatched orders 
            * with physical shipment barcode labels. */}

          {/* <button
            onClick={() => { setShowScanner(true); setScannedOrder(null); setScanInput(""); }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-95 shrink-0"
          >
            <ScanIcon size={18} strokeWidth={3} />
            Scan Shipment Label
          </button> */}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Pending Receipts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
              <ClockIcon size={14} /> In-Transit Shipments
            </h2>
          </div>

          <div className="space-y-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-32 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] animate-pulse" />
              ))
            ) : dispatchedOrders.length === 0 ? (
              <div className="py-20 bg-slate-50 dark:bg-white/[0.02] rounded-[48px] border-2 border-dashed border-slate-200 dark:border-white/5 text-center">
                <TruckIcon className="mx-auto mb-4 text-slate-200" size={48} />
                <p className="text-sm font-black text-slate-400 uppercase tracking-tight">No shipments in transit</p>
                <p className="text-xs text-slate-400 mt-1">Check back once HQ dispatches your orders.</p>
              </div>
            ) : (
              dispatchedOrders.map((order) => (
                <div key={order.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                    <TruckIcon size={120} />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{order.orderNumber}</h3>
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                          IN TRANSIT
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><CalendarIcon size={12} /> Dispatched: {formatDate(order.actualDispatchDate || order.expectedDispatchDate)}</span>
                        <span className="flex items-center gap-1.5"><Building2Icon size={12} /> Destination: {order.franchise?.name || "Independent Branch"}</span>
                        <span className="flex items-center gap-1.5"><PackageIcon size={12} /> {order.items?.length || 0} Product Lines</span>
                      </div>

                      <div className="flex gap-2">
                        {order.items?.slice(0, 3).map((item: any, idx) => (
                          <span key={idx} className="px-2 py-1 bg-slate-50 dark:bg-white/5 rounded-lg text-[9px] font-black text-slate-600 border border-slate-100 dark:border-white/5">
                            {item.product?.name} × {item.quantity}
                          </span>
                        ))}
                        {order.items?.length > 3 && <span className="text-[9px] font-black text-slate-400 flex items-center">+{order.items.length - 3} more</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">₹{order.totalAmount.toLocaleString()}</p>
                      <button
                        disabled={receivingOrderId === order.id}
                        onClick={() => handleReceiveStock(order.id)}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                      >
                        {receivingOrderId === order.id ? <RefreshCwIcon size={14} className="animate-spin" /> : <CheckCircle2Icon size={14} />}
                        Confirm Receipt
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: History & Tips */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-2 flex items-center gap-2">
              <HistoryIcon size={14} /> Recent Inwards
            </h2>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentInwards.length === 0 ? (
                  <div className="p-8 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-widest">No history yet</p>
                  </div>
                ) : (
                  recentInwards.map((order) => (
                    <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{order.orderNumber}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{formatDate(order.updatedAt)}</p>
                      </div>
                      <span className="text-[10px] font-black text-emerald-500">RECEIVED</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 
            * RECEIPT POLICY & AUDIT WORKFLOW
            * Governance rules for receiving goods:
            * 1. Manifest Matching: Verify actual items against electronic Purchase Inward details.
            * 2. Late Claim Penalties: Damage reporting post-receipt causes administrative delays for credit notes.
            */}
          {/* <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 p-8 rounded-[2.5rem] space-y-4 shadow-sm border-l-4 border-l-orange-500">
            <div className="flex items-center gap-3 text-orange-600">
              <AlertTriangleIcon size={24} />
              <p className="text-xs font-black uppercase tracking-tight">Receipt Policy</p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0" />
                <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 leading-relaxed">
                  Verify the physical count against the digital manifest before confirming.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0" />
                <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 leading-relaxed">
                  Reporting damages after receipt may delay credit note processing.
                </p>
              </div>
            </div>
          </div> */}


          {/* <div className="bg-slate-50 dark:bg-white/5 rounded-[2.5rem] p-8">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Stock Impact</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">Branch Stock</span>
                <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">INCREASE <ArrowRightIcon size={10} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">HQ Stock</span>
                <span className="text-[10px] font-black text-rose-500 flex items-center gap-1">DECREASE <ArrowRightIcon size={10} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">Account Payable</span>
                <span className="text-[10px] font-black text-orange-500 flex items-center gap-1">UPDATED <ArrowRightIcon size={10} /></span>
              </div>
            </div>
          </div> */}
        </div>
      </div>

      {/* 
        * ── Shipment Label Scanner Modal ──
        * Simulates a hardware/camera barcode decoder to receive in-transit shipments:
        * - Allows selecting a dispatched order to simulate a successful camera read scan.
        * - Supports manual shipment code matching.
        * - Triggers status transition to DELIVERED on confirmation, adjusting inventory and ledgers.
        */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 p-8 text-white space-y-6">

            {/* Close */}
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <h3 className="text-xl font-black tracking-tight uppercase">Shipment Scanner</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Simulated camera feed & barcode decoder</p>
            </div>

            {/* Viewfinder / Active Scan Display */}
            {!scannedOrder ? (
              <div className="relative h-48 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center group">
                {/* Laser animation */}
                <div className="absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-[scan_2s_ease-in-out_infinite] z-20" />

                {/* Corner Brackets */}
                <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-emerald-500 rounded-tl" />
                <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-emerald-500 rounded-tr" />
                <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-emerald-500 rounded-bl" />
                <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-emerald-500 rounded-br" />

                {isScanProcessing ? (
                  <div className="text-center space-y-3 z-10">
                    <RefreshCwIcon size={28} className="animate-spin text-emerald-500 mx-auto" />
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Decoding label code...</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2 z-10">
                    <ScanIcon size={40} className="text-slate-700 animate-pulse mx-auto" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Align shipment barcode inside grid</p>
                  </div>
                )}

                {/* Inline scan animation style */}
                <style dangerouslySetInnerHTML={{
                  __html: `
                  @keyframes scan {
                    0% { top: 10%; }
                    50% { top: 90%; }
                    100% { top: 10%; }
                  }
                `}} />
              </div>
            ) : (
              <div className="bg-slate-950 border border-emerald-500/20 p-6 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <CheckCircle2Icon size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Match Decoded Successfully</p>
                  <h4 className="text-xl font-black text-white uppercase">{scannedOrder.orderNumber}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">₹{scannedOrder.totalAmount.toLocaleString()} • {scannedOrder.items?.length || 0} Products</p>
                </div>
              </div>
            )}

            {/* Simulated target selector */}
            {!scannedOrder && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Simulate Scanner Camera Read:</label>
                  <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1">
                    {dispatchedOrders.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic text-center py-2 bg-slate-950 rounded-xl border border-slate-800">
                        No in-transit shipments available to scan.
                      </p>
                    ) : (
                      dispatchedOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => {
                            setIsScanProcessing(true);
                            setTimeout(() => {
                              setIsScanProcessing(false);
                              setScannedOrder(order);
                              toast.success(`Label read: ${order.orderNumber}`);
                            }, 1000);
                          }}
                          className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-tight transition-colors"
                        >
                          <span className="text-slate-300 font-mono">{order.orderNumber}</span>
                          <span className="text-orange-500 flex items-center gap-1 text-[9px] tracking-wider">Simulate Scan <ArrowRightIcon size={10} /></span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Or type shipment barcode manual:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. FO-MP8427UA-9KJW"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest text-white outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => {
                        const code = scanInput.trim().toUpperCase();
                        const matched = dispatchedOrders.find(o => o.orderNumber === code || o.id === code);
                        if (matched) {
                          setIsScanProcessing(true);
                          setTimeout(() => {
                            setIsScanProcessing(false);
                            setScannedOrder(matched);
                            toast.success(`Label matched!`);
                          }, 800);
                        } else {
                          toast.error("Invalid shipment code or not in-transit.");
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Read
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirm or Reset Actions */}
            {scannedOrder && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setScannedOrder(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors text-slate-300"
                >
                  Scan Another
                </button>
                <button
                  disabled={receivingOrderId === scannedOrder.id}
                  onClick={async () => {
                    await handleReceiveStock(scannedOrder.id);
                    setShowScanner(false);
                  }}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  {receivingOrderId === scannedOrder.id ? <RefreshCwIcon size={12} className="animate-spin" /> : <CheckCircle2Icon size={12} />}
                  Confirm Receipt
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
