"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { dealersApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

// Minimal quick-add for the same reason as QuickAddCustomerModal — Dealer
// requires a franchiseId server-side (see DealerService.create), so unlike
// Customer this form always needs a franchise selection.
export default function QuickAddDealerModal({
  franchises,
  defaultFranchiseId,
  onClose,
  onCreated,
}: {
  franchises: any[];
  defaultFranchiseId?: string;
  onClose: () => void;
  onCreated: (dealer: any) => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [franchiseId, setFranchiseId] = useState(
    defaultFranchiseId || franchises[0]?.id || ""
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("Dealer name is required", "error");
      return;
    }
    if (!franchiseId) {
      showToast("Select a franchise for this dealer", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await dealersApi.create({
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        franchiseId,
      });
      showToast("Dealer created", "success");
      onCreated((res as any).data);
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to create dealer", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg border border-gray-200 p-5 w-full max-w-sm space-y-4 shadow-xl">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="text-sm font-bold text-gray-800">Quick Add Dealer</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Name *</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="Dealer name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Franchise *</label>
          <select
            value={franchiseId}
            onChange={(e) => setFranchiseId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
          >
            <option value="" disabled>Select franchise...</option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="10-digit phone number"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="Email address"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="Address"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create Dealer"}
        </button>
      </div>
    </div>
  );
}
