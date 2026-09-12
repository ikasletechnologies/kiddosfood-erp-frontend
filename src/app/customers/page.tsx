"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, ChevronDown, Plus, Settings, MoreVertical,
  Edit3, MessageSquare, Phone, Mail, FileText, Clock,
  Printer, MoreHorizontal, BookOpen, X, Info, SlidersHorizontal,
  MapPin, Truck, User, ArrowUpRight, CheckCircle2, AlertCircle, Building2, ShieldCheck, Download, Package
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import AddPartyModal from "@/components/modals/AddPartyModal";
import GSTInvoice from "@/components/documents/GSTInvoice";
import PartyStatement from "@/components/documents/PartyStatement";
import TransactionActionsMenu from "@/components/documents/TransactionActionsMenu";
import { customersApi, franchiseApi, posApi, settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

export default function PartiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuper = user?.role === "SUPER_ADMIN";

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
  const hqName = franchises.find((f: any) => f.isHQ)?.name || "HQ";
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Active section tab: Transactions vs Item / Product Sales History
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "ITEMS">("TRANSACTIONS");
  const [customerItems, setCustomerItems] = useState<any[]>([]);
  const [customerItemsLoading, setCustomerItemsLoading] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-popover-container')) {
        setIsFilterOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isTransactionSearchOpen, setIsTransactionSearchOpen] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    all: false,
    active: false,
    inactive: false,
    toReceive: false,
    toPay: false
  });

  // Settings state
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

  // Sourced from selectedCustomerDetail.orders
  const allTransactions = React.useMemo(() => {
    const orders: any[] = selectedCustomerDetail?.orders || [];
    return orders.map((o: any) => {
      const paidAmount = (o.payments || [])
        .filter((p: any) => !p.isCancelled && p.status !== 'CANCELLED')
        .reduce((sum: number, p: any) => sum + (Number(p.paidAmount) || 0), 0);
      const balance = Number(o.totalAmount || 0) - paidAmount;
      const invNum = o.invoiceNum || o.invoiceNumber || o.orderNumber || o.referenceNumber || (o.id ? String(o.id).slice(-8).toUpperCase() : '');
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : (o.date || '');
      return {
        id: o.id,
        type: o.status === 'CANCELLED' ? 'Sale [Cancelled]' : 'Sale',
        number: invNum,
        date: dateStr,
        total: Number(o.totalAmount || 0),
        balance: balance > 0.005 ? balance : 0,
      };
    });
  }, [selectedCustomerDetail]);

  const transactions = React.useMemo(() => {
    let list = allTransactions;
    if (transactionSearchQuery.trim()) {
      const q = transactionSearchQuery.trim().toLowerCase();
      list = list.filter((t) =>
        (t.number || '').toLowerCase().includes(q) ||
        (t.type || '').toLowerCase().includes(q) ||
        (t.date || '').toLowerCase().includes(q) ||
        String(t.total || '').toLowerCase().includes(q) ||
        String(t.balance || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allTransactions, transactionSearchQuery]);

  const fetchCustomers = async (franchiseId?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (franchiseId) params.franchiseId = franchiseId;
      const res = await customersApi.getAll(params);
      const data = res.data || [];
      setCustomers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load parties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (franchisesLoading) return;

    if (!effectiveFranchiseId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    fetchCustomers(effectiveFranchiseId);
  }, [franchisesLoading, effectiveFranchiseId]);

  // Reset transaction search whenever selected customer changes
  useEffect(() => {
    setTransactionSearchQuery("");
    setIsTransactionSearchOpen(false);
  }, [selectedCustomerId]);

  useEffect(() => {
    let isCancelled = false;
    const fetchCustomerDetail = async () => {
      if (!selectedCustomerId) {
        setSelectedCustomerDetail(null);
        return;
      }
      try {
        const res = await customersApi.getById(selectedCustomerId);
        if (!isCancelled) {
          setSelectedCustomerDetail(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch customer detail", error);
        if (!isCancelled) {
          setSelectedCustomerDetail(null);
        }
      }
    };
    fetchCustomerDetail();
    return () => {
      isCancelled = true;
    };
  }, [selectedCustomerId]);

  useEffect(() => {
    let isCancelled = false;
    const fetchCustomerItems = async () => {
      if (!selectedCustomerId) {
        setCustomerItems([]);
        return;
      }
      setCustomerItemsLoading(true);
      try {
        const res = await customersApi.getItems(selectedCustomerId);
        if (!isCancelled) {
          setCustomerItems(res.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch customer items", error);
        if (!isCancelled) {
          setCustomerItems([]);
        }
      } finally {
        if (!isCancelled) {
          setCustomerItemsLoading(false);
        }
      }
    };
    fetchCustomerItems();
    return () => {
      isCancelled = true;
    };
  }, [selectedCustomerId]);

  const filteredItems = React.useMemo(() => {
    if (!itemSearchQuery.trim()) return customerItems;
    const q = itemSearchQuery.trim().toLowerCase();
    return customerItems.filter((it: any) =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.sku || "").toLowerCase().includes(q) ||
      (it.category || "").toLowerCase().includes(q)
    );
  }, [customerItems, itemSearchQuery]);

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
      XLSX.utils.book_append_sheet(wb, ws, "Item Sales History");
      const filename = `${(customerName || "Customer").replace(/[^a-zA-Z0-9_-]/g, "_")}_Item_History.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("Exported item sales history to Excel");
    } catch (err) {
      toast.error("Failed to export items to Excel");
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;

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
      const targetCustomers = customers || [];
      if (targetCustomers.length === 0) {
        toast("No customers available to export for this scope.", { icon: "ℹ️" });
      }

      const headers = [
        "Party Name",
        "Phone Number",
        "Email Address",
        "GSTIN",
        "GST Type",
        "Billing Address",
        "Shipping Address",
        "Net Balance (₹)",
        "Customer Status"
      ];

      const rows = targetCustomers.map((c: any) => [
        c.name || "",
        c.phone || c.contact || "",
        c.email || "",
        c.gstNumber || c.gstin || "",
        c.gstType || "",
        c.billingAddress || c.address || "",
        c.shippingAddress || "",
        Number(c.balance) || 0,
        c.status || "ACTIVE"
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Set explicit column widths for professional formatting
      ws["!cols"] = [
        { wch: 28 }, // Party Name
        { wch: 18 }, // Phone Number
        { wch: 26 }, // Email Address
        { wch: 20 }, // GSTIN
        { wch: 24 }, // GST Type
        { wch: 34 }, // Billing Address
        { wch: 34 }, // Shipping Address
        { wch: 16 }, // Net Balance
        { wch: 16 }, // Customer Status
      ];

      // Explicit formatting: force text types for phone, GSTIN, GST Type to prevent numeric clipping
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:I1");
      for (let R = 1; R <= range.e.r; ++R) {
        // Phone (Col 1)
        const phoneCell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
        if (phoneCell) {
          phoneCell.t = "s";
          phoneCell.v = String(phoneCell.v || "");
        }
        // GSTIN (Col 3)
        const gstCell = ws[XLSX.utils.encode_cell({ r: R, c: 3 })];
        if (gstCell) {
          gstCell.t = "s";
          gstCell.v = String(gstCell.v || "");
        }
        // GST Type (Col 4)
        const gstTypeCell = ws[XLSX.utils.encode_cell({ r: R, c: 4 })];
        if (gstTypeCell) {
          gstTypeCell.t = "s";
          gstTypeCell.v = String(gstTypeCell.v || "");
        }
        // Net Balance (Col 7)
        const balCell = ws[XLSX.utils.encode_cell({ r: R, c: 7 })];
        if (balCell && typeof balCell.v === "number") {
          balCell.z = "₹#,##0.00;[Red]₹-#,##0.00;₹0.00";
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HQ Customers");

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `HQ_Customers_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${targetCustomers.length} HQ customer(s) to Excel`);
    } catch (error) {
      console.error("Failed to export customers Excel", error);
      toast.error("Failed to download Excel file.");
    }
  };

  const filteredCustomers = React.useMemo(() => {
    return customers.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || c.contact || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const gst = (c.gstNumber || c.gstin || "").toLowerCase();
        const gstType = (c.gstType || "").toLowerCase();

        const nameMatch = name.includes(q);
        const phoneMatch = phone.includes(q);
        const emailMatch = email.includes(q);
        const gstMatch = gst.includes(q);
        const gstTypeMatch = gstType.includes(q);

        if (!nameMatch && !phoneMatch && !emailMatch && !gstMatch && !gstTypeMatch) {
          return false;
        }
      }

      if (filters.all) return true;

      const checkStatus = filters.active || filters.inactive;
      let statusMatch = true;
      if (checkStatus) {
        statusMatch = (filters.active && c.status === 'ACTIVE') || (filters.inactive && c.status !== 'ACTIVE');
      }

      const bal = Number(c.balance) || 0;
      const checkBalance = filters.toReceive || filters.toPay;
      let balanceMatch = true;
      if (checkBalance) {
        balanceMatch = (filters.toReceive && bal > 0) || (filters.toPay && bal < 0);
      }

      if (!checkStatus && !checkBalance) return true;

      return statusMatch && balanceMatch;
    });
  }, [customers, searchQuery, filters]);

  // Keep selection synchronized with filtered customer list
  useEffect(() => {
    if (filteredCustomers.length > 0) {
      const exists = filteredCustomers.some((c) => c.id === selectedCustomerId);
      if (!exists) {
        setSelectedCustomerId(filteredCustomers[0].id);
      }
    } else {
      setSelectedCustomerId(null);
    }
  }, [filteredCustomers, selectedCustomerId]);

  const customerPhone = selectedCustomerDetail?.phone || selectedCustomer?.phone || "—";
  const customerEmail = selectedCustomerDetail?.email || selectedCustomer?.email || "—";
  const customerGstin = selectedCustomerDetail?.gstNumber || selectedCustomerDetail?.gstin || selectedCustomer?.gstNumber || selectedCustomer?.gstin || "—";
  const customerGstType = selectedCustomerDetail?.gstType || selectedCustomer?.gstType || "—";
  const customerBilling = selectedCustomerDetail?.billingAddress || selectedCustomerDetail?.address || selectedCustomer?.billingAddress || selectedCustomer?.address || "—";
  const customerShipping = selectedCustomerDetail?.shippingAddress || selectedCustomer?.shippingAddress || "—";
  const customerBalance = Number(selectedCustomerDetail?.balance ?? selectedCustomer?.balance ?? 0);
  const customerName = selectedCustomerDetail?.name || selectedCustomer?.name || "";
  const customerInitials = customerName ? customerName.slice(0, 2).toUpperCase() : "CU";

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50/60 dark:bg-background text-slate-800 dark:text-foreground min-w-0">

      {/* ── Left Sidebar - Customer / Party List ── */}
      <div className="w-full md:w-[320px] lg:w-[340px] border-b md:border-b-0 md:border-r border-slate-200/90 dark:border-slate-800/90 flex flex-col shrink-0 bg-white dark:bg-[#0A0D14] z-10 min-w-0 max-h-[380px] md:max-h-full shadow-xs">

        {/* Search & Filter Header */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 space-y-2.5">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search party name, phone, GSTIN..."
              className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 bg-slate-50/70 dark:bg-slate-900 text-slate-800 dark:text-white placeholder:text-slate-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider relative filter-popover-container">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <span>Party Name</span>
              <Filter size={12} className={clsx((filters.active || filters.inactive || filters.toReceive || filters.toPay) ? "text-orange-500" : "text-slate-400")} />
            </button>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#13151f] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 p-3.5 space-y-3 font-normal normal-case tracking-normal">
                <p className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Filter Parties</p>
                <div className="space-y-2">
                  {[
                    { id: "all", label: "All Parties" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Inactive" },
                    { id: "toReceive", label: "To Receive (Receivables)" },
                    { id: "toPay", label: "To Pay (Payables)" },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-orange-500 transition-colors">
                      <input
                        type="checkbox"
                        checked={(filters as any)[f.id]}
                        onChange={(e) => setFilters({ ...filters, [f.id]: e.target.checked, all: f.id === 'all' ? e.target.checked : false })}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => { setFilters({ all: true, active: false, inactive: false, toReceive: false, toPay: false }); setIsFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            <span>Net Balance</span>
          </div>
        </div>

        {/* Customer List Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading parties...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <User size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No parties match filters</p>
              <p className="text-[11px] text-slate-400">Try adjusting your search query.</p>
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isActive = c.id === selectedCustomerId;
              const bal = Number(c.balance) || 0;
              const initials = c.name ? c.name.slice(0, 2).toUpperCase() : "CU";

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={clsx(
                    "flex items-center justify-between p-3.5 cursor-pointer transition-all border-l-[3.5px]",
                    isActive
                      ? "bg-orange-50/80 dark:bg-orange-500/10 border-orange-500 text-orange-950 dark:text-white"
                      : "bg-white dark:bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={clsx(
                      "w-8 h-8 rounded-xl flex items-center justify-center font-black text-[11px] shrink-0",
                      isActive ? "bg-orange-500 text-white shadow-2xs" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className={clsx("text-xs font-bold truncate", isActive ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200")}>
                        {c.name}
                      </p>
                      {c.phone && (
                        <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                          {c.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 pl-1">
                    <span className={clsx(
                      "text-xs font-mono font-bold",
                      bal > 0 ? "text-emerald-600 dark:text-emerald-400" : bal < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                    )}>
                      {bal === 0 ? "₹0.00" : `₹${Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                    {bal !== 0 && (
                      <span className={clsx(
                        "text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded-md mt-0.5",
                        bal > 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
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

      {/* ── Right Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/40 dark:bg-card overflow-y-auto custom-scrollbar">

        {/* Top Header Actions Bar */}
        <div className="px-5 sm:px-6 py-3 bg-white dark:bg-[#0A0D14] border-b border-slate-200/90 dark:border-slate-800/90 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg shrink-0">
              <User size={16} />
            </span>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
                HQ Customers & Ledger
              </h1>
              <p className="text-[10px] font-bold text-slate-400 truncate">
                {franchisesLoading ? "Loading HQ..." : `HQ — ${hqName}`}
              </p>
            </div>
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
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer shrink-0",
              franchisesLoading || !effectiveFranchiseId
                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            )}
          >
            <Plus size={15} />
            <span>{franchisesLoading ? "Loading..." : "Add Customer"}</span>
          </button>
        </div>

        {/* Selected Customer Profile Card */}
        {selectedCustomer ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Customer Details Header Card */}
            <div className="bg-white dark:bg-[#0A0D14] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {/* Header Title Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-base sm:text-lg flex items-center justify-center border border-orange-500/20 shrink-0 shadow-2xs">
                    {customerInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase truncate">
                        {customerName}
                      </h2>
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                        title="Edit Customer Details"
                      >
                        <Edit3 size={15} />
                      </button>
                      <span className={clsx(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                        selectedCustomer.status === "INACTIVE"
                          ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                      )}>
                        {selectedCustomer.status === "INACTIVE" ? "Inactive" : "Active Customer"}
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
                      customerBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : customerBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {customerBalance === 0 ? "₹0.00" : `₹${Math.abs(customerBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      {customerBalance !== 0 && (
                        <span className="text-[10px] font-bold ml-1 uppercase opacity-80">
                          {customerBalance > 0 ? "(To Receive)" : "(To Pay)"}
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
                    {isMoreMenuOpen && (
                      <div className="absolute top-full right-0 mt-1.5 w-56 bg-white dark:bg-[#13151f] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-1.5 overflow-hidden">
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            handleExportExcel();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Download size={14} className="text-emerald-500 shrink-0" />
                          <span>Export Customer List (Excel)</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            const params = new URLSearchParams({ parent: "franchise", report: "Party Statement" });
                            if (selectedCustomer?.name) params.set("partyName", selectedCustomer.name);
                            router.push(`/reports?${params.toString()}`);
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <FileText size={14} className="text-orange-500 shrink-0" />
                          <span>Party Statement (Report)</span>
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
                    {customerPhone}
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={11} className="text-slate-400 shrink-0" /> Email Address
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {customerEmail}
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={11} className="text-slate-400 shrink-0" /> GSTIN
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wide truncate">
                    {customerGstin}
                  </p>
                </div>

                <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-slate-400 shrink-0" /> GST Type
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {customerGstType}
                  </p>
                </div>
              </div>

              {/* Address Row: Billing & Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={11} className="text-slate-400 shrink-0" /> Billing Address
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                    {customerBilling}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={11} className="text-slate-400 shrink-0" /> Shipping Address
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                    {customerShipping}
                  </p>
                </div>
              </div>
            </div>

            {/* History Section: Transactions & Finished Goods Item Sales History */}
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
                  {customerItems.length > 0 && (
                    <span className={clsx(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      activeTab === "ITEMS" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      {customerItems.length}
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
                            title="Close search"
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
                        disabled={loading || (isSuper && franchisesLoading)}
                        title="Download Excel"
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download size={14} />
                      </button>

                      <button
                        onClick={() => {
                          if (!selectedCustomer) { toast.error("Select a customer first."); return; }
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
                        disabled={customerItemsLoading || filteredItems.length === 0}
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
                    <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="w-36 px-5 py-3.5">Type</th>
                        <th className="px-5 py-3.5">Number</th>
                        <th className="px-5 py-3.5">Date</th>
                        <th className="px-5 py-3.5 text-right">Total</th>
                        <th className="px-5 py-3.5 text-right">Balance</th>
                        <th className="w-24 px-5 py-3.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center">
                            <div className="max-w-xs mx-auto space-y-2">
                              <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No transactions recorded</p>
                              <p className="text-[11px] text-slate-400">Transactions created for this party will appear here.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t, idx) => {
                          const hasInvoice = t.type.startsWith('Sale');
                          return (
                            <tr key={t.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group">
                              <td className="px-5 py-3.5">
                                <span className={clsx(
                                  "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                  t.type.includes("Cancelled")
                                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                                )}>
                                  {t.type}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {t.number || "—"}
                              </td>
                              <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                                {t.date || "—"}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                ₹ {t.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold">
                                <span className={t.balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}>
                                  ₹ {t.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-center">
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
                      {customerItemsLoading ? (
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
                              <p className="text-[11px] text-slate-400">Finished goods purchased by this customer will be listed here.</p>
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
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Select a Customer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose a customer from the left list to view their contact information, GSTIN details, and ledger transactions.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Customer Transaction Statement — real print action, replaces the old no-op options dialog */}
      {isStatementOpen && selectedCustomer && (
        <PartyStatement
          title="Customer Transaction Statement"
          party={{
            name: selectedCustomer.name,
            phone: selectedCustomerDetail?.phone || selectedCustomer.phone,
            email: selectedCustomerDetail?.email || selectedCustomer.email,
            address: selectedCustomerDetail?.address || selectedCustomer.address,
          }}
          transactions={allTransactions}
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
          vendor={selectedCustomer ? {
            name: selectedCustomer.name,
            phone: selectedCustomerDetail?.phone || selectedCustomer.phone,
            address: selectedCustomerDetail?.address || selectedCustomer.address,
            gstin: selectedCustomerDetail?.gstNumber || selectedCustomer.gstNumber,
          } : { name: "Walk-in Customer" }}
          companyDetails={currentCompany}
          documentType="TAX_INVOICE"
          autoAction={invoiceAction}
          onClose={() => { setInvoiceDoc(null); setInvoiceAction(undefined); }}
        />
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
            if (!effectiveFranchiseId) {
              toast.error("HQ is not configured.");
              return;
            }
            const payload = {
              ...data,
              phone: data.contact,
              franchiseId: effectiveFranchiseId
            };
            const res = await customersApi.create(payload);
            toast.success("Customer added successfully!");
            setIsAddModalOpen(false);
            await fetchCustomers(effectiveFranchiseId);
            if (res.data?.id) {
              setSelectedCustomerId(res.data.id);
            }
          } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to add customer");
            throw error;
          }
        }}
        title="ADD HQ CUSTOMER"
        partyType="customer"
        scopeLabel={`HQ — ${hqName}`}
      />

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
            await fetchCustomers(effectiveFranchiseId);
            const res = await customersApi.getById(selectedCustomerId);
            setSelectedCustomerDetail(res.data);
          } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update customer");
            throw error;
          }
        }}
        title="EDIT HQ CUSTOMER"
        partyType="customer"
        scopeLabel={`HQ — ${hqName}`}
      />

    </div>
  );
}
