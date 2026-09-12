"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, MoreVertical, Edit3, Printer,
  FileText, X, MapPin, Phone, Mail,
  ShieldCheck, Truck, Download, User, Package
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import api, { franchiseApi, posApi, settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";
import PartyStatement from "@/components/documents/PartyStatement";
import TransactionActionsMenu from "@/components/documents/TransactionActionsMenu";
import AddDealerModal from "@/components/modals/AddDealerModal";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

interface Dealer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  shippingAddress?: string;
  gstNumber?: string;
  gstin?: string;
  taxNumber?: string;
  gstType?: string;
  pincode?: string;
  state?: string;
  city?: string;
  district?: string;
  balance?: number;
  openingBalance?: number;
  openingBalanceType?: string;
  asOfDate?: string;
  creditLimit?: number;
  status: string;
  franchiseId: string;
  franchise?: {
    id: string;
    name: string;
  };
  createdAt?: string;
}

export default function DealersClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [franchises, setFranchises] = useState<any[]>([]);
  const [franchisesLoading, setFranchisesLoading] = useState(true);

  useEffect(() => {
    setFranchisesLoading(true);
    franchiseApi.getAll()
      .then((res) => setFranchises(res.data ?? []))
      .catch((err) => console.error("Failed to load franchises list", err))
      .finally(() => setFranchisesLoading(false));
  }, []);

  // Exclusively scoped to HQ Franchise row where isHQ === true
  const hqFranchiseId = franchises.find((f: any) => f.isHQ)?.id;
  const effectiveFranchiseId = hqFranchiseId || (user as any)?.franchiseId;
  const hqName = franchises.find((f: any) => f.isHQ)?.name || "Kiddos Food Headquarters";

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Active section tab: Transactions vs Item / Product Sales History
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "ITEMS">("TRANSACTIONS");
  const [dealerItems, setDealerItems] = useState<any[]>([]);
  const [dealerItemsLoading, setDealerItemsLoading] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);

  // Read-only invoice viewer state
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-popover-container')) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  
  const [isTransactionSearchOpen, setIsTransactionSearchOpen] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDealerForEdit, setSelectedDealerForEdit] = useState<Dealer | null>(null);

  const [dealerTransactions, setDealerTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

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

  const fetchDealerItems = async (dealerId: string) => {
    setDealerItemsLoading(true);
    try {
      const res = await api.get(`/api/dealers/${dealerId}/items`);
      setDealerItems(res.data || []);
    } catch (error) {
      console.error("Failed to fetch dealer items", error);
      setDealerItems([]);
    } finally {
      setDealerItemsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDealerId) {
      fetchDealerTransactions(selectedDealerId);
      fetchDealerItems(selectedDealerId);
    } else {
      setDealerTransactions([]);
      setDealerItems([]);
    }
  }, [selectedDealerId]);

  // Reset search queries on dealer change
  useEffect(() => {
    setTransactionSearchQuery("");
    setIsTransactionSearchOpen(false);
    setItemSearchQuery("");
    setIsItemSearchOpen(false);
  }, [selectedDealerId]);

  const filteredItems = React.useMemo(() => {
    if (!itemSearchQuery.trim()) return dealerItems;
    const q = itemSearchQuery.trim().toLowerCase();
    return dealerItems.filter((it: any) =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.sku || "").toLowerCase().includes(q) ||
      (it.category || "").toLowerCase().includes(q)
    );
  }, [dealerItems, itemSearchQuery]);

  const handleExportItemsExcel = () => {
    try {
      if (filteredItems.length === 0) {
        toast("No item history to export.", { icon: "ℹ️" });
        return;
      }
      const headers = [
        "Product Name",
        "SKU",
        "Category",
        "Quantity Sold",
        "Unit",
        "Total Value (₹)",
        "Orders Count",
        "Last Purchased"
      ];
      const rows = filteredItems.map((it: any) => [
        it.name || "",
        it.sku || "—",
        it.category || "—",
        Number(it.quantitySold || 0),
        it.unit || "PCS",
        Number(it.totalValue || 0),
        Number(it.orderCount || 1),
        it.lastPurchased ? new Date(it.lastPurchased).toLocaleDateString() : "—"
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dealer Item History");
      const filename = `${(selectedDealer?.name || "Dealer").replace(/[^a-zA-Z0-9_-]/g, "_")}_Item_History.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("Exported dealer item sales history to Excel");
    } catch (err) {
      toast.error("Failed to export items to Excel");
    }
  };

  const transactions = dealerTransactions.filter((t) => {
    if (!transactionSearchQuery.trim()) return true;
    const q = transactionSearchQuery.trim().toLowerCase();
    return (
      (t.type && String(t.type).toLowerCase().includes(q)) ||
      (t.number && String(t.number).toLowerCase().includes(q)) ||
      (t.date && formatDate(t.date).toLowerCase().includes(q)) ||
      String(t.total || '').toLowerCase().includes(q) ||
      String(t.balance || '').toLowerCase().includes(q)
    );
  });

  const fetchDealers = async () => {
    if (franchisesLoading) return;
    if (!effectiveFranchiseId) {
      setDealers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `/api/dealers?franchiseId=${effectiveFranchiseId}`;
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
  }, [franchisesLoading, effectiveFranchiseId]);

  const handleOpenEdit = (dealer: Dealer) => {
    setSelectedDealerForEdit(dealer);
    setIsEditModalOpen(true);
  };

  const selectedDealer = dealers.find(d => d.id === selectedDealerId) || null;

  // Selected dealer display values
  const dealerInitials = selectedDealer?.name ? selectedDealer.name.slice(0, 2).toUpperCase() : "DL";
  const dealerName = selectedDealer?.name || "—";
  const dealerPhone = selectedDealer?.phone || "—";
  const dealerEmail = selectedDealer?.email || "—";
  const dealerGstin = selectedDealer?.gstNumber || selectedDealer?.gstin || (selectedDealer as any)?.taxNumber || "—";
  const dealerGstType = selectedDealer?.gstType || "—";
  const dealerAddress = selectedDealer?.address || "—";
  const dealerShippingAddress = selectedDealer?.shippingAddress || "—";
  const hasShippingAddress = Boolean(selectedDealer?.shippingAddress && selectedDealer.shippingAddress.trim() !== "");
  
  const dealerBalance = Number(selectedDealer?.balance) || dealerTransactions.reduce((sum, t) => sum + (Number(t.balance) || 0), 0) || 0;

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

  const handleExportExcel = () => {
    try {
      const targetDealers = dealers || [];
      if (targetDealers.length === 0) {
        toast("No dealers available to export.", { icon: "ℹ️" });
        return;
      }

      const headers = [
        "Dealer Name",
        "Phone Number",
        "Email Address",
        "GSTIN",
        "GST Type",
        "Address",
        "Shipping Address",
        "Status"
      ];

      const rows = targetDealers.map((d: any) => [
        d.name || "",
        d.phone || "",
        d.email || "",
        d.gstNumber || d.gstin || d.taxNumber || "",
        d.gstType || "",
        d.address || "",
        d.shippingAddress || "",
        d.status || "ACTIVE"
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dealers");
      
      const today = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `HQ_Dealers_List_${today}.xlsx`);
      toast.success("Dealer list exported successfully (.xlsx)");
    } catch (error) {
      console.error("Export Excel error", error);
      toast.error("Failed to export dealer list");
    }
  };

  const filteredDealers = dealers.filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const nameMatch = (d.name || "").toLowerCase().includes(q);
    const phoneMatch = (d.phone || "").toLowerCase().includes(q);
    const emailMatch = (d.email || "").toLowerCase().includes(q);
    return nameMatch || phoneMatch || emailMatch;
  });

  // Keep selection synchronized with filtered dealers list
  useEffect(() => {
    if (filteredDealers.length > 0) {
      const exists = filteredDealers.some((d) => d.id === selectedDealerId);
      if (!exists) {
        setSelectedDealerId(filteredDealers[0].id);
      }
    } else {
      setSelectedDealerId(null);
    }
  }, [filteredDealers, selectedDealerId]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-white dark:bg-background text-slate-800 dark:text-slate-100">
      
      {/* Left Sidebar - Dealer List */}
      <div className="w-[300px] border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0 bg-white dark:bg-card relative z-10">

        {/* Search & List Headers */}
        <div className="p-3 border-b border-slate-200 dark:border-white/5 space-y-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Dealer Name, Phone..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 text-slate-800 dark:text-white rounded-xl text-xs outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          
          <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Dealer Name</span>
            <span>Status</span>
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
                    isActive ? "bg-orange-50/80 dark:bg-orange-950/20 border-l-[3.5px] border-l-orange-500" : "hover:bg-slate-50 dark:hover:bg-white/[0.02] bg-white dark:bg-transparent"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className={`text-xs font-bold truncate ${isActive ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"}`}>
                      {d.name}
                    </p>
                    {d.phone && (
                      <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                        {d.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
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
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/40 dark:bg-card overflow-y-auto custom-scrollbar">
        
        {/* Top Header Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0A0D14] shadow-2xs">
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              HQ Dealers & Ledger
            </h1>
            <p className="text-[10px] font-bold text-slate-400">
              {franchisesLoading ? "Loading HQ..." : `HQ — ${hqName}`}
            </p>
          </div>

          <button 
            onClick={() => {
              if (franchisesLoading) return;
              if (!effectiveFranchiseId) {
                toast.error("HQ is not configured.");
                return;
              }
              setIsAddModalOpen(true);
            }}
            disabled={franchisesLoading || !effectiveFranchiseId}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer ${
              franchisesLoading || !effectiveFranchiseId
                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            <Plus size={15} /> {franchisesLoading ? "Loading..." : "Add Dealer"}
          </button>
        </div>

        {/* Dealer Details Header Card */}
        {selectedDealer ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="bg-white dark:bg-[#0A0D14] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {/* Header Title Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-base sm:text-lg flex items-center justify-center border border-orange-500/20 shrink-0 shadow-2xs">
                    {dealerInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase truncate">
                        {dealerName}
                      </h2>
                      <button
                        onClick={() => handleOpenEdit(selectedDealer)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                        title="Edit Dealer Details"
                      >
                        <Edit3 size={15} />
                      </button>
                      <span className={clsx(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                        selectedDealer.status === "INACTIVE"
                          ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                      )}>
                        {selectedDealer.status === "INACTIVE" ? "Inactive" : "Active Dealer"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Balance & Menu */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
                    <p className={clsx(
                      "text-base sm:text-lg font-black font-mono leading-none mt-0.5",
                      dealerBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : dealerBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {dealerBalance === 0 ? "₹0.00" : `₹${Math.abs(dealerBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      {dealerBalance !== 0 && (
                        <span className="text-[10px] font-bold ml-1 uppercase opacity-80">
                          {dealerBalance > 0 ? "(To Receive)" : "(To Pay)"}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="relative filter-popover-container">
                    <button 
                      onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} 
                      className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs"
                      title="More Options"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {/* Customer-style More Options Menu for Dealers */}
                    {isMoreMenuOpen && (
                      <div className="absolute top-full right-0 mt-1.5 w-56 bg-white dark:bg-[#13151f] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-1.5 overflow-hidden">
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            handleExportExcel();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                        >
                          <Download size={14} className="text-emerald-500 shrink-0" />
                          <span>Export Dealer List (Excel)</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            const params = new URLSearchParams({ parent: "franchise", report: "Dealer Statement" });
                            if (selectedDealer?.name) params.set("partyName", selectedDealer.name);
                            router.push(`/reports?${params.toString()}`);
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
                        >
                          <FileText size={14} className="text-orange-500 shrink-0" />
                          <span>Dealer Statement (Report)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Information Grid: Phone, Email, GSTIN, GST Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone size={11} className="text-slate-400 shrink-0" /> Phone Number
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">
                    {dealerPhone}
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={11} className="text-slate-400 shrink-0" /> Email Address
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {dealerEmail}
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={11} className="text-slate-400 shrink-0" /> GSTIN
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wide truncate">
                    {dealerGstin}
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-slate-400 shrink-0" /> GST Type
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {dealerGstType}
                  </p>
                </div>
              </div>

              {/* Address Row */}
              <div className={clsx("grid gap-3 pt-1", hasShippingAddress ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={11} className="text-slate-400 shrink-0" /> Address
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                    {dealerAddress}
                  </p>
                </div>

                {hasShippingAddress && (
                  <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Truck size={11} className="text-slate-400 shrink-0" /> Shipping Address
                    </p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                      {dealerShippingAddress}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* History Section: Transactions & Sold Finished Products History */}
            <div className="bg-white dark:bg-[#0A0D14] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              {/* Tab Switcher Navigation */}
              <div className="flex border-b border-slate-100 dark:border-slate-800/80 px-5 pt-3 gap-6 bg-slate-50/40 dark:bg-slate-900/20">
                <button
                  type="button"
                  onClick={() => setActiveTab("TRANSACTIONS")}
                  className={clsx(
                    "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2",
                    activeTab === "TRANSACTIONS"
                      ? "border-orange-500 text-orange-600 dark:text-orange-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  )}
                >
                  <FileText size={13} />
                  <span>Transactions</span>
                  {transactions.length > 0 && (
                    <span className={clsx(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      activeTab === "TRANSACTIONS" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      {transactions.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("ITEMS")}
                  className={clsx(
                    "pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-2",
                    activeTab === "ITEMS"
                      ? "border-orange-500 text-orange-600 dark:text-orange-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  )}
                >
                  <Package size={13} />
                  <span>Item / Product History</span>
                  {dealerItems.length > 0 && (
                    <span className={clsx(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      activeTab === "ITEMS" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      {dealerItems.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {activeTab === "TRANSACTIONS" ? "Transactions" : "Sold Finished Products"}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {activeTab === "TRANSACTIONS" ? (
                    <>
                      {isTransactionSearchOpen ? (
                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 relative shadow-2xs">
                          <Search size={13} className="text-slate-400 shrink-0" />
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Search invoice number, type..." 
                            className="bg-transparent border-none text-xs w-36 sm:w-48 focus:outline-none ml-2 pr-6 text-slate-800 dark:text-white placeholder:text-slate-400"
                            value={transactionSearchQuery}
                            onChange={(e) => setTransactionSearchQuery(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setTransactionSearchQuery("");
                              setIsTransactionSearchOpen(false);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer rounded"
                            title="Close transaction search"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsTransactionSearchOpen(true)} 
                          className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs"
                          title="Search Transactions"
                        >
                          <Search size={14} />
                        </button>
                      )}

                      <button
                        onClick={handleExportExcel}
                        title="Export Dealer List (Excel)"
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Download size={14} />
                      </button>

                      <button
                        onClick={() => {
                          if (!selectedDealer) { toast.error("Select a dealer first."); return; }
                          setIsStatementOpen(true);
                        }}
                        title="Print Transaction Statement"
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Printer size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      {isItemSearchOpen ? (
                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 relative shadow-2xs">
                          <Search size={13} className="text-slate-400 shrink-0" />
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Search product name, SKU..." 
                            className="bg-transparent border-none text-xs w-36 sm:w-48 focus:outline-none ml-2 pr-6 text-slate-800 dark:text-white placeholder:text-slate-400"
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setItemSearchQuery("");
                              setIsItemSearchOpen(false);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer rounded"
                            title="Close search"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsItemSearchOpen(true)} 
                          className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs"
                          title="Search Item History"
                        >
                          <Search size={14} />
                        </button>
                      )}

                      <button
                        onClick={handleExportItemsExcel}
                        disabled={dealerItemsLoading || filteredItems.length === 0}
                        title="Export Item History to Excel"
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tab 1 Content: Transactions Table */}
              {activeTab === "TRANSACTIONS" && (
                <div className="overflow-x-auto custom-scrollbar w-full">
                  <table className="w-full text-left table-auto min-w-[660px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-white/[0.01]">
                        <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Number</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Total</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Balance</th>
                        <th className="py-3 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-12">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {transactionsLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs font-semibold text-slate-400 animate-pulse">
                            Loading transactions...
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs font-semibold text-slate-400">
                            {transactionSearchQuery ? "No transactions match your search" : "No transactions found"}
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t, idx) => (
                          <tr 
                            key={idx}
                            className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group text-xs"
                          >
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {t.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                              {t.number || "—"}
                            </td>
                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                              {formatDate(t.date)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              ₹{(Number(t.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-orange-600 dark:text-orange-400">
                              ₹{(Number(t.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <TransactionActionsMenu
                                hasInvoice={Boolean(t.id)}
                                busy={loadingInvoiceId === t.id}
                                onView={() => openInvoiceAction(t.id, undefined)}
                                onPrint={() => openInvoiceAction(t.id, 'print')}
                                onDownload={() => openInvoiceAction(t.id, 'download')}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2 Content: Finished Goods Item / Sales History Table */}
              {activeTab === "ITEMS" && (
                <div className="overflow-x-auto custom-scrollbar w-full">
                  <table className="w-full text-left table-auto min-w-[660px]">
                    <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="px-5 py-3.5">Product Name</th>
                        <th className="px-5 py-3.5">SKU</th>
                        <th className="px-5 py-3.5 text-right">Quantity Sold</th>
                        <th className="px-5 py-3.5 text-right">Total Value</th>
                        <th className="px-5 py-3.5 text-right">Last Purchased</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {dealerItemsLoading ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-xs font-semibold text-slate-400 animate-pulse">
                            Loading product sales history...
                          </td>
                        </tr>
                      ) : filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center">
                            <div className="max-w-xs mx-auto space-y-2">
                              <Package size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {itemSearchQuery ? "No products match your search" : "No finished goods sold yet"}
                              </p>
                              <p className="text-[11px] text-slate-400">Finished goods purchased by this dealer will be listed here.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item, idx) => (
                          <tr key={item.productId || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group">
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {item.name}
                                </span>
                                {item.category && item.category !== '—' && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-300 font-medium">
                              {item.sku || "—"}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {Number(item.quantitySold || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-400 uppercase">{item.unit || "PCS"}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹ {(Number(item.totalValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3.5 text-right text-slate-600 dark:text-slate-400 font-medium">
                              {item.lastPurchased ? new Date(item.lastPurchased).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-3 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center">
                <User size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Select a Dealer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose a dealer from the left list to view their contact information, GSTIN details, and ledger transactions.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Statement Print Document (Shared Component) */}
      {isStatementOpen && selectedDealer && (
        <PartyStatement
          title="Dealer Transaction Statement"
          party={{
            name: selectedDealer.name,
            phone: selectedDealer.phone,
            email: selectedDealer.email,
            address: selectedDealer.address,
          }}
          transactions={transactions}
          onClose={() => setIsStatementOpen(false)}
        />
      )}

      {/* Read-only Invoice Modal */}
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
            gstin: selectedDealer.gstNumber || selectedDealer.gstin || (selectedDealer as any).taxNumber,
          } : { name: "Dealer" }}
          companyDetails={currentCompany}
          documentType="TAX_INVOICE"
          autoAction={invoiceAction}
          onClose={() => { setInvoiceDoc(null); setInvoiceAction(undefined); }}
        />
      )}

      {/* Add HQ Dealer Modal (Matches Add HQ Customer Form UX) */}
      <AddDealerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="ADD HQ DEALER"
        scopeLabel={`HQ — ${hqName}`}
        onSave={async (data) => {
          if (!effectiveFranchiseId) {
            toast.error("HQ is not configured.");
            return;
          }
          const res = await api.post("/api/dealers", {
            ...data,
            franchiseId: effectiveFranchiseId
          });
          toast.success("HQ Dealer added successfully");
          await fetchDealers();
          if (res.data?.id) {
            setSelectedDealerId(res.data.id);
          }
        }}
      />

      {/* Edit HQ Dealer Modal */}
      <AddDealerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDealerForEdit(null);
        }}
        initialData={selectedDealerForEdit || selectedDealer}
        title="EDIT HQ DEALER"
        scopeLabel={`HQ — ${hqName}`}
        onSave={async (data) => {
          const dealerId = selectedDealerForEdit?.id || selectedDealer?.id;
          if (!dealerId) return;
          await api.patch(`/api/dealers/${dealerId}`, data);
          toast.success("Dealer updated successfully");
          await fetchDealers();
        }}
      />

    </div>
  );
}
