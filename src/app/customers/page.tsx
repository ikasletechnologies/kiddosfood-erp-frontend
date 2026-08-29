"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search, Filter, ChevronDown, Plus, Settings, MoreVertical,
  Edit3, MessageSquare, Phone as PhoneIcon, Clock,
  Printer, FileText as ExcelIcon, MoreHorizontal, BookOpen,
  X, Info, SlidersHorizontal
} from "lucide-react";
import { toast } from "react-hot-toast";
import AddPartyModal from "@/components/modals/AddPartyModal";
import { customersApi, franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function PartiesPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";

  // HQ / Franchise scope — Super Admin only. Franchise Admin is always
  // implicitly scoped to their own franchiseId (see effectiveFranchiseId below).
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

  // HQ is resolved from the real Franchise row where isHQ === true — never a
  // hardcoded id or name.
  const hqFranchiseId = franchises.find((f: any) => f.isHQ)?.id;
  const effectiveFranchiseId = isSuper
    ? (scope === "HQ" ? hqFranchiseId : selectedFranchiseId)
    : (user as any)?.franchiseId;

  const scopeLabel = isSuper
    ? (scope === "HQ"
      ? (hqFranchiseId ? `HQ — ${franchises.find((f: any) => f.isHQ)?.name}` : "HQ is not configured")
      : (selectedFranchiseId ? `Franchise — ${franchises.find((f: any) => f.id === selectedFranchiseId)?.name}` : "No franchise selected"))
    : undefined;
  const [activeTab, setActiveTab] = useState("Transactions");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);

  const [isTransactionSearchOpen, setIsTransactionSearchOpen] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const transactionTypes = [
    "Sale", "Sale (e-Invoice)", "Purchase", "Credit Note",
    "Credit Note (e-Invoice)", "Debit Note", "Sale Order",
    "Purchase Order", "Payment-In", "Payment-Out", "Estimate",
    "Proforma Invoice", "Delivery Challan", "Receivable Opening Balance",
    "Payable Opening Balance", "Party to Party [Received]",
    "Party to Party [Paid]", "Sale FA", "Sale FA (e-Invoice)",
    "Purchase FA", "Sale[Cancelled]", "Job work out (Challan)",
    "Purchase (Job work)", "Journal Entry"
  ];

  // Fake state for filter checkboxes
  const [filters, setFilters] = useState({
    all: false,
    active: false,
    inactive: false,
    toReceive: false,
    toPay: false
  });

  // Fake state for print modal checkboxes
  const [printOptions, setPrintOptions] = useState({
    itemDetails: false,
    description: false,
    paymentInfo: false,
    paymentStatus: false
  });

  // Fake state for settings
  const [settings, setSettings] = useState({
    partyGrouping: false,
    shippingAddress: false,
    managePartyStatus: false,
    enablePaymentReminder: true,
    reminderDays: "1",
    additionalField1: false,
    field1Name: "",
    field1Print: false,
    additionalField2: false,
    field2Name: "",
    field2Print: false,
    additionalField3: false,
    field3Name: "",
    field3Print: false,
  });

  const transactions: any[] = [];

  const fetchCustomers = async (franchiseId?: string) => {
    setLoading(true);
    try {
      const res = await customersApi.getAll(franchiseId ? { franchiseId } : {});
      const data = res.data || [];
      setCustomers(data);
      if (!selectedCustomerId && data.length > 0) {
        setSelectedCustomerId(data[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load parties");
    } finally {
      setLoading(false);
    }
  };

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
  }, [isSuper, scope, selectedFranchiseId, hqFranchiseId, franchisesLoading, effectiveFranchiseId]);

  useEffect(() => {
    const fetchCustomerDetail = async () => {
      if (!selectedCustomerId) return;
      try {
        const res = await customersApi.getById(selectedCustomerId);
        setSelectedCustomerDetail(res.data);
      } catch (error) {
        console.error("Failed to fetch customer detail", error);
      }
    };
    fetchCustomerDetail();
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;

  const filteredCustomers = customers.filter(c => {
    // 1. Search filter
    // Note: Assuming there is a 'search' state. If not, we skip search for now or rely on an existing one. 
    // The previous code didn't have search state implemented in customers/page.tsx, let's just do the checkboxes.
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-[calc(100vh-64px)] w-full overflow-hidden bg-white dark:bg-background text-slate-800 dark:text-foreground min-w-0">

      {/* Left Sidebar - Party List */}
      <div className="w-full md:w-[300px] border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0 bg-white dark:bg-card relative z-10 min-w-0 max-h-[320px] md:max-h-full">

        {/* HQ / Franchise Scope Selector — Super Admin only */}
        {isSuper && (
          <div className="px-3 py-2 border-b border-slate-200 dark:border-white/5 space-y-2">
            <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-full p-1">
              <button
                type="button"
                onClick={() => setScope("HQ")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-full transition-colors ${scope === "HQ" ? "bg-white dark:bg-white/10 text-orange-600 dark:text-orange-400 shadow" : "text-slate-500 dark:text-slate-400"}`}
              >
                HQ
              </button>
              <button
                type="button"
                onClick={() => setScope("FRANCHISE")}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-full transition-colors ${scope === "FRANCHISE" ? "bg-white dark:bg-white/10 text-orange-600 dark:text-orange-400 shadow" : "text-slate-500 dark:text-slate-400"}`}
              >
                Franchise
              </button>
            </div>
            {scope === "FRANCHISE" && (
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-white/10 rounded-full px-3 py-1.5 outline-none focus:border-orange-400 bg-white dark:bg-white/5 text-slate-800 dark:text-white"
                disabled={franchises.filter((f: any) => !f.isHQ).length === 0}
              >
                {franchises.filter((f: any) => !f.isHQ).length === 0 ? (
                  <option value="" className="dark:bg-[#13151f]">No franchises available</option>
                ) : (
                  <>
                    <option value="" className="dark:bg-[#13151f]">Select Franchise</option>
                    {franchises.filter((f: any) => !f.isHQ).map((f: any) => (
                      <option key={f.id} value={f.id} className="dark:bg-[#13151f]">{f.name}</option>
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
              placeholder="Search Party Name"
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-full text-xs outline-none focus:border-orange-400 bg-white dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-white/5 relative filter-popover-container">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Party Name</span>
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
                    { id: "toReceive", label: "To Receive" },
                    { id: "toPay", label: "To Pay" },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={(filters as any)[f.id]}
                          onChange={(e) => setFilters({ ...filters, [f.id]: e.target.checked, all: f.id === 'all' ? e.target.checked : false })}
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
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
                  <button
                    onClick={() => { setFilters({ all: true, active: false, inactive: false, toReceive: false, toPay: false }); setIsFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Amount</span>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-400 animate-pulse">Loading parties...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-400">No parties match filters</div>
          ) : (
            filteredCustomers.map((c) => {
              const isActive = c.id === selectedCustomerId;
              const bal = Number(c.balance) || Number(c.closingBalance) || Number(c.openingBalance) || 0;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-slate-50 dark:border-white/5 transition-colors ${isActive ? "bg-[#e6f4fc] dark:bg-orange-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-card"
                    }`}
                >
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate pr-2">{c.name}</span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-sm font-semibold ${bal > 0 ? "text-emerald-500" : bal < 0 ? "text-rose-500" : "text-slate-400"
                      }`}>
                      {bal === 0 ? "0.00" : Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {bal !== 0 && (
                      <span className="text-[9px] font-bold uppercase text-slate-400 -mt-0.5">
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

      {/* Right Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-card">

        {/* Top Header Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-2.5 border-b border-slate-200 dark:border-white/5">
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
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${(isSuper && franchisesLoading) || (isSuper && scope === "HQ" && !hqFranchiseId) || (isSuper && scope === "FRANCHISE" && franchises.filter((f: any) => !f.isHQ).length === 0)
                ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
          >
            <Plus size={14} /> {isSuper && franchisesLoading ? "Loading scope..." : "Add Customer"}
          </button>
        </div>

        {/* Party Details Header */}
        {selectedCustomer ? (
          <div className="px-6 py-4 flex items-start justify-between border-b border-slate-200 dark:border-white/5 bg-white dark:bg-card">
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">{selectedCustomer.name}</h2>
                  <button onClick={() => setIsEditModalOpen(true)} className="text-orange-500 hover:text-orange-600 transition-colors">
                    <Edit3 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <button onClick={() => setIsSettingsOpen(true)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><Settings size={18} /></button>
                  <div className="relative filter-popover-container">
                    <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><MoreVertical size={18} /></button>
                    {/* More Options Menu */}
                    {isMoreMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-60 bg-white dark:bg-[#13151f] rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 py-1.5 overflow-hidden">
                        {[
                          "Import from Excel",
                          "Import from Phone",
                          "Import Via Google Contacts",
                          "Party Statement (Report)",
                          "All Parties (Report)"
                        ].map((item, i) => (
                          <button key={i} className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            {item}
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
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selectedCustomerDetail?.phone || selectedCustomer.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Email</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selectedCustomerDetail?.email || selectedCustomer.email || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">GSTIN</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selectedCustomerDetail?.gstNumber || selectedCustomer.gstNumber || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Billing Address</p>
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{selectedCustomerDetail?.address || selectedCustomer.address || "—"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 flex items-center justify-center border-b border-slate-200 dark:border-white/5">
            <span className="text-sm font-semibold text-slate-400">Select a party to view details</span>
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
                      className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-1"
                      onClick={() => setTransactionSearchQuery("")}
                    />
                  )}
                </div>
              ) : (
                <button onClick={() => setIsTransactionSearchOpen(true)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><Search size={16} /></button>
              )}
              <button onClick={() => setIsPrintModalOpen(true)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><Printer size={16} /></button>
              <button className="text-emerald-600 hover:text-emerald-700 transition-colors"><ExcelIcon size={16} fill="currentColor" className="opacity-20" /></button>
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
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs font-semibold text-slate-400">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{t.type}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{t.number}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{t.date}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 text-right">₹ {t.total}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 text-right">{t.balance ? `₹ ${t.balance}` : ""}</td>
                      <td className="px-2 py-4 text-center">
                        <button className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-200">
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Print Options Modal Overlay */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#13151f] border border-slate-100 dark:border-white/10 rounded-xl shadow-2xl w-[320px] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Print Options</h3>
            </div>
            <div className="p-6 space-y-4">
              {[
                { id: "itemDetails", label: "Item Details" },
                { id: "description", label: "Description" },
                { id: "paymentInfo", label: "Payment Info" },
                { id: "paymentStatus", label: "Payment Status" }
              ].map(opt => (
                <label key={opt.id} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white">{opt.label}</span>
                  <input
                    type="checkbox"
                    checked={(printOptions as any)[opt.id]}
                    onChange={(e) => setPrintOptions({ ...printOptions, [opt.id]: e.target.checked })}
                    className="w-4 h-4 rounded-sm border-slate-300 dark:border-white/20 text-orange-500 focus:ring-orange-500 bg-white dark:bg-white/5"
                  />
                </label>
              ))}
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-6 border-t border-slate-100 dark:border-white/10">
              <button onClick={() => setIsPrintModalOpen(false)} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-wide">Cancel</button>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 uppercase tracking-wide">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Party Settings Slide-over */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex justify-end">
          <div className="w-[400px] bg-white dark:bg-[#13151f] border-l border-slate-200 dark:border-white/10 h-full shadow-2xl flex flex-col animate-in slide-in-from-right">

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#13151f] z-10 shrink-0">
              <h3 className="text-lg font-bold text-slate-700 dark:text-white">Party Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* General Section */}
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-white/5 px-4 py-2 rounded-lg border border-slate-100 dark:border-white/5">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">General</span>
                </div>

                {[
                  { id: "partyGrouping", label: "Party Grouping" },
                  { id: "shippingAddress", label: "Shipping Address" },
                  { id: "managePartyStatus", label: "Manage Party Status" }
                ].map(opt => (
                  <div key={opt.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={(settings as any)[opt.id]}
                      onChange={(e) => setSettings({ ...settings, [opt.id]: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-orange-500 focus:ring-orange-500 bg-white dark:bg-white/5"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.label}</span>
                    <Info size={14} className="text-slate-400" />
                  </div>
                ))}

                {/* Payment Reminder */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.enablePaymentReminder}
                      onChange={(e) => setSettings({ ...settings, enablePaymentReminder: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Payment Reminder</span>
                    <Info size={14} className="text-slate-400" />
                  </div>                  {settings.enablePaymentReminder && (
                    <div className="pl-7 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Remind me for payment due in</span>
                        <Info size={12} className="text-slate-400" />
                      </div>
                      <div className="flex items-center relative">
                        <input
                          type="text"
                          value={settings.reminderDays}
                          onChange={(e) => setSettings({ ...settings, reminderDays: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-semibold text-slate-700 dark:text-white bg-white dark:bg-white/5 focus:outline-none focus:border-orange-400"
                        />
                        <span className="absolute right-4 text-sm font-semibold text-slate-400">(Days)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Settings size={16} />
                <span className="text-sm font-semibold">More Settings</span>
              </div>
            </div>

          </div>
        </div>
      )}

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

      <AddPartyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={selectedCustomerDetail}
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
