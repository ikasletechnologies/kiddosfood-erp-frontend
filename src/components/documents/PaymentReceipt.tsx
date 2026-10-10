"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, Download, Share2, X, Loader2, MessageCircle, Copy } from "lucide-react";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// Payment receipt document: Print (isolated print frame — only the receipt
// prints, never the page behind), Download (PDF) and Share (native share of
// the PDF, else WhatsApp/clipboard text). Built purely from the payment
// record passed in; never writes anything.

export interface ReceiptData {
  receiptNo: string;
  date: string;
  partyName: string;
  partyType?: string | null;
  amount: number;
  paymentMode?: string | null;
  status?: string | null;
  invoiceNums?: string[];
  reference?: string | null;
  accountName?: string | null;
  isCancelled?: boolean;
}

interface Props {
  receipt: ReceiptData;
  companyDetails: { name: string; address?: string; gstin?: string; phone?: string; email?: string };
  onClose: () => void;
  autoPrint?: boolean;
}

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (s?: string | null) => (s ? s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "—");

export function receiptShareText(r: ReceiptData, companyName: string): string {
  return [
    `Payment Receipt ${r.receiptNo} — ${companyName}`,
    `Date: ${formatDate(r.date)}`,
    `Received from: ${r.partyName}`,
    `Amount: ${inr(r.amount)}`,
    `Mode: ${label(r.paymentMode)}`,
    r.invoiceNums?.length ? `Against invoice: ${r.invoiceNums.join(", ")}` : null,
    r.reference ? `Reference: ${r.reference}` : null,
    `Status: ${r.isCancelled ? "Cancelled" : label(r.status)}`,
  ].filter(Boolean).join("\n");
}

export default function PaymentReceipt({ receipt, companyDetails, onClose, autoPrint }: Props) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  const fileName = `${receipt.receiptNo || "receipt"}.pdf`;
  const shareText = receiptShareText(receipt, companyDetails.name);

  const buildPdf = async (): Promise<Blob> => {
    if (!docRef.current) throw new Error("Receipt is not rendered yet.");
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const canvas = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = pdf.internal.pageSize.getWidth();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, (canvas.height * w) / canvas.width);
    return pdf.output("blob");
  };

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Prints only the receipt, from a throwaway iframe holding a copy of it.
  const handlePrint = () => {
    if (!docRef.current) { toast.error("Receipt is not ready to print yet."); return; }
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${receipt.receiptNo}</title>
      <style>@page{size:A4 portrait;margin:12mm}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111827}</style>
      </head><body>${docRef.current.outerHTML}</body></html>`);
    doc.close();
    const run = () => {
      try {
        frame.contentWindow!.focus();
        frame.contentWindow!.print();
      } catch {
        toast.error("Could not open the print dialog.");
      }
      setTimeout(() => frame.remove(), 1000);
    };
    // Wait for the logo so it isn't missing from the printout.
    const img = doc.querySelector("img");
    if (img && !(img as HTMLImageElement).complete) {
      img.addEventListener("load", run, { once: true });
      img.addEventListener("error", run, { once: true });
    } else run();
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      download(await buildPdf());
    } catch (e: any) {
      toast.error(`Could not generate the receipt PDF${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setBusy(null);
    }
  };

  // Native share of the PDF where the device supports file sharing; else of
  // the receipt text; else the explicit fallbacks below stay available.
  const handleShare = async () => {
    setBusy("share");
    const nav = navigator as any;
    try {
      const blob = await buildPdf();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `Payment Receipt ${receipt.receiptNo}`, text: shareText });
        toast.success("Receipt shared");
      } else if (nav.share) {
        await nav.share({ title: `Payment Receipt ${receipt.receiptNo}`, text: shareText });
        toast.success("Receipt shared");
      } else {
        download(blob);
        toast("This browser can't share files directly — the receipt PDF was downloaded. Use WhatsApp or Copy below to send it.", { icon: "ℹ️" });
      }
    } catch (e: any) {
      if (e?.name === "AbortError") toast("Sharing cancelled", { icon: "ℹ️" });
      else toast.error(`Could not share the receipt${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Receipt details copied");
    } catch {
      toast.error("Copy isn't available here (the page must be served over HTTPS). Use WhatsApp or Download instead.");
    }
  };

  useEffect(() => {
    if (!mounted || !autoPrint) return;
    const t = setTimeout(handlePrint, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, autoPrint]);

  if (!mounted) return null;

  const row = (k: string, v: React.ReactNode) => (
    <tr>
      <td style={{ padding: "8px 0", color: "#6b7280", width: "40%", borderBottom: "1px solid #f3f4f6" }}>{k}</td>
      <td style={{ padding: "8px 0", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}>{v}</td>
    </tr>
  );
  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold shadow transition-colors disabled:opacity-60";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 p-2 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[210mm] my-14 sm:my-12 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={handlePrint} className={`${btn} bg-[#F97316] text-white hover:bg-orange-600`}><Printer size={15} /> Print</button>
          <button onClick={handleDownload} disabled={busy !== null} className={`${btn} bg-white text-gray-700 hover:bg-gray-50`}>
            {busy === "download" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
          </button>
          <button onClick={handleShare} disabled={busy !== null} className={`${btn} bg-white text-gray-700 hover:bg-gray-50`}>
            {busy === "share" ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} Share
          </button>
          <button onClick={handleWhatsApp} className={`${btn} bg-white text-gray-700 hover:bg-gray-50`}><MessageCircle size={15} /> WhatsApp</button>
          <button onClick={handleCopy} className={`${btn} bg-white text-gray-700 hover:bg-gray-50`}><Copy size={15} /> Copy</button>
          <button onClick={onClose} className={`${btn} bg-white text-gray-700 hover:bg-gray-50`}><X size={15} /> Close</button>
        </div>

        {/* The receipt itself — inline styles so the print frame renders it identically. */}
        <div ref={docRef} style={{ background: "#ffffff", color: "#111827", padding: "40px", fontSize: "13px", lineHeight: 1.4, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
            <div>
              <div style={{ fontSize: "26px", fontWeight: 700, color: "#F97316" }}>Payment Receipt</div>
              <div style={{ marginTop: "6px", color: "#6b7280" }}>Receipt No. <b style={{ color: "#111827" }}>{receipt.receiptNo}</b></div>
              <div style={{ color: "#6b7280" }}>Date <b style={{ color: "#111827" }}>{formatDate(receipt.date)}</b></div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${typeof window !== "undefined" ? window.location.origin : ""}/logo.png`} alt="" style={{ height: "48px", maxWidth: "160px", objectFit: "contain" }} />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>{companyDetails.name}</div>
            {companyDetails.address && <div style={{ color: "#4b5563", maxWidth: "320px" }}>{companyDetails.address}</div>}
            {companyDetails.gstin && <div style={{ color: "#4b5563" }}>GSTIN: {companyDetails.gstin}</div>}
            {(companyDetails.phone || companyDetails.email) && <div style={{ color: "#4b5563" }}>{[companyDetails.phone, companyDetails.email].filter(Boolean).join(" · ")}</div>}
          </div>

          {receipt.isCancelled && (
            <div style={{ border: "2px solid #dc2626", color: "#dc2626", fontWeight: 700, textAlign: "center", padding: "6px", marginBottom: "16px" }}>CANCELLED RECEIPT</div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {row(`Received from${receipt.partyType ? ` (${label(receipt.partyType)})` : ""}`, receipt.partyName)}
              {row("Amount", <span style={{ fontSize: "16px" }}>{inr(receipt.amount)}</span>)}
              {row("Payment Mode", label(receipt.paymentMode))}
              {receipt.accountName && receipt.accountName !== "Unknown" && row("Deposited To", receipt.accountName)}
              {row("Status", receipt.isCancelled ? "Cancelled" : label(receipt.status))}
              {receipt.invoiceNums && receipt.invoiceNums.length > 0 && row(receipt.invoiceNums.length > 1 ? "Against Invoices" : "Against Invoice", receipt.invoiceNums.join(", "))}
              {receipt.reference && row("Reference / Remarks", receipt.reference)}
            </tbody>
          </table>

          <div style={{ marginTop: "48px", color: "#9ca3af", fontSize: "11px" }}>
            This is a computer generated receipt and does not require a signature.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
