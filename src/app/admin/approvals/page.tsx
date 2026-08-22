"use client";

import { useState, useEffect } from "react";
import {
  Workflow,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  IndianRupee,
  Info,
  Calendar,
  User,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { workflowApprovalsApi } from "@/lib/api";

// ─── TYPES & STAGE CONFIG ───────────────────────────────────────────────────
// Mirrors the server-side stage sequences in
// ERP-backend/src/modules/workflow-approvals/stage-config.ts — the backend
// is the actual authority on which permission gates a stage; this copy only
// drives display (labels/descriptions) and the button's enabled/disabled hint.

interface Stage {
  key: string;
  label: string;
  requiredPermission: string;
  roleLabel: string; // display-only, matches the seeded system role that holds requiredPermission
  desc: string;
}

const PURCHASE_STAGES: Stage[] = [
  { key: "REQUEST", label: "Purchase Request", requiredPermission: "purchase:create", roleLabel: "Super Admin (HQ)", desc: "Logged by procurement department" },
  { key: "MANAGER_APPROVE", label: "Manager Approval", requiredPermission: "purchase:manager_approve", roleLabel: "Purchase Manager", desc: "Verify necessity and quantity limits" },
  { key: "ORDER", label: "Purchase Order", requiredPermission: "purchase:order_dispatch", roleLabel: "Purchase Manager", desc: "PO dispatched to vendor" },
  { key: "GRN", label: "GRN Receipt", requiredPermission: "purchase:grn_approve", roleLabel: "Factory Manager", desc: "Received at warehouse and verified" },
  { key: "ACCOUNTS_VERIFY", label: "Accounts Review", requiredPermission: "purchase:accounts_verify", roleLabel: "Accounts Reviewer", desc: "Verify invoice against GRN checklist" },
  { key: "PAYMENT", label: "Vendor Payment", requiredPermission: "purchase:payment_release", roleLabel: "Accounts Reviewer", desc: "Funds released to vendor bank account" },
];

const PRODUCTION_STAGES: Stage[] = [
  { key: "PLAN", label: "Production Plan", requiredPermission: "production:plan_create", roleLabel: "Super Admin (HQ)", desc: "Production target scheduled" },
  { key: "FACTORY_APPROVE", label: "Factory Approval", requiredPermission: "production:factory_approve", roleLabel: "Factory Manager", desc: "Check raw material sufficiency" },
  { key: "EXECUTION", label: "Execution", requiredPermission: "production:execution", roleLabel: "Factory Manager", desc: "Manufacturing batch underway" },
  { key: "QC", label: "QC Verification", requiredPermission: "production:qc_verify", roleLabel: "QC Auditor", desc: "Sample testing and validation" },
  { key: "FINISHED_ENTRY", label: "Finished Goods Entry", requiredPermission: "production:finished_entry", roleLabel: "Super Admin (HQ)", desc: "Items added to inventory" },
];

const EXPENSE_STAGES: Stage[] = [
  { key: "ENTRY", label: "Expense Entry", requiredPermission: "expense:entry_create", roleLabel: "Super Admin (HQ)", desc: "Operational invoice received" },
  { key: "DEPT_APPROVE", label: "Dept Approval", requiredPermission: "expense:dept_approve", roleLabel: "Factory Manager", desc: "Head of department validation" },
  { key: "ACCOUNTS_APPROVE", label: "Accounts Approval", requiredPermission: "expense:accounts_approve", roleLabel: "Accounts Reviewer", desc: "General ledger classification review" },
  { key: "PAYMENT_RELEASE", label: "Payment Release", requiredPermission: "expense:payment_release", roleLabel: "Accounts Reviewer", desc: "Disbursement completed" },
];

type Category = "PURCHASE" | "PRODUCTION" | "EXPENSE";

interface WorkflowHistoryEntry {
  id: string;
  stage: string;
  timestamp: string;
  userLabel: string;
  notes: string | null;
  isOverride: boolean;
}

interface WorkflowItem {
  id: string;
  displayId: string;
  title: string;
  category: Category;
  amount?: number | null;
  currentStage: string;
  initiatedBy: string;
  dateInitiated: string;
  details: Record<string, string>;
  history: WorkflowHistoryEntry[];
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Category>("PURCHASE");
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<WorkflowItem | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchItems(activeTab);
  }, [activeTab]);

  const fetchItems = async (category: Category) => {
    setLoading(true);
    try {
      const res = await workflowApprovalsApi.getAll(category);
      setItems(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to load workflow requests");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to retrieve stage configuration
  const getStagesForCategory = (cat: Category): Stage[] => {
    if (cat === "PURCHASE") return PURCHASE_STAGES;
    if (cat === "PRODUCTION") return PRODUCTION_STAGES;
    return EXPENSE_STAGES;
  };

  const getStageIndex = (stages: Stage[], stageKey: string) => stages.findIndex((s) => s.key === stageKey);

  const isSuperAdmin = (user?.role || "").toUpperCase() === "SUPER_ADMIN";

  // UI-only hint for enabling/disabling the button — the server re-checks this
  // for real on every approve call, so this can never be used to bypass anything.
  const isAuthorizedToApprove = (item: WorkflowItem) => {
    if (isSuperAdmin) return true;
    const stages = getStagesForCategory(item.category);
    const curIdx = getStageIndex(stages, item.currentStage);
    if (curIdx === -1) return false;
    return !!user?.customRole?.permissions?.includes(stages[curIdx].requiredPermission);
  };

  const handleApprove = async (itemId: string, notes?: string) => {
    setApproving(true);
    try {
      const res = await workflowApprovalsApi.approve(itemId, notes);
      const updated: WorkflowItem = res.data;
      setItems((prev) => prev.map((x) => (x.id === itemId ? updated : x)));
      setSelectedItem((prev) => (prev?.id === itemId ? updated : prev));
      toast.success(`Advanced '${updated.title}' to the next gate.`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-white p-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Workflow size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Approval Workflow System</h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control operational accountability & sign-off gates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Your Access */}
      <div className="bg-white dark:bg-card/40 backdrop-blur-xl border border-slate-100 dark:border-white/5 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="text-indigo-500" size={18} />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Your Access</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <User size={12} /> {isSuperAdmin ? "Super Admin (HQ)" : "Franchise Admin"}
          </span>
          {user?.customRole ? (
            <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {user.customRole.name}
            </span>
          ) : !isSuperAdmin ? (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 italic">No department role assigned</span>
          ) : null}
        </div>
        {isSuperAdmin && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-3 flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            Approving a gate outside your assigned department role is recorded as a Super Admin override in the audit log.
          </p>
        )}
      </div>

      {/* Main Workflow Switch Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-px">
        {[
          { key: "PURCHASE", label: "Purchase Approvals", desc: "Procurement & vendor chain" },
          { key: "PRODUCTION", label: "Production Approvals", desc: "Formulation to finished goods" },
          { key: "EXPENSE", label: "Expense Approvals", desc: "Operational spending releases" },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as Category);
                setSelectedItem(null);
              }}
              className={clsx(
                "pb-3.5 px-4 text-left border-b-2 font-black text-xs uppercase tracking-wider transition-all",
                active
                  ? "border-indigo-500 text-indigo-500 dark:text-white"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <span>{tab.label}</span>
              <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 capitalize tracking-normal">{tab.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Visual Workflow Steps Panel */}
      <div className="bg-slate-50 dark:bg-white/[0.01] rounded-3xl p-6 border border-slate-100 dark:border-white/5">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pipeline Steps Flow</h3>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {getStagesForCategory(activeTab).map((s, idx, arr) => {
            const isLast = idx === arr.length - 1;
            return (
              <div key={s.key} className="flex-1 flex items-center gap-3 min-w-[160px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">{s.label}</p>
                    <p className="text-[8px] text-slate-400 uppercase tracking-wide font-black mt-0.5">Role: {s.roleLabel}</p>
                  </div>
                </div>
                {!isLast && <ChevronRight size={14} className="text-slate-300 dark:text-white/10 hidden md:block" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid of Work items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Active Request Queue ({items.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white dark:bg-card/40 border border-slate-100 dark:border-white/5 rounded-3xl p-12 text-center text-slate-400">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-bold uppercase tracking-wide">All cleared!</p>
              <p className="text-xs text-slate-400 mt-1">No pending workflow requests in this pipeline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => {
                const stages = getStagesForCategory(item.category);
                const curIdx = getStageIndex(stages, item.currentStage);
                const progressPct = ((curIdx) / (stages.length - 1)) * 100;
                const nextAuthorized = isAuthorizedToApprove(item);
                const isFinished = curIdx === stages.length - 1;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={clsx(
                      "bg-white dark:bg-card/40 border rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden group",
                      selectedItem?.id === item.id ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-slate-100 dark:border-white/5"
                    )}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[9px] font-black font-mono bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded">
                          {item.displayId}
                        </span>
                        {item.amount != null && (
                          <span className="text-xs font-black text-slate-800 dark:text-emerald-400 flex items-center">
                            <IndianRupee size={11} /> {item.amount.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors uppercase leading-tight line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">Initiated by {item.initiatedBy}</p>
                    </div>

                    <div className="space-y-3">
                      {/* Current Stage Badge */}
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">CURRENT GATE:</span>
                        <span className={clsx(
                          "px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px]",
                          isFinished
                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        )}>
                          {stages[curIdx]?.label}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all duration-500",
                              isFinished ? "bg-emerald-500" : "bg-indigo-500"
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          <span>{stages[0].label}</span>
                          <span>{stages[stages.length - 1].label}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar size={10} /> {new Date(item.dateInitiated).toLocaleDateString()}
                      </span>

                      {!isFinished ? (
                        <button
                          disabled={approving}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(item.id);
                          }}
                          className={clsx(
                            "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50",
                            nextAuthorized
                              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                              : "bg-slate-100 text-slate-400 dark:bg-white/5 cursor-not-allowed"
                          )}
                          title={nextAuthorized ? "Click to approve" : `Requires ${stages[curIdx].roleLabel}`}
                        >
                          Approve <ArrowRight size={10} />
                        </button>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Signed Off
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Item Detail Panel Drawer */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-card/40 backdrop-blur-xl border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm sticky top-6">
            {selectedItem ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black font-mono bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2.5 py-1 rounded">
                      {selectedItem.displayId}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{selectedItem.category} FLOW</span>
                  </div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white uppercase leading-snug">
                    {selectedItem.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-bold">Initiated on {new Date(selectedItem.dateInitiated).toLocaleDateString()} by {selectedItem.initiatedBy}</p>
                </div>

                <div className="h-[1px] bg-slate-100 dark:bg-white/5" />

                {/* Metadata Fields */}
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Metadata Parameters</h4>
                  <div className="space-y-1.5">
                    {Object.entries(selectedItem.details || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-white/[0.01] rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">{key}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-black">{val}</span>
                      </div>
                    ))}
                    {selectedItem.amount != null && (
                      <div className="flex justify-between items-center text-xs p-2 bg-emerald-50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-500/10">
                        <span className="text-emerald-500 font-bold uppercase text-[9px]">Total Value</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center"><IndianRupee size={12} /> {selectedItem.amount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit History Log */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Approval Audit Log</h4>
                  <div className="relative border-l border-slate-200 dark:border-white/10 ml-2.5 space-y-4">
                    {selectedItem.history.map((hist) => (
                      <div key={hist.id} className="relative pl-6">
                        <div className={clsx(
                          "absolute -left-1.5 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900",
                          hist.isOverride ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-1.5">
                            {getStagesForCategory(selectedItem.category).find(s => s.key === hist.stage)?.label || hist.stage}
                            {hist.isOverride && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                Super Admin Override
                              </span>
                            )}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{new Date(hist.timestamp).toLocaleString()} · by {hist.userLabel}</p>
                          {hist.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">"{hist.notes}"</p>}
                        </div>
                      </div>
                    ))}

                    {/* Pending next action marker */}
                    {getStageIndex(getStagesForCategory(selectedItem.category), selectedItem.currentStage) < getStagesForCategory(selectedItem.category).length - 1 && (
                      <div className="relative pl-6">
                        <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                        <div>
                          <p className="text-xs font-black text-amber-500 uppercase tracking-tight">
                            Pending: {getStagesForCategory(selectedItem.category).find(s => s.key === selectedItem.currentStage)?.label}
                          </p>
                          <p className="text-[9px] text-slate-400 font-black uppercase mt-0.5 tracking-wider">
                            Required Role: {getStagesForCategory(selectedItem.category).find(s => s.key === selectedItem.currentStage)?.roleLabel}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Advance Area */}
                {getStageIndex(getStagesForCategory(selectedItem.category), selectedItem.currentStage) < getStagesForCategory(selectedItem.category).length - 1 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                    {isAuthorizedToApprove(selectedItem) ? (
                      <div className="space-y-3">
                        <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 rounded-xl">
                          <ShieldCheck size={12} /> You are authorized to approve this gate.
                        </p>
                        <button
                          disabled={approving}
                          onClick={() => handleApprove(selectedItem.id)}
                          className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          Sign & Release To Next Gate <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-white/[0.01] border border-slate-100 dark:border-white/5 rounded-2xl space-y-2">
                        <div className="flex gap-2 text-slate-400">
                          <Info size={16} className="shrink-0 text-amber-500" />
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-normal">
                            Your assigned role does not match the required gatekeeper role ({getStagesForCategory(selectedItem.category).find(s => s.key === selectedItem.currentStage)?.roleLabel}) for this gate.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Info size={36} className="text-slate-300 dark:text-white/10 mx-auto mb-3" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">No Request Selected</h4>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">Click on any request card from the queue to view its metadata parameters and complete audit timeline.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
