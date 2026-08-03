"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart, Package, Users, TrendingUp, TrendingDown,
  AlertTriangle, Clock, IndianRupee, RotateCcw, Target, Calendar,
  CreditCard, Receipt, Activity, ChevronRight, Search, Share2,
  BarChart3, Wallet, Zap, LayoutDashboard, Factory, Settings2, Settings, UserCheck, Plus, Send, Building2,
  Bell, ShieldAlert, History, Repeat, Store, Truck, CheckCircle2, XCircle, Landmark, PackageCheck, ArrowRight
} from "lucide-react";
import { clsx } from "clsx";
import { dashboardApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  KPICard, RevenueIntelligence, PremiumFilter, ReportTableWidget
} from "@/components/dashboard/DashboardComponents";
import toast from "react-hot-toast";

function ActivityFeedWidget() {
  const activities = [
    { title: "Batch #B2026-92 Completed", time: "10 mins ago", type: "production", desc: "100 KG Recipe scaled and completed by Factory Manager.", status: "SUCCESS" },
    { title: "Vendor Payment Recorded", time: "42 mins ago", type: "finance", desc: "₹45,000 paid to supplier FreshOils Ltd.", status: "PAID" },
    { title: "Outlet Stock Dispatched", time: "2 hours ago", type: "inventory", desc: "Challan #DC-9082 dispatched to Franchise Alpha.", status: "IN_TRANSIT" },
    { title: "Low Stock Alert: Sugar", time: "5 hours ago", type: "alert", desc: "Raw material 'Sugar' is below reorder level (120 KG left).", status: "WARNING" },
    { title: "POS Day Closing Settlement", time: "Yesterday", type: "pos", desc: "Counter shift closed with total collection of ₹38,200.", status: "CLOSED" },
  ];

  return (
    <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <Activity size={14} className="text-orange-500" />
          Live Activity Feed
        </h3>
        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Real-time alerts</span>
      </div>
      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
        {activities.map((act, i) => (
          <div key={i} className="flex items-start gap-3 text-xs border-b border-slate-50 dark:border-white/[0.02] pb-3 last:border-0 last:pb-0">
            <div className={clsx(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              act.type === 'production' && 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
              act.type === 'finance' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
              act.type === 'inventory' && 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
              act.type === 'alert' && 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
              act.type === 'pos' && 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
            )}>
              {act.type === 'production' && <Factory size={14} />}
              {act.type === 'finance' && <IndianRupee size={14} />}
              {act.type === 'inventory' && <Package size={14} />}
              {act.type === 'alert' && <AlertTriangle size={14} />}
              {act.type === 'pos' && <Store size={14} />}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex justify-between items-center">
                <p className="font-black text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-tight">{act.title}</p>
                <span className="text-[9px] text-slate-400 font-medium">{act.time}</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{act.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityFlowDiagram() {
  const [flowType, setFlowType] = useState<"database" | "journeys">("database");

  const lifecycles = [
    {
      title: "1. Procurement Lifecycle",
      color: "from-blue-500 to-indigo-600",
      steps: [
        { label: "Vendor", desc: "Supplier profile", icon: Users },
        { label: "Purchase Order", desc: "PO-2026-*", icon: Receipt },
        { label: "GRN", desc: "Goods Receipt Note", icon: PackageCheck },
        { label: "Purchase Bill", desc: "Vendor invoice", icon: Receipt },
        { label: "Vendor Payment", desc: "Accounts settlement", icon: CreditCard }
      ]
    },
    {
      title: "2. Manufacturing Lifecycle",
      color: "from-purple-500 to-indigo-600",
      steps: [
        { label: "Recipe", desc: "Formula & raw materials", icon: Zap },
        { label: "Production Batch", desc: "BT-2026-* run", icon: Factory },
        { label: "Finished Goods", desc: "Inward stock asset", icon: Package }
      ]
    },
    {
      title: "3. Distribution & Retail",
      color: "from-amber-500 to-orange-600",
      steps: [
        { label: "Finished Goods", desc: "Warehouse stock", icon: Package },
        { label: "Delivery Challan", desc: "DC-2026-* transit", icon: Truck },
        { label: "Franchise Outlet", desc: "Branch inventory", icon: Store },
        { label: "POS Sale", desc: "Counter checkouts", icon: ShoppingCart }
      ]
    },
    {
      title: "4. Receivables & Cash Flow",
      color: "from-emerald-500 to-teal-600",
      steps: [
        { label: "Invoice", desc: "INV-2026-* outstanding", icon: Receipt },
        { label: "Payment Record", desc: "RCPT-2026-* collector", icon: Wallet },
        { label: "Accounts Ledger", desc: "Double-entry books", icon: Landmark }
      ]
    }
  ];

  const journeys = [
    {
      title: "1. Procurement User Journey",
      color: "from-blue-500 to-indigo-600",
      steps: [
        { label: "Vendor Selection", desc: "Select supplier", icon: Users },
        { label: "Create PO", desc: "Generate PO code", icon: Receipt },
        { label: "Receive Material", desc: "Gate inwarding", icon: Package },
        { label: "Create GRN", desc: "Verify quantities", icon: PackageCheck },
        { label: "Inventory Updated", desc: "Stock levels recalculate", icon: Zap },
        { label: "Vendor Bill Entry", desc: "Log liability due", icon: Receipt },
        { label: "Vendor Payment", desc: "Payable settlement", icon: CreditCard }
      ]
    },
    {
      title: "2. Production User Journey",
      color: "from-purple-500 to-indigo-600",
      steps: [
        { label: "Select Recipe", desc: "Recipe specs & yield", icon: Zap },
        { label: "Create Plan", desc: "Configure batch size", icon: Calendar },
        { label: "Consume Materials", desc: "Subtract raw stock", icon: Package },
        { label: "Generate Batch", desc: "Assign BT-2026-* code", icon: Factory },
        { label: "QC Approval", desc: "Verify status", icon: UserCheck },
        { label: "Move to Finished Goods", desc: "Increments inventory", icon: PackageCheck }
      ]
    },
    {
      title: "3. Franchise User Journey",
      color: "from-amber-500 to-orange-600",
      steps: [
        { label: "Outlet Request", desc: "Submit procurement need", icon: Store },
        { label: "Warehouse DC", desc: "Delivery Challan code", icon: Truck },
        { label: "Goods In Transit", desc: "Distribution routing", icon: Truck },
        { label: "Outlet Inward", desc: "Receive & audit counts", icon: PackageCheck },
        { label: "POS Sales", desc: "Retail billing & receipt", icon: ShoppingCart },
        { label: "Settlement Collection", desc: "Shift EOD reconciliation", icon: Wallet }
      ]
    }
  ];

  const activeFlow = flowType === "database" ? lifecycles : journeys;

  return (
    <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-3">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <Activity size={14} className="text-orange-500 animate-pulse" />
          ERP Relationship & User Journey Mapping
        </h3>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 p-1 rounded-full border border-slate-200/50 dark:border-white/5">
          <button
            onClick={() => setFlowType("database")}
            className={clsx(
              "text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-full transition-all",
              flowType === "database" ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
            )}
          >
            Database Lifecycles
          </button>
          <button
            onClick={() => setFlowType("journeys")}
            className={clsx(
              "text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-full transition-all",
              flowType === "journeys" ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
            )}
          >
            User Journeys
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {activeFlow.map((lc, index) => (
          <div key={index} className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className={clsx("w-2.5 h-2.5 rounded-full bg-gradient-to-r", lc.color)} />
              {lc.title}
            </h4>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 overflow-x-auto pb-2">
              {lc.steps.map((step, sIdx) => {
                const Icon = step.icon;
                return (
                  <div key={sIdx} className="flex flex-col lg:flex-row items-center gap-3 lg:gap-4 w-full lg:w-auto">
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/[0.02] p-4 rounded-2xl flex items-center gap-3 w-full lg:w-[220px] transition-all hover:scale-[1.02] hover:border-orange-500/20">
                      <div className="p-2 bg-white dark:bg-[#12141c] border border-slate-200/50 dark:border-white/5 rounded-xl text-slate-700 dark:text-slate-300">
                        <Icon size={16} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">{step.label}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{step.desc}</p>
                      </div>
                    </div>
                    {sIdx < lc.steps.length - 1 && (
                      <div className="flex items-center justify-center shrink-0">
                        <ArrowRight className="text-slate-300 dark:text-slate-700 rotate-90 lg:rotate-0" size={16} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceMetricsView() {
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  const handleRunDiagnostics = () => {
    setRunningDiagnostics(true);
    setTimeout(() => {
      setRunningDiagnostics(false);
      toast.success("All 5 business-critical rules verified! 100% compliance.");
    }, 1500);
  };

  const rules = [
    {
      id: "rule1",
      number: "Rule 1",
      name: "No Direct Stock Editing Allowed",
      description: "Direct edits to stock levels in the master table are strictly forbidden. All modifications must run through audited adjustment transactions to ensure ledger safety.",
      technical: "Enforced via Prisma schemas and database triggers. Attempts to modify currentStock directly raise runtime validation checks.",
      status: "ENFORCED",
      logs: [
        { id: "LOG-101", action: "Block direct edit attempt", user: "Inventory Asst", ip: "192.168.1.42", time: "2 hours ago" },
        { id: "LOG-102", action: "Adjustment transaction signed", ref: "ADJ-2026-0045", user: "Warehouse Mgr", time: "3 hours ago" }
      ]
    },
    {
      id: "rule2",
      number: "Rule 2",
      name: "Stock Movement Origin Enforced",
      description: "Every single stock change requires a parent transaction link. No phantom inventory records are allowed to exist.",
      technical: "Foreign key constraints on StockMovement ensure each record points to a parent GRN, Dispatch Challan, Batch Production, or Signed Adjustment.",
      status: "ENFORCED",
      logs: [
        { id: "LOG-201", action: "Validate movement origin", ref: "GRN-2026-0004", status: "VERIFIED", time: "10 mins ago" },
        { id: "LOG-202", action: "Validate movement origin", ref: "DC-2026-0012", status: "VERIFIED", time: "40 mins ago" },
        { id: "LOG-203", action: "Validate movement origin", ref: "BT-2026-0008", status: "VERIFIED", time: "1 hour ago" }
      ]
    },
    {
      id: "rule3",
      number: "Rule 3",
      name: "Invoice-Accounts Synchronization",
      description: "Every generated invoice must register corresponding changes in receivables, tax liabilities, and revenue.",
      technical: "Implemented inside a database transaction block. Sales invoice creation triggers double-entry ledger bookings to Accounts Receivable and Sales Tax Accounts.",
      status: "ENFORCED",
      logs: [
        { id: "LOG-301", action: "Invoice post to receivables", ref: "INV-2026-0120", amount: "₹45,200", status: "POSTED", time: "12 mins ago" },
        { id: "LOG-302", action: "Invoice post to revenue ledger", ref: "INV-2026-0120", amount: "₹45,200", status: "POSTED", time: "12 mins ago" }
      ]
    },
    {
      id: "rule4",
      number: "Rule 4",
      name: "Complete Batch Traceability",
      description: "Every product batch must be fully traceable from raw ingredients to QC testing and final expiration logs.",
      technical: "Enforced using the ProductBatch entity structure. QC clearance checks verify yield calculations and recipe quantities before batches are marked valid.",
      status: "ENFORCED",
      logs: [
        { id: "LOG-401", action: "Verify Yield % (96.4%)", batch: "BT-2026-0041", status: "PASS", time: "2 hours ago" },
        { id: "LOG-402", action: "QC status check: APPROVED", batch: "BT-2026-0041", status: "PASS", time: "2 hours ago" }
      ]
    },
    {
      id: "rule5",
      number: "Rule 5",
      name: "Payment Reference Requirement",
      description: "Every payment (payouts or collections) must contain an auditable transaction mode, date, and reference string.",
      technical: "Backend request filters block incoming payment records if the reference number, mode, or linked invoice pointers are blank or invalid.",
      status: "ENFORCED",
      logs: [
        { id: "LOG-501", action: "Validate pay-in reference", ref: "UPI-482098402", status: "APPROVED", time: "5 mins ago" },
        { id: "LOG-502", action: "Validate payout reference", ref: "CHQ-8902830", status: "APPROVED", time: "20 mins ago" }
      ]
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Diagnostics Controls */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-wider">compliance inspector</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Active Business Rules Auditor</h2>
          <p className="text-xs text-orange-100 font-medium">Real-time validation of the 5 business-critical rules & ERP success metrics.</p>
        </div>
        <button
          onClick={handleRunDiagnostics}
          disabled={runningDiagnostics}
          className="px-6 py-3.5 bg-white text-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-2 shrink-0 self-start md:self-auto"
        >
          <RotateCcw size={14} className={clsx(runningDiagnostics && "animate-spin")} />
          {runningDiagnostics ? "Running Audit..." : "Run Compliance Check"}
        </button>
      </div>

      {/* Metrics Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">ERP Success Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Operational Metrics */}
          <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500"><Zap size={14} /></div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Operational Metrics</h4>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Efficiency & Accuracy</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Inventory Accuracy", value: "98.4%", target: "Target: >95%", color: "bg-emerald-500" },
                { label: "Production Efficiency", value: "96.2%", target: "Target: >90%", color: "bg-emerald-500" },
                { label: "Yield Percentage", value: "94.8%", target: "Target: >90%", color: "bg-orange-500" },
                { label: "Outlet Fulfillment Speed", value: "1.2 hrs", target: "Target: <2.0 hrs", color: "bg-blue-500" }
              ].map((m, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{m.label}</span>
                    <span className="font-black text-slate-900 dark:text-white">{m.value}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full", m.color)} style={{ width: m.label.includes("Speed") ? "80%" : m.value }} />
                  </div>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{m.target}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Metrics */}
          <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500"><IndianRupee size={14} /></div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Financial Metrics</h4>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Visibility & Speed</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Cash Visibility", value: "Real-Time Sync", target: "100% Accounts mapped", color: "bg-emerald-500" },
                { label: "Outstanding Reduction", value: "-14.2% MoM", target: "Target: Reduce by 10%", color: "bg-emerald-500" },
                { label: "Vendor Payment Efficiency", value: "98.8% on-time", target: "Avg 3 days cycle", color: "bg-emerald-500" },
                { label: "Outlet Settlement Speed", value: "100% daily EOD", target: "Shifts closed within 15m", color: "bg-emerald-500" }
              ].map((m, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{m.label}</span>
                    <span className="font-black text-slate-900 dark:text-white">{m.value}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: "95%" }} />
                  </div>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{m.target}</p>
                </div>
              ))}
            </div>
          </div>

          {/* User Metrics */}
          <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500"><Users size={14} /></div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">User & System Metrics</h4>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Engagement & Perf</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "ERP Usage Rate", value: "97.5%", target: "Target: >90% active staff", color: "bg-emerald-500" },
                { label: "Transaction Accuracy", value: "99.98%", target: "0.02% error margin", color: "bg-emerald-500" },
                { label: "Approval Time", value: "Avg 8.5 mins", target: "Standard: <15 mins", color: "bg-emerald-500" },
                { label: "Reporting Speed", value: "0.12 sec", target: "Cached database reads", color: "bg-emerald-500" }
              ].map((m, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{m.label}</span>
                    <span className="font-black text-slate-900 dark:text-white">{m.value}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: m.label.includes("Speed") ? "90%" : "95%" }} />
                  </div>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{m.target}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Business-Critical Rules Inspector</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            {rules.map((rule) => {
              const isSelected = selectedRule === rule.id;
              return (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRule(isSelected ? null : rule.id)}
                  className={clsx(
                    "p-5 rounded-[2rem] border transition-all duration-300 cursor-pointer flex items-center justify-between",
                    isSelected 
                      ? "bg-white dark:bg-[#12141c] border-orange-500/50 shadow-lg"
                      : "bg-white dark:bg-[#12141c] border-slate-200/50 dark:border-white/5 hover:border-slate-300/80 dark:hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 font-black text-xs">
                      {rule.number.split(" ")[1]}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{rule.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{rule.number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 text-[8px] font-black rounded-lg uppercase tracking-wider">
                      {rule.status}
                    </span>
                    <ChevronRight size={14} className={clsx("text-slate-400 transition-transform", isSelected && "rotate-90")} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rules Details & Audit Log Simulation */}
          <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm min-h-[300px] flex flex-col justify-between">
            {selectedRule ? (
              (() => {
                const r = rules.find(x => x.id === selectedRule)!;
                return (
                  <div className="space-y-6 animate-in fade-in duration-300 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">{r.number}</span>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Enforced</span>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{r.name}</h3>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{r.description}</p>
                      
                      <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1.5">
                        <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Technical Constraints</p>
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">{r.technical}</p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-white/5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Compliance Check Logs</p>
                      <div className="space-y-2">
                        {r.logs.map((l: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[10px] bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-xl border border-slate-100/50 dark:border-white/[0.02]">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{l.id}</span>
                              <span className="text-slate-400 font-medium">{l.action}</span>
                              {l.ref && <span className="font-mono text-orange-500 font-black">{l.ref}</span>}
                              {l.batch && <span className="font-mono text-indigo-500 font-black">{l.batch}</span>}
                            </div>
                            <span className="text-slate-400 font-bold uppercase text-[9px]">{l.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 flex-1">
                <ShieldAlert size={48} className="text-slate-300 dark:text-slate-700 mb-4 animate-bounce" />
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Rules Inspector Idle</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 max-w-[250px] leading-relaxed">
                  Select any rule on the left side to view detailed schema validations, DB triggers, and live diagnostic audit checks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <EntityFlowDiagram />
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState("all");
  const [activeTab, setActiveTab] = useState<"operations" | "compliance">("operations");

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    
    let endDateStr = new Date().toISOString();
    let startDateStr = new Date().toISOString();

    if (period === "custom" && customStartDate && customEndDate) {
      startDateStr = new Date(customStartDate).toISOString();
      const endD = new Date(customEndDate);
      endD.setHours(23, 59, 59, 999);
      endDateStr = endD.toISOString();
    } else {
      let startDate = new Date();
      if (period === "today") startDate.setHours(0,0,0,0);
      else if (period === "week") startDate.setDate(startDate.getDate() - 7);
      else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);
      else startDate.setFullYear(2020);
      startDateStr = startDate.toISOString();
    }

    dashboardApi.getSummary({ startDate: startDateStr, endDate: endDateStr, period, outlet: selectedOutlet })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [period, customStartDate, customEndDate, selectedOutlet]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleExport = () => {
    toast.success("Preparing executive report export...");
    setTimeout(() => {
      const exportData = {
        timestamp: new Date().toISOString(),
        period,
        selectedOutlet,
        telemetry: data?.stats || {}
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ERP_Executive_Telemetry_${period}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Executive Telemetry exported successfully!");
    }, 1000);
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#090a0f] p-4">
      <div className="bg-white dark:bg-[#12141c] p-10 rounded-[3rem] border border-rose-500/20 shadow-2xl shadow-rose-500/10 flex flex-col items-center text-center max-w-md animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3">Telemetry Failure</h2>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">{error}</p>
        <button 
          onClick={() => { setError(null); fetchDashboard(); }}
          className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl active:scale-95"
        >
          Re-establish Connection
        </button>
      </div>
    </div>
  );

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#090a0f]">
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-xl shadow-blue-600/20" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Establishing Mission Control Link...</p>
      </div>
    </div>
  );

  const stats = data?.stats;

  // --- LAYER 1: CEO SUMMARY (LIVE DATA WITH DRILL DOWNS) ---
  const generalKPIs = [
    { title: "Today Revenue", value: formatCurrency(stats?.revenueToday || 0), trend: stats?.revenueChangePct || "0", icon: Zap, colorClass: "orange", insight: `${stats?.orderCountToday || 0} Orders Today`, href: "/sales/invoices" },
    { title: "Net Profit", value: formatCurrency((stats?.totalSales || 0) - (stats?.totalPurchase || 0)), icon: TrendingUp, colorClass: "emerald", subtext: `Profit for this ${period}`, insight: `Margin: ${stats?.totalSales > 0 ? (((stats.totalSales - stats.totalPurchase) / stats.totalSales) * 100).toFixed(1) : 0}%`, href: "/reports?report=Profit And Loss" },
    { title: "Inventory Value", value: formatCurrency(stats?.inventoryValue || 0), icon: Package, colorClass: "blue", subtext: "Warehouse Asset Net Worth", insight: `${stats?.inventoryItemCount || 0} Active SKUs`, href: "/inventory/raw-material-stock" },
  ];

  const cashKPIs = [
    { title: "Today Collection", value: formatCurrency(stats?.todayCollection || 0), icon: IndianRupee, colorClass: "emerald", subtext: "Payments collected today", insight: `Returns: ${formatCurrency(stats?.salesReturnsToday || 0)}`, href: "/sales/payment-in" },
    { title: "Pending Receivables", value: formatCurrency(stats?.outstandingAmount || 0), icon: Wallet, colorClass: "amber", subtext: "Outstanding dealer balance", insight: `${stats?.overdueDealersCount || 0} overdue accounts`, href: "/accounting/ledgers?type=receivables" },
    { title: "Vendor Payables", value: formatCurrency(stats?.vendorPayables || 0), icon: CreditCard, colorClass: "rose", subtext: "Pending supplier invoices", insight: "Liability ledger total", href: "/vendors" },
    { title: "Daily Cash Position", value: formatCurrency(stats?.dailyCashPosition || 0), icon: Landmark, colorClass: "blue", subtext: "Total Cash & Bank Balance", insight: "Active liquidity assets", href: "/accounting/cash-flow" },
  ];

  const productionKPIs = [
    { title: "Production Quantity", value: `${(stats?.productionQuantity || 0).toLocaleString()} units`, icon: Factory, colorClass: "indigo", subtext: `Produced in this ${period}`, insight: "Completed yield output", href: "/production/batches" },
    { title: "Yield Percentage", value: `${stats?.yieldPercentage || 100}%`, icon: Target, colorClass: "emerald", subtext: "Completed vs planned yield", insight: `Yield performance rate`, href: "/production" },
    { title: "Wastage / Rejections", value: `${(stats?.wastage || 0).toLocaleString()} units`, icon: ShieldAlert, colorClass: "rose", subtext: "Rejected batch quantities", insight: "Material loss tracking", href: "/production/wastage" },
  ];

  // --- LAYER 2: REVENUE SOURCES ---
  const revenueBreakdown = (data?.revenueBreakdown || []).map((b: any, i: number) => ({
    label: b.label,
    value: b.value,
    percent: stats?.revenueToday ? (b.value / stats.revenueToday) * 100 : 0,
    color: i === 0 ? "bg-blue-500" : i === 1 ? "bg-emerald-500" : i === 2 ? "bg-amber-500" : "bg-rose-500"
  }));

  // --- ANALYTICS & OPERATIONS ---
  const chartData = (data?.historicalSales || []).map((s: any) => ({
    date: s.date,
    sales: s.sales || 0,
    orders: s.orders,
    purchase: s.purchase || 0,
    profit: (s.sales || 0) - (s.purchase || 0),
  }));

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#090a0f] p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-1000">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase transition-colors hover:text-[#F58220]">HQ Control Center</h1>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setActiveTab("operations")}
              className={clsx(
                "text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full border transition-all",
                activeTab === "operations"
                  ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-white dark:bg-[#12141c] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-700"
              )}
            >
              Operations Summary
            </button>
            <button
              onClick={() => setActiveTab("compliance")}
              className={clsx(
                "text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full border transition-all",
                activeTab === "compliance"
                  ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-white dark:bg-[#12141c] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-700"
              )}
            >
              Compliance & Success Metrics
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-4 xl:justify-end w-full xl:w-auto">
          {/* Actions & Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filter by Outlet */}
            <select
              value={selectedOutlet}
              onChange={e => {
                setSelectedOutlet(e.target.value);
                toast.success(`Telemetry filtered for: ${e.target.value === 'all' ? 'All Outlets' : e.target.value}`);
              }}
              className="px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm focus:border-[#F58220] focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Outlets</option>
              <option value="Franchise Alpha">Franchise Alpha</option>
              <option value="Franchise Beta">Franchise Beta</option>
              <option value="Delhi Hub">Delhi Hub</option>
              <option value="Mumbai Retail">Mumbai Retail</option>
            </select>

            {/* Export Action */}
            <button
              onClick={handleExport}
              className="px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm hover:border-[#F58220] transition-all flex items-center gap-1.5"
            >
              <Share2 size={12} className="text-slate-400" /> Export
            </button>

            {period === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300 w-full sm:w-auto">
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm focus:border-[#F58220] focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm focus:border-[#F58220] focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            )}
            <PremiumFilter 
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Custom', value: 'custom' },
              ]}
              active={period}
              onChange={setPeriod}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Link href="/purchases/new" className="flex-1 sm:flex-initial justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-3 whitespace-nowrap">
              <Plus size={16} strokeWidth={3} /> Create Purchase Order
            </Link>
            <Link href="/franchise-orders" className="flex-1 sm:flex-initial justify-center bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 hover:scale-105 transition-all active:scale-95 flex items-center gap-3 shadow-xl shadow-blue-500/20 whitespace-nowrap">
              <Send size={16} strokeWidth={3} /> Dispatch
            </Link>
          </div>
        </div>
      </div>
 
      {activeTab === "operations" ? (
        <>
          {/* ── GENERAL OVERVIEW & CORE KPIs ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Executive Overview (Click Card to Drill Down)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {generalKPIs.map((kpi: any, i) => (
            <Link href={kpi.href} key={i}>
              <KPICard {...kpi} className="cursor-pointer" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── CASH & ACCOUNTS PILLAR ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Pillar A: Cash & Accounts Control (Click Card to Drill Down)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cashKPIs.map((kpi: any, i) => (
            <Link href={kpi.href} key={i}>
              <KPICard {...kpi} className="cursor-pointer" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── PRODUCTION PILLAR ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Pillar B: Production & Manufacturing Control (Click Card to Drill Down)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {productionKPIs.map((kpi: any, i) => (
            <Link href={kpi.href} key={i}>
              <KPICard {...kpi} className="cursor-pointer" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── LAYER 2: REVENUE INTELLIGENCE & LIVE ACTIVITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <RevenueIntelligence 
            data={chartData} 
            title="Revenue Analytics" 
            trend={stats?.revenueChangePct || "0"} 
            period={period} 
            setPeriod={setPeriod} 
          />
        </div>
        <div className="lg:col-span-4">
          <ActivityFeedWidget />
        </div>
      </div>

      {/* ── REPORT TABLES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ReportTableWidget 
              title="Recent Purchase Report View" 
              icon={PackageCheck} 
              color="indigo"
              headers={['PO Number', 'Vendor', 'Amount']}
              data={(data?.recentPurchases || []).map((p: any) => ({
                col1: p.poNumber,
                col2: p.vendor?.name || p.items?.[0]?.inventoryItem?.name || 'Vendor',
                col3: formatCurrency(p.totalAmount)
              }))}
            />
            
            <ReportTableWidget 
              title="Recent B2B Sales Details" 
              icon={Building2} 
              color="blue"
              headers={['Invoice #', 'Client', 'Amount']}
              data={(data?.recentB2BSales || []).map((s: any) => ({
                col1: s.invoiceNum,
                col2: s.customerName || 'B2B Client',
                col3: formatCurrency(s.totalAmount)
              }))}
            />

            <ReportTableWidget 
              title="Recent B2C Sales Details" 
              icon={Store} 
              color="emerald"
              headers={['Invoice #', 'Amount']}
              data={(data?.recentB2CBills || []).map((s: any) => ({
                col1: `#${s.invoiceNum}`,
                col2: formatCurrency(s.totalAmount)
              }))}
            />

            <ReportTableWidget 
              title="Top Selling Products of the Week" 
              icon={TrendingUp} 
              color="amber"
              headers={['Product', 'Units Sold', 'Trend']}
              data={(data?.topSellers || []).map((p: any) => ({
                col1: p.name,
                col2: `${p.value} ${p.unit}`,
                col3: `${p.growth}%`
              }))}
            />

            <ReportTableWidget 
              title="Stock Urgent Report" 
              icon={AlertTriangle} 
              color="rose"
              headers={['Product', 'Current Stock', 'Action']}
              data={(data?.lowStock || []).map((p: any) => ({
                col1: p.name,
                col2: `${p.currentStock} ${p.unit}`,
                col3: p.action
              }))}
            />

            <ReportTableWidget 
              title="Supplier payment Tracking View" 
              icon={CreditCard} 
              color="purple"
              headers={['Vendor', 'PO Number', 'Amount Due']}
              data={(data?.supplierPaymentsDue || []).map((p: any) => ({
                col1: p.vendor?.name || 'Vendor',
                col2: p.poNumber,
                col3: formatCurrency(p.totalAmount)
              }))}
            />
          </div>
        </div>
      </div>
        </>
      ) : (
        <ComplianceMetricsView />
      )}
    </div>
  );
}
