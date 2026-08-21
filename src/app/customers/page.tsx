"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, Filter, ChevronDown, Plus, Settings, MoreVertical, 
  Edit3, MessageSquare, Phone as PhoneIcon, Clock, 
  Printer, FileText as ExcelIcon, MoreHorizontal, BookOpen,
  X, Info, SlidersHorizontal
} from "lucide-react";
import { Setting07Icon } from "hugeicons-react";
import { toast } from "react-hot-toast";
import AddPartyModal from "@/components/modals/AddPartyModal";
import { customersApi } from "@/lib/api";

export default function PartiesPage() {
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

  const transactions = [
    { type: "Purchase", number: "", date: "22/05/2026", total: "0.00", balance: "0.00" },
    { type: "Lite Sale", number: "1", date: "20/05/2026", total: "350.00", balance: "350.00" },
    { type: "Delivery Challan", number: "1", date: "20/05/2026", total: "35.00", balance: "" },
    { type: "Sale Order", number: "1", date: "20/05/2026", total: "35.00", balance: "35.00" },
  ];

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersApi.getAll();
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
    fetchCustomers();
  }, []);

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

    if (!checkStatus && !checkBalance) return false;

    return statusMatch && balanceMatch;
  });

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-white text-slate-800">
      
      {/* Left Sidebar - Party List */}
      <div className="w-[300px] border-r border-slate-200 flex flex-col shrink-0 bg-white relative z-10">
        
        {/* Sidebar Header */}
        <div className="px-4 py-3 border-b border-slate-200">
          <button className="flex items-center gap-2 text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors">
            Parties <ChevronDown size={18} className="text-blue-500" />
          </button>
        </div>

        {/* Search & List Headers */}
        <div className="px-3 py-2 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Party Name" 
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-full text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 relative filter-popover-container">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <span className="text-[12px] font-bold text-slate-500">Party Name</span>
              <Filter size={12} className="text-orange-500" />
            </div>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-4 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-3">
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
                          onChange={(e) => setFilters({...filters, [f.id]: e.target.checked, all: f.id === 'all' ? e.target.checked : false})}
                          className="peer appearance-none w-4 h-4 rounded border border-slate-300 checked:bg-orange-500 checked:border-orange-500 cursor-pointer transition-colors" 
                        />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-xs font-medium text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button 
                    onClick={() => { setFilters({ all: true, active: false, inactive: false, toReceive: false, toPay: false }); setIsFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-full transition-colors"
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
              <span className="text-[12px] font-bold text-slate-500">Amount</span>
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
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-slate-50 transition-colors ${
                    isActive ? "bg-[#e6f4fc]" : "hover:bg-slate-50 bg-white"
                  }`}
                >
                  <span className="text-sm text-slate-800 truncate pr-2">{c.name}</span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-sm font-semibold ${
                      bal > 0 ? "text-emerald-500" : bal < 0 ? "text-rose-500" : "text-slate-400"
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

        {/* Bottom Promo Banner */}
        <div className="p-3 bg-emerald-50 m-2 rounded-xl flex items-center justify-between border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-500">
              <BookOpen size={16} />
            </div>
            <div className="text-[10px] text-slate-600 leading-tight">
              Use contacts from your Phone or <br/> Gmail to <span className="font-bold">quickly create parties.</span>
            </div>
          </div>
          <ChevronDown size={14} className="text-emerald-500 -rotate-90" />
        </div>
      </div>

      {/* Right Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* Top Header Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-2.5 border-b border-slate-200">
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-colors">
            <Plus size={14} /> Add Party
          </button>
        </div>

        {/* Party Details Header */}
        {selectedCustomer ? (
          <div className="px-6 py-4 flex items-start justify-between border-b border-slate-200 bg-white">
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">{selectedCustomer.name}</h2>
                  <button onClick={() => setIsEditModalOpen(true)} className="text-orange-500 hover:text-orange-600 transition-colors">
                    <Edit3 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <button onClick={() => setIsSettingsOpen(true)} className="hover:text-slate-600 transition-colors"><Setting07Icon size={18} /></button>
                  <div className="relative filter-popover-container">
                    <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="hover:text-slate-600 transition-colors"><MoreVertical size={18} /></button>
                    {/* More Options Menu */}
                    {isMoreMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5">
                        {[
                          "Import from Excel",
                          "Import from Phone",
                          "Import Via Google Contacts",
                          "Party Statement (Report)",
                          "All Parties (Report)"
                        ].map((item, i) => (
                          <button key={i} className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
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
                  <p className="text-[11px] text-slate-400 mb-0.5">Phone Number</p>
                  <p className="text-[13px] font-medium text-slate-700">{selectedCustomerDetail?.contact || selectedCustomer.contact || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Email</p>
                  <p className="text-[13px] font-medium text-slate-700">{selectedCustomerDetail?.email || selectedCustomer.email || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">GSTIN</p>
                  <p className="text-[13px] font-medium text-slate-700">{selectedCustomerDetail?.gstNumber || selectedCustomer.gstNumber || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 mb-0.5">Billing Address</p>
                <p className="text-[13px] font-medium text-slate-700">{selectedCustomerDetail?.address || selectedCustomer.address || "—"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 flex items-center justify-center border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-400">Select a party to view details</span>
          </div>
        )}

        {/* Transactions Section */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Section Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-700">Transactions</h3>
            <div className="flex items-center gap-3 text-slate-400">
              {isTransactionSearchOpen ? (
                <div className="flex items-center bg-slate-100 rounded-full px-3 py-1">
                  <Search size={14} className="text-slate-400" />
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Search transactions..." 
                    className="bg-transparent border-none text-xs w-32 focus:outline-none ml-2 text-slate-700 placeholder:text-slate-400"
                    value={transactionSearchQuery}
                    onChange={(e) => setTransactionSearchQuery(e.target.value)}
                    onBlur={() => !transactionSearchQuery && setIsTransactionSearchOpen(false)}
                  />
            {transactionSearchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setTransactionSearchQuery("")} 
              />
            )}
                </div>
              ) : (
                <button onClick={() => setIsTransactionSearchOpen(true)} className="hover:text-slate-600 transition-colors"><Search size={16} /></button>
              )}
              <button onClick={() => setIsPrintModalOpen(true)} className="hover:text-slate-600 transition-colors"><Printer size={16} /></button>
              <button className="text-emerald-600 hover:text-emerald-700 transition-colors"><ExcelIcon size={16} fill="currentColor" className="opacity-20" /></button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 relative filter-popover-container">
                    <div className="flex items-center justify-between">
                      Type 
                      <button onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)}>
                        <Filter size={14} className="text-slate-400 hover:text-slate-700" />
                      </button>
                    </div>
                    {/* Type Filter Popover */}
                    {isTypeFilterOpen && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden flex flex-col font-normal text-slate-700 normal-case tracking-normal">
                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {transactionTypes.map(type => (
                            <label key={type} className="flex items-start gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={selectedTypes.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedTypes([...selectedTypes, type]);
                                  else setSelectedTypes(selectedTypes.filter(t => t !== type));
                                }}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                              />
                              <span className="text-[11px] leading-tight group-hover:text-slate-900">{type}</span>
                            </label>
                          ))}
                        </div>
                        <div className="p-2 border-t border-slate-100 flex items-center gap-2 bg-white">
                          <button 
                            onClick={() => setSelectedTypes([])} 
                            className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-colors"
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
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100">
                    Number
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100">
                    Date
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 text-right">
                    Total
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 text-right">
                    Balance
                  </th>
                  <th className="w-10 px-2 py-3 border-b border-slate-200"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 text-xs font-medium text-slate-700 border-r border-slate-100">{t.type}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700 border-r border-slate-100">{t.number}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700 border-r border-slate-100">{t.date}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700 border-r border-slate-100 text-right">₹ {t.total}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700 border-r border-slate-100 text-right">{t.balance ? `₹ ${t.balance}` : ""}</td>
                    <td className="px-2 py-4 text-center">
                      <button className="text-slate-300 hover:text-slate-500">
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Print Options Modal Overlay */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[320px] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Print Options</h3>
            </div>
            <div className="p-6 space-y-4">
              {[
                { id: "itemDetails", label: "Item Details" },
                { id: "description", label: "Description" },
                { id: "paymentInfo", label: "Payment Info" },
                { id: "paymentStatus", label: "Payment Status" }
              ].map(opt => (
                <label key={opt.id} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-800">{opt.label}</span>
                  <input 
                    type="checkbox" 
                    checked={(printOptions as any)[opt.id]}
                    onChange={(e) => setPrintOptions({...printOptions, [opt.id]: e.target.checked})}
                    className="w-4 h-4 rounded-sm border-slate-300 text-blue-500 focus:ring-blue-500" 
                  />
                </label>
              ))}
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-6 border-t border-slate-100">
              <button onClick={() => setIsPrintModalOpen(false)} className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide">Cancel</button>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Party Settings Slide-over */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex justify-end">
          <div className="w-[400px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white z-10 shrink-0">
              <h3 className="text-lg font-bold text-slate-700">Party Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* General Section */}
              <div className="space-y-4">
                <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                  <span className="text-sm font-bold text-slate-600">General</span>
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
                      onChange={(e) => setSettings({...settings, [opt.id]: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500" 
                    />
                    <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                    <Info size={14} className="text-slate-400" />
                  </div>
                ))}

                {/* Payment Reminder */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={settings.enablePaymentReminder}
                      onChange={(e) => setSettings({...settings, enablePaymentReminder: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500 bg-blue-500" 
                    />
                    <span className="text-sm font-medium text-slate-700">Enable Payment Reminder</span>
                    <Info size={14} className="text-slate-400" />
                  </div>
                  
                  {settings.enablePaymentReminder && (
                    <div className="pl-7 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Remind me for payment due in</span>
                        <Info size={12} className="text-slate-400" />
                      </div>
                      <div className="flex items-center relative">
                        <input 
                          type="text" 
                          value={settings.reminderDays}
                          onChange={(e) => setSettings({...settings, reminderDays: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-400"
                        />
                        <span className="absolute right-4 text-sm font-semibold text-slate-400">(Days)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 text-slate-600">
                <Setting07Icon size={16} />
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
            await customersApi.create({ ...data, phone: data.contact });
            toast.success("Party added successfully!");
            setIsAddModalOpen(false);
            fetchCustomers();
          } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to add party");
            throw error;
          }
        }} 
        title="ADD PARTY"
        partyType="customer"
      />

      <AddPartyModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        initialData={selectedCustomerDetail}
        onSave={async (data) => {
          try {
            if (!selectedCustomerId) return;
            await customersApi.update(selectedCustomerId, { ...data, phone: data.contact });
            toast.success("Party updated successfully!");
            setIsEditModalOpen(false);
            fetchCustomers();
          } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update party");
            throw error;
          }
        }} 
        title="EDIT PARTY"
        partyType="customer"
      />

    </div>
  );
}
