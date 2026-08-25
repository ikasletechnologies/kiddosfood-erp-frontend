"use client";

import { useState } from "react";
import { 
  ChevronRight, 
  Plus,
  ChevronDown,
  Columns,
  Download,
  Filter
} from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface BankingDashboardProps {
  initialTab?: string;
}

export default function BankingDashboard({ 
  initialTab = "All Payment Accounts" 
}: BankingDashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    "All Payment Accounts", "Bank Accounts", "Employee Accounts", 
    "Bank Reconciliation", "Refrens Payments"
  ];

  const renderTable = () => {
    if (activeTab === "Bank Reconciliation") {
       return (
         <div className="flex items-center justify-center py-20">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-[#F0EAF0] dark:border-slate-800 shadow-xl p-10 flex flex-col items-center text-center space-y-6">
               <h2 className="text-xl font-black text-[#1A1A1A] dark:text-white leading-tight">
                  Reconcile your Books of <br/> Accounts with your Bank Statements
               </h2>
               <p className="text-[13px] font-medium text-[#666] dark:text-slate-400 leading-relaxed px-4">
                  Bank reconciliation helps you maintain precise financial records by automatically matching transactions and identifying discrepancies.
               </p>
               
               <div className="w-full h-48 bg-[#F8F7FF] dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-slate-700 overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 h-full bg-white dark:bg-slate-900 rounded-t-lg shadow-2xl p-4 border border-[#F0EAF0] dark:border-slate-800">
                     <div className="flex items-center gap-2 border-b pb-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                        <div className="h-1 w-16 bg-slate-100 rounded ml-2" />
                     </div>
                     <div className="space-y-2">
                        <div className="h-16 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                           <div className="w-1/2 h-2 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="h-12 bg-slate-50 dark:bg-slate-800 rounded-lg" />
                           <div className="h-12 bg-slate-50 dark:bg-slate-800 rounded-lg" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="w-full pt-4 space-y-4 px-4">
                  <button className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-black text-sm shadow-xl shadow-purple-200/50 transition-all active:scale-95 uppercase tracking-wider">
                     Enable Advanced Accounting
                  </button>
                  <Link href="#" className="flex items-center justify-center gap-2 text-[12px] font-black text-[#666] dark:text-slate-400 hover:text-[#7C3AED] transition-colors uppercase tracking-widest">
                     Learn More ↗
                  </Link>
               </div>
            </div>
         </div>
       );
    }

    let headers: string[] = [];
    let emptyText = "No Data Found";

    if (activeTab === "Bank Accounts") {
       headers = ["Bank Name", "Account Number", "Sort Code", "IFSC", "IBAN", "SWIFT", "Account Holder Name", "Account Type", "Country", "Currency", "Primary Account", "Created At"];
       emptyText = "No Bank Account Found";
    } else if (activeTab === "Employee Accounts") {
       headers = ["Employee ID", "Name", "Department", "Level", "Phone", "Country", "Currency", "Created At"];
       emptyText = "No Employee Found";
    } else {
       headers = ["Payment Account", "Account Type", "Linked Bank", "Linked Employee", "Linked Ledger", "VPA", "Created At"];
       emptyText = "No Payment Accounts Found";
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-6 text-[12px] font-bold border-b border-[#F0EAF0] dark:border-slate-800">
           <button className="pb-2.5 text-[#7C3AED] border-b-2 border-[#7C3AED]">Active Accounts</button>
           <button className="pb-2.5 text-[#999] hover:text-[#444] transition-colors">Inactive Accounts</button>
        </div>

        <div className="flex items-center justify-end gap-3">
           <button className="flex items-center gap-2 px-3 py-1.5 border border-[#F0EAF0] dark:border-slate-800 rounded-md text-[11px] font-bold text-[#666] hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900">
              <Download size={14} /> Download CSV
           </button>
           <button className="flex items-center gap-2 px-3 py-1.5 border border-[#F0EAF0] dark:border-slate-800 rounded-md text-[11px] font-bold text-[#666] hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900">
              <Columns size={14} /> Show/Hide Columns
           </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#FAF9FA] dark:bg-slate-800/50 border-b border-[#F0EAF0] dark:border-slate-800">
                <th className="p-4 w-10">
                   <div className="w-4 h-4 border-2 border-slate-200 rounded" />
                </th>
                {headers.map((head) => (
                  <th key={head} className="p-4 text-[11px] font-bold text-[#999] uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       {head} <ChevronDown size={12} className="opacity-40" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                 <td colSpan={headers.length + 1} className="py-40">
                    <div className="flex flex-col items-center justify-center space-y-6">
                       <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center opacity-30 text-slate-400">
                          <Filter size={40} />
                       </div>
                       <div className="text-center space-y-1">
                          <p className="text-[12px] font-black uppercase tracking-widest text-[#999]">{emptyText}</p>
                          <p className="text-[13px] font-black text-[#CCC] uppercase tracking-tighter">No Data</p>
                       </div>
                    </div>
                 </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617] -m-8 font-sans">
      <div className="p-8 space-y-6">
        {/* Breadcrumbs & Header */}
        <div className="flex items-center justify-end">
          <div className="flex">
             <button className="px-6 py-2.5 bg-[#D81159] hover:bg-[#B00E4A] text-white rounded-l-lg font-bold text-[13px] flex items-center gap-2 transition-all active:scale-95 shadow-lg">
                <Plus size={18} /> New Payments Account
             </button>
             <button className="px-2 py-2.5 bg-[#D81159] hover:bg-[#B00E4A] text-white rounded-r-lg border-l border-white/20 transition-all">
                <ChevronDown size={18} />
             </button>
          </div>
        </div>

        {/* Tab System */}
        <div className="flex items-center gap-6 border-b border-[#F0EAF0] dark:border-slate-800 pb-px overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={clsx(
                 "pb-3 text-[13px] font-bold transition-all relative whitespace-nowrap",
                 activeTab === tab 
                  ? "text-[#7C3AED]" 
                  : "text-[#666] dark:text-slate-500 hover:text-[#1A1A1A] dark:hover:text-white"
               )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7C3AED]" />
              )}
            </button>
          ))}
        </div>

        {renderTable()}
      </div>
    </div>
  );
}
