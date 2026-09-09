"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, QrCode, Download, Share2, Loader2 } from 'lucide-react';
import { formatDate, calculateSalesDocumentTotals } from '@/lib/utils';

// The one shared visual template for every billing/order document in the
// app — a document TYPE only changes its heading, "#" field label, and
// whether/what a "due date" means; the layout, GST math, bank details,
// terms, and footer stay identical everywhere so every PDF in the system
// looks like it came from the same system.
export type GSTDocumentType =
  | "TAX_INVOICE"
  | "PURCHASE_ORDER"
  | "DELIVERY_CHALLAN"
  | "QUOTATION"
  | "PROFORMA_INVOICE"
  | "SALES_ORDER"
  | "SALES_RETURN"
  | "PURCHASE_INVOICE"
  | "DEBIT_NOTE"
  | "GRN"
  | "PAYOUT_RECEIPT"
  | "FRANCHISE_ORDER";

const DOCUMENT_LABELS: Record<GSTDocumentType, { title: string; numberLabel: string; dueDateLabel: string | null }> = {
  TAX_INVOICE: { title: "Invoice", numberLabel: "Invoice#", dueDateLabel: "Due Date" },
  PURCHASE_ORDER: { title: "Purchase Order", numberLabel: "PO#", dueDateLabel: "Expected Delivery" },
  DELIVERY_CHALLAN: { title: "Delivery Challan", numberLabel: "DC#", dueDateLabel: "Delivery Date" },
  QUOTATION: { title: "Quotation", numberLabel: "Quotation#", dueDateLabel: "Valid Until" },
  PROFORMA_INVOICE: { title: "Proforma Invoice", numberLabel: "Proforma#", dueDateLabel: "Valid Until" },
  SALES_ORDER: { title: "Sales Order", numberLabel: "SO#", dueDateLabel: "Due Date" },
  SALES_RETURN: { title: "Sales Return", numberLabel: "Return#", dueDateLabel: null },
  PURCHASE_INVOICE: { title: "Purchase Bill", numberLabel: "Bill#", dueDateLabel: "Due Date" },
  DEBIT_NOTE: { title: "Debit Note", numberLabel: "DN#", dueDateLabel: null },
  GRN: { title: "Goods Receipt Note", numberLabel: "GRN#", dueDateLabel: null },
  PAYOUT_RECEIPT: { title: "Payout Receipt", numberLabel: "Receipt#", dueDateLabel: null },
  FRANCHISE_ORDER: { title: "Franchise Order", numberLabel: "Order#", dueDateLabel: "Expected Dispatch" },
};

interface GSTInvoiceProps {
  order: any;
  vendor: any;
  companyDetails: {
    name: string;
    address: string;
    gstin: string;
    state: string;
    email: string;
    phone: string;
  };
  onClose: () => void;
  // Defaults to TAX_INVOICE (the original, pre-existing behavior) so every
  // call site that predates this prop keeps rendering exactly as before.
  documentType?: GSTDocumentType;
  // Overrides the derived due date's number of days out (default 15,
  // matching the original hardcoded behavior) — irrelevant when the
  // document type has no due-date concept (dueDateLabel is null).
  dueDateDays?: number;
  // Optional overrides — default to the original hardcoded copy below so
  // every pre-existing call site renders byte-identical unless it opts in.
  terms?: string[];
  notes?: string;
  // Auto-fires Print, Download or Share once the document has painted, for
  // a row action that wants "print/download/share this document" without a
  // second click inside the modal. The modal still stays open afterward so
  // the buttons remain available (and so a failed auto-share, or a
  // dismissed print dialog, has a visible retry point).
  autoAction?: 'print' | 'download' | 'share';
}

// Basic number to words converter for INR
function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = Math.floor(num)) === 0) return 'Zero';

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str != '') ? 'And ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) : '';
  
  return str.trim();
}

export default function GSTInvoice({ order, vendor, companyDetails, onClose, documentType = "TAX_INVOICE", dueDateDays = 15, terms, notes, autoAction }: GSTInvoiceProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const docRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState<'download' | 'share' | null>(null);

  const { title: docTitle, numberLabel, dueDateLabel } = DOCUMENT_LABELS[documentType];

  const safe = (val: any) => Number(val) || 0;
  const items = (order.poItems || order.items || []) as any[];
  const round = (n: number) => Math.round(n * 100) / 100;
  const fmt = (n: number) =>
    safe(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const companyState = (companyDetails?.state || "").toLowerCase().trim();
  const vendorState = (vendor?.state || "").toLowerCase().trim();
  // GST place-of-supply (order.stateOfSupply) is the field the law actually
  // keys CGST+SGST vs IGST on — it can legitimately differ from the
  // counterparty's master-record address that `vendor` carries (a Customer's
  // registered state, a Vendor's, or nothing at all). When the caller
  // supplies it, it wins over the vendor-address heuristic below, which
  // stays as-is for callers that don't pass it (e.g. purchase-side
  // documents, where "vendor" genuinely is the state of supply).
  const stateOfSupply = (order?.stateOfSupply || "").toLowerCase().trim();
  const isSameState =
    stateOfSupply && companyState
      ? companyState === stateOfSupply
      : !companyState || !vendorState
        ? true
        : vendorState.includes(companyState) || companyState.includes(vendorState);

  const calcResult = calculateSalesDocumentTotals(
    items,
    order.priceMode || "without_tax",
    order.roundOffEnabled ?? true,
    safe(order.discount ?? order.discountAmount ?? 0)
  );

  const grossSubtotal = round(calcResult.computedItems.reduce((s: number, it: any) => s + it.grossAmount, 0));
  const discount = round(calcResult.totalDiscount) || safe(order.discount ?? order.discountAmount ?? 0);
  const taxableSubtotal = round(calcResult.subTotal);
  const freightCost = safe(order.freightCost ?? order.shippingAmount ?? order.shipping ?? order.freight ?? 0);

  const taxBreakdown = calcResult.computedItems.reduce(
    (acc: any, it: any) => {
      const tax = it.taxAmount;
      if (isSameState) {
        const cgstShare = round(tax / 2);
        acc.cgst += cgstShare;
        acc.sgst += round(tax - cgstShare);
      } else {
        acc.igst += tax;
      }
      return acc;
    },
    { cgst: 0, sgst: 0, igst: 0 }
  );

  const finalCgst = round(taxBreakdown.cgst);
  const finalSgst = round(taxBreakdown.sgst);
  const finalIgst = round(taxBreakdown.igst);

  const totalTax = round(finalCgst + finalSgst + finalIgst);
  const roundOff = calcResult.roundOff;
  const grandTotal = round(calcResult.finalTotal + freightCost);

  const invoiceNo =
    order.poNumber ||
    `INV-${new Date().getFullYear()}-${order.id?.slice(-4).toUpperCase() || '0001'}`;
    
  const invoiceDate = new Date(order.createdAt || Date.now());
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + dueDateDays);

  const fmtDate = (d: Date) => formatDate(d);

  const hasUnitData = items.some((it: any) => it.unit);
  const hasDiscountColumn = items.some((it: any) => safe(it.discountAmount) > 0 || safe(it.discountPct) > 0 || safe(it.discount) > 0);
  const defaultTerms = [
    "Please pay within 15 days from the date of invoice. Overdue interest @ 14% will be charged on delayed payments.",
    "Please quote invoice number when remitting funds.",
  ];
  const termsToShow = terms && terms.length > 0 ? terms : defaultTerms;
  const defaultNotes = "Goods once sold will not be taken back. This is a computer generated invoice and does not require physical signature. All disputes are subject to the local jurisdiction only. E. & O.E.";
  const notesToShow = notes && notes.trim() ? notes : defaultNotes;

  // One shared PDF source for Print (browser print dialog), Download (file
  // save), and Share (native share sheet) — all three snapshot the exact
  // same rendered A4 document node, so the content can never drift between
  // the three actions.
  const buildPdfBlob = async (): Promise<Blob | null> => {
    if (!docRef.current) return null;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    return pdf.output('blob');
  };

  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNo}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    setGenerating('download');
    try {
      const blob = await buildPdfBlob();
      if (blob) triggerDownload(blob);
    } catch (e) {
      console.error('PDF download failed', e);
    } finally {
      setGenerating(null);
    }
  };

  const handleShare = async () => {
    setGenerating('share');
    try {
      const blob = await buildPdfBlob();
      if (!blob) return;
      const file = new File([blob], `${invoiceNo}.pdf`, { type: 'application/pdf' });
      const nav = navigator as any;
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: `${docTitle} ${invoiceNo}` });
      } else {
        // No native file-share support on this browser/device — fall back
        // to a plain download rather than breaking the page.
        triggerDownload(blob);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('PDF share failed', e);
    } finally {
      setGenerating(null);
    }
  };

  useEffect(() => {
    if (!mounted || !autoAction) return;
    // Let the DOM (and the logo image) finish painting before snapshotting/printing.
    const t = setTimeout(() => {
      if (autoAction === 'print') window.print();
      else if (autoAction === 'download') handleDownload();
      else handleShare();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, autoAction]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 p-2 sm:p-4 md:p-8 overflow-y-auto print:p-0 print:bg-white">
      {/* Action Bar */}
      <div className="fixed top-2 sm:top-4 right-2 sm:right-6 left-2 sm:left-auto flex flex-wrap sm:flex-nowrap justify-end items-center gap-1.5 sm:gap-2 print:hidden z-[110]">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 sm:gap-2 bg-[#F97316] text-white px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow hover:bg-orange-600 transition-colors"
        >
          <Printer size={15} /> <span>Print {docTitle}</span>
        </button>
        <button
          onClick={handleDownload}
          disabled={generating !== null}
          className="flex items-center gap-1.5 sm:gap-2 bg-white text-gray-700 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {generating === 'download' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} <span>Download</span>
        </button>
        <button
          onClick={handleShare}
          disabled={generating !== null}
          className="flex items-center gap-1.5 sm:gap-2 bg-white text-gray-700 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {generating === 'share' ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} <span>Share</span>
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 sm:gap-2 bg-white text-gray-700 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow hover:bg-gray-50 transition-colors"
        >
          <X size={15} /> <span>Close</span>
        </button>
      </div>

      {/* Invoice Document (A4 format) */}
      <div className="w-full max-w-[210mm] my-12 sm:my-10 print:my-0 overflow-x-auto custom-scrollbar">
        <div ref={docRef} className="w-full min-w-[640px] md:min-w-0 min-h-[297mm] bg-white text-gray-800 shadow-2xl print:shadow-none p-6 sm:p-10 md:p-14 relative">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#F97316] mb-8">{docTitle}</h1>
            <table className="text-xs border-separate border-spacing-y-2">
              <tbody>
                <tr>
                  <td className="text-gray-500 w-24">{numberLabel}</td>
                  <td className="font-semibold text-gray-900">{invoiceNo}</td>
                </tr>
                {order.sourceSalesOrderNumber && (
                  <tr>
                    <td className="text-gray-500">Source Sales Order</td>
                    <td className="font-semibold text-gray-900">{order.sourceSalesOrderNumber}</td>
                  </tr>
                )}
                <tr>
                  <td className="text-gray-500">{docTitle} Date</td>
                  <td className="font-semibold text-gray-900">{fmtDate(invoiceDate)}</td>
                </tr>
                {dueDateLabel && (
                  <tr>
                    <td className="text-gray-500">{dueDateLabel}</td>
                    <td className="font-semibold text-gray-900">{fmtDate(dueDate)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-right flex items-center justify-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kiddos Food Logo" className="h-12 w-auto max-w-[160px] object-contain object-right" />
          </div>
        </div>

        {/* Billed By / Billed To */}
        <div className="flex gap-4 mb-3">
          <div className="flex-1 bg-[#f8f9fa] p-6 rounded-xl">
            <h3 className="text-[#F97316] font-semibold text-lg mb-2">Billed by</h3>
            <p className="font-bold text-gray-900 text-sm mb-1">{companyDetails.name}</p>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed max-w-[200px]">
              {companyDetails.address}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-900">GSTIN</span>
              <span className="text-gray-600 font-mono">{companyDetails.gstin}</span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="font-bold text-gray-900">PAN</span>
              <span className="text-gray-600 font-mono">ABCDE1234F</span>
            </div>
          </div>
          
          <div className="flex-1 bg-[#f8f9fa] p-6 rounded-xl">
            <h3 className="text-[#F97316] font-semibold text-lg mb-2">Billed to</h3>
            <p className="font-bold text-gray-900 text-sm mb-1">{vendor?.name || order.customerName || order.customer?.name || order.franchise?.name || 'Customer'}</p>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed max-w-[200px]">
              {vendor?.address || vendor?.location || order.franchise?.location || order.customer?.address || 'No address provided'}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-900">GSTIN</span>
              <span className="text-gray-600 font-mono">{vendor?.gstin || vendor?.gstNumber || order.franchise?.gstin || order.customer?.gstNumber || '-'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="font-bold text-gray-900">PAN</span>
              <span className="text-gray-600 font-mono">{vendor?.pan || order.customer?.pan || '-'}</span>
            </div>
            {(vendor?.phone || vendor?.contact || order.customer?.phone || order.customer?.contact || order.franchise?.contactNum) && (
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="font-bold text-gray-900">Phone</span>
                <span className="text-gray-600 font-mono">{vendor?.phone || vendor?.contact || order.customer?.phone || order.customer?.contact || order.franchise?.contactNum}</span>
              </div>
            )}
          </div>
        </div>



        {/* Items Table */}
        <table className="w-full text-xs mb-10 border-collapse">
          <thead>
            <tr className="bg-[#F97316] text-white">
              <th className="py-3 px-2 text-center font-medium rounded-tl-lg w-8">#</th>
              <th className="py-3 px-3 text-left font-medium">Item Description</th>
              <th className="py-3 px-2 text-center font-medium">HSN</th>
              <th className="py-3 px-2 text-right font-medium">Qty.</th>
              {hasUnitData && <th className="py-3 px-2 text-center font-medium">UOM</th>}
              <th className="py-3 px-2 text-right font-medium">Price/Unit</th>
              {hasDiscountColumn && <th className="py-3 px-2 text-right font-medium">Discount</th>}
              <th className="py-3 px-3 text-right font-medium">Taxable Amount</th>
              {isSameState ? (
                <>
                  <th className="py-3 px-3 text-right font-medium">CGST</th>
                  <th className="py-3 px-3 text-right font-medium">SGST</th>
                </>
              ) : (
                <th className="py-3 px-3 text-right font-medium">IGST</th>
              )}
              <th className="py-3 px-3 text-right font-medium rounded-tr-lg">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const comp = calcResult.computedItems[idx] || {};
              const itemName = item.itemName || item.productName || item.name || item.inventoryItem?.name || `Item #${idx + 1}`;
              const qty = safe(item.quantity ?? item.qty);
              const price = safe(item.price ?? item.rate);
              const discAmt = comp.discountAmount ?? 0;
              const taxable = comp.taxableAmount ?? 0;
              const gstRate = safe(item.gstRate ?? item.taxPct ?? item.taxPercent);
              const tax = comp.taxAmount ?? 0;
              const rowTotal = comp.lineTotal ?? 0;

              const cgstRate = round(gstRate / 2);
              const sgstRate = round(gstRate / 2);
              const cgstAmt = round(tax / 2);
              const sgstAmt = round(tax - cgstAmt);

              return (
                <tr key={idx} className="bg-gray-50/50 border-b-4 border-white">
                  <td className="py-3 px-2 text-center text-gray-500 font-medium whitespace-nowrap">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 text-gray-900 font-medium">
                    {itemName}
                  </td>
                  <td className="py-3 px-2 text-center text-gray-600 font-mono text-[11px] truncate max-w-[65px]" title={item.hsnCode || '—'}>
                    {item.hsnCode || '—'}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600 whitespace-nowrap">
                    {qty}
                  </td>
                  {hasUnitData && (
                    <td className="py-3 px-2 text-center text-gray-600 whitespace-nowrap">
                      {item.unit || '—'}
                    </td>
                  )}
                  <td className="py-3 px-2 text-right text-gray-600 whitespace-nowrap">
                    ₹ {fmt(price)}
                  </td>
                  {hasDiscountColumn && (
                    <td className="py-3 px-2 text-right text-gray-600 whitespace-nowrap">
                      {discAmt > 0 ? `₹ ${fmt(discAmt)}` : '—'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right text-gray-600 whitespace-nowrap">
                    ₹ {fmt(taxable)}
                  </td>
                  {isSameState ? (
                    <>
                      <td className="py-3 px-3 text-right text-gray-600 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">₹ {fmt(cgstAmt)}</div>
                        <div className="text-[10px] text-gray-500 font-mono">({cgstRate}%)</div>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">₹ {fmt(sgstAmt)}</div>
                        <div className="text-[10px] text-gray-500 font-mono">({sgstRate}%)</div>
                      </td>
                    </>
                  ) : (
                    <td className="py-3 px-3 text-right text-gray-600 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">₹ {fmt(tax)}</div>
                      <div className="text-[10px] text-gray-500 font-mono">({gstRate}%)</div>
                    </td>
                  )}
                  <td className="py-3 px-3 text-right text-gray-900 font-medium whitespace-nowrap">
                    ₹ {fmt(rowTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Lower Section */}
        <div className="flex gap-8">
          
          {/* Left: Bank & Terms */}
          <div className="flex-1">


            <div>
              <h3 className="text-[#F97316] font-semibold text-base mb-2">Terms and Conditions</h3>
              <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1.5 leading-relaxed">
                {termsToShow.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>

            <div className="mt-6">
              <h3 className="text-[#F97316] font-semibold text-base mb-2">Additional Notes</h3>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {notesToShow}
              </p>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="w-[300px] shrink-0 pt-1">
            <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-600">Sub Total</span>
              <span className="font-semibold text-gray-900">₹{fmt(discount > 0 ? grossSubtotal : taxableSubtotal)}</span>
            </div>
            {discount > 0 && (
              <>
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-emerald-500">Discount</span>
                  <span className="font-semibold text-emerald-500">- ₹{fmt(discount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">Taxable Amount</span>
                  <span className="font-semibold text-gray-900">₹{fmt(taxableSubtotal)}</span>
                </div>
              </>
            )}
            {freightCost > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-600">Freight / Shipment</span>
                <span className="font-semibold text-gray-900">+ ₹{fmt(freightCost)}</span>
              </div>
            )}
            {isSameState ? (
              <>
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">CGST</span>
                  <span className="font-semibold text-gray-900">₹{fmt(finalCgst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">SGST</span>
                  <span className="font-semibold text-gray-900">₹{fmt(finalSgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-600">IGST</span>
                <span className="font-semibold text-gray-900">₹{fmt(finalIgst)}</span>
              </div>
            )}
            {roundOff !== 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-600">Round Off</span>
                <span className="font-semibold text-gray-900">{roundOff >= 0 ? "+" : "-"} ₹{fmt(Math.abs(roundOff))}</span>
              </div>
            )}
            
            <div className="flex justify-between py-4 border-b-2 border-gray-100 mt-2">
              <span className="text-xl font-medium text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">₹{fmt(grandTotal)}</span>
            </div>

            <div className="py-4 border-b border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">{docTitle} Total (in words)</p>
              <p className="font-semibold text-gray-800 text-sm leading-snug">
                {numberToWords(grandTotal)} Rupees Only
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-10 left-10 right-10 pt-4 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium">
            For any enquiries, email us on <span className="font-bold text-gray-800">{companyDetails.email || "support@kiddosfood.com"}</span> or call us on <span className="font-bold text-gray-800">{companyDetails.phone || "+91 98765 43210"}</span>
          </p>
        </div>

      </div>
      </div>
    </div>,
    document.body
  );
}
