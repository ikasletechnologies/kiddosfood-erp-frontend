"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { franchiseApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

// Minimal quick-add — the full Franchise setup (dashboard login, pricing,
// primary warehouse, etc.) still lives on the Franchise Management page;
// this only covers the fields Franchise.create actually requires.
export default function QuickAddFranchiseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (franchise: any) => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactNum, setContactNum] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !location.trim() || !ownerName.trim() || !contactNum.trim()) {
      showToast("Name, location, owner name and contact number are all required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await franchiseApi.create({
        name: name.trim(),
        location: location.trim(),
        ownerName: ownerName.trim(),
        contactNum: contactNum.trim(),
      });
      showToast("Franchise created", "success");
      onCreated((res as any).data);
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to create franchise", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg border border-gray-200 p-5 w-full max-w-sm space-y-4 shadow-xl">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="text-sm font-bold text-gray-800">Quick Add Franchise</h3>
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
            placeholder="Franchise / branch name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Location *</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="City / area"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Owner Name *</label>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="Franchise owner"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Contact Number *</label>
          <input
            value={contactNum}
            onChange={(e) => setContactNum(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
            placeholder="10-digit phone number"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create Franchise"}
        </button>
      </div>
    </div>
  );
}
