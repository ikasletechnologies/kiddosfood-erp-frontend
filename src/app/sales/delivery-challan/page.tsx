"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Truck, Plus, Search, RefreshCw, X, FileText,
  User, Check, Package, Calendar,
  MapPin, Hash, ArrowRight,
  ChevronDown, Trash2, MoreVertical,
  ArrowLeft
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, dealersApi, productsFullApi, franchiseApi, inventoryApi, salesApi, productBatchesApi, settingsApi, posApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

// ── Constants (Unified with Invoice Page) ────────────────────────────────────

const UNITS = [
  { label: "None",              short: "None",  code: "NONE" },
  { label: "Bags (Bag)",        short: "Bag",   code: "BAG" },
  { label: "Bottles (Btl)",     short: "Btl",   code: "BTL" },
  { label: "Box (Box)",         short: "Box",   code: "BOX" },
  { label: "Bundles (Bdl)",     short: "Bdl",   code: "BDL" },
  { label: "Carats (Ct)",       short: "Ct",    code: "CT" },
  { label: "Cms",               short: "Cms",   code: "CMS" },
  { label: "Dozens (Dzn)",      short: "Dzn",   code: "DZN" },
  { label: "Grams (Grm)",       short: "Grm",   code: "GRM" },
  { label: "Kilograms (Kgs)",   short: "Kgs",   code: "KGS" },
  { label: "Liters (Ltr)",      short: "Ltr",   code: "LTR" },
  { label: "Meters (Mtr)",      short: "Mtr",   code: "MTR" },
  { label: "Numbers (Nos)",     short: "Nos",   code: "NOS" },
  { label: "Packs (Pkt)",       short: "Pkt",   code: "PKT" },
  { label: "Pieces (Pcs)",      short: "Pcs",   code: "PCS" },
  { label: "Rolls",             short: "Roll",  code: "ROLL" },
  { label: "Square Feet (Sqf)", short: "Sqf",   code: "SQF" },
  { label: "Tons (Tne)",        short: "Tne",   code: "TNE" },
  { label: "Units (Unt)",       short: "Unt",   code: "UNT" },
];

const TAX_OPTIONS = [
  { label: "NONE", value: 0 },
  { label: "IGST@0%", value: 0 },
  { label: "GST@0%", value: 0 },
  { label: "IGST@5%", value: 5 },
  { label: "GST@5%", value: 5 },
  { label: "IGST@12%", value: 12 },
  { label: "GST@12%", value: 12 },
  { label: "IGST@18%", value: 18 },
  { label: "GST@18%", value: 18 },
  { label: "IGST@28%", value: 28 },
  { label: "GST@28%", value: 28 },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu & Kashmir","Ladakh",
];

// Unified Color Coding (from Invoice Page status colors)
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:      { label: "Draft",       color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200" },
  IN_TRANSIT: { label: "In Transit",  color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  CLOSED:     { label: "Delivered",   color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  CANCELLED:  { label: "Cancelled",   color: "text-slate-400",   bg: "bg-slate-100",  border: "border-slate-200" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  productId: string;
  itemSearch: string;
  qty: number;
  unit: string;
  rate: number;
  taxPct: number;
  taxLabel: string;
  batchNumber: string;
  remarks: string;
}

function makeItem(): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    productId: "",
    itemSearch: "",
    qty: 1,
    unit: "NONE",
    rate: 0,
    taxPct: 0,
    taxLabel: "NONE",
    batchNumber: "",
    remarks: "",
  };
}

function computeRow(item: LineItem, withTax: boolean) {
  const gross = item.qty * item.rate;
  if (withTax) {
    const taxAmt = parseFloat((gross * item.taxPct / (100 + item.taxPct)).toFixed(2));
    const netAmt = gross - taxAmt;
    return { taxAmt, amount: parseFloat(gross.toFixed(2)) };
  }
  const taxAmt = parseFloat((gross * item.taxPct / 100).toFixed(2));
  return { taxAmt, amount: parseFloat((gross + taxAmt).toFixed(2)) };
}

// A batch is dispatchable when it has passed QC, isn't under an active recall,
// hasn't expired, and still has packaged stock on hand.
function batchIsUsable(b: any) {
  const qcOk = b.qcStatus === "APPROVED" || b.qcStatus === "PARTIALLY_APPROVED";
  const notRecalled = !(b.recall && (b.recall.status === "IN_PROGRESS" || b.recall.status === "COMPLETED"));
  const notExpired = b.expiryStatus !== "EXPIRED";
  const hasStock = (b.availableQuantity || 0) > 0;
  return qcOk && notRecalled && notExpired && hasStock;
}

const isValidPhone = (v: string) => v === "" || /^\d{10}$/.test(v);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeliveryChallanPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation State
  const [view, setView] = useState<"list" | "create" | "edit" | "transit">(searchParams.get("sourceInvoiceId") ? "create" : "list");
  const [transitStock, setTransitStock] = useState<any[]>([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [sourceInvoiceIdState, setSourceInvoiceIdState] = useState<string | null>(searchParams.get("sourceInvoiceId"));
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  // List filter state
  const [dateFilter, setDateFilter] = useState("THIS_MONTH");
  const [firmFilter, setFirmFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  });

  // Active Challan Form State
  const [destType, setDestType] = useState<"CUSTOMER" | "DEALER" | "FRANCHISE">("CUSTOMER");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedDealer, setSelectedDealer] = useState<any>(null);
  const [selectedFranchise, setSelectedFranchise] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  // Empty until resolved to the real HQ franchise once `franchises` loads
  // (see the effect below) — there's no fixed literal id to default to.
  const [sourceFranchiseId, setSourceFranchiseId] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [challanNo, setChallanNo] = useState<string>("1");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stateOfSupply, setStateOfSupply] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [showPriceDrop, setShowPriceDrop] = useState(false);
  
  // Dialog drop/floating states
  const [openItemDrop, setOpenItemDrop] = useState<string | null>(null);
  const [openUnitDrop, setOpenUnitDrop] = useState<string | null>(null);
  const [openTaxDrop, setOpenTaxDrop] = useState<string | null>(null);
  
  // Custom Notes / Terms Fields
  const [termsText, setTermsText] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  // One key per "New Challan" form session — a retry/double-click on Save/
  // Dispatch that races past disabled={saving} hits SalesService.
  // createDeliveryChallan's idempotency check server-side and returns the
  // already-created challan (and its already-deducted stock) instead of
  // dispatching a second time.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [showRowMenu, setShowRowMenu] = useState<string | null>(null);
  const [previewingChallan, setPreviewingChallan] = useState<any>(null);
  const [deliveringChallan, setDeliveringChallan] = useState<any>(null);
  const [returningChallan, setReturningChallan] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const currentCompany = companyProfile || FALLBACK_COMPANY;

  // Refs for closing dropdowns
  const customerDropRef = useRef<HTMLDivElement>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, dlRes, pRes, fRes, wRes, dcRes, cpRes] = await Promise.allSettled([
        customersApi.getAll(),
        dealersApi.getAll(),
        productsFullApi.getAll(),
        franchiseApi.getAll(),
        inventoryApi.getWarehouses(),
        salesApi.getDeliveryChallans(),
        settingsApi.getCompanyProfile(),
      ]);

      let apiChallans = dcRes.status === "fulfilled" ? (dcRes.value as any).data || [] : [];

      // Load from LocalStorage
      try {
        const localData = localStorage.getItem("sale_delivery_challans");
        if (localData) {
          const locals = JSON.parse(localData);
          // Filter out API duplicates if they have overlapping IDs
          const apiIds = new Set(apiChallans.map((c: any) => c.id));
          const uniqueLocals = locals.filter((l: any) => !apiIds.has(l.id));
          apiChallans = [...uniqueLocals, ...apiChallans];
        }
      } catch (e) {
        console.error("Failed to load local storage challans", e);
      }

      // Resolve lists
      const customerList = cRes.status === "fulfilled" ? (cRes.value as any).data || [] : [];
      const dealerList = dlRes.status === "fulfilled" ? (dlRes.value as any).data || [] : [];
      const franchiseList = fRes.status === "fulfilled" ? (fRes.value as any).data || [] : [];

      // Map to frontend structure
      const mappedChallans = apiChallans.map((dc: any) => {
        let name = dc.customerName;
        let phone = dc.customerPhone || "";
        if (dc.customerId) {
          const c = customerList.find((x: any) => x.id === dc.customerId);
          if (c) {
            name = c.name;
            phone = c.phone || phone;
          } else if (dc.customer) {
            name = dc.customer.name;
            phone = dc.customer.phone || phone;
          }
        } else if (dc.dealerId) {
          const dl = dealerList.find((x: any) => x.id === dc.dealerId);
          if (dl) {
            name = dl.name;
            phone = dl.phone || phone;
          } else if (dc.dealer) {
            name = dc.dealer.name;
            phone = dc.dealer.phone || phone;
          }
        } else if (dc.franchiseId) {
          const f = franchiseList.find((x: any) => x.id === dc.franchiseId);
          if (f) {
            name = f.name;
            phone = f.phone || phone;
          }
        }
        return {
          ...dc,
          status: dc.status === "OPEN" ? "IN_TRANSIT" : dc.status,
          challanNo: formatERPNumber("DC", dc.challanNo || dc.challanNumber || dc.id, dc.createdAt || dc.challanDate),
          invoiceDate: dc.invoiceDate || (dc.challanDate ? dc.challanDate.split("T")[0] : new Date().toISOString().split("T")[0]),
          dueDate: dc.dueDate ? dc.dueDate.split("T")[0] : dc.invoiceDate || new Date().toISOString().split("T")[0],
          customerName: name || "Unknown Party",
          customerPhone: phone,
          finalAmount: dc.finalAmount || dc.totalAmount || 0,
        };
      });

      setChallans(mappedChallans);
      if (cRes.status === "fulfilled") {
        const d = (cRes.value as any).data;
        setCustomers(Array.isArray(d) ? d : d?.data || []);
      }
      if (dlRes.status === "fulfilled") {
        const d = (dlRes.value as any).data;
        setDealers(Array.isArray(d) ? d : d?.data || []);
      }
      if (pRes.status === "fulfilled") {
        const d = (pRes.value as any).data;
        setProducts(Array.isArray(d) ? d : d?.data || []);
      }
      if (fRes.status === "fulfilled") {
        const d = (fRes.value as any).data;
        setFranchises(Array.isArray(d) ? d : d?.data || []);
      }
      if (wRes.status === "fulfilled") {
        const d = (wRes.value as any).data;
        setWarehouses(Array.isArray(d) ? d : d?.data || []);
      }
      if (cpRes.status === "fulfilled" && (cpRes.value as any).data) {
        setCompanyProfile((cpRes.value as any).data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transit Stock — derived from IN_TRANSIT challans server-side (see
  // SalesService.getTransitStock), not its own manual-entry page.
  useEffect(() => {
    if (view !== "transit") return;
    let cancelled = false;
    setTransitLoading(true);
    salesApi.getTransitStock().then((res: any) => {
      if (!cancelled) setTransitStock(res.data || []);
    }).catch(() => { if (!cancelled) setTransitStock([]); })
      .finally(() => { if (!cancelled) setTransitLoading(false); });
    return () => { cancelled = true; };
  }, [view]);

  // Load from Tax Invoice if creating via sourceInvoiceId
  useEffect(() => {
    if (sourceInvoiceIdState && view === "create" && !loading) {
      posApi.getOrderById(sourceInvoiceIdState).then((res: any) => {
        const order = res.data;
        if (!order) return;
        
        const pType = order.partyType || (order.customerId ? "CUSTOMER" : "UNKNOWN");
        setDestType(pType === "UNKNOWN" ? "CUSTOMER" : pType);
        
        if (pType === "CUSTOMER" && order.customer) {
          setSelectedCustomer(order.customer);
          setCustomerSearch(order.customer.name);
          setCustomerPhone(order.customer.phone || "");
        } else if (pType === "DEALER" && order.dealer) {
          setSelectedDealer(order.dealer);
          setCustomerSearch(order.dealer.name);
          setCustomerPhone(order.dealer.phone || "");
        } else if (pType === "FRANCHISE" && order.franchise) {
          setSelectedFranchise(order.franchise);
          setCustomerSearch(order.franchise.name);
          setCustomerPhone(order.franchise.phone || "");
        } else if (order.customerId) {
           // fallback if relation was not joined
           customersApi.getById(order.customerId).then((cRes: any) => {
             if (cRes.data) {
                setSelectedCustomer(cRes.data);
                setCustomerSearch(cRes.data.name);
                setCustomerPhone(cRes.data.phone || "");
             }
           });
        }
        
        setStateOfSupply(order.stateOfSupply || "");
        
        if (order.orderItems && order.orderItems.length > 0) {
          const newItems = order.orderItems.map((it: any) => {
            const taxPct = (it.taxAmount / (it.quantity * it.price)) * 100 || 0;
            return {
              id: Math.random().toString(36).slice(2),
              productId: it.productId,
              itemSearch: it.product?.name || "",
              qty: it.quantity,
              unit: it.unit || "NONE",
              rate: it.price,
              taxPct: isNaN(taxPct) ? 0 : Math.round(taxPct),
              taxLabel: isNaN(taxPct) ? "NONE" : "GST",
              batchNumber: it.batchNumber || "",
              remarks: "",
            };
          });
          setItems(newItems);
        }
      }).catch(err => {
        console.error("Failed to fetch source invoice:", err);
      });
    }
  }, [sourceInvoiceIdState, view, loading]);

  // Resume an in-progress challan after a round trip to /customers/add,
  // /franchise/dealers/add, or /franchise/add (see openQuickAdd below) —
  // those are real, separately-navigable pages (not inline modals), so
  // without this the in-progress draft would simply be lost on navigation.
  const restoredQuickAddRef = useRef(false);
  useEffect(() => {
    if (loading || restoredQuickAddRef.current) return;
    restoredQuickAddRef.current = true;
    try {
      const draftRaw = sessionStorage.getItem("dc_draft_before_quickadd");
      if (!draftRaw) return;

      const readFresh = (key: string) => {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Date.now() - parsed.at < 5 * 60 * 1000 ? parsed : null;
      };
      const newCustomer = readFresh("lastCreatedCustomer");
      const newDealer = readFresh("lastCreatedDealer");
      const newFranchise = readFresh("lastCreatedFranchise");
      if (!newCustomer && !newDealer && !newFranchise) return;

      const draft = JSON.parse(draftRaw);
      setDraftId(draft.draftId ?? null);
      setChallanNo(draft.challanNo ?? "1");
      setDestType(draft.destType ?? "CUSTOMER");
      setCustomerPhone(draft.customerPhone ?? "");
      setSourceFranchiseId(draft.sourceFranchiseId ?? "");
      setVehicleNo(draft.vehicleNo ?? "");
      setDriverName(draft.driverName ?? "");
      setInvoiceDate(draft.invoiceDate ?? new Date().toISOString().split("T")[0]);
      setDueDate(draft.dueDate ?? new Date().toISOString().split("T")[0]);
      setStateOfSupply(draft.stateOfSupply ?? "");
      setItems(draft.items ?? [makeItem(), makeItem()]);
      setPriceMode(draft.priceMode ?? "without_tax");
      setTermsText(draft.termsText ?? "");
      setShowTerms(draft.showTerms ?? false);
      setDescription(draft.description ?? "");
      setShowDesc(draft.showDesc ?? false);
      setRoundOffEnabled(draft.roundOffEnabled ?? true);

      if (newCustomer) {
        setSelectedCustomer({ id: newCustomer.id, name: newCustomer.name });
        setCustomerSearch(newCustomer.name);
      } else if (newDealer) {
        setSelectedDealer({ id: newDealer.id, name: newDealer.name });
        setCustomerSearch(newDealer.name);
      } else if (newFranchise) {
        setSelectedFranchise({ id: newFranchise.id, name: newFranchise.name });
        setCustomerSearch(newFranchise.name);
      } else {
        setCustomerSearch(draft.customerSearch ?? "");
      }

      setView("create");
    } catch (e) {
      console.error("Failed to restore delivery challan draft after quick-add", e);
    } finally {
      sessionStorage.removeItem("dc_draft_before_quickadd");
      sessionStorage.removeItem("lastCreatedCustomer");
      sessionStorage.removeItem("lastCreatedDealer");
      sessionStorage.removeItem("lastCreatedFranchise");
    }
  }, [loading]);

  // Stash the in-progress draft, then navigate to the relevant master's
  // quick-add page (which redirects back here via ?returnTo=).
  const openQuickAdd = (type: "CUSTOMER" | "DEALER" | "FRANCHISE") => {
    try {
      sessionStorage.setItem("dc_draft_before_quickadd", JSON.stringify({
        draftId, challanNo, destType, customerSearch, customerPhone, sourceFranchiseId,
        vehicleNo, driverName, invoiceDate, dueDate, stateOfSupply, items, priceMode,
        termsText, showTerms, description, showDesc, roundOffEnabled,
      }));
    } catch { /* ignore unavailable storage */ }
    const returnTo = encodeURIComponent("/sales/delivery-challan");
    if (type === "CUSTOMER") router.push(`/customers`);
    else if (type === "DEALER") router.push(`/franchise/dealers`);
    else router.push(`/franchise`);
  };

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node)) {
        setShowCustomerDrop(false);
      }
      if (priceDropRef.current && !priceDropRef.current.contains(e.target as Node)) {
        setShowPriceDrop(false);
      }
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node)) {
        setShowShareDrop(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch batches for the currently selected source warehouse/branch whenever it
  // changes (including on entering the create/edit form), so the Batch No dropdown
  // reflects real production/finished-goods inventory instead of staying empty.
  useEffect(() => {
    if (view !== "create" && view !== "edit") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await productBatchesApi.getAll({ franchiseId: sourceFranchiseId });
        const d = (res as any).data;
        if (!cancelled) setBatches(Array.isArray(d) ? d : d?.data || []);
      } catch (e) {
        console.error("Failed to load batches", e);
        if (!cancelled) setBatches([]);
      }
    })();
    return () => { cancelled = true; };
  }, [view, sourceFranchiseId]);

  // Keep each row's batch selection valid for the current source warehouse: drop it if
  // it's no longer usable there, and auto-pick the single valid batch when there's only one.
  useEffect(() => {
    setItems(prev => prev.map(it => {
      if (!it.productId) return it;
      const valid = batches.filter(b => b.productId === it.productId && b.franchiseId === sourceFranchiseId && batchIsUsable(b));
      const stillValid = valid.some(b => (b.batchCode || b.id) === it.batchNumber);
      if (stillValid) return it;
      return { ...it, batchNumber: valid.length === 1 ? (valid[0].batchCode || valid[0].id) : "" };
    }));
  }, [batches, sourceFranchiseId]);

  // ── Calculations ────────────────────────────────────────────────────────────

  const withTax = priceMode === "with_tax";
  const rowData = items.map(item => ({ item, ...computeRow(item, withTax) }));

  // Batches for a product at the current source warehouse that are actually dispatchable.
  const getValidBatches = (productId: string) =>
    batches.filter(b => b.productId === productId && b.franchiseId === sourceFranchiseId && batchIsUsable(b));
  // A product is "batch-controlled" if production has ever recorded a batch for it at
  // this warehouse — such items must have a batch selected before the challan can save.
  const isBatchControlled = (productId: string) =>
    batches.some(b => b.productId === productId && b.franchiseId === sourceFranchiseId);
  // A product is batch-controlled SOMEWHERE (any franchise) but not usable
  // here — that's the "not dispatchable from this location" case the item
  // search should hide. A product with no batch records anywhere is simply
  // not batch-tracked at all and stays searchable everywhere (e.g. a
  // packaging item dispatched without a production batch).
  const isDispatchableHere = (productId: string) =>
    !batches.some(b => b.productId === productId) || getValidBatches(productId).length > 0;
  
  // Rows with no item selected yet don't count toward the total — otherwise blank
  // rows (which default to qty 1) inflate Total Qty before a product is even picked.
  const totalQty = items.reduce((s, i) => s + (i.itemSearch.trim() !== "" ? (Number(i.qty) || 0) : 0), 0);
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const totalAmount = parseFloat(rowData.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(totalAmount) - totalAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((totalAmount + roundOff).toFixed(2));

  // Auto-increment Challan Number
  useEffect(() => {
    if (view === "create" && !draftId) {
      const numericNos = challans
        .map(c => parseInt(c.challanNo))
        .filter(n => !isNaN(n));
      const nextNo = numericNos.length > 0 ? Math.max(...numericNos) + 1 : 1;
      setChallanNo(String(nextNo));
    }
  }, [view, challans, draftId]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const selectCustomer = (c: any) => {
    if (destType === "CUSTOMER") {
      setSelectedCustomer(c);
    } else if (destType === "DEALER") {
      setSelectedDealer(c);
    } else {
      setSelectedFranchise(c);
    }
    setCustomerSearch(c.name);
    setCustomerPhone(c.phone || "");
    setShowCustomerDrop(false);
  };

  const selectProduct = (idx: number, p: any) => {
    const validBatches = getValidBatches(p.id);
    const autoBatch = validBatches.length === 1 ? (validBatches[0].batchCode || validBatches[0].id) : "";
    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        rate: p.basePrice || p.price || 0,
        unit: p.unit || "NONE",
        taxPct: p.taxPercent || 0,
        taxLabel: TAX_OPTIONS.find(o => o.value === (p.taxPercent || 0))?.label || "NONE",
        batchNumber: autoBatch,
      } : it
    ));
    setOpenItemDrop(null);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addRow = () => setItems(prev => [...prev, makeItem()]);

  const removeRow = (idx: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== idx));
    } else {
      setItems([makeItem()]);
    }
  };

  // Prefer the real HQ franchise (see FranchiseService.getHqFranchise) —
  // never a hardcoded literal id, which silently breaks the moment that id
  // stops being a real Franchise row. Falls back to the first franchise in
  // the list only when no franchise is flagged isHQ yet, so the field
  // still has something usable rather than staying stuck empty.
  const defaultSourceFranchiseId = () => franchises.find((f: any) => f.isHQ)?.id || franchises[0]?.id || "";

  // Same resolution, applied once the franchise list actually loads — the
  // initial useState("") and the quick-add-restore path both run before
  // `franchises` is populated, so they can't call defaultSourceFranchiseId()
  // synchronously. Never overrides a value the user (or a resumed draft)
  // already set.
  useEffect(() => {
    if (!sourceFranchiseId && franchises.length > 0) {
      setSourceFranchiseId(defaultSourceFranchiseId());
    }
  }, [franchises]);

  const resetForm = () => {
    setDraftId(null);
    setIdempotencyKey(crypto.randomUUID());
    setSourceInvoiceIdState(null);
    setSelectedCustomer(null);
    setSelectedDealer(null);
    setSelectedFranchise(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setSourceFranchiseId(defaultSourceFranchiseId());
    setVehicleNo("");
    setDriverName("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date().toISOString().split("T")[0]);
    setStateOfSupply("");
    setItems([makeItem(), makeItem()]);
    setPriceMode("without_tax");
    setTermsText("");
    setShowTerms(false);
    setDescription("");
    setShowDesc(false);
    setRoundOffEnabled(true);
  };

  const handleSave = async (status: "DRAFT" | "IN_TRANSIT") => {
    // Applies to both Save Draft and Save Challan, and whether the number was typed
    // or auto-filled from the selected customer/franchise record.
    if (!isValidPhone(customerPhone)) {
      showToast("Enter a valid 10-digit mobile number.", "error");
      return;
    }
    if (destType === "CUSTOMER" && !selectedCustomer && status === "IN_TRANSIT") {
      showToast("Please select a customer", "error");
      return;
    }
    if (destType === "DEALER" && !selectedDealer && status === "IN_TRANSIT") {
      showToast("Please select a dealer", "error");
      return;
    }
    if (destType === "FRANCHISE" && !selectedFranchise && status === "IN_TRANSIT") {
      showToast("Please select a franchise destination", "error");
      return;
    }
    const validItems = items.filter(it => it.itemSearch.trim() !== "" && it.qty > 0);
    if (validItems.length === 0 && status === "IN_TRANSIT") {
      showToast("Add at least one item with valid quantity", "error");
      return;
    }

    if (status === "IN_TRANSIT") {
      for (const it of validItems) {
        if (!isBatchControlled(it.productId)) continue;
        const valid = getValidBatches(it.productId);
        if (valid.length === 0) {
          showToast("No available batch found for this product in the selected warehouse.", "error");
          return;
        }
        if (!it.batchNumber) {
          showToast(`Select a batch for ${it.itemSearch}`, "error");
          return;
        }
        const chosen = valid.find(b => (b.batchCode || b.id) === it.batchNumber);
        if (!chosen) {
          showToast(`Selected batch for ${it.itemSearch} is no longer available. Please reselect.`, "error");
          return;
        }
        if (it.qty > (chosen.availableQuantity || 0)) {
          showToast(`Quantity for ${it.itemSearch} exceeds available batch stock (${chosen.availableQuantity}).`, "error");
          return;
        }
      }
    }

    setSaving(true);
    const apiPayload = {
      // Explicit null (not undefined) for the two inactive destination
      // fields — undefined gets dropped by JSON serialization entirely,
      // which on an update would leave a stale customerId/dealerId/
      // franchiseId in place from before a destination-type switch instead
      // of actually clearing it.
      customerId: destType === "CUSTOMER" ? (selectedCustomer?.id || null) : null,
      dealerId: destType === "DEALER" ? (selectedDealer?.id || null) : null,
      franchiseId: destType === "FRANCHISE" ? (selectedFranchise?.id || null) : null,
      sourceFranchiseId,
      sourceInvoiceId: sourceInvoiceIdState || undefined,
      vehicleNo: vehicleNo || undefined,
      driverName: driverName || undefined,
      status,
      challanDate: invoiceDate,
      dueDate,
      stateOfSupply: stateOfSupply || undefined,
      termsConditions: termsText || undefined,
      notes: description || undefined,
      items: validItems.map(it => ({
        productId: it.productId || undefined,
        productName: it.itemSearch,
        batchNumber: it.batchNumber || undefined,
        quantity: it.qty,
        unit: it.unit,
        rate: it.rate,
        taxPercent: it.taxPct,
      })),
    };

    try {
      if (draftId) {
        await salesApi.updateDeliveryChallan(draftId, apiPayload);
        showToast("Delivery Challan updated successfully", "success");
      } else {
        await salesApi.createDeliveryChallan({ ...apiPayload, idempotencyKey });
        showToast("Delivery Challan saved successfully", "success");
      }
      fetchData();
      setView("list");
      resetForm();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Error saving Delivery Challan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dc: any) => {
    setDraftId(dc.id);
    setChallanNo(dc.challanNo);
    const raw = dc._rawState || {};
    
    // Resolve destination type
    if (dc.franchiseId) {
      setDestType("FRANCHISE");
      const f = franchises.find(x => x.id === dc.franchiseId);
      setSelectedFranchise(f || null);
      setSelectedCustomer(null);
      setSelectedDealer(null);
    } else if (dc.dealerId) {
      setDestType("DEALER");
      const dl = dealers.find(x => x.id === dc.dealerId);
      setSelectedDealer(dl || null);
      setSelectedCustomer(null);
      setSelectedFranchise(null);
    } else {
      setDestType("CUSTOMER");
      const c = customers.find(x => x.id === dc.customerId);
      setSelectedCustomer(c || null);
      setSelectedDealer(null);
      setSelectedFranchise(null);
    }

    setCustomerSearch(raw.customerSearch || dc.customerName);
    setCustomerPhone(raw.customerPhone || dc.customerPhone || "");
    setVehicleNo(raw.vehicleNo || dc.vehicleNo || "");
    setDriverName(raw.driverName || dc.driverName || "");
    setSourceFranchiseId(raw.sourceFranchiseId || dc.sourceFranchiseId || defaultSourceFranchiseId());
    setInvoiceDate(raw.invoiceDate || dc.invoiceDate);
    setDueDate(raw.dueDate || dc.dueDate);
    setStateOfSupply(raw.stateOfSupply || dc.stateOfSupply || "");
    setPriceMode(raw.priceMode || "without_tax");
    setTermsText(raw.termsText || "");
    setShowTerms(raw.showTerms || !!raw.termsText);
    setDescription(raw.description || dc.remarks || "");
    setShowDesc(raw.showDesc || !!raw.description || !!dc.remarks);
    setRoundOffEnabled(raw.roundOffEnabled ?? true);
    
    if (raw.items && raw.items.length > 0) {
      setItems(raw.items);
    } else if (dc.items && dc.items.length > 0) {
      setItems(dc.items.map((it: any) => {
        const taxPct = Number(it.taxPercent ?? it.taxPct ?? 0);
        return {
          id: it.id || Math.random().toString(36).slice(2),
          productId: it.productId || "",
          itemSearch: it.productName || it.description || "",
          qty: Number(it.quantity ?? it.qty ?? 1),
          unit: it.unit || "NONE",
          rate: Number(it.rate ?? it.unitPrice ?? 0),
          taxPct,
          taxLabel: TAX_OPTIONS.find(o => o.value === taxPct)?.label || "NONE",
          batchNumber: it.batchNumber || "",
          remarks: it.remarks || "",
        };
      }));
    } else {
      setItems([makeItem()]);
    }
    
    setView("edit");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Delivery Challan?")) return;
    try {
      const localData = localStorage.getItem("sale_delivery_challans");
      if (localData) {
        let locals = JSON.parse(localData);
        locals = locals.filter((x: any) => x.id !== id);
        localStorage.setItem("sale_delivery_challans", JSON.stringify(locals));
      }
      showToast("Challan deleted successfully", "success");
      fetchData();
    } catch (e) {
      showToast("Failed to delete challan", "error");
    }
  };

  const convertToSale = async (dc: any) => {
    try {
      // Simulate conversion
      const localData = localStorage.getItem("sale_delivery_challans");
      if (localData) {
        const locals = JSON.parse(localData);
        const updated = locals.map((x: any) => x.id === dc.id ? { ...x, status: "CLOSED" } : x);
        localStorage.setItem("sale_delivery_challans", JSON.stringify(updated));
      }
      showToast(`Challan #${dc.challanNo} successfully converted to Sale!`, "success");
      fetchData();
    } catch (e) {
      showToast("Conversion failed", "error");
    }
  };

  // ── Filters & Formatting ─────────────────────────────────────────────────────

  const getFilteredChallans = () => {
    return challans.filter(dc => {
      const matchSearch = !search ||
        dc.challanNo.toLowerCase().includes(search.toLowerCase()) ||
        dc.customerName.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "ALL" || dc.status === statusFilter;
      
      // Date filter
      let matchDate = true;
      if (dateFilter === "THIS_MONTH") {
        const d = new Date(dc.invoiceDate);
        const now = new Date();
        matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (dateFilter === "TODAY") {
        matchDate = dc.invoiceDate === new Date().toISOString().split("T")[0];
      } else if (dateFilter === "CUSTOM") {
        matchDate = dc.invoiceDate >= dateFrom && dc.invoiceDate <= dateTo;
      }
      
      return matchSearch && matchStatus && matchDate;
    });
  };

  const filteredChallans = getFilteredChallans();

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const filteredDealers = dealers.filter(d =>
    !customerSearch ||
    d.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    d.phone?.includes(customerSearch)
  );

  const filteredFranchisesForDest = franchises.filter(f =>
    !customerSearch || f.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Which destination-master list backs the picker dropdown for the
  // currently selected destination type.
  const destinationOptions = destType === "CUSTOMER" ? filteredCustomers
    : destType === "DEALER" ? filteredDealers
    : filteredFranchisesForDest;

  const stats = {
    total: challans.length,
    inTransit: challans.filter(d => d.status === "IN_TRANSIT").length,
    closed: challans.filter(d => d.status === "CLOSED").length,
    draft: challans.filter(d => d.status === "DRAFT").length,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. FORM VIEW (Screen 2 Layout - Full Page Creation View)
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create" || view === "edit") {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 104px)" }}>
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView("list");
                resetForm();
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold text-gray-800">
              {view === "create" ? "Add Delivery Challan" : `Edit Challan #${challanNo}`}
            </h2>
          </div>
          <span className="text-xs text-gray-400">Challan No: <span className="text-orange-500 font-semibold">{challanNo}</span></span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Customer + Details card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-4 mb-1.5">
                    <label className="text-xs font-medium text-gray-500">Destination *</label>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={destType === "CUSTOMER"} onChange={() => { setDestType("CUSTOMER"); setCustomerSearch(""); setSelectedCustomer(null); setSelectedDealer(null); setSelectedFranchise(null); }} className="accent-orange-500" /> Customer
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={destType === "DEALER"} onChange={() => { setDestType("DEALER"); setCustomerSearch(""); setSelectedCustomer(null); setSelectedDealer(null); setSelectedFranchise(null); }} className="accent-orange-500" /> Dealer
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={destType === "FRANCHISE"} onChange={() => { setDestType("FRANCHISE"); setCustomerSearch(""); setSelectedCustomer(null); setSelectedDealer(null); setSelectedFranchise(null); }} className="accent-orange-500" /> Franchise
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1" ref={customerDropRef}>
                      <div
                        className={clsx(
                          "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white transition-colors",
                          showCustomerDrop ? "border-orange-400 ring-1 ring-orange-100" : "border-gray-300 hover:border-gray-400"
                        )}
                        onClick={() => setShowCustomerDrop(v => !v)}
                      >
                        <input
                          className="flex-1 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                          placeholder={`Select / Search ${destType === "CUSTOMER" ? "Customer" : destType === "DEALER" ? "Dealer" : "Franchise"}`}
                          value={customerSearch}
                          onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                          onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                        />
            {customerSearch && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                onClick={() => setCustomerSearch("")}
              />
            )}
                        <ChevronDown size={13} className="text-gray-400 shrink-0" />
                      </div>
                      {showCustomerDrop && (
                        <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                          <div className="max-h-56 overflow-y-auto">
                            {destinationOptions.length === 0 ? (
                              <div className="px-4 py-4 text-xs text-gray-400 text-center">No results found</div>
                            ) : destinationOptions.map(c => (
                              <button key={c.id} type="button" className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-orange-50 border-b border-gray-50 last:border-0 transition-colors" onClick={() => selectCustomer(c)}>
                                <div className="text-left">
                                  <div className="text-sm font-medium text-gray-800">{c.name}</div>
                                  <div className="text-xs text-gray-400">{c.phone || c.email || "—"}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openQuickAdd(destType)}
                      title={`Create new ${destType === "CUSTOMER" ? "Customer" : destType === "DEALER" ? "Dealer" : "Franchise"}`}
                      className="shrink-0 p-2 border border-gray-300 hover:border-orange-400 rounded-lg text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400"
                      placeholder="10-digit phone number"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                    {customerPhone && !isValidPhone(customerPhone) && (
                      <p className="text-[11px] text-red-500 mt-1">Enter a valid 10-digit mobile number.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Source Warehouse</label>
                    {/* The value submitted is a franchiseId — dispatch/receive
                        stock accounting keys off sourceFranchiseId, one stock
                        pool per franchise/branch (see SalesService.dispatch
                        ChallanStock). `Warehouse` has no franchiseId column
                        (it's the reverse: Franchise.primaryWarehouseId points
                        INTO Warehouse), so options are built by joining the
                        already-fetched franchise list to each one's primary
                        warehouse — showing a real warehouse name where one
                        exists, the branch name otherwise. Previously this
                        filtered the raw Warehouse list on a field
                        (`w.franchiseId`) that never existed, so it was always
                        empty. */}
                    <select value={sourceFranchiseId} onChange={e => setSourceFranchiseId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white">
                      {franchises.length === 0 && <option value="" disabled>Loading warehouses…</option>}
                      {franchises.map((f: any) => {
                        const primaryWarehouse = warehouses.find((w: any) => w.id === f.primaryWarehouseId);
                        return (
                          <option key={f.id} value={f.id}>
                            {primaryWarehouse ? `${primaryWarehouse.name} — ${f.name}` : f.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Vehicle Number</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400" placeholder="e.g. MH 12 AB 1234" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Driver Name</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400" placeholder="Driver Name" value={driverName} onChange={e => setDriverName(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-medium text-gray-500">Challan Date</span>
                  <input type="date" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Due Date</span>
                  <input type="date" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">State of Supply</span>
                  <select value={stateOfSupply} onChange={e => setStateOfSupply(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-700 outline-none focus:border-orange-400 w-44">
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</span>
              <button type="button" onClick={() => setPriceMode(priceMode === "without_tax" ? "with_tax" : "without_tax")} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1 bg-white hover:border-gray-400 transition-colors">
                Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold text-xs border-b border-gray-200 uppercase">
                    <th className="text-left px-4 py-2.5 w-10">#</th>
                    <th className="text-left px-4 py-2.5">Item</th>
                    <th className="text-left px-3 py-2.5 w-32">Batch No</th>
                    <th className="text-center px-3 py-2.5 w-20">Qty</th>
                    <th className="text-center px-3 py-2.5 w-24">Unit</th>
                    <th className="text-right px-3 py-2.5 w-28">Price/Unit</th>
                    <th className="text-center px-3 py-2.5 w-28">Tax</th>
                    <th className="text-right px-3 py-2.5 w-28">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it, idx) => {
                    const comp = computeRow(it, withTax);
                    const isItemDropOpen = openItemDrop === it.id;
                    return (
                      <tr key={it.id} className="hover:bg-orange-50/20 group">
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-2 relative">
                          <input value={it.itemSearch} onChange={e => { updateItem(idx, "itemSearch", e.target.value); setOpenItemDrop(it.id); }} onFocus={() => setOpenItemDrop(it.id)} placeholder="Search product..." className="w-full text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400" />
            {it.itemSearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setOpenItemDrop("")} 
              />
            )}
                          {isItemDropOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                              {products.filter(p => p.name.toLowerCase().includes(it.itemSearch.toLowerCase()) && isDispatchableHere(p.id)).length === 0 ? (
                                <div className="px-4 py-3 text-xs text-gray-400">
                                  {products.some(p => p.name.toLowerCase().includes(it.itemSearch.toLowerCase()))
                                    ? "No dispatchable stock for this item at the selected warehouse"
                                    : "No items matched"}
                                </div>
                              ) : products.filter(p => p.name.toLowerCase().includes(it.itemSearch.toLowerCase()) && isDispatchableHere(p.id)).map(p => (
                                <button key={p.id} type="button" className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-orange-50 text-left border-b border-gray-50 last:border-0 text-xs" onClick={() => selectProduct(idx, p)}>
                                  <div><strong className="text-gray-800 font-medium">{p.name}</strong><div className="text-[10px] text-gray-400">SKU: {p.sku || "—"}</div></div>
                                  <div className="text-orange-500 font-semibold">₹{p.basePrice || p.price || 0}</div>
                                </button>
                              ))}
                            </div>
                          )}
                          <input value={it.remarks} onChange={e => updateItem(idx, "remarks", e.target.value)} placeholder="Add brief details..." className="w-full text-xs text-gray-400 outline-none bg-transparent mt-1 focus:text-gray-600" />
                        </td>
                        <td className="px-3 py-2.5">
{(() => {
  const validBatches = getValidBatches(it.productId);
  return (
    <>
      <select value={it.batchNumber} onChange={e => updateItem(idx, "batchNumber", e.target.value)} className="w-full text-sm outline-none bg-transparent text-gray-700 cursor-pointer">
        <option value="">Select...</option>
        {validBatches.map(b => (
          <option key={b.id} value={b.batchCode || b.id}>{b.batchCode || 'No Code'} (Qty: {b.availableQuantity})</option>
        ))}
      </select>
      {it.productId && isBatchControlled(it.productId) && validBatches.length === 0 && (
        <div className="text-[10px] text-red-500 mt-1 leading-tight">No available batch found for this product in the selected warehouse.</div>
      )}
    </>
  );
})()}
</td>
                        <td className="px-3 py-2.5">
<input type="number" min={0} value={it.qty} onChange={e => {
  const val = Number(e.target.value) || 0;
  const batch = getValidBatches(it.productId).find(b => (b.batchCode || b.id) === it.batchNumber);
  if (batch && val > (batch.availableQuantity || 0)) {
    updateItem(idx, "qty", batch.availableQuantity || 0);
  } else {
    updateItem(idx, "qty", val);
  }
}} className="w-full text-sm text-center outline-none bg-transparent text-gray-700" />
</td>
                        <td className="px-3 py-2.5"><select value={it.unit} onChange={e => updateItem(idx, "unit", e.target.value)} className="w-full text-xs text-gray-700 outline-none bg-transparent cursor-pointer">{UNITS.map(u => <option key={u.code} value={u.code}>{u.short}</option>)}</select></td>
                        <td className="px-3 py-2.5"><input type="number" min={0} value={it.rate || ""} onChange={e => updateItem(idx, "rate", Number(e.target.value) || 0)} className="w-full text-sm text-right outline-none bg-transparent text-gray-700" placeholder="0.00" /></td>
                        <td className="px-3 py-2.5">
                          <select value={it.taxPct} onChange={e => { const val = Number(e.target.value); const opt = TAX_OPTIONS.find(x => x.value === val); updateItem(idx, "taxPct", val); updateItem(idx, "taxLabel", opt?.label || "NONE"); }} className="w-full text-xs text-gray-700 outline-none bg-transparent cursor-pointer">
                            {TAX_OPTIONS.map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">₹{comp.amount.toFixed(2)}</td>
                        <td className="pr-2"><button type="button" onClick={() => removeRow(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
              <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors"><Plus className="h-4 w-4" /> Add Row</button>
              <span className="text-xs text-gray-500">Total Qty: <span className="font-semibold text-gray-700">{totalQty}</span></span>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex gap-4 items-start pb-2">
            <div className="flex-1 space-y-2">
              <button type="button" onClick={() => setShowTerms(v => !v)} className={clsx("flex items-center gap-2 text-xs font-medium border rounded-lg px-3 py-2 transition-colors", showTerms ? "border-orange-300 bg-orange-50 text-orange-600" : "border-gray-200 bg-white text-gray-500 hover:text-gray-700")}><FileText className="h-3.5 w-3.5" /> Terms &amp; Conditions</button>
              <button type="button" onClick={() => setShowDesc(v => !v)} className={clsx("flex items-center gap-2 text-xs font-medium border rounded-lg px-3 py-2 transition-colors", showDesc ? "border-orange-300 bg-orange-50 text-orange-600" : "border-gray-200 bg-white text-gray-500 hover:text-gray-700")}><FileText className="h-3.5 w-3.5" /> Add Description</button>
              {showTerms && <textarea rows={3} value={termsText} onChange={e => setTermsText(e.target.value)} placeholder="Enter terms..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none" />}
              {showDesc && <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Enter description..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none" />}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 w-64 shrink-0 space-y-2">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>₹ {totalAmount.toFixed(2)}</span></div>
              {totalTax > 0 && <div className="flex justify-between text-sm text-gray-500"><span>Tax</span><span>+ ₹ {totalTax.toFixed(2)}</span></div>}
              <div className="flex justify-between items-center text-sm text-gray-500 border-t border-gray-100 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" id="roundoff" checked={roundOffEnabled} onChange={e => setRoundOffEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" /><span className="text-xs">Round Off</span></label>
                <span className="text-xs">{roundOff >= 0 ? "+" : ""}{roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                <span className="text-sm font-semibold text-gray-800">Total</span>
                <span className="text-lg font-bold text-orange-500">₹ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <button type="button" onClick={() => { setView("list"); resetForm(); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => handleSave("DRAFT")} disabled={saving} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60">Save Draft</button>
            <button type="button" onClick={() => handleSave("IN_TRANSIT")} disabled={saving} className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors">
              <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save Challan"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2a. TRANSIT STOCK VIEW — read-only, derived from IN_TRANSIT challans
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "transit") {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-800">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setView("list")} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">Challans</button>
            <button className="px-3 py-1.5 text-sm font-semibold text-white bg-orange-500 rounded-lg">Transit Stock</button>
          </div>
          <button onClick={() => salesApi.getTransitStock().then((res: any) => setTransitStock(res.data || []))} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", transitLoading && "animate-spin")} />
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-5">
          {transitLoading ? (
            <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
          ) : transitStock.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-16 text-center text-gray-400 text-sm">Nothing currently in transit.</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                    <th className="text-left px-4 py-3">Challan No</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3">Party</th>
                    <th className="text-left px-4 py-3">From</th>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Batch</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-left px-4 py-3">Dispatched</th>
                    <th className="text-left px-4 py-3">Vehicle / Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transitStock.map((r: any, i: number) => (
                    <tr key={`${r.challanId}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{r.challanNumber}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold border", r.sourceDocument === "SALES_INVOICE" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200")}>
                          {r.sourceDocument === "SALES_INVOICE" ? "Sales Invoice" : "Direct"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{r.partyName || "—"} <span className="text-gray-400">({r.partyType})</span></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.sourceWarehouseName || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{r.productName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.batchNumber || "—"}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{r.quantity} {r.unit}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.dispatchDate)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.vehicleNo || "—"} {r.driverName ? `/ ${r.driverName}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => setView("transit")}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
        >
          Transit Stock
        </button>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Challan
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total",      value: stats.total,     color: "text-gray-700",    dot: "bg-gray-400" },
            { label: "In Transit", value: stats.inTransit, color: "text-blue-600",    dot: "bg-blue-500" },
            { label: "Delivered",  value: stats.closed,    color: "text-emerald-600", dot: "bg-emerald-500" },
            { label: "Drafts",     value: stats.draft,     color: "text-amber-600",   dot: "bg-amber-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search challan or party..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 outline-none"
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="TODAY">Today</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
          {dateFilter === "CUSTOM" && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm outline-none" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm outline-none" />
            </>
          )}
          <div className="flex-1" />
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Empty State ── */}
        {filteredChallans.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Truck className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Delivery Challans</p>
              <p className="text-gray-500 text-sm mt-1">Create your first delivery challan to get started.</p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Create Challan
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Party</th>
                  <th className="text-left px-4 py-3">Challan No.</th>
                  <th className="text-left px-4 py-3">Due Date</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredChallans.map(dc => {
                  const style = STATUS_STYLES[dc.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={dc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {formatDate(dc.invoiceDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-sm">{dc.customerName}</div>
                        {dc.customerPhone && <div className="text-xs text-gray-400">{dc.customerPhone}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#f58220] text-xs">
                        #{dc.challanNo}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {formatDate(dc.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">
                        ₹{Number(dc.finalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {dc.status === "DRAFT" && (
                            <button
                              onClick={() => handleEdit(dc)}
                              className="px-2.5 py-1 text-xs font-medium text-[#f58220] hover:bg-orange-50 rounded transition-colors"
                            >
                              Resume
                            </button>
                          )}
                          {dc.status === "IN_TRANSIT" && (
                            <button
                              onClick={() => setDeliveringChallan(dc)}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {dc.status === "CLOSED" && (
                            <button
                              onClick={() => setReturningChallan(dc)}
                              className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              Return Goods
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setShowRowMenu(showRowMenu === dc.id ? null : dc.id)}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {showRowMenu === dc.id && (
                              <div className="absolute right-0 top-8 z-50 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-left">
                                <button
                                  onClick={() => { handleEdit(dc); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 text-left"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setPreviewingChallan(dc); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 text-left"
                                >
                                  Print
                                </button>
                                <button
                                  onClick={() => { handleDelete(dc.id); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-red-50 text-xs text-red-600 text-left border-t border-gray-100"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewingChallan && (
        <GSTInvoice
          order={{
            poNumber: previewingChallan.challanNo,
            createdAt: previewingChallan.invoiceDate,
            items: (previewingChallan.items || []).map((it: any) => ({
              itemName: it.description || it.productName || "Item",
              quantity: it.qty ?? it.quantity ?? 0,
              price: it.rate ?? it.unitPrice ?? 0,
              gstRate: it.taxPct ?? it.taxPercent ?? 0,
            })),
          }}
          vendor={{
            name: previewingChallan.customerName,
            address: previewingChallan.stateOfSupply,
            state: previewingChallan.stateOfSupply,
            phone: previewingChallan.customerPhone,
          }}
          companyDetails={currentCompany}
          documentType="DELIVERY_CHALLAN"
          onClose={() => setPreviewingChallan(null)}
        />
      )}

      {deliveringChallan && (
        <MarkDeliveredModal
          challan={deliveringChallan}
          onClose={() => setDeliveringChallan(null)}
          onDelivered={() => { setDeliveringChallan(null); fetchData(); }}
          showToast={showToast}
        />
      )}

      {returningChallan && (
        <ReturnGoodsModal
          challan={returningChallan}
          onClose={() => setReturningChallan(null)}
          onReturned={() => { setReturningChallan(null); fetchData(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Mark Delivered modal ─────────────────────────────────────────────────────
// Captures the delivery confirmation fields (Received By / delivered date /
// POD reference) that a bare status PATCH used to silently drop — see
// SalesService.markChallanDelivered.
function MarkDeliveredModal({ challan, onClose, onDelivered, showToast }: { challan: any; onClose: () => void; onDelivered: () => void; showToast: (msg: string, type?: any) => void }) {
  const [receivedBy, setReceivedBy] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(new Date().toISOString().slice(0, 16));
  const [podReference, setPodReference] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await salesApi.markDeliveryChallanDelivered(challan.id, {
        receivedBy: receivedBy || undefined,
        deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : undefined,
        podReference: podReference || undefined,
      });
      showToast("Delivery confirmed", "success");
      onDelivered();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to confirm delivery", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-gray-800">Mark Delivered</h3>
          <p className="text-xs text-gray-400 mt-0.5">{challan.challanNo || challan.challanNumber}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Received By</label>
          <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Name of person who received goods" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Delivered At</label>
          <input type="datetime-local" value={deliveredAt} onChange={e => setDeliveredAt(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">POD / Note Reference (optional)</label>
          <input value={podReference} onChange={e => setPodReference(e.target.value)} placeholder="Proof-of-delivery reference" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
            {saving ? "Confirming..." : "Confirm Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return Goods modal ───────────────────────────────────────────────────────
// Two backend calls in one flow: createDeliveryChallanReturn (returnable-qty
// validated per line) then receiveDeliveryChallanReturn (condition-based
// stock disposition) — see sections 22-28. Quantity + reason + condition are
// all captured in one screen since in practice the person logging a return
// already knows the condition.
const RETURN_REASONS = ["Unused Goods", "Demo Completed", "Sample Returned", "Excess Quantity", "Customer Rejected", "Damaged", "Wrong Product", "Replacement Return", "Job Work Returned", "Other"];
const RETURN_CONDITIONS = ["GOOD", "DAMAGED", "EXPIRED", "REJECTED", "QUARANTINE"];

function ReturnGoodsModal({ challan, onClose, onReturned, showToast }: { challan: any; onClose: () => void; onReturned: () => void; showToast: (msg: string, type?: any) => void }) {
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const items = (challan.items || []) as any[];

  const submit = async () => {
    const lines = items
      .map(it => ({ challanItemId: it.id, quantity: Number(qtyByItem[it.id] || 0) }))
      .filter(l => l.quantity > 0);
    if (lines.length === 0) {
      showToast("Enter a return quantity for at least one item", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await salesApi.createDeliveryChallanReturn({
        challanId: challan.id,
        reason,
        otherReason: reason === "Other" ? (otherReason || undefined) : undefined,
        items: lines,
        idempotencyKey,
      });
      const ret = (res as any).data;
      const itemConditions = (ret.items || []).map((ri: any) => ({ returnItemId: ri.id, condition }));
      await salesApi.receiveDeliveryChallanReturn(ret.id, itemConditions);
      showToast(`Return ${ret.returnNumber} recorded`, "success");
      onReturned();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to record return", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-gray-800">Return Goods</h3>
          <p className="text-xs text-gray-400 mt-0.5">{challan.challanNo || challan.challanNumber}</p>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Dispatched</th>
                <th className="text-right px-3 py-2 w-28">Return Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(it => (
                <tr key={it.id}>
                  <td className="px-3 py-2 text-gray-700">{it.productName}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{it.quantity} {it.unit}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0} max={it.quantity}
                      value={qtyByItem[it.id] || ""}
                      onChange={e => setQtyByItem(prev => ({ ...prev, [it.id]: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-right outline-none focus:border-orange-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Condition on Receipt</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
              {RETURN_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {reason === "Other" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
            <input value={otherReason} onChange={e => setOtherReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
          </div>
        )}
        {condition !== "GOOD" && (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {condition} condition returns are logged for traceability but are NOT added to available warehouse stock.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50">
            {saving ? "Saving..." : "Record Return"}
          </button>
        </div>
      </div>
    </div>
  );
}
