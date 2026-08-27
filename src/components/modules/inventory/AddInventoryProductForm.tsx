"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, Save, X,
  ChevronDown,
  AlertCircle, CheckCircle2,
  Scale, Tag, LayoutGrid,
  RefreshCw, Plus, Percent,
  Coins, Calendar, Search, Barcode, Globe
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { rawMaterialsApi, franchiseApi, vendorsApi, inventoryApi } from "@/lib/api";
import { ITEM_CATEGORIES, UNITS } from "@/lib/constants";
import { clsx } from "clsx";
import { useAuth } from "@/context/AuthContext";
import Fuse from "fuse.js";
import { toast } from "react-hot-toast";
import WarehouseFormModal from "@/components/modals/WarehouseFormModal";

interface AddInventoryProductFormProps {
  onSuccess?: (product: any) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function AddInventoryProductForm({ onSuccess, onCancel, isModal }: AddInventoryProductFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { user } = useAuth();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"specs" | "opening">("specs");

  // Core product details
  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [category, setCategory] = useState("RAW_MATERIAL");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showHsnSearch, setShowHsnSearch] = useState(false);
  const [hsnSearchQuery, setHsnSearchQuery] = useState("");
  const [hsnList, setHsnList] = useState<Array<{ hsn: string; description: string }>>([]);
  const [loadingHsn, setLoadingHsn] = useState(false);

  // Dynamic loading of the comprehensive HSN database on modal open
  useEffect(() => {
    if (showHsnSearch && hsnList.length === 0) {
      setLoadingHsn(true);
      import("@/lib/data/hsn_all.json")
        .then((module) => {
          setHsnList(module.default);
          setLoadingHsn(false);
        })
        .catch((err) => {
          console.error("Failed to load HSN master database", err);
          setLoadingHsn(false);
        });
    }
  }, [showHsnSearch, hsnList.length]);

  // Initialize Fuse.js for high-fidelity fuzzy searches
  const fuse = useMemo(() => {
    if (hsnList.length === 0) return null;
    return new Fuse(hsnList, {
      keys: ["hsn", "description"],
      threshold: 0.3,
      minMatchCharLength: 2,
    });
  }, [hsnList]);

  // Compute fuzzy search and code-prefix matches combined
  const filteredHsnResults = useMemo(() => {
    if (!hsnSearchQuery.trim()) {
      // Popular standard HSN codes to display initially
      const popularCodes = ["190190", "210690", "110100", "110290", "150910", "200190", "090411", "090420", "090910", "230990", "481190", "392329", "999999"];
      return hsnList.filter(item => popularCodes.includes(item.hsn));
    }

    const query = hsnSearchQuery.trim().toLowerCase();

    // 1. Chapter/prefix direct matching (starts-with)
    const prefixMatches = hsnList.filter(item => item.hsn.startsWith(query));

    // 2. Fuzzy match using Fuse.js
    if (!fuse) return prefixMatches.slice(0, 100);
    const fuzzyResults = fuse.search(query).map(r => r.item);

    // Merge and deduplicate
    const merged = [...prefixMatches];
    const seen = new Set(merged.map(item => item.hsn));
    for (const item of fuzzyResults) {
      if (!seen.has(item.hsn)) {
        merged.push(item);
        seen.add(item.hsn);
      }
    }

    return merged.slice(0, 100);
  }, [hsnSearchQuery, hsnList, fuse]);

  // UOM Quantity settings
  const [primaryUnit, setPrimaryUnit] = useState("kg");
  const [secondaryUnit, setSecondaryUnit] = useState("box");
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [showAddPrimaryUnit, setShowAddPrimaryUnit] = useState(false);
  const [newPrimaryUnitInput, setNewPrimaryUnitInput] = useState("");
  const [showAddSecondaryUnit, setShowAddSecondaryUnit] = useState(false);
  const [newSecondaryUnitInput, setNewSecondaryUnitInput] = useState("");
  const [conversionRatio, setConversionRatio] = useState(10); // e.g. 1 Box = 10 KG

  // Tax brackets
  const [gstRate, setGstRate] = useState(18); // Default 18%
  const [customGstInput, setCustomGstInput] = useState(""); // custom GST text input value

  // Discount options
  const [discountType, setDiscountType] = useState<"PERCENT" | "VALUE">("PERCENT");
  const [discountValue, setDiscountValue] = useState(0);

  // Pricing models - Track both "Without Tax" and "With Tax" versions!
  const [prices, setPrices] = useState({
    purchasePrice: 0,
    purchasePriceWithTax: 0,
    franchisePrice: 0,
    franchisePriceWithTax: 0,
    dealerPrice: 0,
    dealerPriceWithTax: 0,
    customerPrice: 0,
    customerPriceWithTax: 0,
    customModeName: "Amazon",
    customModePrice: 0,
    customModePriceWithTax: 0,
  });

  // Dynamic Custom Channels State for multi-card option
  const [customChannels, setCustomChannels] = useState<Array<{
    id: string;
    name: string;
    price: number;
    priceWithTax: number;
  }>>([
    { id: "1", name: "Amazon", price: 0, priceWithTax: 0 }
  ]);

  // Dynamic double-way calculator for custom channels
  const handleCustomChannelChange = (index: number, field: "name" | "price" | "priceWithTax", value: any) => {
    setCustomChannels(prev => {
      const updated = [...prev];
      const channel = { ...updated[index] };
      const factor = 1 + gstRate / 100;
      
      if (field === "name") {
        channel.name = value;
      } else if (field === "price") {
        channel.price = value;
        channel.priceWithTax = Math.round(value * factor * 100) / 100;
      } else if (field === "priceWithTax") {
        channel.priceWithTax = value;
        channel.price = Math.round((value / factor) * 100) / 100;
      }
      
      updated[index] = channel;
      return updated;
    });
  };

  // Parallel Tab: Opening stock setup
  const [openingStock, setOpeningStock] = useState(0);
  const [openingDate, setOpeningDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [openingPurchasePrice, setOpeningPurchasePrice] = useState(0);
  const [openingPurchasePriceWithTax, setOpeningPurchasePriceWithTax] = useState(0);
  const [minimumStock, setMinimumStock] = useState<string | number>("5");
  const [itemLocation, setItemLocation] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);

  const [size, setSize] = useState("1KG");
  const [customNumber, setCustomNumber] = useState("1");
  const [customUnit, setCustomUnit] = useState("KG");

  const getSizeUnit = () => {
    if (!size) return primaryUnit.toUpperCase();
    const match = size.match(/[A-Z]+$/i);
    return match ? match[0].toUpperCase() : primaryUnit.toUpperCase();
  };

  // Fetch initial dependencies
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fRes, vRes, wRes] = await Promise.all([
          franchiseApi.getAll().catch(() => ({ data: [] })),
          vendorsApi.getAll().catch(() => ({ data: [] })),
          inventoryApi.getWarehouses().catch(() => ({ data: [] }))
        ]);
        // Franchise.isHQ is the one real definition of HQ (see
        // FranchiseService.getHqFranchise) — not a name/id guess.
        setFranchises((fRes.data || []).filter((f: any) => !f.isHQ));
        setVendors(vRes.data || []);
        setWarehouses(wRes.data || []);
      } catch (e) {
        console.error("Failed to fetch dependencies", e);
      }
    };
    fetchData();
  }, []);

  // Sync primary unit from weight variant unit for raw materials
  useEffect(() => {
    if (category !== "FINISHED_GOOD") {
      setPrimaryUnit(customUnit.toLowerCase());
    }
  }, [customUnit, category]);

  // Prevent scroll change on number inputs
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement && document.activeElement.getAttribute("type") === "number") {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    document.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Handle Dynamic Double-Way Tax Calculations when GST Rate changes
  useEffect(() => {
    setPrices(prev => {
      const factor = 1 + gstRate / 100;
      return {
        ...prev,
        purchasePriceWithTax: Math.round(prev.purchasePrice * factor * 100) / 100,
        franchisePriceWithTax: Math.round(prev.franchisePrice * factor * 100) / 100,
        dealerPriceWithTax: Math.round(prev.dealerPrice * factor * 100) / 100,
        customerPriceWithTax: Math.round(prev.customerPrice * factor * 100) / 100,
        customModePriceWithTax: Math.round(prev.customModePrice * factor * 100) / 100,
      };
    });
    setCustomChannels(prev => {
      const factor = 1 + gstRate / 100;
      return prev.map(ch => ({
        ...ch,
        priceWithTax: Math.round(ch.price * factor * 100) / 100
      }));
    });
    setOpeningPurchasePriceWithTax(() => {
      const factor = 1 + gstRate / 100;
      return Math.round(openingPurchasePrice * factor * 100) / 100;
    });
  }, [gstRate]);

  // Double-Way Calculation Handlers for Price changes
  const handlePriceChange = (field: keyof typeof prices, value: number, isWithTax: boolean) => {
    const factor = 1 + gstRate / 100;

    setPrices(prev => {
      const updated = { ...prev };
      if (isWithTax) {
        updated[`${field}WithTax` as keyof typeof prices] = value as never;
        const cleanField = field.replace("WithTax", "") as keyof typeof prices;
        updated[cleanField] = Math.round((value / factor) * 100) / 100 as never;
      } else {
        updated[field] = value as never;
        const taxField = `${field}WithTax` as keyof typeof prices;
        updated[taxField] = Math.round(value * factor * 100) / 100 as never;
      }

      // Automatically sync opening stock purchase price if standard purchase price is changed
      if (field === "purchasePrice") {
        if (isWithTax) {
          setOpeningPurchasePriceWithTax(value);
          setOpeningPurchasePrice(Math.round((value / factor) * 100) / 100);
        } else {
          setOpeningPurchasePrice(value);
          setOpeningPurchasePriceWithTax(Math.round(value * factor * 100) / 100);
        }
      }

      return updated;
    });
  };

  // Helper for Opening stock price calculations
  const handleOpeningPriceChange = (value: number, isWithTax: boolean) => {
    const factor = 1 + gstRate / 100;
    if (isWithTax) {
      setOpeningPurchasePriceWithTax(value);
      const exclTax = Math.round((value / factor) * 100) / 100;
      setOpeningPurchasePrice(exclTax);
      setPrices(prev => ({
        ...prev,
        purchasePrice: exclTax,
        purchasePriceWithTax: value
      }));
    } else {
      setOpeningPurchasePrice(value);
      const inclTax = Math.round(value * factor * 100) / 100;
      setOpeningPurchasePriceWithTax(inclTax);
      setPrices(prev => ({
        ...prev,
        purchasePrice: value,
        purchasePriceWithTax: inclTax
      }));
    }
  };

  // Calculate final discounted customer retail price
  const discountAmount = discountType === "PERCENT"
    ? (prices.customerPrice * (discountValue / 100))
    : discountValue;

  const discountedSellingPrice = Math.max(0, prices.customerPrice - discountAmount);
  const discountedSellingPriceWithTax = Math.round(discountedSellingPrice * (1 + gstRate / 100) * 100) / 100;

  const handleSave = async () => {
    if (!name) {
      setError("Please provide an Item Name.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (Number(openingStock) > 0 && !itemLocation) {
      setError("Please select a Warehouse for the opening stock.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const weightSuffix = size ? `-${size.toUpperCase()}` : "";
    const generatedSku = name.toUpperCase().replace(/\s+/g, "-").slice(0, 20) + weightSuffix;
    const finalSku = itemCode 
      ? (itemCode.toUpperCase().endsWith(weightSuffix) ? itemCode.toUpperCase() : `${itemCode.toUpperCase()}${weightSuffix}`)
      : generatedSku;

    // Prepare payload
    const payload = {
      name,
      sku: finalSku,
      unit: primaryUnit,
      category,
      hsnCode,
      gstRate,
      minimumStock: Number(minimumStock) || 0,
      initialStock: Number(openingStock) || 0,
      // Omitted, not a hardcoded literal id — this form has no franchise
      // selector, so it always creates HQ-scoped stock, and
      // InventoryService.createItem treats "no franchiseId at all" as
      // HQ-scoped (franchiseId: null) already. A hardcoded "hq-001"
      // pointed at whatever id happened to exist when this was written;
      // that id is no longer a real Franchise row, so this would fail its
      // foreign key constraint outright.
      costPrice: prices.purchasePrice,
      basePrice: discountValue > 0 ? discountedSellingPrice : prices.customerPrice,
      secondaryUnit,
      conversionRatio,
      discountType,
      discountValue,
      franchisePrice: prices.franchisePrice,
      dealerPrice: prices.dealerPrice,
      customerPrice: prices.customerPrice,
      customModeName: customChannels[0]?.name || "",
      customModePrice: customChannels[0]?.price || 0,
      openingStockDate: openingDate,
      openingPurchasePrice: openingPurchasePrice,
      binLocation: itemLocation,
    };

    try {
      const res = await rawMaterialsApi.create(payload);
      setSuccess("Inventory Product Master successfully registered!");
      
      if (onSuccess) {
        onSuccess((res as any).data || payload);
      } else {
        setTimeout(() => {
          if (returnTo) {
            // Callers that send people here to create a linked product (e.g.
            // Recipe Master's "+ Add New Product") have no other way to learn
            // which product just got made — this endpoint returns the raw
            // InventoryItem, not the synced Product record. Stash the name so
            // the returning page can look it up itself once it refetches.
            try {
              sessionStorage.setItem("lastCreatedInventoryProduct", JSON.stringify({ name, sku: finalSku, at: Date.now() }));
            } catch { /* ignore unavailable storage */ }
            router.push(returnTo);
          } else {
            // Route to the Stock Hub tab matching the item's actual saved
            // category — never change the category itself just to steer
            // navigation. Only FINISHED_GOOD has its own tab; every other
            // category (raw materials, packaging, semi-finished, etc.)
            // lives under Raw Materials & Assets.
            const stockHubType = category === "FINISHED_GOOD" ? "FINISHED_GOOD" : "RAW_MATERIAL";
            router.push(`/inventory/stock?type=${stockHubType}`);
          }
        }, 1500);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || "Failed to finalize product registration.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={clsx("max-w-6xl mx-auto pb-24 px-4 sm:px-6", isModal && "pt-8")}>
      {/* Hide native browser spinners for number inputs to prevent overlapping with custom overlays */}
      <style>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Strategic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6 border-b border-slate-100 dark:border-white/5 pb-6 animate-in fade-in duration-300">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/inventory/stock" className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm active:scale-95">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                Add <span className="text-orange-600">Inventory Product</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide mt-0.5 uppercase flex items-center gap-1.5">
                <Tag size={12} className="text-orange-500" />
                Comprehensive Pricing, Tax & Stock Intelligence Center
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Parallel Tabs */}
        <div className="flex border-b border-slate-200 dark:border-white/10 w-full md:w-80">
          <button 
            type="button"
            onClick={() => setActiveTab("specs")} 
            className={clsx(
              "flex-1 text-center py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 outline-none",
              activeTab === "specs" 
                ? "border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold" 
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            Pricing
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("opening")} 
            className={clsx(
              "flex-1 text-center py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 outline-none",
              activeTab === "opening" 
                ? "border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold" 
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            Stock
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold animate-in zoom-in-95">
          <AlertCircle size={16} className="shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3 text-emerald-700 dark:text-emerald-400 text-xs font-bold animate-in zoom-in-95">
          <CheckCircle2 size={16} className="shrink-0" />
          <div>{success}</div>
        </div>
      )}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Hand: Config Tabs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: Product Specifications & pricing models */}
          {activeTab === "specs" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* General Identity */}
              <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500"><LayoutGrid size={16} /></div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Identity Details</h2>
                    <p className="text-xs text-slate-400">Classify product within master ledger</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Item Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Name *</label>
                    <input
                      placeholder="e.g. Batter Dosa"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white transition-all text-sm font-semibold"
                    />
                  </div>

                  {/* Item Code / Barcode */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Code / Barcode</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          placeholder="Enter item code or scan barcode"
                          value={itemCode}
                          onChange={e => setItemCode(e.target.value)}
                          className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white transition-all text-xs font-semibold"
                        />
                        <Barcode size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (name.trim()) {
                            // Generate code based on item name (e.g., "Batter Idly" -> "BATTER-IDLY")
                            const base = name.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
                            setItemCode(base);
                          } else {
                            const code = "ITM-" + Math.random().toString(36).toUpperCase().slice(2, 8);
                            setItemCode(code);
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400 hover:text-orange-600 transition-all whitespace-nowrap"
                      >
                        Assign Code
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Item Category */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Category</label>
                      {showAddCategory ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            placeholder="New category name"
                            value={newCategoryInput}
                            onChange={e => setNewCategoryInput(e.target.value.toUpperCase())}
                            className="flex-1 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-orange-400 rounded-lg outline-none text-slate-800 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newCategoryInput.trim()) {
                                const key = newCategoryInput.trim().replace(/\s+/g, "_");
                                setCustomCategories(prev => [...prev, key]);
                                setCategory(key);
                              }
                              setShowAddCategory(false);
                              setNewCategoryInput("");
                            }}
                            className="px-3 py-2 bg-orange-500 text-white rounded-lg text-[10px] font-bold"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowAddCategory(false); setNewCategoryInput(""); }}
                            className="px-2 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-400"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <select
                              value={category}
                              onChange={e => setCategory(e.target.value)}
                              className="w-full appearance-none border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-orange-500 cursor-pointer"
                            >
                              {[...ITEM_CATEGORIES, ...customCategories].map(c => (
                                <option key={c} value={c} className="dark:bg-slate-950">{c.replace(/_/g, " ")}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddCategory(true)}
                            className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:text-orange-600 hover:border-orange-400 transition-all whitespace-nowrap flex items-center gap-1"
                          >
                            <Plus size={11} /> New
                          </button>
                        </div>
                      )}
                    </div>

                    {/* HSN / SAC Code */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HSN / SAC Code</label>
                      <div className="flex gap-2">
                        <input
                          placeholder="e.g. 190190"
                          value={hsnCode}
                          onChange={e => setHsnCode(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-slate-800 dark:text-white transition-all font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => setShowHsnSearch(true)}
                          className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 hover:text-orange-600 hover:border-orange-400 transition-all"
                          title="Search HSN Code"
                        >
                          <Search size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* HSN Search Modal */}
                  {showHsnSearch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md mx-4 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Search HSN / SAC Code</h3>
                          <button type="button" onClick={() => { setShowHsnSearch(false); setHsnSearchQuery(""); }} className="text-slate-400 hover:text-slate-600">
                            <X size={16} />
                          </button>
                        </div>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            autoFocus
                            placeholder="Search by description or code..."
                            value={hsnSearchQuery}
                            onChange={e => setHsnSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-orange-500 bg-slate-50 dark:bg-slate-800 dark:text-white font-semibold"
                          />
            {hsnSearchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setHsnSearchQuery("")} 
              />
            )}
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-50 dark:divide-white/5">
                          {loadingHsn ? (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                              <RefreshCw size={24} className="animate-spin text-orange-500" />
                              <span className="text-xs font-medium uppercase tracking-wider">Loading HSN Database...</span>
                            </div>
                          ) : filteredHsnResults.length === 0 ? (
                            <div className="text-center py-8 text-xs font-medium text-slate-400">
                              No matching HSN codes found
                            </div>
                          ) : (
                            filteredHsnResults.map(h => (
                              <button
                                key={h.hsn}
                                type="button"
                                onClick={() => {
                                  setHsnCode(h.hsn);
                                  setShowHsnSearch(false);
                                  setHsnSearchQuery("");
                                }}
                                className="w-full flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-all text-left group"
                              >
                                <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{h.description}</span>
                                <span className="text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded shrink-0">{h.hsn}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-white/5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Weight Variant</label>
                    <div className="flex items-center bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden w-fit">
                      <input 
                        type="number"
                        placeholder="Qty (e.g. 25)" 
                        value={customNumber}
                        onChange={e => {
                          const num = e.target.value;
                          setCustomNumber(num);
                          setSize(num + customUnit);
                        }}
                        className="bg-transparent px-3 py-1.5 text-xs font-bold uppercase outline-none w-24 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-r border-slate-200 dark:border-slate-800"
                      />
                      <div className="relative">
                        <select
                          value={customUnit}
                          onChange={e => {
                            const unit = e.target.value;
                            setCustomUnit(unit);
                            setSize(customNumber + unit);
                          }}
                          className="appearance-none bg-transparent pl-3 pr-7 py-1.5 text-xs font-bold uppercase outline-none dark:text-white cursor-pointer"
                        >
                          {["KG", "G", "L", "ML", "PCS", "PKT", "BOX"].map(u => (
                            <option key={u} value={u} className="dark:bg-slate-950">{u}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* UOM Setup - only for Finished Goods; raw materials derive unit from weight variant */}
              {category === "FINISHED_GOOD" && (
              <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                  <Scale size={16} className="text-orange-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Stocking Units (UOM)</span>
                </div>

                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Primary Unit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Unit</label>
                        {showAddPrimaryUnit ? (
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              placeholder="e.g. BKT"
                              value={newPrimaryUnitInput}
                              onChange={e => setNewPrimaryUnitInput(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-orange-400 rounded-lg outline-none text-slate-800 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newPrimaryUnitInput.trim()) {
                                  const val = newPrimaryUnitInput.trim().toLowerCase();
                                  setCustomUnits(prev => prev.includes(val) ? prev : [...prev, val]);
                                  setPrimaryUnit(val);
                                }
                                setShowAddPrimaryUnit(false);
                                setNewPrimaryUnitInput("");
                              }}
                              className="px-3 py-2 bg-orange-500 text-white rounded-lg text-[10px] font-bold"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddPrimaryUnit(false); setNewPrimaryUnitInput(""); }}
                              className="px-2 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <select 
                                value={primaryUnit} 
                                onChange={e => setPrimaryUnit(e.target.value)}
                                className="w-full appearance-none border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-orange-500 cursor-pointer"
                              >
                                {[...UNITS, ...customUnits].map(u => <option key={u} value={u} className="dark:bg-slate-950">{u.toUpperCase()}</option>)}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowAddPrimaryUnit(true)}
                              className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:text-orange-600 hover:border-orange-400 transition-all whitespace-nowrap flex items-center gap-1"
                            >
                              <Plus size={11} /> New
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Secondary Unit */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Secondary Unit (Bulk)</label>
                        {showAddSecondaryUnit ? (
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              placeholder="e.g. CRATE"
                              value={newSecondaryUnitInput}
                              onChange={e => setNewSecondaryUnitInput(e.target.value.toUpperCase())}
                              className="flex-1 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-orange-400 rounded-lg outline-none text-slate-800 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newSecondaryUnitInput.trim()) {
                                  const val = newSecondaryUnitInput.trim().toLowerCase();
                                  setCustomUnits(prev => prev.includes(val) ? prev : [...prev, val]);
                                  setSecondaryUnit(val);
                                }
                                setShowAddSecondaryUnit(false);
                                setNewSecondaryUnitInput("");
                              }}
                              className="px-3 py-2 bg-orange-500 text-white rounded-lg text-[10px] font-bold"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddSecondaryUnit(false); setNewSecondaryUnitInput(""); }}
                              className="px-2 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <select 
                                value={secondaryUnit} 
                                onChange={e => setSecondaryUnit(e.target.value)}
                                className="w-full appearance-none border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-orange-500 cursor-pointer"
                              >
                                {Array.from(new Set(["box", "bag", "dozen", "carton", "packet", ...customUnits])).map(u => (
                                  <option key={u} value={u} className="dark:bg-slate-950">{u.toUpperCase()}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowAddSecondaryUnit(true)}
                              className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:text-orange-600 hover:border-orange-400 transition-all whitespace-nowrap flex items-center gap-1"
                            >
                              <Plus size={11} /> New
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Conversion Ratio */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversion Ratio</label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={conversionRatio}
                            onChange={e => setConversionRatio(Math.max(1, Number(e.target.value) || 0))}
                            className="w-full pl-3 pr-16 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-xs font-semibold bg-white dark:bg-slate-900 dark:text-white"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold uppercase">
                            PCS/{secondaryUnit.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {(() => {
                      const kgMatch = size.match(/^([\d.]+)\s*KG$/i);
                      const gMatch  = size.match(/^([\d.]+)\s*G$/i);
                      const pieceG  = kgMatch ? parseFloat(kgMatch[1]) * 1000
                                    : gMatch  ? parseFloat(gMatch[1])
                                    : null;
                      const totalG  = pieceG !== null ? pieceG * conversionRatio : null;
                      const totalLabel = totalG !== null
                        ? totalG >= 1000 ? `${(totalG / 1000).toFixed(2)} KG` : `${totalG.toFixed(0)} G`
                        : null;
                      return (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-4 py-2.5 rounded-lg border border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-x-1.5 gap-y-1 animate-in fade-in duration-200">
                          <span>Stocking translation:</span>
                          <strong className="text-slate-700 dark:text-slate-200">1 {secondaryUnit.toUpperCase()}</strong>
                          <span>=</span>
                          <strong className="text-orange-500">{conversionRatio} pieces</strong>
                          <span>×</span>
                          <strong className="text-slate-700 dark:text-slate-200">{size} each</strong>
                          {totalLabel && (
                            <>
                              <span>=</span>
                              <strong className="text-emerald-600 dark:text-emerald-400">{totalLabel} total</strong>
                            </>
                          )}
                        </div>
                      );
                    })()}
                </>
              </div>
              )}

              {/* GST Compliance */}
              <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                  <Percent size={16} className="text-orange-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">GST Compliance Tax Rate</span>
                  <span className="ml-auto text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md">
                    Active: {gstRate}%
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {[0, 5, 12, 18, 28].map(rate => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => { setGstRate(rate); setCustomGstInput(""); }}
                      className={clsx(
                        "px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1 border",
                        gstRate === rate && !customGstInput
                          ? "bg-orange-500 border-orange-500 text-white shadow-sm scale-105"
                          : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                      )}
                    >
                      {rate === 0 ? "Without Tax (0%)" : `${rate}% GST`}
                    </button>
                  ))}

                  {/* Custom GST divider */}
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                  {/* Custom GST input */}
                  <div className="flex items-center gap-1.5">
                    <div className={clsx(
                      "flex items-center gap-1 border rounded-lg transition-all overflow-hidden",
                      customGstInput
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5"
                    )}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={customGstInput}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomGstInput(val);
                          const num = parseFloat(val);
                          if (!isNaN(num) && num >= 0 && num <= 100) setGstRate(num);
                        }}
                        placeholder="Custom %"
                        className={clsx(
                          "w-24 px-3 py-2 font-bold text-xs outline-none bg-transparent",
                          customGstInput ? "text-orange-600 dark:text-orange-400" : "text-slate-400"
                        )}
                      />
                      <span className={clsx(
                        "pr-2.5 text-[10px] font-black",
                        customGstInput ? "text-orange-500" : "text-slate-400"
                      )}>%</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Custom GST</span>
                  </div>
                </div>

                {/* Summary row */}
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  {gstRate === 0 ? (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                      No GST active → Base Price is identical to Gross Price
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                        Without GST base price → <span className="text-slate-700 dark:text-slate-200">any price excl. column</span>
                      </div>
                      <div className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-500/20">
                        With GST ({gstRate}%) → auto-calculated in incl. column
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Pricing Tiers Table */}
              <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500"><Coins size={16} /></div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {category === "FINISHED_GOOD" ? "Pricing Tiers Matrix" : "Acquisition Price Matrix"}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {category === "FINISHED_GOOD" ? "Manage all wholesale and retail channels" : "Manage base purchasing/acquisition costs"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      Double-Way Tax Auto-Sync
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-2">Pricing Channel</th>
                        <th className="py-3 px-2">Excl. GST (Base Rate)</th>
                        <th className="py-3 px-2">Incl. GST (Gross Rate)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {/* Tier A: Purchase Price */}
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                        <td className="py-4 px-2 font-semibold text-slate-700 dark:text-slate-300">
                          <div>Purchase Price</div>
                          <div className="text-[10px] text-slate-400 font-normal">Standard acquisition cost</div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="relative max-w-[160px]">
                            <input 
                              type="number"
                              value={prices.purchasePrice}
                              onChange={e => handlePriceChange("purchasePrice", Number(e.target.value) || 0, false)}
                              className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="relative max-w-[160px]">
                            <input 
                              type="number"
                              value={prices.purchasePriceWithTax}
                              onChange={e => handlePriceChange("purchasePrice", Number(e.target.value) || 0, true)}
                              className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                          </div>
                        </td>
                      </tr>

                      {category === "FINISHED_GOOD" && (
                        <>
                          {/* Tier B: Franchise Price */}
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                            <td className="py-4 px-2 font-semibold text-slate-700 dark:text-slate-300">
                              <div>Franchise Price</div>
                              <div className="text-[10px] text-slate-400 font-normal">Wholesale supply cost</div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="relative max-w-[160px]">
                                <input 
                                  type="number"
                                  value={prices.franchisePrice}
                                  onChange={e => handlePriceChange("franchisePrice", Number(e.target.value) || 0, false)}
                                  className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="relative max-w-[160px]">
                                <input 
                                  type="number"
                                  value={prices.franchisePriceWithTax}
                                  onChange={e => handlePriceChange("franchisePrice", Number(e.target.value) || 0, true)}
                                  className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                              </div>
                            </td>
                          </tr>

                          {/* Tier D: Dealer Price */}
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                            <td className="py-4 px-2 font-semibold text-slate-700 dark:text-slate-300">
                              <div>Dealer Price</div>
                              <div className="text-[10px] text-slate-400 font-normal">Distributor channel cost</div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="relative max-w-[160px]">
                                <input 
                                  type="number"
                                  value={prices.dealerPrice}
                                  onChange={e => handlePriceChange("dealerPrice", Number(e.target.value) || 0, false)}
                                  className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="relative max-w-[160px]">
                                <input 
                                  type="number"
                                  value={prices.dealerPriceWithTax}
                                  onChange={e => handlePriceChange("dealerPrice", Number(e.target.value) || 0, true)}
                                  className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                              </div>
                            </td>
                          </tr>

                          {/* Tier E: Customer Price */}
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                            <td className="py-4 px-2 font-semibold text-slate-700 dark:text-slate-300">
                              <div>Customer Retail</div>
                              <div className="text-[10px] text-slate-400 font-normal">Direct B2C counter sales</div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="relative max-w-[160px]">
                                <input 
                                  type="number"
                                  value={prices.customerPrice}
                                  onChange={e => handlePriceChange("customerPrice", Number(e.target.value) || 0, false)}
                                  className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                              </div>
                            </td>
                            <td className="py-4 px-2">
                              <div className="relative max-w-[160px]">
                                <input 
                                  type="number"
                                  value={prices.customerPriceWithTax}
                                  onChange={e => handlePriceChange("customerPrice", Number(e.target.value) || 0, true)}
                                  className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                              </div>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {category === "FINISHED_GOOD" && (
                <>
                  {/* Dedicated Custom Sales Channel Override Cards */}
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {customChannels.map((ch, idx) => (
                      <div key={ch.id} className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-4 relative">
                        {/* Delete dynamic card option */}
                        {customChannels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCustomChannels(prev => prev.filter(c => c.id !== ch.id))}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/5"
                            title="Delete Channel"
                          >
                            <X size={14} />
                          </button>
                        )}

                        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <Globe size={16} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Custom Sales Channel Platform</h3>
                            <p className="text-[10px] text-slate-400">Configure distinct override rates for this custom marketplace</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <div className="min-h-[28px] flex items-end">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Channel Platform Name</label>
                            </div>
                            <input 
                              type="text"
                              value={ch.name}
                              onChange={e => handleCustomChannelChange(idx, "name", e.target.value)}
                              placeholder="e.g. Amazon"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-xs font-semibold text-slate-800 dark:text-white"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="min-h-[28px] flex items-end">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Price Excl. GST (Without Tax)</label>
                            </div>
                            <div className="relative">
                              <input 
                                type="number"
                                value={ch.price || ""}
                                onChange={e => handleCustomChannelChange(idx, "price", Number(e.target.value) || 0)}
                                className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-xs font-semibold bg-white dark:bg-slate-900 dark:text-white"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="min-h-[28px] flex items-end">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Price Incl. GST (With Tax)</label>
                            </div>
                            <div className="relative">
                              <input 
                                type="number"
                                value={ch.priceWithTax || ""}
                                onChange={e => handleCustomChannelChange(idx, "priceWithTax", Number(e.target.value) || 0)}
                                className="w-full pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-xs font-semibold bg-white dark:bg-slate-900 dark:text-white"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add dynamic channel card option button */}
                    <button
                      type="button"
                      onClick={() => setCustomChannels(prev => [
                        ...prev,
                        { id: Date.now().toString(), name: "Flipkart", price: 0, priceWithTax: 0 }
                      ])}
                      className="w-full py-3.5 bg-orange-50/50 dark:bg-orange-500/5 hover:bg-orange-100/70 dark:hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-dashed border-orange-200 dark:border-orange-500/20 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.99] mb-4"
                    >
                      <Plus size={14} />
                      Add Custom Sales Channel Card
                    </button>
                  </div>

                  {/* Promo Discount Configuration */}
                  <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent size={16} className="text-orange-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Customer Retail Discount</span>
                      </div>
                      <div className="flex bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-white/10">
                        <button 
                          type="button" 
                          onClick={() => setDiscountType("PERCENT")} 
                          className={clsx("px-3 py-1 rounded-md text-[10px] font-bold transition-all", discountType === "PERCENT" ? "bg-white dark:bg-slate-800 text-orange-600 shadow-sm" : "text-slate-400")}
                        >
                          Percent %
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setDiscountType("VALUE")} 
                          className={clsx("px-3 py-1 rounded-md text-[10px] font-bold transition-all", discountType === "VALUE" ? "bg-white dark:bg-slate-800 text-orange-600 shadow-sm" : "text-slate-400")}
                        >
                          Flat ₹
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="relative">
                        <input 
                          type="number"
                          value={discountValue}
                          onChange={e => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="Enter discount value..."
                          className="w-full pl-3 pr-10 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-orange-500 text-sm font-semibold bg-white dark:bg-slate-900 dark:text-white"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-500">
                          {discountType === "PERCENT" ? "%" : "₹"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-4 py-2.5 rounded-lg border border-slate-100 dark:border-white/5">
                        {discountValue > 0 ? (
                          <span>Customer retail reduces to <strong className="text-orange-500">₹{discountedSellingPriceWithTax}</strong> (incl. tax)</span>
                        ) : (
                          <span>No discount applied. Standard channel rates apply.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          )}

          {/* TAB 2: Parallel Tab (Opening Stock Setup) */}
          {activeTab === "opening" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-6">
                
                {/* Row 1: Opening Stock */}
                <div className="relative mt-2">
                  <label className="absolute -top-2 left-3 bg-white dark:bg-[#12141a] px-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 z-10 transition-all select-none">
                    Opening Stock ({category === "FINISHED_GOOD" ? "Units" : primaryUnit.toUpperCase()})
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[8px] text-slate-400 cursor-pointer font-bold select-none hover:bg-slate-200">i</span>
                  </label>
                  <div className="flex gap-2 items-stretch">
                    <input
                      type="number"
                      placeholder={category === "FINISHED_GOOD" ? "Ex: 24" : "Ex: 300"}
                      value={openingStock || ""}
                      onChange={e => setOpeningStock(Math.max(0, Number(e.target.value) || 0))}
                      className="flex-1 px-3.5 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-rose-500 dark:focus:border-rose-500 text-slate-700 dark:text-slate-200 font-semibold transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                    <div className="flex items-center justify-center px-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-700 dark:text-slate-200 min-w-[3.5rem]">
                      {category === "FINISHED_GOOD" ? "UNITS" : primaryUnit.toUpperCase()}
                    </div>
                  </div>

                  {/* Raw material: show entry info with optional conversion */}
                  {category !== "FINISHED_GOOD" && openingStock > 0 && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg text-[10px] font-semibold text-blue-700 dark:text-blue-400 flex-wrap">
                      <span className="font-black">{openingStock} {primaryUnit.toUpperCase()}</span>
                      <span className="text-blue-400">→</span>
                      <span>entering opening inventory</span>
                      {primaryUnit.toLowerCase() === "g" && openingStock >= 1000 && (
                        <span className="ml-auto font-black">= {(openingStock / 1000).toFixed(2)} KG</span>
                      )}
                      {primaryUnit.toLowerCase() === "ml" && openingStock >= 1000 && (
                        <span className="ml-auto font-black">= {(openingStock / 1000).toFixed(2)} L</span>
                      )}
                    </div>
                  )}

                  {/* Finished good: show unit × variant = total weight breakdown */}
                  {category === "FINISHED_GOOD" && openingStock > 0 && (() => {
                    const variantQty = parseFloat(customNumber) || 1;
                    const variantUnit = customUnit.toUpperCase();
                    const totalRaw = openingStock * variantQty;
                    let totalStr = "";
                    if (variantUnit === "G" || variantUnit === "GM") {
                      totalStr = totalRaw >= 1000 ? `${(totalRaw / 1000).toFixed(2)} KG` : `${totalRaw.toFixed(0)} G`;
                    } else if (variantUnit === "ML") {
                      totalStr = totalRaw >= 1000 ? `${(totalRaw / 1000).toFixed(2)} L` : `${totalRaw.toFixed(0)} ML`;
                    } else {
                      totalStr = `${totalRaw % 1 === 0 ? totalRaw.toFixed(0) : totalRaw.toFixed(2)} ${variantUnit}`;
                    }
                    return (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-lg text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex-wrap">
                        <span className="font-black">{openingStock} Units</span>
                        <span className="text-emerald-400">×</span>
                        <span className="font-bold">{customNumber} {variantUnit} each</span>
                        <span className="text-emerald-400">=</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-300">{totalStr} total</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Row 2: As of Date & Price/Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative mt-2">
                    <label className="absolute -top-2 left-3 bg-white dark:bg-[#12141a] px-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 z-10 transition-all select-none">
                      As of Date
                    </label>
                    <input
                      type="date"
                      value={openingDate}
                      onChange={e => setOpeningDate(e.target.value)}
                      className="w-full px-3.5 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-rose-500 dark:focus:border-rose-500 text-slate-700 dark:text-slate-200 font-semibold transition-all cursor-pointer"
                    />
                  </div>

                  <div className="relative mt-2">
                    <label className="absolute -top-2 left-3 bg-white dark:bg-[#12141a] px-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 z-10 transition-all select-none">
                      {category === "FINISHED_GOOD" ? "Purchase Price / Unit (Excl. GST)" : `Price / ${primaryUnit.toUpperCase()} (Excl. GST)`}
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[8px] text-slate-400 cursor-pointer font-bold select-none hover:bg-slate-200">i</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 2,000"
                        value={openingPurchasePrice || ""}
                        onChange={e => handleOpeningPriceChange(Number(e.target.value) || 0, false)}
                        className="w-full px-3.5 pr-16 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-rose-500 dark:focus:border-rose-500 text-slate-700 dark:text-slate-200 font-semibold transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-orange-500">
                        {category === "FINISHED_GOOD" ? "₹/Unit" : `₹/${primaryUnit.toUpperCase()}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Min Stock Qty & Item Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative mt-2">
                    <label className="absolute -top-2 left-3 bg-white dark:bg-[#12141a] px-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 z-10 transition-all select-none">
                      Min Stock Qty {category === "FINISHED_GOOD" ? "(Units)" : `(${primaryUnit.toUpperCase()})`}
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[8px] text-slate-400 cursor-pointer font-bold select-none hover:bg-slate-200">i</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 5"
                      value={minimumStock || ""}
                      onChange={e => setMinimumStock(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3.5 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-rose-500 dark:focus:border-rose-500 text-slate-700 dark:text-slate-200 font-semibold transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>

                  <div className="relative mt-2">
                    <label className="absolute -top-2 left-3 bg-white dark:bg-[#12141a] px-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 z-10 transition-all select-none">
                      Item Location (Warehouse)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={itemLocation}
                          onChange={e => setItemLocation(e.target.value)}
                          className="w-full px-3.5 py-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-rose-500 dark:focus:border-rose-500 text-slate-700 dark:text-slate-200 font-semibold transition-all appearance-none"
                        >
                          <option value="">Select Warehouse</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddWarehouse(true)}
                        className="px-3 py-2 bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 hover:text-orange-600 hover:border-orange-400 transition-all whitespace-nowrap flex items-center gap-1"
                      >
                        <Plus size={11} /> New
                      </button>
                    </div>
                    {warehouses.length === 0 && (
                      <p className="mt-1.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                        No warehouses exist yet — click "New" to create one before adding opening stock.
                      </p>
                    )}
                  </div>
                </div>

                <WarehouseFormModal
                  isOpen={showAddWarehouse}
                  onClose={() => setShowAddWarehouse(false)}
                  onSuccess={(warehouse) => {
                    setWarehouses(prev => [...prev, warehouse]);
                    setItemLocation(warehouse.id);
                  }}
                />

                {openingStock > 0 && openingPurchasePrice > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-rose-500/5 border border-rose-500/10 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 animate-in fade-in duration-300">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Computed Asset Value</span>
                      <span className="text-[10px] text-slate-400">
                        {category === "FINISHED_GOOD"
                          ? `${openingStock} Units × ₹${openingPurchasePrice}/Unit`
                          : `${openingStock} ${primaryUnit.toUpperCase()} × ₹${openingPurchasePrice}/${primaryUnit.toUpperCase()}`}
                      </span>
                    </div>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400">
                      ₹{(openingStock * openingPurchasePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Hand Side: Summary and Actions */}
        <div className="space-y-6">
          
          {/* Item Code Card */}
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md relative overflow-hidden group">
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all duration-700" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Item Code / Barcode</p>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight uppercase select-all">
                {itemCode || <span className="text-slate-500 text-sm font-normal">Not assigned</span>}
              </h3>
              <Barcode className="text-orange-500 shrink-0" size={18} />
            </div>
          </div>

          {/* Pricing & Valuation Dashboard */}
          <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 p-6 shadow-md space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 dark:border-white/5 pb-2">Commercial Summary</h3>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Base Purchase Cost</span>
                <span className="text-slate-900 dark:text-white font-bold">₹{prices.purchasePrice}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>GST Tax Bracket</span>
                <span className="text-orange-600 font-bold">{gstRate}% GST</span>
              </div>
              {category === "FINISHED_GOOD" && (
                <>
                  <div className="pt-1.5 border-t border-slate-50 dark:border-white/5 space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Profit Margins</p>
                    {[
                      { label: "Franchise", price: prices.franchisePrice },
                      { label: "Dealer", price: prices.dealerPrice },
                      { label: "Customer", price: prices.customerPrice },
                      ...customChannels.map(ch => ({ label: ch.name || "Custom", price: ch.price })),
                    ].map(({ label, price }) => {
                      // An unconfigured channel (price left at 0) is "not set", not
                      // "selling at ₹0" — treating it as the latter made every
                      // unconfigured channel show a bogus -100% loss against the
                      // purchase cost.
                      if (!price || price <= 0) {
                        return (
                          <div key={label} className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                            <span>{label}</span>
                            <span className="font-bold text-xs text-slate-400">Not set</span>
                          </div>
                        );
                      }
                      const margin = price - prices.purchasePrice;
                      const pct = prices.purchasePrice > 0 ? ((margin / prices.purchasePrice) * 100).toFixed(0) : "—";
                      return (
                        <div key={label} className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                          <span>{label}</span>
                          <span className={`font-bold text-xs ${margin > 0 ? "text-emerald-600 dark:text-emerald-400" : margin < 0 ? "text-red-500" : "text-slate-400"}`}>
                            {margin > 0 ? "+" : ""}{margin !== 0 ? `₹${margin.toFixed(0)}` : "—"}
                            {prices.purchasePrice > 0 && margin !== 0 && <span className="text-[9px] ml-1 opacity-70">({pct}%)</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between items-center text-red-500 font-bold">
                      <span>Customer Discount</span>
                      <span>-{discountType === "PERCENT" ? `${discountValue}%` : `₹${discountValue}`}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col gap-2">
            <button 
              type="button"
              onClick={handleSave} 
              disabled={saving} 
              className="flex items-center justify-center gap-2 w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 border-none cursor-pointer"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Registering..." : "Launch Item Master"}
            </button>

            {isModal ? (
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-center py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Discard & Quit
              </button>
            ) : (
              <Link 
                href="/inventory/stock" 
                className="w-full text-center py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Discard & Quit
              </Link>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
