"use client";

import React, { useState, useEffect } from "react";
import { 
  FileTextIcon, PrinterIcon, ChevronDownIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

export default function GSTR9Report() {
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState("2025-2026");
  const [considerNonTax, setConsiderNonTax] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await reportsApi.getGSTR9({ financialYear });
        setReportData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [financialYear]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    const rows = [
      ["Field", "Value"],
      ["Financial Year", reportData?.basicDetails?.financialYear || financialYear],
      ["GSTIN", reportData?.basicDetails?.gstin || ""],
      ["Legal Name", reportData?.basicDetails?.legalName || "My Company"],
      ["Trade Name", reportData?.basicDetails?.tradeName || ""],
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `GSTR9_${financialYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Top Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700">
              Financial Year {financialYear} <ChevronDownIcon size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer mt-4 md:mt-0">
            <input 
              type="checkbox" 
              checked={considerNonTax}
              onChange={(e) => setConsiderNonTax(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">CONSIDER NON-TAX AS EXEMPTED</span>
          </label>
          <div className="flex items-center gap-2.5">
            <button onClick={handleExportCSV} className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 transition-colors">
              <FileTextIcon size={16} />
            </button>
            <button onClick={handlePrint} className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-full border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors">
              <PrinterIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">GSTR9 REPORT</h3>
        </div>

        <div className="overflow-x-auto flex-1 p-6 space-y-12">
          
          {/* Pt I */}
          <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800">
            <thead>
              <tr className="bg-slate-300/40 dark:bg-slate-800">
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 w-16 border-r border-slate-200 dark:border-slate-800 text-center">Pt. I</th>
                <th colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 text-center">Basic Details</th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">1</td>
                <td className="px-4 py-3 w-1/3 border-r border-slate-200 dark:border-slate-800">Financial Year</td>
                <td className="px-4 py-3">{reportData?.basicDetails?.financialYear || "2025-2026"}</td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">2</td>
                <td className="px-4 py-3 w-1/3 border-r border-slate-200 dark:border-slate-800">GSTIN</td>
                <td className="px-4 py-3">{reportData?.basicDetails?.gstin || ""}</td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">3A</td>
                <td className="px-4 py-3 w-1/3 border-r border-slate-200 dark:border-slate-800">Legal Name</td>
                <td className="px-4 py-3">{reportData?.basicDetails?.legalName || "My Company"}</td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">3B</td>
                <td className="px-4 py-3 w-1/3 border-r border-slate-200 dark:border-slate-800">Trade Name (if any)</td>
                <td className="px-4 py-3">{reportData?.basicDetails?.tradeName || ""}</td>
              </tr>
            </tbody>
          </table>

          {/* Pt II */}
          <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 min-w-[1000px]">
            <thead>
              <tr className="bg-slate-300/40 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 w-16 border-r border-slate-200 dark:border-slate-800 text-center">Pt. II</th>
                <th colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 text-center">Details Of Outward And Inward Supplies Declared During The Financial Year</th>
              </tr>
              <tr className="bg-white dark:bg-[#12141c] border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 text-center"></th>
                <th className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800"></th>
                <th className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800"></th>
                <th className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800"></th>
                <th colSpan={2} className="px-4 py-3 text-xs text-slate-500 font-medium text-right">(Amount in Rupees in All Tables)</th>
              </tr>
              <tr className="bg-white dark:bg-[#12141c] border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 border-r border-slate-200 dark:border-slate-800 text-center"></th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-200 dark:border-slate-800">Nature of Supplies</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-200 dark:border-slate-800">Taxable Value</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-200 dark:border-slate-800">Central Tax</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-200 dark:border-slate-800">State Tax/ UT Tax</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-200 dark:border-slate-800">Integrated Tax</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-center">Cess</th>
              </tr>
              <tr className="bg-white dark:bg-[#12141c] border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-1 text-center border-r border-slate-200 dark:border-slate-800 text-[10px] text-slate-400"></th>
                <th className="px-4 py-1 text-center border-r border-slate-200 dark:border-slate-800 text-xs text-blue-500 font-medium">1</th>
                <th className="px-4 py-1 text-center border-r border-slate-200 dark:border-slate-800 text-xs text-blue-500 font-medium">2</th>
                <th className="px-4 py-1 text-center border-r border-slate-200 dark:border-slate-800 text-xs text-blue-500 font-medium">3</th>
                <th className="px-4 py-1 text-center border-r border-slate-200 dark:border-slate-800 text-xs text-blue-500 font-medium">4</th>
                <th className="px-4 py-1 text-center border-r border-slate-200 dark:border-slate-800 text-xs text-blue-500 font-medium">5</th>
                <th className="px-4 py-1 text-center text-xs text-blue-500 font-medium">6</th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              <tr className="bg-slate-200/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">4</td>
                <td colSpan={6} className="px-4 py-3 text-slate-600 dark:text-slate-400">Details of advances, Inward and outward supplies on which tax is payable as declared in returns filed during the financial year</td>
              </tr>
              {[
                { l: "A", text: "Supplies made to un-registered persons(B2C)" },
                { l: "B", text: "Supplies made to registered persons(B2B)" },
                { l: "C", text: "Zero rated supply(Export) on payment of tax (except supplies to SEZs)" },
                { l: "D", text: "Supplies to SEZs on payment of tax", empty: true },
                { l: "E", text: "Deemed Exports", empty: true },
                { l: "F", text: "Advances on which tax has been paid but invoice has not been issued (not cover under (A) to (E) above)", empty: true },
                { l: "G", text: "Inward supplies on which tax is to be paid on reverse charge basis" },
                { l: "G1", text: "Supplies on which e-commerce operator is required to pay tax as per section 9(5) (including amendments, if any) [E-commerce operator to report]" },
                { l: "H", text: "Sub-total (A to G1 above)" },
                { l: "I", text: "Credit Notes issued in respect of transactions specified in (B) to (E) above (-)" },
                { l: "J", text: "Debit Notes issued in respect of transactions specified in (B) to (E) above (+)" },
                { l: "K", text: "Supplies/tax declared through Amendments(+)" },
              ].map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800 font-bold">{row.l}</td>
                  <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800">{row.text}</td>
                  {!row.empty ? (
                    <>
                      <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">0</td>
                      <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">0</td>
                      <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">0</td>
                      <td className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800">0</td>
                      <td className="px-4 py-3 text-center">0</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800"></td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800"></td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800"></td>
                      <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-800"></td>
                      <td className="px-4 py-3"></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
