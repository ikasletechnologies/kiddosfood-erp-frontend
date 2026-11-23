"use client";

import { Edit3, X, Plus, User, Phone, Building2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePurchaseOrder, Vendor } from "@/context/PurchaseOrderContext";
import { useState, useRef, useCallback } from "react";
import { vendorsApi } from "@/lib/api";
import Link from "next/link";
import { clsx } from "clsx";
import SearchAutocomplete from "@/components/ui/SearchAutocomplete";
import { dedupeById, formatQty, matchesSearch } from "@/lib/search";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Vendors are loaded once per form (the vendor list API has no server-side
  // search); re-focusing the field must not re-download the whole list.
  const loadState = useRef<"idle" | "loading" | "done">("idle");

  const loadVendors = useCallback(async () => {
    if (loadState.current !== "idle") return; // already loaded / in flight: no duplicate request
    loadState.current = "loading";
    setLoading(true);
    setLoadError(null);
    try {
      const response = await vendorsApi.getAll();
      const mappedVendors: Vendor[] = (Array.isArray(response.data) ? response.data : []).map((v: any) => ({
        id: v.id,
        name: v.name,
        status: v.status || 'ACTIVE',
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
      setVendors(dedupeById(mappedVendors));
      loadState.current = "done";
    } catch (error: any) {
      console.error("Failed to fetch vendors", error);
      loadState.current = "idle"; // allow a retry on next focus
      setLoadError(error?.response?.data?.error || "Could not load vendors");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trimmed, case-insensitive match on name, code, GSTIN and phone. Blocked
  // vendors are listed (so a search does not falsely say "not found") but
  // cannot be selected.
  const filteredVendors = vendors.filter(v =>
    matchesSearch(searchQuery, v.name, v.vendorCode, v.gstNumber, v.phone)
  );
  const isBlocked = (v: Vendor) => !!v.status && v.status !== "ACTIVE";

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
          <div className={clsx(
            "p-3.5 sm:p-4 bg-white dark:bg-slate-900 border rounded-xl shadow-2xs transition-all flex flex-col justify-between gap-2.5 min-h-[96px] relative",
            selectedVendor.status && selectedVendor.status !== 'ACTIVE'
              ? "border-rose-300 dark:border-rose-800/60 bg-rose-50/20"
              : "border-slate-200 dark:border-slate-800 hover:border-orange-200 dark:hover:border-slate-700"
          )}>
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 w-full">
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                <div className={clsx(
                  "w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 uppercase",
                  selectedVendor.status && selectedVendor.status !== 'ACTIVE' ? "bg-rose-600" : "bg-purple-600"
                )}>
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
                    {selectedVendor.status && selectedVendor.status !== 'ACTIVE' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-800">
                        {selectedVendor.status}
                      </span>
                    )}
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

            {selectedVendor.status && selectedVendor.status !== 'ACTIVE' && (
              <div className="w-full pt-2 border-t border-rose-200 dark:border-rose-900/40 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle size={14} className="shrink-0" />
                <span>This vendor is blocked and cannot be used for Purchase Orders.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl shadow-2xs flex flex-col justify-center min-h-[96px] relative group">
            <div className="w-full relative z-10">
              <SearchAutocomplete<Vendor>
                id="po-vendor-search"
                label="Search vendor"
                placeholder="Search vendor name, code, GSTIN or phone..."
                minChars={0}
                value={searchQuery}
                onFocus={loadVendors}
                onInputChange={text => { setSearchQuery(text); loadVendors(); }}
                onClear={() => setSearchQuery("")}
                options={filteredVendors}
                loading={loading}
                error={loadError}
                getOptionKey={v => v.id}
                isOptionDisabled={isBlocked}
                inputClassName="bg-slate-50 dark:bg-slate-900 text-xs font-medium"
                // Stores the full vendor record (its database id), not just the name.
                onSelect={v => { setSelectedVendor(v); setSearchQuery(""); }}
                renderOption={v => (
                  <div className="flex justify-between items-center gap-3 min-w-0">
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">{v.name}</span>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-slate-400">{v.vendorCode || "No code"}</span>
                        <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 rounded border border-purple-200">
                          {v.suppliedMaterials?.length || 0} Items
                        </span>
                        {isBlocked(v) && (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 rounded border border-rose-200">{v.status}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-[10px] font-mono text-slate-500">{v.gstNumber || "GST UNREGISTERED"}</span>
                      {(v.balanceDue > 0 || v.advanceBalance > 0) && (
                        <span className={clsx("block text-[10px] font-semibold", v.balanceDue > 0 ? "text-rose-600" : "text-emerald-600")}>
                          {v.balanceDue > 0 ? `Due ₹${formatQty(v.balanceDue)}` : `Advance ₹${formatQty(v.advanceBalance)}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                footer={close => onAddTarget ? (
                  <button
                    type="button"
                    onClick={() => { close(); onAddTarget(); }}
                    className="w-full flex items-center gap-1 px-3 py-2 text-[11px] font-bold text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-950/40"
                  >
                    <Plus size={12} /> Create Vendor{searchQuery.trim() ? ` "${searchQuery.trim()}"` : ""}
                  </button>
                ) : null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
