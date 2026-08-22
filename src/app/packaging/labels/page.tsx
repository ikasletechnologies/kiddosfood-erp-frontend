"use client";

import { useState, useEffect } from "react";
import { X,
  Barcode, Printer, History, Search
} from "lucide-react";
import { clsx } from "clsx";
import { productionApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import Code128Barcode from "@/components/common/Code128Barcode";

interface PackagingRecord {
  id: string;
  packetSize: string;
  quantityPackets: number;
  totalWeight: number;
  barcode: string;
  createdAt: string;
  batch: {
    batchCode: string;
    expiryDate: string;
    product: {
      name: string;
      sku: string;
    };
  };
}

export default function LabelsBarcodesPage() {
  const [packagings, setPackagings] = useState<PackagingRecord[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<PackagingRecord | null>(null);

  useEffect(() => {
    async function initData() {
      try {
        const fRes = await franchiseApi.getAll();
        setFranchises(fRes.data || []);
        if (fRes.data?.length > 0) {
          setSelectedFranchiseId(fRes.data[0].id);
        }
      } catch (err) {
        toast.error("Failed to load franchises");
      }
    }
    initData();
  }, []);

  const loadRecords = async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    try {
      const res = await productionApi.getPackagings(selectedFranchiseId);
      setPackagings(res.data || []);
      if (res.data?.length > 0) {
        setSelectedRecord(res.data[0]);
      }
    } catch (err) {
      toast.error("Failed to load packaging history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedFranchiseId]);

  const handlePrintLabel = () => {
    window.print();
  };

  // Retail SKUs/product names carry the master product's own weight (e.g.
  // "Idly Batter 1 Kg" / "...-1-KG-1KG"), which reads as wrong once a
  // different retail pack size is printed next to it. Strip it for display
  // only — the underlying records are untouched.
  const stripEmbeddedWeight = (name: string): string =>
    name.replace(/\s+\d+(\.\d+)?\s*(kg|g|l|ml|pcs|units?)\.?$/i, '').trim() || name;

  const stripEmbeddedSizeSku = (sku: string): string => {
    const segments = sku.split('-');
    const isSizeSegment = (seg: string) =>
      /^\d+(\.\d+)?$/.test(seg) ||
      /^(KG|G|L|ML|PCS|UNITS?)$/i.test(seg) ||
      /^\d+(\.\d+)?(KG|G|L|ML|PCS|UNITS?)$/i.test(seg);
    while (segments.length > 1 && isSizeSegment(segments[segments.length - 1])) {
      segments.pop();
    }
    return segments.join('-') || sku;
  };

  const filteredRecords = packagings.filter(p =>
    p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.batch?.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 print:bg-white">

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Barcode className="h-5 w-5 text-[#f58220]" />
          Labels & Barcodes
        </h1>

        <select
          value={selectedFranchiseId}
          onChange={(e) => setSelectedFranchiseId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 outline-none focus:border-[#f58220]"
        >
          {franchises.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 print:p-0 print:max-w-none">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Packaging log list */}
          <div className="lg:col-span-2 print:hidden">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-[#f58220]" />
                  Packaging Run Logs
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search barcode or product..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                  />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><Printer className="h-8 w-8 text-orange-400 opacity-50 animate-pulse" /></div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">
                  No packaging logs found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                        <th className="text-left px-4 py-3">Product Details</th>
                        <th className="text-center px-4 py-3">Pack Size</th>
                        <th className="text-right px-4 py-3">Pack Qty</th>
                        <th className="text-left px-4 py-3">Barcode ID</th>
                        <th className="text-center px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRecords.map((rec) => {
                        const isSelected = selectedRecord?.id === rec.id;

                        return (
                          <tr
                            key={rec.id}
                            className={clsx("cursor-pointer transition-colors", isSelected ? "bg-orange-50" : "hover:bg-gray-50")}
                            onClick={() => setSelectedRecord(rec)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{rec.batch?.product?.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">Batch: {rec.batch?.batchCode}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border text-gray-600 bg-gray-50 border-gray-200">
                                {rec.packetSize}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {rec.quantityPackets} packs
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                              {rec.barcode}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRecord(rec);
                                  setTimeout(handlePrintLabel, 100);
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Column: Visual label previewer */}
          <div className="lg:col-span-1">
            {selectedRecord ? (
              <div className="space-y-5">

                {/* Label sheet visual mockup container */}
                <div id="print-label-sticker" className="bg-white text-slate-950 border-2 border-dashed border-gray-300 rounded-lg p-6 shadow-sm space-y-4 max-w-sm mx-auto print:border-none print:shadow-none print:p-0 print:m-0 print:space-y-2">
                  <div className="text-center border-b-2 border-gray-900 pb-3 print:pb-1.5">
                    <span className="text-[10px] print:text-[8px] font-black uppercase tracking-widest text-[#f58220]">Kiddos Food HQ</span>
                    <h4 className="text-sm print:text-[13px] font-black uppercase tracking-tight text-slate-900 mt-0.5 print:mt-px">
                      {stripEmbeddedWeight(selectedRecord.batch?.product?.name || "")}
                    </h4>
                    <div className="text-[10px] print:text-[9px] font-bold text-gray-500 uppercase mt-0.5 print:mt-px">
                      Pack Size: {selectedRecord.packetSize}
                    </div>
                  </div>

                  <div className="space-y-2 print:space-y-1 text-[10px] print:text-[9px] font-semibold text-slate-800">
                    <div className="flex justify-between">
                      <span className="uppercase text-gray-400">SKU Ref:</span>
                      <span className="font-mono">{stripEmbeddedSizeSku(selectedRecord.batch?.product?.sku || "")}-{selectedRecord.packetSize.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase text-gray-400">Batch Code:</span>
                      <span className="font-mono">{selectedRecord.batch?.batchCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase text-gray-400">Expiry Date:</span>
                      <span>{selectedRecord.batch?.expiryDate ? format(new Date(selectedRecord.batch.expiryDate), 'dd/MM/yyyy') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase text-gray-400">Intake Date:</span>
                      <span>{format(new Date(selectedRecord.createdAt), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>

                  {/* Real Code 128 (Subset B) barcode, rendered as SVG <rect>
                      bars derived from the encoded value — not a CSS
                      background, so it survives "Background graphics" off
                      in print/PDF, and it actually scans. */}
                  <div className="bg-gray-50 px-4 py-3 print:py-1.5 rounded-lg flex flex-col items-center gap-2 border border-gray-100 print:bg-white print:border-0 print:px-2">
                    <div className="w-full flex items-center justify-center bg-white">
                      <Code128Barcode value={selectedRecord.barcode} height={48} moduleWidth={1.6} className="h-16 print:h-[0.4in] max-w-full" />
                    </div>
                    <div className="text-[11px] print:text-[10px] font-mono tracking-widest font-black text-slate-800">
                      {selectedRecord.barcode}
                    </div>
                  </div>

                  <div className="text-center text-[8px] print:text-[7px] font-bold text-gray-400 uppercase tracking-widest">
                    Licensed Product of Kiddos Food LLP
                  </div>
                </div>

                {/* Action controller */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 print:hidden">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Labeling Actions</h4>

                  <button
                    onClick={handlePrintLabel}
                    className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print Sticker
                  </button>

                  <p className="text-xs text-gray-500 leading-relaxed">
                    Sticker is rendered to standard 4&quot; x 3&quot; thermal label dimensions.
                  </p>
                  <p className="text-xs text-amber-600 font-medium leading-relaxed">
                    In the print dialog: set Paper size to 4in x 3in (or your thermal printer), Margins to None, and turn OFF &quot;Headers and footers&quot; — otherwise the browser prints the page URL/date on the sticker.
                  </p>
                </div>

              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 rounded-lg text-center p-6 bg-white print:hidden">
                <Barcode className="h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">Select a record to preview compliance label</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Styled inline sheet print CSS rules */}
      <style jsx global>{`
        @media print {
          @page {
            size: 4in 3in;
            margin: 0;
          }
          html, body {
            width: 4in;
            height: 3in;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          #print-label-sticker, #print-label-sticker * {
            visibility: visible;
          }
          #print-label-sticker {
            position: absolute;
            left: 0;
            top: 0;
            width: 4in !important;
            height: 3in !important;
            max-width: none !important;
            border: none !important;
            padding: 0.12in !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>
    </div>
  );
}
