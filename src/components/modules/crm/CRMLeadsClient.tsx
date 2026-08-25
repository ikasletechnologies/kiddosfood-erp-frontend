"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  ArrowRight,
  Filter,
  X,
  Columns,
  Download,
  RefreshCcw,
  ChevronDown,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import api from "@/lib/api";
import { useSearchParams } from "next/navigation";

interface Lead {
  id: string;
  contactName: string;
  orgName?: string;
  email?: string;
  phone?: string;
  contactCountry?: string;
  customerCity?: string;
  leadSource?: string;
  budget?: number;
  subject?: string;
  status: string;
  assigneeId?: string;
  followUpDate?: string;
  createdAt: string;
  pipeline?: { name: string };
}

const STATUS_TABS = ["All", "New", "Open", "Contacted", "Proposal Sent", "Deal Done", "Lost", "Not Serviceable", "Deleted"];

const STATUS_MAP: Record<string, string> = {
  All: "",
  New: "NEW",
  Open: "OPEN",
  Contacted: "CONTACTED",
  "Proposal Sent": "PROPOSAL_SENT",
  "Deal Done": "DEAL_DONE",
  Lost: "LOST",
  "Not Serviceable": "NOT_SERVICEABLE",
  Deleted: "DELETED"
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  OPEN: "bg-green-100 text-green-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  PROPOSAL_SENT: "bg-purple-100 text-purple-700",
  DEAL_DONE: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
  NOT_SERVICEABLE: "bg-gray-100 text-gray-600",
  DELETED: "bg-slate-100 text-slate-500"
};

export default function CRMLeadsClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("All Leads");
  const [subTab, setSubTab] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const pipelineId = searchParams.get("pipelineId") || undefined;

  useEffect(() => {
    fetchLeads();
  }, [subTab, pipelineId]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (pipelineId) params.pipelineId = pipelineId;
      if (STATUS_MAP[subTab]) params.status = STATUS_MAP[subTab];
      if (search) params.search = search;
      const res = await api.get("/api/crm/leads", { params });
      setLeads(res.data);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchLeads();
  };

  const downloadCSV = () => {
    const headers = ["Contact Name", "Org", "Email", "Phone", "Country", "City", "Lead Source", "Budget", "Status", "Pipeline", "Created At", "Follow Up"];
    const rows = leads.map((l) => [
      l.contactName, l.orgName || "", l.email || "", l.phone || "",
      l.contactCountry || "", l.customerCity || "", l.leadSource || "",
      l.budget || "", l.status, l.pipeline?.name || "",
      new Date(l.createdAt).toLocaleDateString(),
      l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : ""
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617] -m-8 font-sans">
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-end">
          <Link
            href="/crm/leads/new"
            className="flex items-center gap-2 px-6 py-2.5 bg-[#D81159] hover:bg-[#B00E4A] text-white rounded-lg font-bold text-[13px] transition-all active:scale-95 shadow-lg shadow-pink-200/50"
          >
            <Plus size={18} strokeWidth={3} />
            Add Lead
          </Link>
        </div>

        <div className="flex items-center gap-8 border-b border-[#F0EAF0] dark:border-slate-800">
          {["All Sales Pipelines", "Forms", "All Leads", "Reports & More"].map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={clsx(
                 "pb-3 text-[13px] font-bold transition-all relative flex items-center gap-2",
                 activeTab === tab
                  ? "text-[#7C3AED]"
                  : "text-[#666] dark:text-slate-500 hover:text-[#1A1A1A] dark:hover:text-white"
               )}
            >
              {tab}
              {tab === "Reports & More" && <ChevronRight size={12} />}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7C3AED]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
               key={tab}
               onClick={() => setSubTab(tab)}
               className={clsx(
                 "text-[12px] font-bold transition-all relative min-w-fit",
                 subTab === tab
                  ? "text-[#1A1A1A] dark:text-white border-b-2 border-[#1A1A1A] dark:border-white pb-1"
                  : "text-[#999] dark:text-slate-500 hover:text-[#1A1A1A] dark:hover:text-white pb-1"
               )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="pt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-[13px] font-bold text-[#333] dark:text-white hover:text-[#7C3AED] transition-colors"
              >
                <ChevronDown size={16} className={clsx("transition-transform", !showFilters && "-rotate-90")} />
                <Filter size={16} /> Filters
                <span onClick={(e) => { e.stopPropagation(); setSubTab("All"); setSearch(""); }} className="text-[11px] text-[#999] font-medium ml-2 cursor-pointer flex items-center gap-1">
                  <X size={10} /> Clear
                </span>
                <span onClick={(e) => { e.stopPropagation(); fetchLeads(); }} className="text-[11px] text-[#999] font-medium ml-2 cursor-pointer flex items-center gap-1">
                  <RefreshCcw size={10} /> Refresh
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={downloadCSV} className="flex items-center gap-2 px-3 py-1.5 border border-[#F0EAF0] dark:border-slate-800 rounded-md text-[11px] font-bold text-[#666] hover:bg-slate-50 transition-colors">
                <Download size={14} />
                CSV
              </button>
              <div className="relative group w-64">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearch}
                  placeholder="Search Leads"
                  className="w-full pl-4 pr-10 py-2 bg-white dark:bg-slate-900 border border-[#F0EAF0] dark:border-slate-800 rounded-lg text-[13px] font-medium outline-none focus:border-[#7C3AED] transition-all"
                />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[#999]">
                  <Search size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-[#F0EAF0] dark:border-slate-800 bg-[#FAF9FA] dark:bg-slate-800/50">
            <span className="text-[12px] font-bold text-[#666]">{leads.length} Lead{leads.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-white dark:bg-slate-900 border-b border-[#F0EAF0] dark:border-slate-800">
                  {["Pipeline", "Contact Name", "Organisation", "Email", "Phone", "Created At", "Lead Source", "Budget", "Status"].map((head) => (
                    <th key={head} className="p-4 text-[11px] font-bold text-[#999] dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <Loader2 size={28} className="animate-spin text-[#7C3AED] mx-auto" />
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-40 text-center">
                       <p className="text-sm font-black text-[#1A1A1A] dark:text-white uppercase tracking-widest">No Leads Found</p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-[#F0EAF0] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-[13px] font-medium text-[#666] dark:text-slate-400">{lead.pipeline?.name || "—"}</td>
                      <td className="p-4 text-[13px] font-bold text-[#1A1A1A] dark:text-white">{lead.contactName}</td>
                      <td className="p-4 text-[13px] text-[#666] dark:text-slate-400">{lead.orgName || "—"}</td>
                      <td className="p-4 text-[13px] text-[#666] dark:text-slate-400">{lead.email || "—"}</td>
                      <td className="p-4 text-[13px] text-[#666] dark:text-slate-400">{lead.phone || "—"}</td>
                      <td className="p-4 text-[13px] text-[#666] dark:text-slate-400">{new Date(lead.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-[13px] text-[#666] dark:text-slate-400">{lead.leadSource || "—"}</td>
                      <td className="p-4 text-[13px] text-[#666] dark:text-slate-400">{lead.budget ? `₹${lead.budget.toLocaleString()}` : "—"}</td>
                      <td className="p-4">
                        <span className={clsx("px-2 py-1 rounded-md text-[11px] font-bold", STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-600")}>
                          {lead.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
