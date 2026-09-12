"use client";

import { useState } from "react";
import { Warehouse as WarehouseIcon, Loader2 } from "lucide-react";
import { setupApi } from "@/lib/api";
import type { CreatedHq, CreatedWarehouse } from "../page";

// Only ever show messages the backend explicitly wrote for end users (see
// SetupController.createWarehouse's isValidationError check) — anything
// else (a raw Prisma/db error, a stack trace) gets a generic message here
// instead, with the real detail going to the console for debugging only.
const FRIENDLY_ERROR_PATTERNS = [/required/i, /already exists/i, /no franchise is marked/i];
function toDisplayError(raw: string | undefined): string {
  if (raw && FRIENDLY_ERROR_PATTERNS.some((p) => p.test(raw))) return raw;
  if (raw) console.error("[Setup] Warehouse creation failed:", raw);
  return "We couldn't complete the warehouse setup. Please try again.";
}

const CARD_CLASS =
  "w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-slate-800/50 p-10 space-y-6";

const INPUT_CLASS =
  "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function CreateWarehouseStep({
  hq,
  nextWarehouseCode,
  onCreated,
}: {
  hq: CreatedHq;
  nextWarehouseCode?: string | null;
  onCreated: (warehouse: CreatedWarehouse) => void;
}) {
  const [name, setName] = useState("Central Warehouse");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Warehouse Name is required.");
      return;
    }
    setSaving(true);
    try {
      // No franchiseId sent — the backend resolves HQ itself
      // (WarehouseService.createHqWarehouse / FranchiseService.getHqFranchise).
      const response = await setupApi.createWarehouse({
        name: name.trim(),
        code: code.trim() || undefined,
        location: address.trim() || undefined,
      });
      onCreated({ id: response.data.id, name: response.data.name, code: response.data.code });
    } catch (err: any) {
      setError(toDisplayError(err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
          <WarehouseIcon size={20} className="text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Set up your Main Warehouse</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hq.name} needs a warehouse to receive purchases, hold inventory and supply production.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Warehouse Name *
          </label>
          <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Code</label>
          <input className={INPUT_CLASS} value={code} onChange={(e) => setCode(e.target.value)} placeholder={nextWarehouseCode ? `e.g. ${nextWarehouseCode} (Auto-generated)` : "Optional"} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Address</label>
          <input className={INPUT_CLASS} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : "Continue"}
        </button>
      </form>
    </div>
  );
}
