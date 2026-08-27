"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, QrCode } from 'lucide-react';

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

export default function GSTInvoice({ order, vendor, companyDetails, onClose }: GSTInvoiceProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const safe = (val: any) => Number(val) || 0;
  const items = (order.poItems || order.items || []) as any[];
  const round = (n: number) => Math.round(n * 100) / 100;
  const fmt = (n: number) =>
    safe(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const companyState = (companyDetails?.state || "").toLowerCase().trim();
  const vendorState = (vendor?.state || "").toLowerCase().trim();
  const isSameState =
    !companyState || !vendorState
      ? true
      : vendorState.includes(companyState) || companyState.includes(vendorState);

  const taxableSubtotal = items.reduce((s: number, it: any) => s + safe(it.quantity) * safe(it.price), 0);
  const discount = safe(order.discount ?? order.discountAmount ?? 0);
  const freightCost = safe(order.freightCost ?? order.shippingAmount ?? order.shipping ?? order.freight ?? 0);
  const taxableAfterDiscount = Math.max(0, taxableSubtotal - discount);

  const taxBreakdown = items.reduce(
    (acc: any, it: any) => {
      // Assuming discount is proportional, but for simple invoice we calculate tax on base price
      const amt = safe(it.quantity) * safe(it.price);
      const tax = amt * (safe(it.gstRate) / 100);
      if (isSameState) {
        acc.cgst += round(tax / 2);
        acc.sgst += round(tax / 2);
      } else {
        acc.igst += round(tax);
      }
      return acc;
    },
    { cgst: 0, sgst: 0, igst: 0 }
  );

  // Re-adjust tax if there was an order-level discount
  let finalCgst = taxBreakdown.cgst;
  let finalSgst = taxBreakdown.sgst;
  let finalIgst = taxBreakdown.igst;
  
  if (discount > 0 && taxableSubtotal > 0) {
    const ratio = taxableAfterDiscount / taxableSubtotal;
    finalCgst = round(finalCgst * ratio);
    finalSgst = round(finalSgst * ratio);
    finalIgst = round(finalIgst * ratio);
  }

  const totalTax = round(finalCgst + finalSgst + finalIgst);
  const grandTotal = round(taxableAfterDiscount + totalTax + freightCost);

  const invoiceNo =
    order.poNumber ||
    `INV-${new Date().getFullYear()}-${order.id?.slice(-4).toUpperCase() || '0001'}`;
    
  const invoiceDate = new Date(order.createdAt || Date.now());
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 15); // 15 days due

  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 p-4 md:p-8 overflow-y-auto print:p-0 print:bg-white">
      {/* Action Bar */}
      <div className="fixed top-4 right-6 flex gap-2 print:hidden z-[110]">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#F97316] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-orange-600 transition-colors"
        >
          <Printer size={16} /> Print Invoice
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-gray-50 transition-colors"
        >
          <X size={16} /> Close
        </button>
      </div>

      {/* Invoice Document (A4 format) */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-gray-800 shadow-2xl my-10 print:my-0 print:shadow-none p-10 md:p-14 relative">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#F97316] mb-8">Invoice</h1>
            <table className="text-xs border-separate border-spacing-y-2">
              <tbody>
                <tr>
                  <td className="text-gray-500 w-24">Invoice#</td>
                  <td className="font-semibold text-gray-900">{invoiceNo}</td>
                </tr>
                <tr>
                  <td className="text-gray-500">Invoice Date</td>
                  <td className="font-semibold text-gray-900">{fmtDate(invoiceDate)}</td>
                </tr>
                <tr>
                  <td className="text-gray-500">Due Date</td>
                  <td className="font-semibold text-gray-900">{fmtDate(dueDate)}</td>
                </tr>
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
            <p className="font-bold text-gray-900 text-sm mb-1">{vendor?.name || 'Customer'}</p>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed max-w-[200px]">
              {vendor?.address || 'No address provided'}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-gray-900">GSTIN</span>
              <span className="text-gray-600 font-mono">{vendor?.gstin || '-'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="font-bold text-gray-900">PAN</span>
              <span className="text-gray-600 font-mono">{vendor?.pan || '-'}</span>
            </div>
          </div>
        </div>

        {/* Place of Supply */}
        <div className="flex justify-between px-6 text-xs mb-8 text-gray-500">
          <div>
            Place of Supply <span className="font-bold text-gray-900 ml-2">{vendorState || companyDetails.state || "Karnataka"}</span>
          </div>
          <div>
            Country of Supply <span className="font-bold text-gray-900 ml-2">India</span>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-xs mb-10 border-collapse">
          <thead>
            <tr className="bg-[#F97316] text-white">
              <th className="py-3 px-4 text-left font-medium rounded-tl-lg w-1/3">Item #/Item description</th>
              <th className="py-3 px-2 text-center font-medium">HSN</th>
              <th className="py-3 px-2 text-right font-medium">Qty.</th>
              <th className="py-3 px-2 text-right font-medium">GST</th>
              <th className="py-3 px-4 text-right font-medium">Taxable Amount</th>
              <th className="py-3 px-4 text-right font-medium">
                {isSameState ? 'CGST+SGST' : 'IGST'}
              </th>
              <th className="py-3 px-4 text-right font-medium rounded-tr-lg">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const itemName = item.itemName || item.inventoryItem?.name || `Product / Material #${idx + 1}`;
              const qty = safe(item.quantity);
              const price = safe(item.price);
              const taxable = qty * price;
              const tax = taxable * (safe(item.gstRate) / 100);
              
              return (
                <tr key={idx} className="bg-gray-50/50 border-b-4 border-white">
                  <td className="py-3 px-4 text-gray-900 font-medium">
                    {idx + 1}. {itemName}
                  </td>
                  <td className="py-3 px-2 text-center text-gray-600 font-mono text-[11px] truncate max-w-[70px]" title={item.hsnCode || '—'}>{item.hsnCode || '—'}</td>
                  <td className="py-3 px-2 text-right text-gray-600">{qty}</td>
                  <td className="py-3 px-2 text-right text-gray-600">{safe(item.gstRate)}%</td>
                  <td className="py-3 px-4 text-right text-gray-600">₹ {fmt(taxable)}</td>
                  <td className="py-3 px-4 text-right text-gray-600">₹ {fmt(tax)}</td>
                  <td className="py-3 px-4 text-right text-gray-900 font-medium">₹ {fmt(taxable + tax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Lower Section */}
        <div className="flex gap-8">
          
          {/* Left: Bank & Terms */}
          <div className="flex-1">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[#F97316] font-semibold text-base mb-3">Bank & Payment Details</h3>
                <table className="text-xs border-separate border-spacing-y-1.5">
                  <tbody>
                    <tr><td className="text-gray-500 w-32">Account Holder Name</td><td className="text-gray-900 font-medium">{companyDetails.name}</td></tr>
                    <tr><td className="text-gray-500">Account Number</td><td className="text-gray-900 font-medium font-mono">45366287987</td></tr>
                    <tr><td className="text-gray-500">IFSC</td><td className="text-gray-900 font-medium font-mono">HDFC0018159</td></tr>
                    <tr><td className="text-gray-500">Account Type</td><td className="text-gray-900 font-medium">Savings</td></tr>
                    <tr><td className="text-gray-500">Bank</td><td className="text-gray-900 font-medium">HDFC Bank</td></tr>
                    <tr><td className="text-gray-500">UPI</td><td className="text-gray-900 font-medium">payment@hdfc</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400">UPI - Scan to Pay</span>
                <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded">
                  <QrCode size={80} className="text-gray-900" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[#F97316] font-semibold text-base mb-2">Terms and Conditions</h3>
              <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1.5 leading-relaxed">
                <li>Please pay within 15 days from the date of invoice. Overdue interest @ 14% will be charged on delayed payments.</li>
                <li>Please quote invoice number when remitting funds.</li>
              </ol>
            </div>

            <div className="mt-6">
              <h3 className="text-[#F97316] font-semibold text-base mb-2">Additional Notes</h3>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Goods once sold will not be taken back. This is a computer generated invoice and does not require physical signature. 
                All disputes are subject to the local jurisdiction only. E. & O.E.
              </p>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="w-[300px] shrink-0 pt-1">
            <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-600">Sub Total</span>
              <span className="font-semibold text-gray-900">₹{fmt(taxableSubtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                <span className="text-emerald-500">Discount</span>
                <span className="font-semibold text-emerald-500">- ₹{fmt(discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-600">Taxable Amount</span>
              <span className="font-semibold text-gray-900">₹{fmt(taxableAfterDiscount)}</span>
            </div>
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
            {freightCost > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-600">Freight / Shipping</span>
                <span className="font-semibold text-gray-900">+ ₹{fmt(freightCost)}</span>
              </div>
            )}
            
            <div className="flex justify-between py-4 border-b-2 border-gray-100 mt-2">
              <span className="text-xl font-medium text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">₹{fmt(grandTotal)}</span>
            </div>

            <div className="py-4 border-b border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">Invoice Total (in words)</p>
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
    </div>,
    document.body
  );
}
