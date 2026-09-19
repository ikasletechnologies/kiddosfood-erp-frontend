"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, Sparkles, CheckCircle2, AlertCircle, Warehouse } from "lucide-react";
import { franchiseWarehouseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface FranchiseWarehouseGuardProps {
  children: React.ReactNode;
}

export function FranchiseWarehouseGuard({ children }: FranchiseWarehouseGuardProps) {
  const { user } = useAuth();
  const rawRole = (user?.role as any)?.name ?? user?.role ?? "";
  const role = typeof rawRole === "string" ? rawRole.toUpperCase() : "";
  const isFranchiseUser = role === "FRANCHISE_ADMIN" || Boolean(user?.franchiseId && role !== "SUPER_ADMIN");

  const [checking, setChecking] = useState(true);
  const [hasWarehouse, setHasWarehouse] = useState(true);
  const [franchiseName, setFranchiseName] = useState<string>("");
  const [franchiseLocation, setFranchiseLocation] = useState<string>("");

  // Setup Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkFranchiseWarehouse = useCallback(async () => {
    if (!user || !isFranchiseUser) {
      setChecking(false);
      setHasWarehouse(true);
      return;
    }

    setChecking(true);
    try {
      // Query dedicated Franchise Warehouse status API
      const res = await franchiseWarehouseApi.getStatus();
      const data = res.data;

      if (data.configured && data.warehouse) {
        setHasWarehouse(true);
        setChecking(false);
        return;
      }

      // No warehouse configured for this franchise yet
      setHasWarehouse(false);

      if (data.franchise) {
        setFranchiseName(data.franchise.name || "");
        setFranchiseLocation(data.franchise.location || "");
        setName(`${data.franchise.name} Warehouse`);
        setLocation(data.franchise.location || "");
      }

      if (data.nextCode) {
        setCode(data.nextCode);
      }
    } catch (err: any) {
      console.error("Error checking franchise warehouse status:", err);
      // Fail safely to not trap user on unexpected API network error
      setHasWarehouse(true);
    } finally {
      setChecking(false);
    }
  }, [user, isFranchiseUser]);

  useEffect(() => {
    checkFranchiseWarehouse();
  }, [checkFranchiseWarehouse]);

  // Lock body scroll when setup modal is active
  useEffect(() => {
    if (!hasWarehouse && !checking) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [hasWarehouse, checking]);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Please enter a warehouse name.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      await franchiseWarehouseApi.setup({
        name: name.trim(),
        location: location.trim() || undefined,
        code: code.trim() || undefined,
      });

      toast.success("Warehouse set up successfully! Welcome to your Franchise Dashboard.");
      setHasWarehouse(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to create warehouse. Please try again.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // If verifying initial warehouse status
  if (isFranchiseUser && checking) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#f58220]" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest animate-pulse">
            Verifying Warehouse Configuration...
          </p>
        </div>
      </div>
    );
  }

  // If franchise already has a warehouse, render normal app children
  if (hasWarehouse) {
    return <>{children}</>;
  }

  // If franchise has NO warehouse, render the dedicated setup screen
  return (
    <>
      {/* Background content rendered underneath */}
      <div className="filter blur-sm pointer-events-none select-none opacity-40">
        {children}
      </div>

      {/* Setup Modal Portal */}
      {mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md transition-opacity" />

            {/* Modal Card */}
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 text-left animate-in zoom-in-95 duration-200 min-w-0">
              
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-[#f58220] flex items-center justify-center shrink-0 border border-orange-200/50 dark:border-orange-500/30">
                  <Warehouse className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-[#f58220] mb-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Initial Setup Required</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    Set Up Your Warehouse
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Create your primary warehouse to manage your franchise inventory and stock.
                  </p>
                </div>
              </div>

              {/* Franchise Context Banner */}
              {franchiseName && (
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 mb-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Franchise
                    </p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {franchiseName}
                    </p>
                  </div>
                  {franchiseLocation && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate max-w-[140px]">{franchiseLocation}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 mb-5 flex items-start gap-3 animate-in fade-in">
                  <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Setup Form */}
              <form onSubmit={handleCreateWarehouse} className="space-y-4">
                {/* Warehouse Code (Auto Generated) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Warehouse Code
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/30">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Auto Generated</span>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={code || "Generating code..."}
                      className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-600 dark:text-slate-300 cursor-not-allowed outline-none select-all"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sequenced automatically by the ERP system.
                  </p>
                </div>

                {/* Warehouse Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Downtown Central Store"
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-[#f58220] transition-colors placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                {/* Physical Location / Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Physical Location / Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Ground Floor Storage Area"
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-[#f58220] transition-colors placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="w-full py-3.5 px-6 bg-[#f58220] hover:bg-[#e07110] active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-black tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Configuring Warehouse...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Create Warehouse & Continue</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-center text-slate-400 mt-2.5">
                    You will be directed straight to the Franchise Dashboard once finished.
                  </p>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
