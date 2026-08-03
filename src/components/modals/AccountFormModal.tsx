"use client";

import { useState } from "react";
import { Wallet, Building2, Smartphone, Loader2 } from "lucide-react";
import { accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { clsx } from "clsx";

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAccount: any) => void;
}

const EMPTY_FORM = {
  name: "",
  type: "BANK" as "BANK" | "CASH" | "UPI",
  balance: ""
};

export default function AccountFormModal({ isOpen, onClose, onSuccess }: AccountFormModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Account Name is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await accountsApi.create({
        name: trimmedName,
        type: form.type,
        balance: Number(form.balance) || 0
      });

      const createdAccount = response.data || response;
      toast.success(`Account "${trimmedName}" created successfully!`);
      onSuccess(createdAccount);
      onClose();
      setForm(EMPTY_FORM);
    } catch (error: any) {
      console.error("Failed to create account", error);
      toast.error(error.response?.data?.error || "Failed to create financial account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Financial Account"
      size="sm"
      zIndex={100}
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Creating..." : "Save Account"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Account Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. HDFC Current Account, Petty Cash, UPI QR"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-orange-500 bg-gray-50 dark:bg-slate-900 text-sm font-semibold text-gray-800 dark:text-gray-100 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Account Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "BANK", label: "Bank", icon: Building2 },
              { id: "CASH", label: "Cash", icon: Wallet },
              { id: "UPI", label: "UPI", icon: Smartphone }
            ].map(type => {
              const Icon = type.icon;
              const isSelected = form.type === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setForm({ ...form, type: type.id as any })}
                  className={clsx(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1.5",
                    isSelected
                      ? "border-orange-500 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold"
                      : "border-gray-200 dark:border-white/10 hover:border-gray-300 text-gray-500 font-medium"
                  )}
                >
                  <Icon size={18} />
                  <span className="text-xs">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Opening Balance (Optional)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
            <input
              type="number"
              placeholder="0.00"
              value={form.balance}
              onChange={e => setForm({ ...form, balance: e.target.value })}
              className="w-full pl-8 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-orange-500 bg-gray-50 dark:bg-slate-900 text-sm font-semibold text-gray-800 dark:text-gray-100 transition-all"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
