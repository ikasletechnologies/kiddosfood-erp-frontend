"use client";

import { ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function PayrollPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617] font-sans w-full min-w-0">
      <div className="p-4 sm:p-8 space-y-6 w-full min-w-0">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#999] uppercase tracking-widest">
           <Link href="/" className="hover:text-[#7C3AED]">Dashboard</Link>
           <ChevronRight size={10} />
           <span className="text-[#666]">Payroll & HRMS</span>
        </div>

        <div className="flex items-center justify-center pt-4 w-full min-w-0">
           <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl sm:rounded-[32px] border border-[#F0EAF0] dark:border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-12 space-y-6 sm:space-y-8 min-w-0">
              <div className="text-center space-y-4">
                 <h1 className="text-2xl font-black text-[#1A1A1A] dark:text-white">HR and Payroll Management</h1>
                 <p className="text-[13px] font-medium text-[#666] dark:text-slate-400">
                    Please fill out this form, and we will reach out to you shortly to understand your requirements.
                 </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Full Name*</label>
                    <input type="text" placeholder="Enter Full Name" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Email*</label>
                    <input type="email" placeholder="Enter Email" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Phone number*</label>
                    <div className="flex items-center border border-[#F0EAF0] dark:border-slate-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                       <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-r border-[#F0EAF0] dark:border-slate-800 flex items-center gap-2 text-sm font-bold text-[#444] dark:text-slate-300">
                          IN <ChevronDown size={14} className="opacity-50" />
                       </div>
                       <div className="px-3 text-sm font-bold text-[#444] dark:text-slate-300">+91</div>
                       <input type="text" placeholder="Enter Phone number" className="flex-1 px-4 py-3 text-sm focus:outline-none bg-white dark:bg-slate-900 font-medium" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Organisation Name*</label>
                    <input type="text" placeholder="Enter Organisation Name" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Number of Employees*</label>
                    <input type="number" defaultValue={0} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-purple-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-black text-purple-600" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Feature Requirements / Priorities</label>
                    <div className="relative">
                       <select className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-[#999] font-medium">
                          <option>Select Feature Requirements / Priorities</option>
                       </select>
                       <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999]" size={16} />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#444] dark:text-slate-300 uppercase tracking-wider">Feel free to add any comments!</label>
                    <textarea placeholder="Enter Feel free to add any comments!" className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium min-h-[100px] resize-none" />
                 </div>

                 <button className="w-full py-4 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-xl font-black text-sm shadow-xl shadow-red-200/50 transition-all active:scale-[0.98] uppercase tracking-widest">
                    Submit
                 </button>

                 <div className="flex flex-col items-center justify-center space-y-1 pt-4">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-[#999] uppercase tracking-widest">Powered By</span>
                       <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 bg-[#7C3AED] rounded flex items-center justify-center -rotate-12">
                             <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-white rotate-45" />
                          </div>
                          <span className="text-[14px] font-black tracking-tight text-[#1A1A1A] dark:text-white">Refrens</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
