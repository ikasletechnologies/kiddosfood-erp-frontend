"use client";

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";

export interface LineItem {
  id: string;
  materialId: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  gstRate: number;
}

export interface Vendor {
  [x: string]: any;
  id: string;
  name: string;
  phone?: string;
  advanceBalance: number;
  balanceDue: number;
  suppliedMaterials?: { materialId: string; name?: string; price: number }[];
}

interface PurchaseOrderContextType {
  selectedVendor: Vendor | null;
  setSelectedVendor: (vendor: Vendor | null) => void;
  items: LineItem[];
  addItem: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<LineItem>) => void;
  useAdvance: boolean;
  setUseAdvance: (use: boolean) => void;
  notes: string;
  setNotes: (notes: string) => void;
  totals: {
    [x: string]: any;
    subtotal: number;
    totalGst: number;
    total: number;
    appliedAdvance: number;
    balanceDue: number;
  };
  isValid: boolean;
  errors: string[];
  isSubmitting: boolean;
  setIsSubmitting: (submitting: boolean) => void;
  poNumber: string;
  setPoNumber: (num: string) => void;
  invoiceNo: string;
  setInvoiceNo: (num: string) => void;
  quotationNo: string;
  setQuotationNo: (num: string) => void;
  purchaseDate: string;
  setPurchaseDate: (date: string) => void;
  dueDate: string;
  setDueDate: (date: string) => void;
  expectedDeliveryDate: string;
  setExpectedDeliveryDate: (date: string) => void;
  warehouseId: string;
  setWarehouseId: (id: string) => void;
  purchaseType: string;
  setPurchaseType: (type: string) => void;
  paymentTerms: string;
  setPaymentTerms: (terms: string) => void;
  poStatus: string;
  setPoStatus: (status: string) => void;
  discountAmount: number;
  setDiscountAmount: (amount: number) => void;
  freightCost: number;
  setFreightCost: (amount: number) => void;
  internalNotes: string;
  setInternalNotes: (notes: string) => void;
  vendorNotes: string;
  setVendorNotes: (notes: string) => void;
  getVendorPrice: (materialId: string) => number | null;
  autoFilledIds: Set<string>;
  setAutoFilledIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  editId?: string;
  contextMessage: string | null;
  setContextMessage: (msg: string | null) => void;
}

const PurchaseOrderContext = createContext<PurchaseOrderContextType | undefined>(undefined);

export function PurchaseOrderProvider({ children, editId }: { children: React.ReactNode, editId?: string }) {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<LineItem[]>([
    { id: "1", materialId: "", name: "", quantity: 0, unit: "KG", price: 0, gstRate: 5 }
  ]);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [autoFilledIds, setAutoFilledIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load draft from localStorage or fetch existing PO on mount
  useEffect(() => {
    if (editId) {
      // Fetch existing PO
      import('@/lib/api').then(({ purchaseOrdersApi }) => {
        purchaseOrdersApi.getById(editId).then((res) => {
          const po = res.data;
          if (po.vendor) setSelectedVendor(po.vendor);
          if (po.poItems && po.poItems.length > 0) {
            setItems(po.poItems.map((item: any) => ({
              id: item.id || Math.random().toString(36).substr(2, 9),
              materialId: item.inventoryItemId,
              name: item.inventoryItem?.name || "",
              quantity: item.quantity,
              unit: item.inventoryItem?.unit || "KG",
              price: item.price,
              gstRate: item.gstRate || 5
            })));
          }
          if (po.purchaseType) setPurchaseType(po.purchaseType);
          if (po.warehouseId) setWarehouseId(po.warehouseId);
          if (po.expectedDeliveryDate) setExpectedDeliveryDate(po.expectedDeliveryDate.split('T')[0]);
          if (po.paymentTerms) setPaymentTerms(po.paymentTerms);
          if (po.internalNotes) setInternalNotes(po.internalNotes);
          if (po.vendorNotes) setVendorNotes(po.vendorNotes);
          if (po.status) setPoStatus(po.status);
          setIsLoaded(true);
        }).catch(err => {
          console.error("Failed to load PO for edit", err);
          setIsLoaded(true);
        });
      });
    } else {
      const prefilled = sessionStorage.getItem('prefilledPoItems');
      if (prefilled) {
        try {
          const parsed = JSON.parse(prefilled);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mapped = parsed.map((item: any, idx: number) => ({
              id: (idx + 1).toString(),
              materialId: item.materialId,
              name: item.name,
              quantity: item.shortage,
              unit: item.unit || "KG",
              price: 0,
              gstRate: 5
            }));
            setItems(mapped);
            setContextMessage(`Purchase Order started from Recipe. ${parsed.length} ingredients require restocking.`);
            sessionStorage.removeItem('prefilledPoItems');
          }
        } catch (e) {
          console.error("Failed to parse prefilled PO items", e);
        }
      } else {
        const saved = localStorage.getItem('draftPurchaseOrder');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.selectedVendor) setSelectedVendor(parsed.selectedVendor);
            if (parsed.items && parsed.items.length > 0) setItems(parsed.items);
          } catch (e) {
            console.error("Failed to parse draft PO", e);
          }
        }
      }

      // Check if vendorId is in URL (e.g. redirected after creating vendor)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const vendorIdParam = params.get("vendorId");
        if (vendorIdParam) {
          import('@/lib/api').then(({ vendorsApi }) => {
            vendorsApi.getAll().then((res) => {
              const list = res.data?.vendors || res.data || [];
              const found = list.find((v: any) => v.id === vendorIdParam);
              if (found) {
                setSelectedVendor({
                  id: found.id,
                  name: found.name,
                  phone: found.phone || found.mobile || found.contact,
                  email: found.email,
                  gstNumber: found.gstNumber,
                  advanceBalance: found.advanceBalance || (found.balance < 0 ? Math.abs(found.balance) : 0),
                  balanceDue: found.balanceDue || (found.balance > 0 ? found.balance : 0),
                  creditLimit: found.creditLimit || 0,
                  vendorCode: found.vendorCode,
                  suppliedMaterials: found.suppliedMaterials?.map((sm: any) => ({
                    materialId: sm.materialId,
                    price: sm.price,
                    name: sm.material?.name || "Material"
                  })) || []
                });
              }
            }).catch(err => console.error("Failed to auto-select vendor from URL", err));
          });
        }
      }

      setIsLoaded(true);
    }
  }, [editId]);

  // When vendor changes, automatically show materials under that vendor in the items table
  useEffect(() => {
    if (selectedVendor && isLoaded) {
      // Don't wipe the table if the user has already added items manually!
      const hasManualItems = items.some(item => item.materialId !== "");
      if (hasManualItems) return;

      if (selectedVendor.suppliedMaterials && selectedVendor.suppliedMaterials.length > 0) {
        // Deduplicate materials by materialId to prevent repeated rows
        const uniqueMaterials = [];
        const seen = new Set();
        for (const sm of selectedVendor.suppliedMaterials) {
          if (!seen.has(sm.materialId)) {
            seen.add(sm.materialId);
            uniqueMaterials.push(sm);
          }
        }

        const newItems = uniqueMaterials.map((sm, index) => ({
          id: (index + 1).toString(),
          materialId: sm.materialId,
          name: sm.name || "Unknown Material",
          quantity: 0,
          unit: "KG",
          price: sm.price || 0,
          gstRate: 5
        }));
        setItems(newItems);
        // Mark all as auto-filled since we got rates from vendor link
        setAutoFilledIds(new Set(newItems.map(i => i.id)));
      } else {
        // Fallback to one empty row if no materials linked
        setItems([{ id: "1", materialId: "", name: "", quantity: 0, unit: "KG", price: 0, gstRate: 5 }]);
        setAutoFilledIds(new Set());
      }
    }
  }, [selectedVendor]);
  const [useAdvance, setUseAdvance] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poNumber, setPoNumber] = useState("PO-2026-00001");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [quotationNo, setQuotationNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [purchaseType, setPurchaseType] = useState("RAW_MATERIAL");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [poStatus, setPoStatus] = useState("DRAFT");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [freightCost, setFreightCost] = useState(0);
  const [internalNotes, setInternalNotes] = useState("");
  const [vendorNotes, setVendorNotes] = useState("");

  // Initialize dates on mount to avoid hydration mismatch
  useEffect(() => {
    const today = new Date();
    setPurchaseDate(today.toISOString().split('T')[0]);
    
    const due = new Date();
    due.setDate(due.getDate() + 15);
    setDueDate(due.toISOString().split('T')[0]);
  }, []);

  // Load other draft fields from localStorage
  useEffect(() => {
    if (isLoaded) {
      const saved = localStorage.getItem('draftPurchaseOrder');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.purchaseType) setPurchaseType(parsed.purchaseType);
          if (parsed.warehouseId) setWarehouseId(parsed.warehouseId);
          if (parsed.expectedDeliveryDate) setExpectedDeliveryDate(parsed.expectedDeliveryDate);
          if (parsed.paymentTerms) setPaymentTerms(parsed.paymentTerms);
          if (parsed.internalNotes) setInternalNotes(parsed.internalNotes);
          if (parsed.vendorNotes) setVendorNotes(parsed.vendorNotes);
        } catch (e) {}
      }
    }
  }, [isLoaded]);

  // Save draft to localStorage whenever fields change
  useEffect(() => {
    if (!isLoaded) return;
    const draft = {
      selectedVendor,
      items,
      purchaseType,
      warehouseId,
      expectedDeliveryDate,
      paymentTerms,
      internalNotes,
      vendorNotes
    };
    localStorage.setItem('draftPurchaseOrder', JSON.stringify(draft));
  }, [selectedVendor, items, purchaseType, warehouseId, expectedDeliveryDate, paymentTerms, internalNotes, vendorNotes, isLoaded]);

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), materialId: "", name: "", quantity: 0, unit: "KG", price: 0, gstRate: 5 }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    } else {
      // Reset the single item instead of removing
      setItems([{ id: "1", materialId: "", name: "", quantity: 0, unit: "KG", price: 0, gstRate: 5 }]);
    }
  };

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // Returns the vendor-linked price for a material, or null if not found
  const getVendorPrice = (materialId: string): number | null => {
    if (!selectedVendor?.suppliedMaterials) return null;
    const linked = selectedVendor.suppliedMaterials.find(sm => sm.materialId === materialId);
    return linked ? linked.price : null;
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const totalGst = items.reduce((acc, item) => acc + (item.quantity * item.price * (item.gstRate / 100)), 0);
    
    // CGST/SGST vs IGST split (simplified logic for now)
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;
    
    const grandTotal = subtotal + totalGst - discountAmount + freightCost;
    const roundoff = Math.round(grandTotal) - grandTotal;
    const finalTotal = grandTotal + roundoff;

    let appliedAdvance = 0;
    if (useAdvance && selectedVendor && selectedVendor.advanceBalance > 0) {
      appliedAdvance = Math.min(selectedVendor.advanceBalance, finalTotal);
    }
    
    const balanceDue = finalTotal - appliedAdvance;
    
    return {
      subtotal,
      totalGst,
      cgst,
      sgst,
      igst: 0, // Placeholder
      discountAmount,
      freightCost,
      roundoff,
      total: finalTotal,
      appliedAdvance,
      balanceDue
    };
  }, [items, useAdvance, selectedVendor, discountAmount, freightCost]);

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!selectedVendor) errs.push("Please select a vendor");
    if (!expectedDeliveryDate) errs.push("Expected delivery date is mandatory");
    if (items.length === 0 || (items.length === 1 && !items[0].materialId && items[0].quantity === 0)) {
        errs.push("Please add at least one item");
    }
    if (items.some(i => i.quantity <= 0)) errs.push("One or more items have invalid quantity");
    if (items.some(i => i.price <= 0)) errs.push("One or more items have invalid price");
    return errs;
  }, [selectedVendor, expectedDeliveryDate, items]);

  const isValid = errors.length === 0;

  return (
    <PurchaseOrderContext.Provider value={{
      selectedVendor,
      setSelectedVendor,
      items,
      addItem,
      removeItem,
      updateItem,
      useAdvance,
      setUseAdvance,
      notes,
      setNotes,
      totals,
      isValid,
      errors,
      isSubmitting,
      setIsSubmitting,
      editId,
      poNumber,
      setPoNumber,
      invoiceNo,
      setInvoiceNo,
      quotationNo,
      setQuotationNo,
      purchaseDate,
      setPurchaseDate,
      dueDate,
      setDueDate,
      expectedDeliveryDate,
      setExpectedDeliveryDate,
      warehouseId,
      setWarehouseId,
      purchaseType,
      setPurchaseType,
      paymentTerms,
      setPaymentTerms,
      poStatus,
      setPoStatus,
      discountAmount,
      setDiscountAmount,
      freightCost,
      setFreightCost,
      internalNotes,
      setInternalNotes,
      vendorNotes,
      setVendorNotes,
      getVendorPrice,
      autoFilledIds,
      setAutoFilledIds,
      contextMessage,
      setContextMessage,
    }}>
      {children}
    </PurchaseOrderContext.Provider>
  );
}

export function usePurchaseOrder() {
  const context = useContext(PurchaseOrderContext);
  if (context === undefined) {
    throw new Error("usePurchaseOrder must be used within a PurchaseOrderProvider");
  }
  return context;
}
