"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { CreatedHq } from "../page";

const CARD_CLASS =
  "w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-slate-800/50 p-10 space-y-6";

const INPUT_CLASS =
  "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function CreateHqStep({ onCreated }: { onCreated: (hq: CreatedHq) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("Kiddos Food Headquarters");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !address.trim() || !phone.trim()) {
      setError("Headquarters Name, Address, and Phone are all required.");
      return;
    }
    setSaving(true);
    try {
      const response = await franchiseApi.create({
        name: name.trim(),
        location: address.trim(),
        contactNum: phone.trim(),
        ownerName: user?.fullName || "Head Office Administration",
        isHQ: true,
      });
      onCreated({ id: response.data.id, name: response.data.name });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to create Headquarters.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
          <Building2 size={20} className="text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Set up your Headquarters</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your Headquarters is the central location for inventory, production, procurement and POS.
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
            Headquarters Name *
          </label>
          <input className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Address *
          </label>
          <input
            className={INPUT_CLASS}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Central Plaza, Tech Hub"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Phone *
          </label>
          <input className={INPUT_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : "Create Headquarters"}
        </button>
      </form>
    </div>
  );
}
