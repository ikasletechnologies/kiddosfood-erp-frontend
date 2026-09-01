"use client";

import { Edit3, X, Plus, Search, User, Phone, MapPin, Building2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePurchaseOrder, Vendor } from "@/context/PurchaseOrderContext";
import { useState, useEffect, useRef } from "react";
import { vendorsApi } from "@/lib/api";
import Link from "next/link";
import { clsx } from "clsx";

interface BillingSectionProps {
  fromLabel: string;
  fromSubLabel?: string;
  toLabel: string;
  toSubLabel?: string;
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* ── Billed To (Entity) Section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 size={13} className="text-[#f58220]" />
            {fromLabel}
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Entity
          </span>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs hover:border-orange-200 dark:hover:border-slate-700 transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 min-h-[96px]">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 uppercase">
              {user?.fullName?.charAt(0) || "S"}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                {user?.fullName || "SYSTEM SUPER ADMIN"}
              </h4>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                  {user?.role?.replace('_', ' ') || "SUPER ADMIN"}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <MapPin size={11} className="text-slate-400 shrink-0" />
                  HQ - Main Facility
                </span>
              </div>
            </div>
          </div>

          <Link 
            href="/profile/agency" 
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#f58220] hover:text-[#e8740e] hover:underline shrink-0"
          >
            <Edit3 size={12} /> Edit Profile
          </Link>
        </div>
      </div>

      {/* ── Billed By (Vendor) Section ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <User size={13} className="text-[#f58220]" />
            {toLabel}
          </span>
          {selectedVendor ? (
            <button
              type="button"
              onClick={() => setSelectedVendor(null)}
              className="text-[11px] font-semibold text-slate-400 hover:text-[#f58220] transition-colors cursor-pointer"
            >
              Change Vendor
            </button>
          ) : (
            <button
              type="button"
              onClick={onAddTarget}
              className="text-[11px] font-semibold text-[#f58220] hover:text-[#e8740e] flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={12} /> New Vendor
            </button>
          )}
        </div>

        {selectedVendor ? (
          <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs hover:border-orange-200 dark:hover:border-slate-700 transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 min-h-[96px] relative">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 uppercase">
                {selectedVendor.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    {selectedVendor.name}
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                    {selectedVendor.vendorCode || "V-0001"}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  <span className="text-[11px] font-mono text-slate-500">
                    GSTIN: {selectedVendor.gstNumber || "GST UNREGISTERED"}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Phone size={10} className="text-slate-400 shrink-0" />
                    {selectedVendor.phone || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-md border border-purple-200 dark:border-purple-800/40 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                {selectedVendor.suppliedMaterials?.length || 1} Available
              </span>
              <button 
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                title="Remove Vendor"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl shadow-2xs flex flex-col justify-center min-h-[96px] relative group">
            <div className="w-full relative z-10" ref={searchContainerRef}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search vendor name or code..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-8 text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!showSearch) setShowSearch(true);
                  }}
                  onFocus={() => setShowSearch(true)}
                />
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {showSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="max-h-52 overflow-y-auto">
                    {loading ? (
                      <div className="p-4 text-xs text-slate-400 font-medium text-center animate-pulse">Loading vendors...</div>
                    ) : filteredVendors.length > 0 ? (
                      filteredVendors.map(v => (
                        <div 
                          key={v.id}
                          onClick={() => {
                            setSelectedVendor(v);
                            setShowSearch(false);
                          }}
                          className="p-3 hover:bg-orange-50/70 dark:hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center"
                        >
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">{v.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono font-bold text-slate-400">{v.vendorCode || "V-000"}</span>
                              <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                {v.suppliedMaterials?.length || 0} Items
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono text-slate-500">{v.gstNumber || "GST UNREGISTERED"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-xs text-slate-400 text-center flex flex-col items-center gap-2">
                        <span>No vendors found for &quot;{searchQuery}&quot;</span>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onAddTarget) onAddTarget();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f58220] hover:text-[#e8740e] bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1.5 rounded-lg border border-orange-200 transition-colors cursor-pointer"
                        >
                          <Plus size={12} /> Create Vendor
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
