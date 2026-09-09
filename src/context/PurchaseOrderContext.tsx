"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import { roundMoney } from "@/lib/utils";

// Generated purely on the client the instant a new PO screen is opened — no
// backend round trip. Whatever this produces is what gets sent to and stored
// by the backend on save (ProcurementService.createPurchaseOrder honors a
// client-supplied poNumber), so what's shown on screen always matches what's
// persisted. The running count is tracked in this browser's localStorage so
// numbers read as a normal PO-<year>-<seq> sequence instead of a timestamp.
function poSeqStorageKey(year: number) {
  return `poSequenceCounter_${year}`;
}

function generateClientPoNumber(): string {
  const year = new Date().getFullYear();
  let next = 1;
  try {
    const stored = parseInt(localStorage.getItem(poSeqStorageKey(year)) || "0", 10);
    next = (Number.isFinite(stored) ? stored : 0) + 1;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall back to 1
  }
  return `PO-${year}-${String(next).padStart(3, "0")}`;
}

// Called once a PO number has actually been used to create/save an order, so
// the next generated number doesn't repeat it. Reads the sequence back out of
// the number itself rather than assuming it was the one just previewed, since
// a saved draft's poNumber could be older than the current counter.
export function commitClientPoNumber(poNumber: string) {
  const match = poNumber.match(/^PO-(\d{4})-(\d+)$/);
  if (!match) return;
  const [, yearStr, seqStr] = match;
  try {
    const key = poSeqStorageKey(parseInt(yearStr, 10));
    const current = parseInt(localStorage.getItem(key) || "0", 10) || 0;
    const used = parseInt(seqStr, 10);
    if (used > current) localStorage.setItem(key, String(used));
  } catch {
    // ignore
  }
}

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
  status?: string;
  phone?: string;
  advanceBalance: number;
  balanceDue: number;
  suppliedMaterials?: { materialId: string; name?: string; price: number }[];
}

interface PurchaseOrderContextType {
  selectedVendor: Vendor | null;
  setSelectedVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
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
  const prevVendorIdRef = useRef<string | null | undefined>(undefined);
  const [useAdvance, setUseAdvance] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poNumber, setPoNumber] = useState("");
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

  // Load draft from localStorage or fetch existing PO on mount
  useEffect(() => {
    if (editId) {
      // Fetch existing PO
      import('@/lib/api').then(({ purchaseOrdersApi }) => {
        purchaseOrdersApi.getById(editId).then((res) => {
          const po = res.data;
          if (po.poNumber) setPoNumber(po.poNumber);
          else if (po.id) setPoNumber(`PO-${po.id.slice(0, 8)}`);
          if (po.vendor) {
            setSelectedVendor(po.vendor);
            prevVendorIdRef.current = po.vendor.id;
          } else {
            prevVendorIdRef.current = null;
          }
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
          if (po.warehouseId) {
            setWarehouseId(po.warehouseId);
          } else if (po.franchise?.primaryWarehouseId) {
            setWarehouseId(po.franchise.primaryWarehouseId);
          }
          if (po.expectedDeliveryDate) setExpectedDeliveryDate(po.expectedDeliveryDate.split('T')[0]);
          if (po.paymentTerms) setPaymentTerms(po.paymentTerms);
          if (po.internalNotes) setInternalNotes(po.internalNotes);
          else if (po.notes) setInternalNotes(po.notes);
          if (po.vendorNotes) setVendorNotes(po.vendorNotes);
          else if (po.deliveryInstructions) setVendorNotes(po.deliveryInstructions);
          if (po.discountAmount !== undefined) setDiscountAmount(Number(po.discountAmount) || 0);
          if (po.freightCost !== undefined) setFreightCost(Number(po.freightCost) || 0);
          if (po.status) setPoStatus(po.status);
          setIsLoaded(true);
        }).catch(err => {
          console.error("Failed to load PO for edit", err);
          setIsLoaded(true);
        });
      });
    } else {
      let draftPoNumber = "";
      let draftVendorId: string | null = null;
      const saved = localStorage.getItem('draftPurchaseOrder');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.poNumber) {
            draftPoNumber = parsed.poNumber;
            setPoNumber(parsed.poNumber);
          }
          if (parsed.selectedVendor) {
            setSelectedVendor(parsed.selectedVendor);
            draftVendorId = parsed.selectedVendor.id || null;
            if (draftVendorId) {
              import('@/lib/api').then(({ vendorsApi }) => {
                vendorsApi.getById(draftVendorId!).then((res) => {
                  if (res.data) {
                    const latestV = res.data;
                    setSelectedVendor((prev: any) => ({
                      ...(prev || {}),
                      ...latestV,
                      id: latestV.id,
                      name: latestV.name,
                      status: latestV.status,
                      phone: latestV.phone || latestV.mobile || latestV.contact,
                      advanceBalance: latestV.advanceBalance || (latestV.balance < 0 ? Math.abs(latestV.balance) : 0),
                      balanceDue: latestV.balanceDue || (latestV.balance > 0 ? latestV.balance : 0)
                    }));
                  }
                }).catch(err => {
                  console.error("Failed to revalidate draft vendor status", err);
                });
              });
            }
          }
          if (parsed.items && parsed.items.length > 0) setItems(parsed.items);
          if (parsed.purchaseType) setPurchaseType(parsed.purchaseType);
          if (parsed.warehouseId) setWarehouseId(parsed.warehouseId);
          if (parsed.expectedDeliveryDate) setExpectedDeliveryDate(parsed.expectedDeliveryDate);
          if (parsed.paymentTerms) setPaymentTerms(parsed.paymentTerms);
          if (parsed.internalNotes) setInternalNotes(parsed.internalNotes);
          if (parsed.vendorNotes) setVendorNotes(parsed.vendorNotes);
        } catch (e) {
          console.error("Failed to parse draft PO", e);
        }
      }

      // No backend round trip for this — generated right here so it's visible
      // instantly, and sent back to the server as-is on save so the number on
      // screen always matches what gets persisted.
      if (!draftPoNumber) {
        setPoNumber(generateClientPoNumber());
      }

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
                const mappedVendor = {
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
                };
                setSelectedVendor(mappedVendor);
                prevVendorIdRef.current = found.id;
              }
            }).catch(err => console.error("Failed to auto-select vendor from URL", err));
          });
        } else {
          prevVendorIdRef.current = draftVendorId;
        }
      } else {
        prevVendorIdRef.current = draftVendorId;
      }

      setIsLoaded(true);
    }
  }, [editId]);

  // When vendor changes, automatically synchronize materials under that vendor in the items table
  useEffect(() => {
    if (!isLoaded) return;

    const currentVendorId = selectedVendor?.id || null;
    if (prevVendorIdRef.current !== undefined && prevVendorIdRef.current === currentVendorId) {
      return;
    }
    prevVendorIdRef.current = currentVendorId;

    if (selectedVendor) {
      if (selectedVendor.suppliedMaterials && selectedVendor.suppliedMaterials.length > 0) {
        // Deduplicate materials by materialId to prevent repeated rows
        const uniqueMaterials: { materialId: string; name?: string; price: number }[] = [];
        const seen = new Set<string>();
        for (const sm of selectedVendor.suppliedMaterials) {
          if (!seen.has(sm.materialId)) {
            seen.add(sm.materialId);
            uniqueMaterials.push(sm);
          }
        }

        const newItems = uniqueMaterials.map((sm, index) => ({
          id: (index + 1).toString(),
          materialId: sm.materialId,
          name: sm.name || "Material",
          quantity: 0,
          unit: "KG",
          price: sm.price || 0,
          gstRate: 5
        }));
        setItems(newItems);
        setAutoFilledIds(new Set(newItems.map(i => i.id)));
      } else {
        // Vendor has no linked materials: reset to one blank line item
        setItems([{ id: "1", materialId: "", name: "", quantity: 0, unit: "KG", price: 0, gstRate: 5 }]);
        setAutoFilledIds(new Set());
      }
    } else {
      // Vendor was unselected/cleared: reset to one blank line item
      setItems([{ id: "1", materialId: "", name: "", quantity: 0, unit: "KG", price: 0, gstRate: 5 }]);
      setAutoFilledIds(new Set());
    }
  }, [selectedVendor, isLoaded]);

  // Initialize dates on mount to avoid hydration mismatch
  useEffect(() => {
    const today = new Date();
    setPurchaseDate(today.toISOString().split('T')[0]);
    
    const due = new Date();
    due.setDate(due.getDate() + 15);
    setDueDate(due.toISOString().split('T')[0]);
  }, []);

  // Save draft to localStorage whenever fields change (only when creating new PO)
  useEffect(() => {
    if (!isLoaded || editId) return;
    const draft = {
      poNumber,
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
  }, [poNumber, selectedVendor, items, purchaseType, warehouseId, expectedDeliveryDate, paymentTerms, internalNotes, vendorNotes, isLoaded, editId]);

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
    const rawSubtotal = items.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      return acc + roundMoney(q * p);
    }, 0);
    const subtotal = roundMoney(rawSubtotal);

    const parsedDiscount = Number(discountAmount);
    const validDiscount = (Number.isFinite(parsedDiscount) && parsedDiscount >= 0) 
      ? roundMoney(Math.min(parsedDiscount, subtotal)) 
      : 0;

    const parsedFreight = Number(freightCost);
    const validFreight = (Number.isFinite(parsedFreight) && parsedFreight >= 0)
      ? roundMoney(parsedFreight)
      : 0;

    const taxableAfterDiscount = roundMoney(Math.max(0, subtotal - validDiscount));
    const ratio = subtotal > 0 ? taxableAfterDiscount / subtotal : 1;

    const baseGst = items.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      const g = Number(item.gstRate) || 0;
      const lineGross = roundMoney(q * p);
      return acc + roundMoney(lineGross * (g / 100));
    }, 0);
    const totalGst = roundMoney(validDiscount > 0 ? baseGst * ratio : baseGst);
    
    // CGST/SGST vs IGST split
    const vendorState = (selectedVendor?.state || "").toLowerCase().trim();
    const isInterstate = Boolean(
      vendorState && 
      !vendorState.includes("tamil nadu") && 
      vendorState !== "tamil nadu"
    );
    
    const cgst = !isInterstate ? roundMoney(totalGst / 2) : 0;
    const sgst = !isInterstate ? roundMoney(totalGst - cgst) : 0;
    const igst = isInterstate ? totalGst : 0;
    
    const grandTotalBeforeRound = roundMoney(taxableAfterDiscount + totalGst + validFreight);
    const roundoff = roundMoney(Math.round(grandTotalBeforeRound) - grandTotalBeforeRound);
    const finalTotal = roundMoney(grandTotalBeforeRound + roundoff);

    let appliedAdvance = 0;
    if (useAdvance && selectedVendor && selectedVendor.advanceBalance > 0) {
      appliedAdvance = roundMoney(Math.min(selectedVendor.advanceBalance, finalTotal));
    }
    
    const balanceDue = roundMoney(Math.max(0, finalTotal - appliedAdvance));
    
    return {
      subtotal,
      taxableAfterDiscount,
      totalGst,
      cgst,
      sgst,
      igst,
      discountAmount: validDiscount,
      freightCost: validFreight,
      roundoff,
      total: finalTotal,
      appliedAdvance,
      balanceDue
    };
  }, [items, useAdvance, selectedVendor, discountAmount, freightCost]);

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!selectedVendor) {
      errs.push("Please select a vendor");
    } else if (selectedVendor.status && selectedVendor.status !== 'ACTIVE') {
      errs.push("This vendor is blocked and cannot be used for Purchase Orders.");
    }
    if (!expectedDeliveryDate) errs.push("Expected delivery date is mandatory");
    if (items.length === 0 || (items.length === 1 && !items[0].materialId && items[0].quantity === 0)) {
        errs.push("Please add at least one item");
    }
    if (items.some(i => i.quantity <= 0)) errs.push("One or more items have invalid quantity");
    if (items.some(i => i.price <= 0)) errs.push("One or more items have invalid price");

    const parsedDiscount = Number(discountAmount);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      errs.push("Discount must be a valid non-negative number.");
    } else if (parsedDiscount > totals.subtotal) {
      errs.push("Discount cannot exceed subtotal.");
    }

    const parsedFreight = Number(freightCost);
    if (!Number.isFinite(parsedFreight) || parsedFreight < 0) {
      errs.push("Freight must be a valid non-negative number.");
    }

    return errs;
  }, [selectedVendor, expectedDeliveryDate, items, discountAmount, freightCost, totals.subtotal]);

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
