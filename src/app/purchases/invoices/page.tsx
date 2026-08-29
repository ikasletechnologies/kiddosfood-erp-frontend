"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt, Plus, Search, RefreshCw, X,
  Printer, ChevronDown, Trash2, Share2, Calendar,
  AlignLeft, FileText, ArrowLeft, Upload, Download,
  Tag, Truck,
} from "lucide-react";
import { clsx } from "clsx";
import { vendorsApi, vendorInvoicesApi, grnApi, purchaseOrdersApi, accountsApi, settingsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import AccountFormModal from "@/components/modals/AccountFormModal";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

// ── Constants ────────────────────────────────────────────────────────────────

const UNITS = [
  { label: "None",             short: "None", code: "NONE" },
  { label: "Bags (Bag)",       short: "Bag",  code: "BAG" },
  { label: "Box (Box)",        short: "Box",  code: "BOX" },
  { label: "Grams (Grm)",      short: "Grm",  code: "GRM" },
  { label: "Kilograms (Kgs)",  short: "Kgs",  code: "KGS" },
  { label: "Liters (Ltr)",     short: "Ltr",  code: "LTR" },
  { label: "Meters (Mtr)",     short: "Mtr",  code: "MTR" },
  { label: "Numbers (Nos)",    short: "Nos",  code: "NOS" },
  { label: "Packs (Pkt)",      short: "Pkt",  code: "PKT" },
  { label: "Pieces (Pcs)",     short: "Pcs",  code: "PCS" },
];

const TAX_OPTIONS = [
  { label: "NONE", value: 0 },
  { label: "GST@0%", value: 0 },
  { label: "GST@5%", value: 5 },
  { label: "GST@12%", value: 12 },
  { label: "GST@18%", value: 18 },
  { label: "GST@28%", value: 28 },
  { label: "IGST@5%", value: 5 },
  { label: "IGST@12%", value: 12 },
  { label: "IGST@18%", value: 18 },
  { label: "IGST@28%", value: 28 },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu & Kashmir","Ladakh",
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: "Pending",  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-900/40" },
  MATCHED:  { label: "Matched",  color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-900/40" },
  APPROVED: { label: "Approved", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900/40" },
  MISMATCH: { label: "Mismatch", color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-900/40" },
  PAID:     { label: "Paid",     color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900/40" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  rate: number;
  taxPct: number;
  taxLabel: string;
}

function makeItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), name: "", qty: 1, unit: "NONE", rate: 0, taxPct: 0, taxLabel: "NONE" };
}

function computeRow(item: LineItem, mode: "without_tax" | "with_tax" = "without_tax") {
  if (mode === "with_tax") {
    const gross = item.qty * item.rate;
    const base = item.taxPct > 0 ? parseFloat((gross / (1 + item.taxPct / 100)).toFixed(2)) : gross;
    const taxAmt = parseFloat((gross - base).toFixed(2));
    return { base, taxAmt, amount: parseFloat(gross.toFixed(2)) };
  } else {
    const base = parseFloat((item.qty * item.rate).toFixed(2));
    const taxAmt = parseFloat((base * item.taxPct / 100).toFixed(2));
    return { base, taxAmt, amount: parseFloat((base + taxAmt).toFixed(2)) };
  }
}

// ── MiniCalendar ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const isSelected = (d: number) => Boolean(value) && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - 15 + i);

  return (
    <div className="bg-white dark:bg-[#13151f] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2 gap-1">
        <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-slate-400">
          <ChevronDown size={14} className="rotate-90" />
        </button>
        <div className="flex items-center gap-1">
          <select
            value={viewMonth}
            onChange={e => setViewMonth(Number(e.target.value))}
            className="text-xs font-semibold text-gray-800 dark:text-white bg-transparent border-0 outline-none cursor-pointer hover:text-orange-600 dark:hover:text-orange-400"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx} className="dark:bg-[#13151f]">{m}</option>
            ))}
          </select>
          <select
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            className="text-xs font-semibold text-gray-800 dark:text-white bg-transparent border-0 outline-none cursor-pointer hover:text-orange-600 dark:hover:text-orange-400"
          >
            {years.map(y => (
              <option key={y} value={y} className="dark:bg-[#13151f]">{y}</option>
            ))}
          </select>
        </div>
        <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-slate-400">
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i}
            onClick={() => { onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); onClose(); }}
            className={clsx("w-full aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors",
              isSelected(d) && "bg-orange-500 text-white",
              !isSelected(d) && isToday(d) && "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
              !isSelected(d) && !isToday(d) && "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10"
            )}
          >{d}</button>
        ))}
      </div>
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 dark:border-white/10 pt-2">
        <button onClick={() => { const t = new Date(); onChange(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`); onClose(); }} className="text-[11px] font-semibold text-orange-500 hover:text-orange-700 dark:hover:text-orange-400">Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white">Close</button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PurchaseBillsPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [bills, setBills] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState("");

  // form
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const [vendorPhone, setVendorPhone] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billNumber, setBillNumber] = useState("Auto");
  const [stateOfSupply, setStateOfSupply] = useState("");
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [showPriceDrop, setShowPriceDrop] = useState(false);
  const [openUnitDrop, setOpenUnitDrop] = useState<string | null>(null);
  const [unitDropRect, setUnitDropRect] = useState<{ top: number; left: number } | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [freight, setFreight] = useState<number>(0);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [sourcePoId, setSourcePoId] = useState<string | null>(null);
  const [sourceGrnId, setSourceGrnId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: string; type: string; url?: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const vendorDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);

  // date filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

  // GSTInvoice preview/print modal — holds either a saved bill (from the
  // list) or a synthetic draft object built from the in-progress form.
  const [previewBill, setPreviewBill] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  const fmtD = (d: string) => formatDate(d);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, accRes, vRes] = await Promise.all([
        vendorInvoicesApi.getAll(),
        accountsApi.getAll().catch(() => ({ data: [] })),
        vendorsApi.getAll()
      ]);
      setBills(res.data?.invoices || res.data || []);
      setAccounts(accRes.data || []);
      setVendors(vRes.data?.vendors || vRes.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => setCompanyProfile(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const grnId = urlParams.get('grnId');
    const poId = urlParams.get('poId');

    if (grnId) {
      grnApi.getById(grnId).then(res => {
        const grn = res.data;
        if (grn) {
           setView("create");
           if (grn.procurementOrder?.vendor) {
              const v = grn.procurementOrder.vendor;
              setSelectedVendor(v);
              setVendorSearch(v.name);
              setVendorPhone(v.contact || v.phone || "");
              if (v.state) setStateOfSupply(v.state);
           }
           setSourcePoId(grn.poId);
           setSourceGrnId(grn.id);
            if (grn.items && grn.items.length > 0) {
               let poItems: any[] = [];
               try {
                  if (typeof grn.procurementOrder?.items === 'string') {
                     poItems = JSON.parse(grn.procurementOrder.items);
                  } else if (Array.isArray(grn.procurementOrder?.items)) {
                     poItems = grn.procurementOrder.items;
                  } else if (Array.isArray(grn.procurementOrder?.poItems)) {
                     poItems = grn.procurementOrder.poItems;
                  }
               } catch(e) {}

               const newItems = grn.items.map((item: any) => {
                  let rate = item.gstRate || 0;
                  if (rate === 0 && poItems.length > 0) {
                     const matId = item.materialId || item.inventoryItemId || (item.inventoryItem ? item.inventoryItem.id : null);
                     const poItem = poItems.find((pi: any) => (pi.inventoryItemId === matId || pi.id === matId));
                     if (poItem && poItem.gstRate) {
                        rate = poItem.gstRate;
                     }
                  }
                  if (rate === 0) {
                     rate = item.inventoryItem?.taxRate || item.inventoryItem?.gstRate || 0;
                  }
                  return {
                     id: Math.random().toString(36).slice(2),
                     name: item.inventoryItem?.name || item.itemName || "Material",
                     qty: Number(item.acceptedQty ?? item.quantity) || 0,
                     unit: item.inventoryItem?.unit || item.unit || "KGS",
                     rate: Number(item.price) || 0,
                     taxPct: rate,
                     taxLabel: rate > 0 ? `GST@${rate}%` : "NONE"
                  };
               });
               setItems(newItems);
            }

            // Fetch discount and freight from PO or GRN
            let poDiscount = Number(grn.procurementOrder?.discountAmount) || 0;
            let poFreight = Number(grn.procurementOrder?.freightCost) || Number(grn.freightCost) || 0;

            const poSubtotal = Number(grn.procurementOrder?.subtotal) || 0;
            const acceptedSubtotal = (grn.items || []).reduce((acc: number, it: any) => {
              const qty = Number(it.acceptedQty ?? it.quantity ?? 0);
              const price = Number(it.price ?? 0);
              return acc + (qty * price);
            }, 0);

            if (poSubtotal > 0 && acceptedSubtotal > 0 && acceptedSubtotal < poSubtotal) {
              const ratio = acceptedSubtotal / poSubtotal;
              poDiscount = parseFloat((poDiscount * ratio).toFixed(2));
              poFreight = parseFloat((poFreight * ratio).toFixed(2));
            }

            setDiscount(poDiscount);
            setFreight(poFreight);

           setDescription(`Auto-generated from GRN: ${grnId} / PO: ${grn.procurementOrder?.poNumber || ''}`);
           setShowDesc(true);
           toast.success("Bill auto-filled from GRN!");
        }
      }).catch(err => {
         console.error("Failed to load GRN for auto-fill", err);
      });
    } else if (poId) {
      purchaseOrdersApi.getById(poId).then(res => {
        const po = res.data;
        if (po) {
          setView("create");
          if (po.vendor) {
            setSelectedVendor(po.vendor);
            setVendorSearch(po.vendor.name);
            setVendorPhone(po.vendor.contact || po.vendor.phone || "");
            if (po.vendor.state) setStateOfSupply(po.vendor.state);
          }
          setSourcePoId(po.id);
          const poItems = po.poItems || (typeof po.items === 'string' ? JSON.parse(po.items) : po.items) || [];
          if (poItems.length > 0) {
            const newItems = poItems.map((item: any) => {
              const rate = item.gstRate ?? (item.inventoryItem?.taxRate || item.inventoryItem?.gstRate || 0);
              return {
                id: Math.random().toString(36).slice(2),
                name: item.itemName || item.inventoryItem?.name || "Material",
                qty: Number(item.quantity) || 1,
                unit: item.unit || item.inventoryItem?.unit || "KGS",
                rate: Number(item.price) || 0,
                taxPct: rate,
                taxLabel: rate > 0 ? `GST@${rate}%` : "NONE"
              };
            });
            setItems(newItems);
          }
          const disc = Number(po.discountAmount) || 0;
          const frt = Number(po.freightCost) || 0;
          setDiscount(disc);
          setFreight(frt);
          setDescription(`Auto-generated from PO: ${po.poNumber || po.id}`);
          setShowDesc(true);
          toast.success("Bill auto-filled from PO!");
        }
      }).catch(err => {
        console.error("Failed to load PO for auto-fill", err);
      });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vendorDropRef.current && !vendorDropRef.current.contains(e.target as Node)) setShowVendorDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node)) setShowShareDrop(false);
      if (priceDropRef.current && !priceDropRef.current.contains(e.target as Node)) setShowPriceDrop(false);
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setShowCalendar(false);
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node)) setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node)) setShowToCal(false);
      
      if (!(e.target as Element).closest?.('.unit-dropdown-container')) {
        setOpenUnitDrop(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Computed
  const rowData = items.map(item => ({ item, ...computeRow(item, priceMode) }));
  const subtotal = parseFloat(rowData.reduce((s, r) => s + r.base, 0).toFixed(2));
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const safeFreight = Math.max(0, Number(freight) || 0);
  const netAmount = parseFloat((subtotal + totalTax - safeDiscount + safeFreight).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(netAmount) - netAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((netAmount + roundOff).toFixed(2));

  const updateItem = (idx: number, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const addRow = () => setItems(prev => [...prev, makeItem()]);
  const removeRow = (idx: number) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  const openCreate = () => {
    setSelectedVendor(null); setVendorSearch(""); setVendorPhone("");
    setBillDate(new Date().toISOString().split("T")[0]); setBillNumber("Auto");
    setStateOfSupply(""); setPaymentType("CASH");
    setItems([makeItem(), makeItem()]); setPriceMode("without_tax");
    setDiscount(0); setFreight(0);
    setTermsText(""); setShowTerms(false); setDescription(""); setShowDesc(false);
    setAttachedFiles([]);
    setRoundOffEnabled(true); setView("create");
    setSourcePoId(null); setSourceGrnId(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: { id: string; name: string; size: string; type: string; url?: string }[] = [];
    Array.from(files).forEach((file) => {
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;
      
      const newFileObj = {
        id: Math.random().toString(36).slice(2),
        name: file.name,
        size: sizeStr,
        type: file.type,
        url: URL.createObjectURL(file),
      };
      newAttachments.push(newFileObj);
    });

    setAttachedFiles(prev => [...prev, ...newAttachments]);
    toast.success(`Attached ${newAttachments.length} document${newAttachments.length > 1 ? "s" : ""}`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Builds a synthetic bill object from the in-progress create/edit form
  // state, in the same shape as a saved bill, so both the "Print" and
  // "Download" actions (and a saved-bill row's preview) can share one
  // GSTInvoice preview modal.
  const buildDraftBillPreview = () => ({
    vendor: selectedVendor,
    items: items.filter(i => i.name && i.qty > 0),
    invoiceNumber: billNumber !== "Auto" ? billNumber : "Draft",
    billDate: billDate || new Date().toISOString(),
    paymentType: paymentType,
    amount: finalTotal,
    discount: safeDiscount,
    discountAmount: safeDiscount,
    freight: safeFreight,
    freightCost: safeFreight,
    subtotal: subtotal,
    totalTax: totalTax
  });

  const handleDownloadPdf = (bill?: any) => {
    setPreviewBill(bill || buildDraftBillPreview());
  };

  const handleShare = (bill?: any) => {
    toast.success("Share link copied to clipboard!");
  };

  const handlePrint = () => {
    setPreviewBill(buildDraftBillPreview());
  };

  const handleSave = async () => {
    if (!selectedVendor) { toast.error("Please select a vendor"); return; }
    if (!billDate) { toast.error("Bill Date / Invoice Date is required"); return; }
    const validItems = items.filter(i => i.name && i.qty > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      await vendorInvoicesApi.create({
        vendorId: selectedVendor.id,
        poId: sourcePoId || undefined,
        grnId: sourceGrnId || undefined,
        invoiceNumber: billNumber !== "Auto" ? billNumber : `BILL-${Date.now().toString().slice(-6)}`,
        billDate,
        stateOfSupply: stateOfSupply || undefined,
        paymentType,
        amount: finalTotal,
        subtotal: subtotal,
        taxAmount: totalTax,
        discountAmount: safeDiscount,
        freightCost: safeFreight,
        items: validItems.map(i => {
          const row = computeRow(i, priceMode);
          return {
            name: i.name, qty: i.qty, unit: i.unit,
            rate: i.rate, taxPct: i.taxPct, taxAmount: row.taxAmt, amount: row.amount,
          };
        }),
        termsAndConditions: termsText || undefined,
        description: description || undefined,
        attachments: attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type, url: f.url })),
        roundOff,
      });
      toast.success("Bill saved successfully");
      setView("list");
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save bill");
    } finally { setSaving(false); }
  };

  const getFilteredAccounts = () => {
    if (paymentMode === "CASH") {
      return accounts.filter(a => a.type === "CASH");
    } else {
      return accounts.filter(a => a.type === "BANK" || a.type === "UPI");
    }
  };

  const handlePaymentModeChange = (mode: string) => {
    setPaymentMode(mode);
    const filtered = mode === "CASH" 
      ? accounts.filter(a => a.type === "CASH")
      : accounts.filter(a => a.type === "BANK" || a.type === "UPI");
    
    const isStillValid = filtered.some(a => a.id === paymentAccount);
    if (!isStillValid) {
      setPaymentAccount("");
    }
  };

  const handleMakePayment = async () => {
    if (!paymentBill || !paymentAccount) {
      if (accounts.length === 0) {
        toast.error("No account found. Please add a financial account first.");
        setShowAccountModal(true);
        return;
      }
      return toast.error("Please select an account.");
    }
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) return toast.error("Valid amount required.");

    const outstanding = paymentBill.outstanding ?? Math.max(0, (paymentBill.amount || 0) - (paymentBill.advanceApplied || 0) - (paymentBill.paidAmount || 0));
    if (Number(paymentAmount) > outstanding + 0.01) {
      return toast.error(`Payment amount of ₹${paymentAmount} cannot exceed outstanding balance of ₹${outstanding.toFixed(2)}.`);
    }
    
    try {
      setSubmittingPayment(true);
      await vendorsApi.recordPayment(paymentBill.vendorId, {
        amount: Number(paymentAmount),
        note: paymentNote || `Payment for ${paymentBill.invoiceNumber || 'Bill'}`,
        accountId: paymentAccount,
        paymentMode,
        type: "PAYMENT",
        vendorInvoiceId: paymentBill.id,
        idempotencyKey: paymentIdempotencyKey
      });
      toast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openPaymentModal = async (bill: any) => {
    setPaymentBill(bill);
    const outstanding = bill.outstanding ?? Math.max(0, (bill.amount || 0) - (bill.advanceApplied || 0) - (bill.paidAmount || 0));
    setPaymentAmount(outstanding.toString());
    setPaymentNote(`Payment for ${bill.invoiceNumber || 'Bill'}`);
    setPaymentMode("CASH");
    if (accounts.length > 0) setPaymentAccount(accounts[0].id);
    setShowPaymentModal(true);
  };

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const filtered = bills.filter(b => {
    const matchSearch = !search ||
      b.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      b.vendor?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
    const targetDate = b.billDate || b.invoiceDate;
    let matchDate = true;
    if (targetDate) {
      const bD = typeof targetDate === "string" ? targetDate.split("T")[0] : new Date(targetDate).toISOString().split("T")[0];
      if (dateFrom && bD < dateFrom) matchDate = false;
      if (dateTo && bD > dateTo) matchDate = false;
    }
    return matchSearch && matchStatus && matchDate;
  });

  const totalBillAmt = filtered.reduce((s, b) => s + (b.amount || 0), 0);
  const totalPaid = filtered.filter(b => b.status === "PAID" || b.status === "APPROVED").reduce((s, b) => s + (b.amount || 0), 0);
  const totalPending = filtered.filter(b => b.status === "PENDING").reduce((s, b) => s + (b.amount || 0), 0);

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground" style={{ height: "calc(100vh - 104px)" }}>
        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors">
              <ArrowLeft size={17} />
            </button>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">New Purchase Bill</h2>
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500">Bill No: <span className="text-orange-500 font-semibold">Auto</span></span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 sm:py-5 space-y-4 custom-scrollbar w-full min-w-0">

          {/* Vendor + Bill Details */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-sm w-full min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full min-w-0">
              {/* Left: Vendor */}
              <div className="space-y-3 min-w-0">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Vendor / Party *</label>
                  <div className="relative" ref={vendorDropRef}>
                    <div
                      className={clsx(
                        "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white dark:bg-white/5 transition-colors",
                        showVendorDrop ? "border-orange-400 ring-1 ring-orange-100 dark:ring-orange-950/40" : "border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20"
                      )}
                      onClick={() => setShowVendorDrop(v => !v)}
                    >
                      <input
                        className="flex-1 text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                        placeholder="Search by vendor name..."
                        value={vendorSearch}
                        onChange={e => { setVendorSearch(e.target.value); setShowVendorDrop(true); }}
                        onClick={e => { e.stopPropagation(); setShowVendorDrop(true); }}
                      />
                      {vendorSearch && (
                        <X 
                          size={14} 
                          className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                          onClick={(e) => { e.stopPropagation(); setVendorSearch(""); setSelectedVendor(null); }} 
                        />
                      )}
                      <ChevronDown size={13} className="text-gray-400 shrink-0" />
                    </div>
                    {showVendorDrop && (
                      <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                          {filteredVendors.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">No vendors found</div>
                          ) : filteredVendors.map(v => (
                            <button key={v.id}
                              className="w-full flex items-start px-3 py-2 hover:bg-orange-50/50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 text-left"
                              onClick={() => { 
                                setSelectedVendor(v); 
                                setVendorSearch(v.name); 
                                setVendorPhone(v.contact || v.phone || ""); 
                                if (v.state) setStateOfSupply(v.state);
                                setShowVendorDrop(false); 
                              }}
                            >
                              <div>
                                <div className="text-sm font-medium text-gray-800 dark:text-white">{v.name}</div>
                                <div className="text-xs text-gray-400 dark:text-slate-500">{v.contact || v.phone || "—"}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Phone</label>
                  <input
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                    placeholder="Phone Number"
                    value={vendorPhone}
                    onChange={e => setVendorPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Right: Bill Details */}
              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Bill Number</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Auto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Bill Date <span className="text-rose-500 font-bold">*</span></span>
                  <div className="relative" ref={calendarRef}>
                    <div className="flex items-center gap-2 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-white/5 hover:border-orange-400 transition-colors w-48 justify-between">
                      <button
                        type="button"
                        onClick={() => setShowCalendar(v => !v)}
                        className="text-sm text-gray-700 dark:text-white text-left outline-none truncate"
                      >
                        {billDate ? formatDate(billDate) : "Select Date"}
                      </button>
                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowCalendar(v => !v)}
                          className="text-orange-500 hover:text-orange-600 transition-colors"
                          title="Open Calendar"
                        >
                          <Calendar size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setBillDate(""); }}
                          className={clsx(
                            "text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all",
                            billDate ? "opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"
                          )}
                          title="Clear Date"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-1 z-[200]">
                        <MiniCalendar value={billDate} onChange={setBillDate} onClose={() => setShowCalendar(false)} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">State of Supply</span>
                  <select
                    value={stateOfSupply}
                    onChange={e => setStateOfSupply(e.target.value)}
                    className="border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-white/5 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 w-44 transition-colors"
                  >
                    <option value="" className="dark:bg-[#13151f]">Select</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s} className="dark:bg-[#13151f]">{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Payment Type</span>
                  <div className="flex gap-2">
                    {(["CASH", "CREDIT"] as const).map(pt => (
                      <button key={pt} onClick={() => setPaymentType(pt)}
                        className={clsx("px-3 py-1 rounded-lg text-xs font-semibold border transition-colors",
                          paymentType === pt ? "bg-orange-500 text-white border-orange-500" : "bg-white dark:bg-white/5 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20"
                        )}
                      >{pt}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Items</span>
              <div className="relative" ref={priceDropRef}>
                <button onClick={() => setShowPriceDrop(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-white/10 rounded-lg px-2.5 py-1 bg-white dark:bg-white/5 hover:border-gray-400 dark:hover:border-white/20 transition-colors"
                >
                  Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
                  <ChevronDown size={11} />
                </button>
                {showPriceDrop && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg text-xs w-44 z-50 overflow-hidden">
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200" onClick={() => { setPriceMode("without_tax"); setShowPriceDrop(false); }}>Excl. Tax (Without Tax)</button>
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200" onClick={() => { setPriceMode("with_tax"); setShowPriceDrop(false); }}>Incl. Tax (With Tax)</button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    <th className="w-8 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5 text-left">Item / Description</th>
                    <th className="w-16 px-2 py-2.5 text-center">Qty</th>
                    <th className="w-20 px-2 py-2.5 text-center">Unit</th>
                    <th className="w-28 px-3 py-2.5 text-right">Price/Unit</th>
                    <th className="w-36 px-2 py-2.5 text-center">Tax</th>
                    <th className="w-24 px-3 py-2.5 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((item, idx) => {
                    const { amount } = computeRow(item, priceMode);
                    return (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-orange-50/30 dark:hover:bg-white/[0.02] group">
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                            placeholder="Enter item name..."
                            value={item.name}
                            onChange={e => updateItem(idx, "name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.qty}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 dark:text-white text-center outline-none bg-transparent"
                          />
                        </td>
                        <td style={{ position: "relative", overflow: "visible" }} className="unit-dropdown-container">
                          <button
                            className="w-full flex items-center justify-center gap-0.5 px-2 py-2.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                            onClick={e => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setUnitDropRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                              setOpenUnitDrop(v => v === item.id ? null : item.id);
                            }}
                          >
                            <span>{UNITS.find(u => u.code === item.unit)?.short ?? item.unit}</span>
                            <ChevronDown size={9} className="text-gray-400 shrink-0" />
                          </button>
                          {openUnitDrop === item.id && unitDropRect && (
                            <div className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-y-auto"
                              style={{ position: "fixed", top: unitDropRect.top + 2, left: unitDropRect.left, width: 180, maxHeight: 220, zIndex: 9999 }}
                            >
                              {UNITS.map(u => (
                                <button key={u.code}
                                  className={clsx("w-full text-left px-3 py-2 text-xs border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-orange-50 dark:hover:bg-white/5",
                                    item.unit === u.code ? "text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-white/5" : "text-gray-700 dark:text-slate-300"
                                  )}
                                  onMouseDown={() => { updateItem(idx, "unit", u.code); setOpenUnitDrop(null); }}
                                >
                                  <span className="font-medium">{u.short}</span>
                                  <span className="text-gray-400 dark:text-slate-500 ml-1">– {u.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.rate || ""}
                            placeholder="0"
                            onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 dark:text-white text-right outline-none bg-transparent"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <select
                            value={item.taxLabel}
                            onChange={e => {
                              const label = e.target.value;
                              const opt = TAX_OPTIONS.find(o => o.label === label);
                              updateItem(idx, "taxLabel", label);
                              updateItem(idx, "taxPct", opt?.value ?? 0);
                            }}
                            className="w-full text-xs text-gray-700 dark:text-white outline-none bg-transparent cursor-pointer"
                          >
                            {TAX_OPTIONS.map((t, i) => <option key={i} value={t.label} className="dark:bg-[#13151f]">{t.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800 dark:text-white">
                          {amount > 0 ? amount.toFixed(2) : "—"}
                        </td>
                        <td className="pr-2">
                          <button onClick={() => removeRow(idx)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/40 dark:bg-white/[0.01]">
              <button onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 border border-orange-200 dark:border-orange-900/40 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Row
              </button>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Total Tax: <span className="font-semibold text-gray-700 dark:text-slate-200">₹ {totalTax.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start pb-2 w-full min-w-0">
            <div className="flex-1 space-y-2.5 min-w-0">
              <div className="flex flex-wrap gap-2">
                {!showTerms && (
                  <button onClick={() => setShowTerms(true)} className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 transition-colors">
                    <AlignLeft size={13} /> Add Terms &amp; Conditions
                  </button>
                )}
                {!showDesc && (
                  <button onClick={() => setShowDesc(true)} className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 transition-colors">
                    <FileText size={13} /> Add Description
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                >
                  <Upload size={13} /> Upload Bill
                </button>
              </div>

              {showTerms && (
                <div className="relative">
                  <textarea value={termsText} onChange={e => setTermsText(e.target.value)} rows={3} placeholder="Terms and conditions..." className="w-full text-xs text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 outline-none resize-none" />
                  <button type="button" onClick={() => { setTermsText(""); setShowTerms(false); }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><X size={12} /></button>
                </div>
              )}

              {showDesc && (
                <div className="relative">
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Description..." className="w-full text-xs text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-lg px-3 py-2 outline-none resize-none" />
                  <button type="button" onClick={() => { setDescription(""); setShowDesc(false); }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><X size={12} /></button>
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />

                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {attachedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/40 rounded-lg text-xs text-gray-700 dark:text-slate-200 shadow-sm"
                      >
                        <FileText size={14} className="text-orange-500 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium max-w-[180px] truncate">{file.name}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">{file.size}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(file.id)}
                          className="ml-1 text-gray-400 hover:text-red-500 transition-colors p-0.5"
                          title="Remove attachment"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Summary Panel */}
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4.5 w-full lg:w-72 shrink-0 space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center text-sm text-gray-600 dark:text-slate-300">
                <span className="font-medium">Subtotal</span>
                <span className="font-semibold text-gray-900 dark:text-white">₹ {subtotal.toFixed(2)}</span>
              </div>

              {safeDiscount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-slate-300 font-medium">Discount</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">- ₹ {safeDiscount.toFixed(2)}</span>
                </div>
              )}

              {totalTax > 0 && (
                <div className="flex justify-between items-center text-sm text-gray-600 dark:text-slate-300">
                  <span className="font-medium">Tax (GST)</span>
                  <span className="font-semibold text-gray-900 dark:text-white">+ ₹ {totalTax.toFixed(2)}</span>
                </div>
              )}

              {safeFreight > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-slate-300 font-medium">Freight / Shipment</span>
                  <span className="font-semibold text-gray-900 dark:text-white">+ ₹ {safeFreight.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-white/5 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={roundOffEnabled} onChange={e => setRoundOffEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-xs font-medium">Round Off</span>
                </label>
                <span className="text-xs font-mono">{roundOff >= 0 ? "+" : ""}{roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 dark:border-white/10 pt-2.5">
                <span className="text-sm font-bold text-gray-800 dark:text-white">Total</span>
                <span className="text-xl font-black text-orange-500">₹ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button onClick={() => setView("list")} className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg">
            Cancel
          </button>
          <div className="relative" ref={shareDropRef}>
            <div className="flex rounded-lg overflow-hidden">
              <button 
                type="button"
                onClick={() => handleShare()}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 border-r border-orange-400 flex items-center gap-1.5"
              >
                <Share2 size={13} /> Share
              </button>
              <button 
                type="button"
                onClick={() => setShowShareDrop(v => !v)}
                className="px-2 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            {showShareDrop && (
              <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg text-sm min-w-[160px] z-50 py-1 overflow-hidden">
                <button 
                  type="button"
                  onClick={() => { setShowShareDrop(false); handlePrint(); }} 
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <Printer size={13} /> Print
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowShareDrop(false); handleDownloadPdf(); }} 
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <Download size={13} /> Download
                </button>
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground">
      {/* Page Header Toolbar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end">
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" /> Add Purchase Bill
        </button>
      </div>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Purchases",  value: `₹ ${totalBillAmt.toLocaleString("en-IN")}`,  dot: "bg-blue-500",    color: "text-gray-900 dark:text-white" },
            { label: "Paid",             value: `₹ ${totalPaid.toLocaleString("en-IN")}`,     dot: "bg-emerald-500", color: "text-emerald-700 dark:text-emerald-400" },
            { label: "Pending Payment",  value: `₹ ${totalPending.toLocaleString("en-IN")}`,  dot: "bg-amber-500",   color: "text-amber-700 dark:text-amber-400" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search bill no. or vendor..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-card text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg p-1 text-xs gap-1">
            {["ALL", "PENDING", "PAID"].map(st => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={clsx("px-3 py-1 rounded font-semibold transition-colors",
                  statusFilter === st ? "bg-[#f58220] text-white" : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >{st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={fromCalRef}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:border-[#f58220] transition-colors">
                <button
                  type="button"
                  onClick={() => { setShowFromCal(v => !v); setShowToCal(false); }}
                  className="outline-none"
                >
                  {dateFrom ? fmtD(dateFrom) : "From Date"}
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => { setShowFromCal(v => !v); setShowToCal(false); }}
                    className="text-[#f58220]"
                    title="Choose from date"
                  >
                    <Calendar size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDateFrom(""); }}
                    className={clsx(
                      "text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all",
                      dateFrom ? "opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"
                    )}
                    title="Clear from date"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              {showFromCal && (
                <div className="absolute left-0 top-full mt-1 z-50">
                  <MiniCalendar value={dateFrom} onChange={v => { setDateFrom(v); setShowFromCal(false); }} onClose={() => setShowFromCal(false)} />
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500">to</span>
            <div className="relative" ref={toCalRef}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:border-[#f58220] transition-colors">
                <button
                  type="button"
                  onClick={() => { setShowToCal(v => !v); setShowFromCal(false); }}
                  className="outline-none"
                >
                  {dateTo ? fmtD(dateTo) : "To Date"}
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => { setShowToCal(v => !v); setShowFromCal(false); }}
                    className="text-[#f58220]"
                    title="Choose to date"
                  >
                    <Calendar size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDateTo(""); }}
                    className={clsx(
                      "text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all",
                      dateTo ? "opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"
                    )}
                    title="Clear to date"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              {showToCal && (
                <div className="absolute left-0 top-full mt-1 z-50">
                  <MiniCalendar value={dateTo} onChange={v => { setDateTo(v); setShowToCal(false); }} onClose={() => setShowToCal(false)} />
                </div>
              )}
            </div>
          </div>

          <button onClick={fetchData} className="p-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors ml-auto" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400 dark:text-slate-500">Loading bills...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center shadow-sm">
            <Receipt className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">No Purchase Bills Found</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Create your first bill to get started.</p>
            <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
              <Plus className="h-4 w-4" /> Add Purchase Bill
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Bill No.</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Payment Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map(b => {
                  const style = STATUS_STYLES[b.status] || { label: b.status, color: "text-gray-600 dark:text-slate-400", bg: "bg-gray-50 dark:bg-white/5", border: "border-gray-200 dark:border-white/10" };
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                        {formatDate(b.billDate)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-800 dark:text-white">
                        {b.invoiceNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">
                        {b.vendor?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                        {b.paymentType || "Cash"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-white">
                        ₹ {(b.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {b.status !== "PAID" && (b.outstanding ?? 0) > 0.01 && (
                            <button onClick={() => openPaymentModal(b)} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-semibold rounded text-xs transition-colors">
                              Make Payment
                            </button>
                          )}
                          <button 
                            type="button"
                            onClick={() => handleDownloadPdf(b)} 
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors" 
                            title="Download PDF"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleShare(b)} 
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors" 
                            title="Share Purchase Bill"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {previewBill && (
        <GSTInvoice
          order={{
            poNumber: previewBill.invoiceNumber || previewBill.billNumber,
            createdAt: previewBill.billDate || previewBill.invoiceDate,
            discount: previewBill.discount || previewBill.discountAmount || 0,
            discountAmount: previewBill.discountAmount || previewBill.discount || 0,
            freight: previewBill.freight || previewBill.freightCost || 0,
            freightCost: previewBill.freightCost || previewBill.freight || 0,
            items: (previewBill.items || []).map((it: any, idx: number) => ({
              itemName: it.item || it.name || `Item #${idx + 1}`,
              quantity: Number(it.qty ?? it.quantity) || 0,
              price: Number(it.price ?? it.pricePerUnit ?? it.rate) || 0,
              gstRate: Number(it.taxRate ?? it.tax ?? it.taxPct ?? 0),
              hsnCode: it.hsnCode || it.hsn || undefined,
            })),
          }}
          vendor={previewBill.vendor || selectedVendor || { name: previewBill.vendorSearch || "Vendor" }}
          companyDetails={companyProfile || FALLBACK_COMPANY}
          documentType="PURCHASE_INVOICE"
          onClose={() => setPreviewBill(null)}
        />
      )}

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Make Payment"
        size="md"
        footer={
          <>
            <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">Cancel</button>
            <button onClick={handleMakePayment} disabled={submittingPayment} className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg shadow disabled:opacity-50">
              {submittingPayment ? "Processing..." : "Save Payment"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 font-medium">₹</span>
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-500 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Payment Mode</label>
              <select value={paymentMode} onChange={e => handlePaymentModeChange(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-500 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white">
                <option value="CASH" className="dark:bg-[#13151f]">Cash</option>
                <option value="BANK_TRANSFER" className="dark:bg-[#13151f]">Bank Transfer</option>
                <option value="UPI" className="dark:bg-[#13151f]">UPI</option>
                <option value="CARD" className="dark:bg-[#13151f]">Card</option>
                <option value="CHEQUE" className="dark:bg-[#13151f]">Cheque</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Source Account</label>
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                >
                  + Add New
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={paymentAccount}
                  onChange={e => {
                    if (e.target.value === "ADD_NEW") {
                      setShowAccountModal(true);
                    } else {
                      setPaymentAccount(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-500 bg-gray-50 dark:bg-white/5 text-sm font-medium text-gray-700 dark:text-white"
                >
                  <option value="" className="dark:bg-[#13151f]">Select Account</option>
                  {getFilteredAccounts().map(a => (
                    <option key={a.id} value={a.id} className="dark:bg-[#13151f]">{a.name} ({a.type})</option>
                  ))}
                  <option value="ADD_NEW" className="font-bold text-orange-600 dark:bg-[#13151f]">+ Add New Account...</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="p-2 border border-gray-200 dark:border-white/10 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400 hover:text-orange-600 rounded-lg transition-all"
                  title="Add New Account"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Payment Note</label>
            <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-500 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-white"
              placeholder="e.g. Cleared via Cheque #1234"
            />
          </div>
        </div>
      </Modal>

      <AccountFormModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onSuccess={(acc) => {
          setAccounts(prev => [...prev, acc]);
          setPaymentAccount(acc.id);
        }}
      />
    </div>
  );
}
