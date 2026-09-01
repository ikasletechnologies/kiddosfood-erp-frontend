"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Filter, ChevronDown, Plus, Settings, MoreVertical,
  Edit3, Phone as PhoneIcon, Clock,
  Printer, FileSpreadsheet, MoreHorizontal, BookOpen,
  X, Info, ArrowLeft, Trash2, CheckCircle2, User, Building2,
  Mail, MapPin, CreditCard, ShieldCheck, Download
} from "lucide-react";
import { toast } from "react-hot-toast";
import AddPartyModal from "@/components/modals/AddPartyModal";
import { customersApi, franchiseApi, salesApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { clsx } from "clsx";

export default function CustomersPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";

  // HQ / Franchise scope — Super Admin only.
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

  const scopeLabel = isSuper
    ? (scope === "HQ"
      ? (hqFranchiseId ? `HQ — ${franchises.find((f: any) => f.isHQ)?.name}` : "HQ is not configured")
      : (selectedFranchiseId ? `Franchise — ${franchises.find((f: any) => f.id === selectedFranchiseId)?.name}` : "No franchise selected"))
    : undefined;

  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Transactions state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [isTransactionSearchOpen, setIsTransactionSearchOpen] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const transactionTypes = [
    "Sale", "Tax Invoice", "Sale Order", "Estimate",
    "Credit Note", "Payment-In", "Delivery Challan", "Sales Return"
  ];

  const [filters, setFilters] = useState({
    all: true,
    active: false,
    inactive: false,
    toReceive: false,
    toPay: false
  });

  const [printOptions, setPrintOptions] = useState({
    itemDetails: true,
    description: true,
    paymentInfo: true,
    paymentStatus: true
  });

  const [settings, setSettings] = useState({
    partyGrouping: false,
    shippingAddress: true,
    managePartyStatus: true,
    enablePaymentReminder: true,
    reminderDays: "7",
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-popover-container')) {
        setIsFilterOpen(false);
        setIsTypeFilterOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCustomers = useCallback(async (franchiseId?: string) => {
    setLoading(true);
    try {
      const res = await customersApi.getAll(franchiseId ? { franchiseId } : {});
      const data = res.data?.customers || res.data?.data || res.data || [];
      setCustomers(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedCustomerId((prev) => prev && data.some((c: any) => c.id === prev) ? prev : data[0].id);
      } else {
        setSelectedCustomerId(null);
        setSelectedCustomerDetail(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load customer list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuper && franchisesLoading) return;

    if (isSuper && scope === "FRANCHISE" && !selectedFranchiseId) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    if (isSuper && scope === "HQ" && !hqFranchiseId) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    fetchCustomers(effectiveFranchiseId);
  }, [isSuper, scope, selectedFranchiseId, hqFranchiseId, franchisesLoading, effectiveFranchiseId, fetchCustomers]);

  // Load customer detail & transaction ledger
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomerDetail(null);
      setTransactions([]);
      return;
    }

    setDetailLoading(true);
    customersApi.getById(selectedCustomerId)
      .then(res => {
        setSelectedCustomerDetail(res.data?.data || res.data);
      })
      .catch(err => {
        console.error("Failed to fetch customer detail", err);
      })
      .finally(() => setDetailLoading(false));

    // Load actual transactions
    setTransactionsLoading(true);
    salesApi.getSalesOrders({ customerId: selectedCustomerId })
      .then(res => {
        const orders = res.data?.data || res.data || [];
        const mapped = Array.isArray(orders) ? orders.map((o: any) => ({
          type: "Sale Order",
          number: o.orderNo || o.orderNumber || `#${o.id?.slice(-6)}`,
          date: formatDate(o.createdAt),
          total: Number(o.finalAmount || o.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          balance: o.paymentStatus === 'PAID' ? "0.00" : Number(o.finalAmount || o.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
          status: o.status || 'PENDING'
        })) : [];
        setTransactions(mapped);
      })
      .catch(() => {
        setTransactions([]);
      })
      .finally(() => setTransactionsLoading(false));
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || selectedCustomerDetail || null;

  // Filtered customer list
  const filteredCustomers = customers.filter(c => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = (c.phone || c.contact || "").toLowerCase().includes(q);
      const matchEmail = (c.email || "").toLowerCase().includes(q);
      const matchGst = (c.gstNumber || c.gstin || "").toLowerCase().includes(q);
      const matchAddr = (c.address || c.billingAddress || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchEmail && !matchGst && !matchAddr) return false;
    }

    // 2. Checkbox filters
    if (filters.all) return true;

    const checkStatus = filters.active || filters.inactive;
    let statusMatch = true;
    if (checkStatus) {
      statusMatch = (filters.active && c.status === 'ACTIVE') || (filters.inactive && c.status !== 'ACTIVE');
    }

    const bal = Number(c.balance) || Number(c.closingBalance) || Number(c.openingBalance) || 0;
    const checkBalance = filters.toReceive || filters.toPay;
    let balanceMatch = true;
    if (checkBalance) {
      balanceMatch = (filters.toReceive && bal > 0) || (filters.toPay && bal < 0);
    }

    if (!checkStatus && !checkBalance) return true;

    return statusMatch && balanceMatch;
  });

  // Filtered transactions list
  const filteredTransactions = transactions.filter(t => {
    if (transactionSearchQuery.trim()) {
      const q = transactionSearchQuery.toLowerCase().trim();
      const matchNum = t.number?.toLowerCase().includes(q);
      const matchType = t.type?.toLowerCase().includes(q);
      if (!matchNum && !matchType) return false;
    }
    if (selectedTypes.length > 0) {
      if (!selectedTypes.includes(t.type)) return false;
    }
    return true;
  });

  const handleDeleteCustomer = async () => {
    if (!selectedCustomerId || !selectedCustomer) return;
    if (!window.confirm(`Are you sure you want to deactivate or delete "${selectedCustomer.name}"?`)) return;

    try {
      await customersApi.delete(selectedCustomerId);
      toast.success("Customer removed successfully");
      setIsMoreMenuOpen(false);
      setShowMobileDetail(false);
      fetchCustomers(effectiveFranchiseId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete customer");
    }
  };

  const exportToCSV = () => {
    if (!customers.length) {
      toast.error("No customers to export");
      return;
    }
    const headers = ["Name", "Phone", "Email", "GSTIN", "Address", "Balance", "Status"];
    const rows = customers.map(c => [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${(c.phone || c.contact || "").replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.gstNumber || c.gstin || "").replace(/"/g, '""')}"`,
      `"${(c.address || c.billingAddress || "").replace(/"/g, '""')}"`,
      `"${Number(c.balance || c.closingBalance || c.openingBalance || 0).toFixed(2)}"`,
      `"${c.status || 'ACTIVE'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Customers_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Customer list exported to CSV");
  };

  const handlePrintStatement = () => {
    if (!selectedCustomer) return;
    window.print();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-[calc(100vh-64px)] w-full overflow-hidden bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-w-0">

      {/* ── LEFT SIDEBAR: Customer List ───────────────────────────────────── */}
      <div className={clsx(
        "w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5 flex flex-col shrink-0 bg-white dark:bg-card relative z-10 min-w-0 shadow-2xs",
        showMobileDetail ? "hidden md:flex" : "flex h-[calc(100vh-64px)] md:h-full"
      )}>

        {/* HQ / Franchise Scope Selector (Super Admin) */}
        {isSuper && (
          <div className="p-3 border-b border-gray-200 dark:border-white/5 space-y-2 shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="flex gap-1 bg-gray-200/70 dark:bg-white/5 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setScope("HQ")}
                className={clsx(
                  "flex-1 text-xs font-bold py-1.5 rounded-lg transition-all cursor-pointer",
                  scope === "HQ" ? "bg-white dark:bg-card text-[#f58220] shadow-2xs" : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
                )}
              >
                HQ
              </button>
              <button
                type="button"
                onClick={() => setScope("FRANCHISE")}
                className={clsx(
                  "flex-1 text-xs font-bold py-1.5 rounded-lg transition-all cursor-pointer",
                  scope === "FRANCHISE" ? "bg-white dark:bg-card text-[#f58220] shadow-2xs" : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
                )}
              >
                Franchise
              </button>
            </div>
            {scope === "FRANCHISE" && (
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="w-full text-xs border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                disabled={franchises.filter((f: any) => !f.isHQ).length === 0}
              >
                {franchises.filter((f: any) => !f.isHQ).length === 0 ? (
                  <option value="" className="dark:bg-card">No franchises available</option>
                ) : (
                  <>
                    <option value="" className="dark:bg-card">Select Franchise</option>
                    {franchises.filter((f: any) => !f.isHQ).map((f: any) => (
                      <option key={f.id} value={f.id} className="dark:bg-card">{f.name}</option>
                    ))}
                  </>
                )}
              </select>
            )}
            {scope === "HQ" && !hqFranchiseId && !franchisesLoading && (
              <div className="w-full text-xs border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl px-3 py-1.5 text-center font-semibold">
                HQ is not configured
              </div>
            )}
          </div>
        )}

        {/* Search, Filter Bar & Add Button */}
        <div className="p-3 border-b border-gray-200 dark:border-white/5 space-y-2.5 shrink-0 bg-white dark:bg-card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-lg">
                <User size={16} />
              </div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">Customer Directory</h2>
            </div>
            <button
              onClick={() => {
                if (isSuper && franchisesLoading) return;
                if (isSuper && scope === "FRANCHISE" && !effectiveFranchiseId) {
                  toast.error("Select a franchise before adding a customer.");
                  return;
                }
                if (isSuper && scope === "HQ" && !hqFranchiseId) {
                  toast.error("HQ is not configured.");
                  return;
                }
                setIsAddModalOpen(true);
              }}
              disabled={(isSuper && franchisesLoading) || (isSuper && scope === "HQ" && !hqFranchiseId) || (isSuper && scope === "FRANCHISE" && franchises.filter((f: any) => !f.isHQ).length === 0)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#f58220] hover:bg-[#e8740e] text-white shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus size={13} /> Add
            </button>
          </div>

          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search Name, Phone, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-[#f58220] bg-gray-50 dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-colors"
            />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </div>

          <div className="flex items-center justify-between px-1 relative filter-popover-container">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-slate-400 hover:text-[#f58220] transition-colors cursor-pointer"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <span>Filters</span>
              <Filter size={12} className="text-[#f58220]" />
              {!filters.all && <span className="w-2 h-2 rounded-full bg-[#f58220]" />}
            </button>

            <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 font-mono">
              {filteredCustomers.length} {filteredCustomers.length === 1 ? "party" : "parties"}
            </span>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#13151f] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 z-50 p-3.5 animate-in zoom-in-95 duration-150">
                <p className="text-[11px] font-bold uppercase text-gray-400 dark:text-slate-500 tracking-wider mb-2.5">Filter Parties</p>
                <div className="space-y-2 mb-3">
                  {[
                    { id: "all", label: "All Customers" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Inactive" },
                    { id: "toReceive", label: "To Receive (Debit)" },
                    { id: "toPay", label: "To Pay (Credit)" },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={(filters as any)[f.id]}
                        onChange={(e) => setFilters({ ...filters, [f.id]: e.target.checked, all: f.id === 'all' ? e.target.checked : false })}
                        className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-[#f58220] focus:ring-orange-500 cursor-pointer bg-white dark:bg-white/5"
                      />
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">{f.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-gray-100 dark:border-white/5">
                  <button
                    onClick={() => { setFilters({ all: true, active: false, inactive: false, toReceive: false, toPay: false }); setIsFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Customer List Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-white/5">
          {loading ? (
            <div className="p-8 text-center text-xs font-semibold text-gray-400 dark:text-slate-500 space-y-2">
              <div className="w-5 h-5 border-2 border-[#f58220] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading customer directory...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs font-medium text-gray-400 dark:text-slate-500">
              No customers match your search
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isActive = c.id === selectedCustomerId;
              const bal = Number(c.balance) || Number(c.closingBalance) || Number(c.openingBalance) || 0;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setShowMobileDetail(true);
                  }}
                  className={clsx(
                    "flex items-center justify-between px-3.5 py-3 cursor-pointer transition-colors border-l-3",
                    isActive
                      ? "bg-orange-50/70 dark:bg-orange-500/10 border-[#f58220]"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.02] border-transparent bg-white dark:bg-card"
                  )}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                      {c.phone || c.contact || c.gstNumber || "No contact"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={clsx(
                      "text-xs sm:text-sm font-bold font-mono",
                      bal > 0 ? "text-emerald-600 dark:text-emerald-400" : bal < 0 ? "text-rose-500" : "text-gray-400 dark:text-slate-500"
                    )}>
                      ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {bal !== 0 && (
                      <span className={clsx(
                        "text-[9px] font-bold uppercase tracking-wider px-1 rounded mt-0.5",
                        bal > 0 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/10 text-rose-500"
                      )}>
                        {bal > 0 ? "To Receive" : "To Pay"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* ── RIGHT MAIN PANEL: Customer Details & Transactions ────────────── */}
      <div className={clsx(
        "flex-1 flex flex-col min-w-0 bg-white dark:bg-card overflow-hidden",
        showMobileDetail ? "flex h-screen md:h-full" : "hidden md:flex"
      )}>

        {/* Details Header Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-white/5 shrink-0 bg-white dark:bg-card">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Back button */}
            <button
              onClick={() => setShowMobileDetail(false)}
              className="md:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
              title="Back to Customer List"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                {selectedCustomer ? selectedCustomer.name : "Customer Details"}
              </h1>
              {selectedCustomer?.category && (
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Category: {selectedCustomer.category}
                </span>
              )}
            </div>
          </div>

          {selectedCustomer && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 dark:text-slate-400 shrink-0">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:text-[#f58220] hover:border-orange-200 dark:hover:border-orange-500/20 transition-all cursor-pointer shadow-2xs"
              >
                <Edit3 size={13} /> <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                title="Party Settings"
              >
                <Settings size={16} />
              </button>

              <div className="relative filter-popover-container">
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                  title="More Options"
                >
                  <MoreVertical size={16} />
                </button>
                {isMoreMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-[#13151f] rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 z-50 py-1.5 overflow-hidden animate-in zoom-in-95 duration-150">
                    <button
                      onClick={exportToCSV}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Download size={13} /> Export to CSV
                    </button>
                    <button
                      onClick={handlePrintStatement}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Printer size={13} /> Print Statement
                    </button>
                    <button
                      onClick={handleDeleteCustomer}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border-t border-gray-100 dark:border-white/5 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={13} /> Delete Customer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Customer Master Information Card */}
        {selectedCustomer ? (
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-card shrink-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <PhoneIcon size={12} className="text-orange-500" /> Phone Number
                </p>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-200 font-mono">
                  {selectedCustomerDetail?.phone || selectedCustomer.phone || selectedCustomer.contact || "—"}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Mail size={12} className="text-blue-500" /> Email Address
                </p>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-200 truncate" title={selectedCustomerDetail?.email || selectedCustomer.email}>
                  {selectedCustomerDetail?.email || selectedCustomer.email || "—"}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <ShieldCheck size={12} className="text-emerald-500" /> GSTIN
                </p>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-200 font-mono">
                  {selectedCustomerDetail?.gstNumber || selectedCustomer.gstNumber || selectedCustomer.gstin || "Unregistered"}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <CreditCard size={12} className="text-violet-500" /> Outstanding Balance
                </p>
                <p className={clsx(
                  "text-xs sm:text-sm font-bold font-mono",
                  (Number(selectedCustomer.balance) || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-white"
                )}>
                  ₹{Number(selectedCustomerDetail?.balance || selectedCustomer.balance || selectedCustomer.openingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <MapPin size={12} className="text-orange-500" /> Billing Address
                </p>
                <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                  {selectedCustomerDetail?.address || selectedCustomerDetail?.billingAddress || selectedCustomer.address || "—"}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <MapPin size={12} className="text-blue-500" /> Shipping Address
                </p>
                <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                  {selectedCustomerDetail?.shippingAddress || selectedCustomer.shippingAddress || selectedCustomerDetail?.address || selectedCustomer.address || "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-2">
            <User size={36} strokeWidth={1.5} className="text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-gray-700 dark:text-slate-200">No Party Selected</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Choose a customer from the left directory to view details</p>
          </div>
        )}

        {/* Transactions Section */}
        {selectedCustomer && (
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-card">
            {/* Section Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-gray-200 dark:border-white/5 shrink-0 bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider">Transaction Ledger</h3>
                <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 font-mono">({filteredTransactions.length})</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500">
                {isTransactionSearchOpen ? (
                  <div className="flex items-center bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1 shadow-2xs">
                    <Search size={13} className="text-gray-400" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search transactions..."
                      className="bg-transparent border-none text-xs w-28 sm:w-36 focus:outline-none ml-1.5 text-gray-800 dark:text-white placeholder:text-gray-400"
                      value={transactionSearchQuery}
                      onChange={(e) => setTransactionSearchQuery(e.target.value)}
                      onBlur={() => !transactionSearchQuery && setIsTransactionSearchOpen(false)}
                    />
                    {transactionSearchQuery && (
                      <X
                        size={13}
                        className="text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-slate-200 transition-colors ml-1"
                        onClick={() => setTransactionSearchQuery("")}
                      />
                    )}
                  </div>
                ) : (
                  <button onClick={() => setIsTransactionSearchOpen(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer" title="Search Transactions">
                    <Search size={15} />
                  </button>
                )}
                <button onClick={() => setIsPrintModalOpen(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer" title="Print Ledger">
                  <Printer size={15} />
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead className="bg-gray-50/75 dark:bg-white/[0.02] sticky top-0 z-10 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th className="px-4 sm:px-6 py-2.5 font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider relative filter-popover-container">
                      <div className="flex items-center justify-between">
                        <span>Type</span>
                        <button onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)} className="p-1 text-gray-400 hover:text-[#f58220] transition-colors cursor-pointer">
                          <Filter size={13} />
                        </button>
                      </div>

                      {/* Type Filter Popover */}
                      {isTypeFilterOpen && (
                        <div className="absolute top-full left-4 mt-1 w-52 bg-white dark:bg-[#13151f] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 z-50 overflow-hidden flex flex-col font-normal text-gray-800 dark:text-slate-200 normal-case tracking-normal animate-in zoom-in-95 duration-150">
                          <div className="max-h-52 overflow-y-auto custom-scrollbar p-2.5 space-y-1">
                            {transactionTypes.map(type => (
                              <label key={type} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selectedTypes.includes(type)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedTypes([...selectedTypes, type]);
                                    else setSelectedTypes(selectedTypes.filter(t => t !== type));
                                  }}
                                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-white/20 text-[#f58220] focus:ring-orange-500 cursor-pointer bg-white dark:bg-white/5"
                                />
                                <span className="text-xs font-semibold group-hover:text-gray-900 dark:group-hover:text-white">{type}</span>
                              </label>
                            ))}
                          </div>
                          <div className="p-2.5 border-t border-gray-100 dark:border-white/5 flex items-center gap-2 bg-gray-50 dark:bg-[#13151f]">
                            <button
                              onClick={() => setSelectedTypes([])}
                              className="flex-1 py-1.5 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => setIsTypeFilterOpen(false)}
                              className="flex-1 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="px-4 sm:px-6 py-2.5 font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Number</th>
                    <th className="px-4 sm:px-6 py-2.5 font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 sm:px-6 py-2.5 font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Total</th>
                    <th className="px-4 sm:px-6 py-2.5 font-bold text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {transactionsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                        <div className="w-5 h-5 border-2 border-[#f58220] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading transaction ledger...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                        No transactions recorded for this customer yet
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-800 dark:text-slate-200">{t.type}</td>
                        <td className="px-4 sm:px-6 py-3 text-xs font-mono font-bold text-orange-600 dark:text-orange-400">{t.number}</td>
                        <td className="px-4 sm:px-6 py-3 text-xs text-gray-600 dark:text-slate-400 font-mono">{t.date}</td>
                        <td className="px-4 sm:px-6 py-3 text-xs font-bold font-mono text-gray-800 dark:text-white text-right">₹{t.total}</td>
                        <td className="px-4 sm:px-6 py-3 text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 text-right">{t.balance ? `₹${t.balance}` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Print Options Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white">Print Statement Options</h3>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { id: "itemDetails", label: "Include Item Details" },
                { id: "description", label: "Include Line Descriptions" },
                { id: "paymentInfo", label: "Include Payment History" },
                { id: "paymentStatus", label: "Show Settlement Status" }
              ].map(opt => (
                <label key={opt.id} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white">{opt.label}</span>
                  <input
                    type="checkbox"
                    checked={(printOptions as any)[opt.id]}
                    onChange={(e) => setPrintOptions({ ...printOptions, [opt.id]: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-[#f58220] focus:ring-orange-500 bg-white dark:bg-white/5 cursor-pointer"
                  />
                </label>
              ))}
            </div>
            <div className="px-5 py-3.5 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
              <button onClick={() => setIsPrintModalOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsPrintModalOpen(false);
                  window.print();
                }}
                className="px-4 py-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Settings Slide-over */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm bg-white dark:bg-[#13151f] border-l border-gray-200 dark:border-white/10 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10 shrink-0">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-tight">Party Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase text-gray-400 dark:text-slate-500 tracking-wider">General Preferences</span>

                {[
                  { id: "partyGrouping", label: "Enable Party Grouping" },
                  { id: "shippingAddress", label: "Separate Shipping Address" },
                  { id: "managePartyStatus", label: "Manage Active / Inactive Status" }
                ].map(opt => (
                  <label key={opt.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl cursor-pointer">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{opt.label}</span>
                    <input
                      type="checkbox"
                      checked={(settings as any)[opt.id]}
                      onChange={(e) => setSettings({ ...settings, [opt.id]: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-[#f58220] focus:ring-orange-500 cursor-pointer"
                    />
                  </label>
                ))}

                <div className="pt-2 space-y-2">
                  <label className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl cursor-pointer">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Payment Reminders</span>
                    <input
                      type="checkbox"
                      checked={settings.enablePaymentReminder}
                      onChange={(e) => setSettings({ ...settings, enablePaymentReminder: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-[#f58220] focus:ring-orange-500 cursor-pointer"
                    />
                  </label>
                  {settings.enablePaymentReminder && (
                    <div className="pl-3 space-y-1">
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">Remind payment due in (days)</span>
                      <input
                        type="number"
                        min="1"
                        value={settings.reminderDays}
                        onChange={(e) => setSettings({ ...settings, reminderDays: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-800 dark:text-white bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-white/10 shrink-0">
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  toast.success("Party settings updated");
                }}
                className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Party Modal */}
      <AddPartyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={async (data) => {
          try {
            if (isSuper && scope === "FRANCHISE" && !effectiveFranchiseId) {
              toast.error("Select a franchise before adding a customer.");
              return;
            }
            if (isSuper && scope === "HQ" && !hqFranchiseId) {
              toast.error("HQ is not configured.");
              return;
            }
            const payload = isSuper
              ? { ...data, phone: data.contact, franchiseId: effectiveFranchiseId }
              : { ...data, phone: data.contact };
            await customersApi.create(payload);
            toast.success("Customer added successfully!");
            setIsAddModalOpen(false);
            fetchCustomers(effectiveFranchiseId);
          } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to add customer");
            throw error;
          }
        }}
        title="ADD CUSTOMER"
        partyType="customer"
        scopeLabel={scopeLabel}
      />

      {/* Edit Party Modal */}
      <AddPartyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={selectedCustomerDetail || selectedCustomer}
        onSave={async (data) => {
          try {
            if (!selectedCustomerId) return;
            await customersApi.update(selectedCustomerId, { ...data, phone: data.contact });
            toast.success("Customer updated successfully!");
            setIsEditModalOpen(false);
            fetchCustomers(effectiveFranchiseId);
          } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update customer");
            throw error;
          }
        }}
        title="EDIT CUSTOMER"
        partyType="customer"
        scopeLabel={scopeLabel}
      />

    </div>
  );
}
