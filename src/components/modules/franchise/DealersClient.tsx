"use client";

import React, { useState, useEffect } from "react";
import {
  Search, Filter, ChevronDown, Plus, Settings, MoreVertical,
  Edit3, Printer, FileText as ExcelIcon, X, Info, Store,
  MapPin, Phone as PhoneIcon, Mail, Building2, XCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import api, { franchiseApi, posApi, settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";
import PartyStatement from "@/components/documents/PartyStatement";
import TransactionActionsMenu from "@/components/documents/TransactionActionsMenu";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

const dealerSectionLabelClass = "block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-3 pb-2 border-b border-gray-100 dark:border-white/5";

interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  franchiseId: string;
  franchise?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export default function DealersClient() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";

  const [scope, setScope] = useState<"HQ" | "FRANCHISE">("HQ");
  const [franchises, setFranchises] = useState<any[]>([]);
  const [franchisesLoading, setFranchisesLoading] = useState(true);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");

  useEffect(() => {
    if (!isSuper) {
      setFranchisesLoading(false);
      return;
    }
    setFranchisesLoading(true);
    franchiseApi.getAll()
      .then((res) => setFranchises(res.data ?? []))
      .catch((err) => console.error("Failed to load franchises list", err))
      .finally(() => setFranchisesLoading(false));
  }, [isSuper]);

  const hqFranchiseId = franchises.find((f: any) => f.isHQ)?.id;
  const effectiveFranchiseId = isSuper
    ? (scope === "HQ" ? hqFranchiseId : selectedFranchiseId)
    : (user as any)?.franchiseId;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Read-only invoice viewer state — View/Print/Download all reuse the one
  // fetched Order, they never create or alter anything.
  const [invoiceDoc, setInvoiceDoc] = useState<any>(null);
  const [invoiceAction, setInvoiceAction] = useState<'print' | 'download' | undefined>(undefined);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const currentCompany = companyProfile || FALLBACK_COMPANY;

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => { if (res.data) setCompanyProfile(res.data); })
      .catch(() => {});
  }, []);


  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  
  const [isTransactionSearchOpen, setIsTransactionSearchOpen] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDealerId, setEditDealerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    franchiseId: ""
  });

  const [dealerTransactions, setDealerTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const transactionTypes = [
    "Sale", "Sale (e-Invoice)", "Purchase", "Credit Note", 
    "Debit Note", "Sale Order", "Purchase Order", "Payment-In", 
    "Payment-Out", "Estimate", "Delivery Challan", "Journal Entry"
  ];
  
  const [filters, setFilters] = useState({
    all: false,
    active: false,
    inactive: false
  });

  const fetchDealerTransactions = async (dealerId: string) => {
    setTransactionsLoading(true);
    try {
      const res = await api.get(`/api/dealers/${dealerId}/transactions`);
      setDealerTransactions(res.data || []);
    } catch (error) {
      console.error(error);
      setDealerTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDealerId) {
      fetchDealerTransactions(selectedDealerId);
    } else {
      setDealerTransactions([]);
    }
  }, [selectedDealerId]);

  const transactions = dealerTransactions.filter((t) => {
    if (!transactionSearchQuery.trim()) return true;
    const q = transactionSearchQuery.trim().toLowerCase();
    return (
      (t.type && String(t.type).toLowerCase().includes(q)) ||
      (t.number && String(t.number).toLowerCase().includes(q)) ||
      (t.date && formatDate(t.date).toLowerCase().includes(q))
    );
  });

  const fetchDealers = async () => {
    if (isSuper && franchisesLoading) return;
    if (isSuper && scope === "FRANCHISE" && !selectedFranchiseId) {
      setDealers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fId = effectiveFranchiseId;
      const url = fId ? `/api/dealers?franchiseId=${fId}` : `/api/dealers`;
      const res = await api.get(url);
      const data = res.data || [];
      setDealers(data);
      if (!selectedDealerId && data.length > 0) {
        setSelectedDealerId(data[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load dealers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, [user, isSuper, scope, selectedFranchiseId, franchisesLoading, effectiveFranchiseId]);

  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Dealer Name is required.");
      return;
    }

    // Editing an existing dealer only updates its own fields — no franchise
    // scope re-validation needed (a dealer's franchise assignment doesn't
    // change from this form).
    if (isEditMode && editDealerId) {
      try {
        await api.patch(`/api/dealers/${editDealerId}`, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address
        });
        toast.success("Dealer updated successfully");
        setShowAddModal(false);
        setIsEditMode(false);
        setEditDealerId(null);
        setFormData({ name: "", email: "", phone: "", address: "", franchiseId: "" });
        fetchDealers();
      } catch (error: any) {
        toast.error(error.response?.data?.error || "Failed to update dealer");
      }
      return;
    }

    if (isSuper && scope === "HQ" && !hqFranchiseId) {
      toast.error("HQ is not configured.");
      return;
    }

    if ((isSuper && scope === "FRANCHISE" && !effectiveFranchiseId) || (!isSuper && !effectiveFranchiseId)) {
      toast.error(isSuper ? "Select a franchise branch first." : "Please select a franchise branch.");
      return;
    }

    try {
      await api.post(`/api/dealers`, {
        ...formData,
        franchiseId: effectiveFranchiseId
      });
      toast.success("Dealer added successfully");
      setShowAddModal(false);
      setFormData({ name: "", email: "", phone: "", address: "", franchiseId: "" });
      fetchDealers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add dealer");
    }
  };

  const handleOpenEdit = (dealer: Dealer) => {
    setIsEditMode(true);
    setEditDealerId(dealer.id);
    setFormData({
      name: dealer.name || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      address: dealer.address || "",
      franchiseId: dealer.franchiseId || ""
    });
    setShowAddModal(true);
  };

  const selectedDealer = dealers.find(d => d.id === selectedDealerId) || null;

  // Read-only: fetches the exact existing Order (with its real invoiceNum
  // and line items) and opens it in the shared GSTInvoice viewer — no new
  // invoice/order is ever created here, this only reads GET /api/orders/:id.
  const openInvoiceAction = async (orderId: string, action: 'print' | 'download' | undefined) => {
    setLoadingInvoiceId(orderId);
    try {
      const res = await posApi.getOrderById(orderId);
      setInvoiceDoc(res.data);
      setInvoiceAction(action);
    } catch (e) {
      toast.error("Failed to load invoice");
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleDealerStatementReport = () => {
    if (!selectedDealer) {
      toast.error("Select a dealer first.");
      return;
    }
    if (dealerTransactions.length === 0) {
      toast.error("No transactions to include in the statement.");
      return;
    }
    const cleanName = selectedDealer.name.replace(/[^a-zA-Z0-9]/g, "_");
    const todayStr = new Date().toISOString().split("T")[0];
    const filename = `Dealer_Statement_${cleanName}_${todayStr}.xlsx`;

    const partyName = selectedDealer.name;
    const partyPhone = selectedDealer.phone || "-";
    const partyEmail = selectedDealer.email || "-";

    const headers = ["Party Name", "Phone", "Email", "Transaction Type", "Invoice/Transaction Number", "Date", "Total (₹)", "Balance (₹)"];
    const rows = dealerTransactions.map((t) => [
      partyName,
      partyPhone,
      partyEmail,
      t.type || "",
      t.number || "",
      formatDate(t.date),
      Number(t.total || 0),
      Number(t.balance || 0)
    ]);
    const totalAmount = dealerTransactions.reduce((s, t) => s + Number(t.total || 0), 0);
    const totalBalance = dealerTransactions.reduce((s, t) => s + Number(t.balance || 0), 0);

    const aoa = [
      ["DEALER STATEMENT"],
      [`Dealer Name: ${partyName}`, `Branch: ${selectedDealer.franchise?.name || "HQ"}`],
      [`Phone: ${partyPhone}`, `Email: ${partyEmail}`],
      [`Generated Date: ${formatDate(new Date())}`],
      [],
      headers,
      ...rows,
      [],
      ["TOTALS", "", "", "", "", "", totalAmount, totalBalance]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dealer Statement");
    XLSX.writeFile(wb, filename);
    toast.success(`Dealer Statement for ${selectedDealer.name} downloaded (.xlsx)`);
    setIsMoreMenuOpen(false);
  };

  const handleAllDealersReport = () => {
    if (dealers.length === 0) {
      toast.error("No dealer data available to download.");
      return;
    }
    const todayStr = new Date().toISOString().split("T")[0];
    const filename = `All_Dealers_Report_${todayStr}.xlsx`;

    const headers = ["#", "Dealer Name", "Phone", "Email", "Address", "Branch", "Status"];
    const rows = dealers.map((d, idx) => [
      idx + 1,
      d.name || "",
      d.phone || "—",
      d.email || "—",
      d.address || "—",
      d.franchise?.name || "HQ",
      d.status || "ACTIVE"
    ]);

    const aoa = [
      ["ALL DEALERS REPORT"],
      [`Generated Date: ${formatDate(new Date())}`, `Total Dealers: ${dealers.length}`],
      [],
      headers,
      ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All Dealers");
    XLSX.writeFile(wb, filename);
    toast.success("All Dealers report downloaded (.xlsx)");
    setIsMoreMenuOpen(false);
  };

  const filteredDealers = dealers.filter(d => {
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.all) return true;
    const checkStatus = filters.active || filters.inactive;
    if (checkStatus) {
      const statusMatch = (filters.active && d.status === 'ACTIVE') || (filters.inactive && d.status !== 'ACTIVE');
      if (!statusMatch) return false;
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-white dark:bg-background text-slate-800 dark:text-slate-100">
      
      {/* Left Sidebar - Dealer List */}
      <div className="w-[300px] border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0 bg-white dark:bg-card relative z-10">
        
        {/* Sidebar Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5">
          <button className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Dealers <ChevronDown size={18} className="text-blue-500" />
          </button>
        </div>

        {/* HQ / Franchise Scope Selector — Super Admin only */}
        {isSuper && (
          <div className="px-3 py-2 border-b border-slate-200 dark:border-white/5 space-y-2">
            <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-full p-1">
              <button
                type="button"
                onClick={() => setScope("HQ")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-full transition-colors ${scope === "HQ" ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow" : "text-slate-500 dark:text-slate-400"}`}
              >
                HQ
              </button>
              <button
                type="button"
                onClick={() => setScope("FRANCHISE")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-full transition-colors ${scope === "FRANCHISE" ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow" : "text-slate-500 dark:text-slate-400"}`}
              >
                Franchise
              </button>
            </div>
            {scope === "FRANCHISE" && (
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13151f] text-slate-800 dark:text-white rounded-full px-3 py-1.5 outline-none focus:border-blue-400"
                disabled={franchises.filter((f: any) => !f.isHQ).length === 0}
              >
                {franchises.filter((f: any) => !f.isHQ).length === 0 ? (
                  <option value="">No franchises available</option>
                ) : (
                  <>
                    <option value="">Select Franchise</option>
                    {franchises.filter((f: any) => !f.isHQ).map((f: any) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </>
                )}
              </select>
            )}
            {scope === "HQ" && !hqFranchiseId && !franchisesLoading && (
              <div className="w-full text-xs border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-full px-3 py-1.5 text-center font-medium">
                HQ is not configured
              </div>
            )}
          </div>
        )}

        {/* Search & List Headers */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-white/5 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Dealer Name" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-white rounded-full text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </div>
          
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-white/5 relative filter-popover-container">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Dealer Name</span>
              <Filter size={12} className="text-orange-500" />
            </div>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-4 mt-2 w-48 bg-white dark:bg-[#13151f] rounded-xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 p-3">
                <div className="space-y-2 mb-3">
                  {[
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Inactive" },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={(filters as any)[f.id]}
                          onChange={(e) => setFilters({...filters, [f.id]: e.target.checked, all: f.id === 'all' ? e.target.checked : false})}
                          className="peer appearance-none w-4 h-4 rounded border border-slate-300 dark:border-white/20 checked:bg-orange-500 checked:border-orange-500 cursor-pointer transition-colors bg-white dark:bg-white/5" 
                        />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{f.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button 
                    onClick={() => { setFilters({ all: true, active: false, inactive: false }); setIsFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-colors"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-colors shadow-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Status</span>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-400 animate-pulse">Loading dealers...</div>
          ) : filteredDealers.length === 0 ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-400">No dealers found</div>
          ) : (
            filteredDealers.map((d) => {
              const isActive = d.id === selectedDealerId;
              return (
                <div 
                  key={d.id}
                  onClick={() => setSelectedDealerId(d.id)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-slate-50 dark:border-white/5 transition-colors ${
                    isActive ? "bg-[#e6f4fc] dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-white/[0.02] bg-white dark:bg-transparent"
                  }`}
                >
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate pr-2">{d.name}</span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-[10px] font-bold uppercase ${d.status === 'ACTIVE' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Right Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-card">
        
        {/* Top Header Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-2.5 border-b border-slate-200 dark:border-white/5">
          <button 
            onClick={() => {
              if (isSuper && franchisesLoading) return;
              if (isSuper && scope === "FRANCHISE" && !effectiveFranchiseId) {
                toast.error("Select a franchise before adding a dealer.");
                return;
              }
              if (isSuper && scope === "HQ" && !hqFranchiseId) {
                toast.error("HQ is not configured.");
                return;
              }
              setIsEditMode(false);
              setEditDealerId(null);
              setFormData({
                name: "", email: "", phone: "", address: "", franchiseId: ""
              });
              setShowAddModal(true);
            }}
            disabled={(isSuper && franchisesLoading) || (isSuper && scope === "HQ" && !hqFranchiseId) || (isSuper && scope === "FRANCHISE" && franchises.filter((f: any) => !f.isHQ).length === 0)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
              (isSuper && franchisesLoading) || (isSuper && scope === "HQ" && !hqFranchiseId) || (isSuper && scope === "FRANCHISE" && franchises.filter((f: any) => !f.isHQ).length === 0)
                ? "bg-slate-300 dark:bg-white/10 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
            }`}
          >
            <Plus size={14} /> {isSuper && franchisesLoading ? "Loading scope..." : "Add Dealer"}
          </button>
        </div>

        {/* Dealer Details Header */}
        {selectedDealer ? (
          <div className="px-6 py-4 flex items-start justify-between border-b border-slate-200 dark:border-white/5 bg-white dark:bg-card">
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">{selectedDealer.name}</h2>
                  <button
                    onClick={() => handleOpenEdit(selectedDealer)}
                    className="text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="relative filter-popover-container">
                    <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><MoreVertical size={18} /></button>
                    {/* More Options Menu */}
                    {isMoreMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-60 bg-white dark:bg-[#13151f] rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 py-1.5">
                        {[
                          { label: "Dealer Statement (Report)", onClick: handleDealerStatementReport },
                          { label: "All Dealers (Report)", onClick: handleAllDealersReport }
                        ].map((item, i) => (
                          <button
                            key={i}
                            onClick={item.onClick}
                            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6 max-w-3xl">
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Phone Number</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selectedDealer.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Email</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selectedDealer.email || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Branch</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Building2 size={12} className="text-slate-400" />
                    {selectedDealer.franchise?.name || "HQ"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Address</p>
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400" />
                  {selectedDealer.address || "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 flex items-center justify-center border-b border-slate-200 dark:border-white/5">
            <span className="text-sm font-semibold text-slate-400">Select a dealer to view details</span>
          </div>
        )}

        {/* Transactions Section */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-card">
          {/* Section Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-white/5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Transactions</h3>
            <div className="flex items-center gap-3 text-slate-400">
              {isTransactionSearchOpen ? (
                <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-full px-3 py-1">
                  <Search size={14} className="text-slate-400" />
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Search transactions..." 
                    className="bg-transparent border-none text-xs w-32 focus:outline-none ml-2 text-slate-700 dark:text-white placeholder:text-slate-400"
                    value={transactionSearchQuery}
                    onChange={(e) => setTransactionSearchQuery(e.target.value)}
                    onBlur={() => !transactionSearchQuery && setIsTransactionSearchOpen(false)}
                  />
            {transactionSearchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setTransactionSearchQuery("")} 
              />
            )}
                  {transactionSearchQuery && (
                    <X 
                      size={14} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                      onClick={() => setTransactionSearchQuery("")} 
                    />
                  )}
                </div>
              ) : (
                <button onClick={() => setIsTransactionSearchOpen(true)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><Search size={16} /></button>
              )}
              <button
                onClick={() => {
                  if (!selectedDealer) { toast.error("Select a dealer first."); return; }
                  setIsStatementOpen(true);
                }}
                title="Print Transaction Statement"
                className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <Printer size={16} />
              </button>
              <button
                onClick={handleDealerStatementReport}
                title="Export Transactions (.xlsx)"
                className="text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <ExcelIcon size={16} fill="currentColor" className="opacity-20" />
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white dark:bg-card sticky top-0 z-10 border-b border-slate-200 dark:border-white/5">
                <tr>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5 relative filter-popover-container">
                    <div className="flex items-center justify-between">
                      Type 
                      <button onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)}>
                        <Filter size={14} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                      </button>
                    </div>
                    {/* Type Filter Popover */}
                    {isTypeFilterOpen && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#13151f] rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden flex flex-col font-normal text-slate-700 dark:text-slate-200 normal-case tracking-normal">
                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {transactionTypes.map(type => (
                            <label key={type} className="flex items-start gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={selectedTypes.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedTypes([...selectedTypes, type]);
                                  else setSelectedTypes(selectedTypes.filter(t => t !== type));
                                }}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 dark:border-white/20 text-orange-500 focus:ring-orange-500 cursor-pointer bg-white dark:bg-white/5"
                              />
                              <span className="text-[11px] leading-tight group-hover:text-slate-900 dark:group-hover:text-white">{type}</span>
                            </label>
                          ))}
                        </div>
                        <div className="p-2 border-t border-slate-100 dark:border-white/5 flex items-center gap-2 bg-white dark:bg-[#13151f]">
                          <button 
                            onClick={() => setSelectedTypes([])} 
                            className="flex-1 py-1.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
                          >
                            Clear
                          </button>
                          <button 
                            onClick={() => setIsTypeFilterOpen(false)} 
                            className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5">
                    Number
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5">
                    Date
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5 text-right">
                    Total
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5 text-right">
                    Balance
                  </th>
                  <th className="w-10 px-2 py-3 border-b border-slate-200 dark:border-white/5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {transactionsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs font-semibold text-slate-400 animate-pulse">
                      Loading transactions...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs font-semibold text-slate-400">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((t, idx) => {
                    // Only a POS Sale row has a real backing Order/Invoice —
                    // Delivery Challan rows have no invoice to view/print/download.
                    const hasInvoice = t.type === 'POS Sale' && !!t.id;
                    return (
                      <tr key={t.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{t.type}</td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{t.number}</td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{formatDate(t.date)}</td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 text-right">₹ {Number(t.total || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 text-right">₹ {Number(t.balance || 0).toFixed(2)}</td>
                        <td className="px-2 py-4 text-center">
                          <TransactionActionsMenu
                            hasInvoice={hasInvoice}
                            busy={loadingInvoiceId === t.id}
                            onView={() => openInvoiceAction(t.id, undefined)}
                            onPrint={() => openInvoiceAction(t.id, 'print')}
                            onDownload={() => openInvoiceAction(t.id, 'download')}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Dealer Transaction Statement — real print action, replaces the old no-op options dialog */}
      {isStatementOpen && selectedDealer && (
        <PartyStatement
          title="Dealer Transaction Statement"
          party={{
            name: selectedDealer.name,
            phone: selectedDealer.phone,
            email: selectedDealer.email,
            address: selectedDealer.address,
            branch: selectedDealer.franchise?.name || "HQ",
          }}
          transactions={dealerTransactions}
          onClose={() => setIsStatementOpen(false)}
        />
      )}

      {/* Row-level View/Print/Download Invoice — reads the exact existing Order, never creates one */}
      {invoiceDoc && (
        <GSTInvoice
          order={{
            id: invoiceDoc.id,
            poNumber: invoiceDoc.invoiceNum,
            createdAt: invoiceDoc.createdAt,
            discount: invoiceDoc.discountAmount || 0,
            items: (invoiceDoc.orderItems || []).map((it: any) => ({
              itemName: it.product?.name || "Item",
              quantity: it.quantity,
              price: it.price,
              gstRate: it.taxAmount > 0 ? Number(((it.taxAmount / (it.quantity * it.price)) * 100).toFixed(0)) : 0,
              hsnCode: it.product?.hsnCode || "—",
            })),
          }}
          vendor={selectedDealer ? {
            name: selectedDealer.name,
            phone: selectedDealer.phone,
            address: selectedDealer.address,
          } : { name: "Dealer" }}
          companyDetails={currentCompany}
          documentType="TAX_INVOICE"
          autoAction={invoiceAction}
          onClose={() => { setInvoiceDoc(null); setInvoiceAction(undefined); }}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">{isEditMode ? "EDIT DEALER" : "ADD DEALER"}</h2>
              <button
                onClick={() => { setShowAddModal(false); setIsEditMode(false); setEditDealerId(null); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {isSuper && !isEditMode && (
                <div>
                  <label className={dealerSectionLabelClass}>Target Scope</label>
                  <div className="w-full border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 rounded-lg px-3 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
                    {scope === "HQ"
                      ? (hqFranchiseId ? `HQ — ${franchises.find((f: any) => f.isHQ)?.name}` : "HQ is not configured")
                      : (franchises.find((f: any) => f.id === selectedFranchiseId)?.name ? `Franchise — ${franchises.find((f: any) => f.id === selectedFranchiseId)?.name}` : "No franchise selected")}
                  </div>
                </div>
              )}

              <div>
                <label className={dealerSectionLabelClass}>Business Information</label>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Dealer Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Acme Distribution"
                      className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Email</label>
                      <input
                        type="email"
                        placeholder="dealer@example.com"
                        className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        placeholder="Contact Number"
                        className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={dealerSectionLabelClass}>Address</label>
                <textarea
                  rows={3}
                  placeholder="Enter shop/office address..."
                  className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors resize-none"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-between shrink-0 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setIsEditMode(false); setEditDealerId(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
              >
                {isEditMode ? "Update Dealer" : "Save Dealer"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
