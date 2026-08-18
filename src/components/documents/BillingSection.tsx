"use client";

import { ChevronDown, Edit3, X, Plus, Search, User, Phone, Wallet, Package, MapPin, Hash, BarChart3, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePurchaseOrder, Vendor } from "@/context/PurchaseOrderContext";
import { useState, useEffect, useRef } from "react";
import { vendorsApi } from "@/lib/api";
import Link from "next/link";
import { clsx } from "clsx";

interface BillingSectionProps {
  fromLabel: string;
  fromSubLabel: string;
  toLabel: string;
  toSubLabel: string;
  targetType: "client" | "vendor";
  onAddTarget?: () => void;
}

export default function BillingSection({ 
  fromLabel, 
  toLabel, 
  targetType,
  onAddTarget 
}: BillingSectionProps) {
  const { user } = useAuth();
  const { selectedVendor, setSelectedVendor } = usePurchaseOrder();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);

  const placeholderText = targetType === "client" ? "Select a Client" : "Search Vendor Name / Code...";
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (showSearch) {
      const fetchVendors = async () => {
        setLoading(true);
        try {
          const response = await vendorsApi.getAll();
          const mappedVendors = response.data.map((v: any) => ({
            id: v.id,
            name: v.name,
            phone: v.phone || v.mobile || v.contact,
            email: v.email,
            gstNumber: v.gstNumber,
            advanceBalance: v.advanceBalance || (v.balance < 0 ? Math.abs(v.balance) : 0),
            balanceDue: v.balanceDue || (v.balance > 0 ? v.balance : 0),
            creditLimit: v.creditLimit || 0,
            vendorCode: v.vendorCode,
            suppliedMaterials: v.suppliedMaterials?.map((sm: any) => ({
              materialId: sm.materialId,
              price: sm.price,
              name: sm.material?.name || "Material"
            })) || [], 
          }));
          setVendors(mappedVendors);
        } catch (error) {
          console.error("Failed to fetch vendors", error);
        } finally {
          setLoading(false);
        }
      };
      fetchVendors();
    }
  }, [showSearch]);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.vendorCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* From Section: Professional & Compact */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {fromLabel}
        </h3>
        
        <div className="p-4 bg-white dark:bg-[#0A0D14] border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 group">
           <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-inner uppercase">
              {user?.fullName?.charAt(0) || "U"}
           </div>
           <div className="flex-1">
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{user?.fullName || "System Admin"}</h4>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-0.5">
                 <span className="flex items-center gap-1 uppercase"><MapPin size={10} /> {user?.role?.replace('_', ' ') || "ADMIN"}</span>
                 <Link href="/settings" className="flex items-center gap-1 text-[#7C3AED] hover:underline cursor-pointer"><Edit3 size={10} /> Edit profile</Link>
              </div>
           </div>
        </div>
      </div>

      {/* To Section: Dynamic Vendor Card */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {toLabel}
        </h3>
        
        {selectedVendor ? (
          <div className="p-4 bg-white dark:bg-[#0A0D14] border border-purple-200 dark:border-slate-800 rounded-2xl relative group">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                 <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-purple-100">
                    {selectedVendor.name.charAt(0)}
                 </div>
                 <div className="flex-1">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                       {selectedVendor.name}
                       <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">{selectedVendor.vendorCode || "V-001"}</span>
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-bold mt-1">
                       <span className="flex items-center gap-1"><Hash size={10} /> {selectedVendor.gstNumber || "GST UNREGISTERED"}</span>
                       <span className="flex items-center gap-1"><Phone size={10} /> {selectedVendor.phone || "N/A"}</span>
                       <span className="text-purple-500 font-black">● {selectedVendor.suppliedMaterials?.length || 0} Materials Available</span>
                    </div>
                 </div>
              </div>
              <button 
                onClick={() => setSelectedVendor(null)}
                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                title="Remove Selected Vendor"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
               <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                    <Wallet size={8} /> {(selectedVendor.advanceBalance || 0) > 0 ? "Advance" : "Balance Due"}
                  </span>
                  <span className={clsx(
                    "text-xs font-black",
                    (selectedVendor.balanceDue || 0) > 0 ? "text-red-500" : "text-green-600"
                  )}>₹{((selectedVendor.advanceBalance || 0) > 0 ? selectedVendor.advanceBalance : (selectedVendor.balanceDue || 0)).toLocaleString()}</span>
               </div>
               <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1"><BarChart3 size={8} /> Performance</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">98% OTD</span>
               </div>

            </div>
          </div>
        ) : (
          <div className="p-4 bg-white dark:bg-[#0A0D14] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-center min-h-[88px] relative group shadow-sm">
            <div className="w-full relative z-10" ref={searchContainerRef}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search vendor..."
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none focus:border-[#7C3AED] transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!showSearch) setShowSearch(true);
                  }}
                  onFocus={() => setShowSearch(true)}
                />
              </div>

              {showSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                   <div className="max-h-48 overflow-y-auto">
                      {loading ? (
                        <div className="p-4 text-[10px] text-slate-400 font-black uppercase tracking-widest animate-pulse">Loading vendors...</div>
                      ) : filteredVendors.length > 0 ? (
                        filteredVendors.map(v => (
                          <div 
                            key={v.id}
                            onClick={() => {
                              setSelectedVendor(v);
                              setShowSearch(false);
                            }}
                            className="p-3 hover:bg-purple-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center"
                          >
                             <div className="flex flex-col text-left">
                                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{v.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <span className="text-[9px] font-bold text-slate-400">{v.vendorCode || "V-000"}</span>
                                   <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                      {v.suppliedMaterials?.length || 0} Items
                                   </span>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className={clsx(
                                  "text-[10px] font-black",
                                  (v.balanceDue || 0) > 0 ? "text-red-500" : "text-green-600"
                                )}>₹{((v.advanceBalance || 0) > 0 ? v.advanceBalance : (v.balanceDue || 0)).toLocaleString()}</span>
                             </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-[10px] text-slate-400 font-black uppercase tracking-widest text-center">No vendors found</div>
                      )}
                   </div>
                </div>
              )}
            </div>

            <Link 
              href={targetType === "client" ? "/customers" : "/vendors"}
              className="text-[10px] font-black text-[#7C3AED] uppercase tracking-widest hover:underline flex items-center gap-2 mt-4"
            >
              <Plus size={14} /> Add New {targetType === "client" ? "Client" : "Vendor"}
            </Link>
            
            {/* Background pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#7C3AED_1px,transparent_1px)] [background-size:10px_10px]" />
          </div>
        )}
      </div>
    </div>
  );
}
