"use client";

import { ChevronDown, FileText, Paperclip, MessageSquare, Phone, UserPlus, X, Send, Loader2, AlertCircle, Plus } from "lucide-react";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { useRouter } from "next/navigation";
import { purchaseOrdersApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface DocumentOptionsProps {
  type: "invoice" | "quotation" | "purchase";
}

export default function DocumentOptions({ type }: DocumentOptionsProps) {
  const { isValid, errors, isSubmitting, setIsSubmitting, selectedVendor, items, totals, notes, internalNotes, vendorNotes, editId, discountAmount, freightCost } = usePurchaseOrder();
  const router = useRouter();

  const handleCreatePO = async () => {
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        vendorId: selectedVendor!.id,
        advancePaid: totals.appliedAdvance,
        notes: notes || internalNotes || undefined,
        internalNotes: internalNotes || notes || undefined,
        vendorNotes: vendorNotes || undefined,
        deliveryInstructions: vendorNotes || undefined,
        discountAmount: discountAmount || 0,
        freightCost: freightCost || 0,
        items: items.map(item => ({
          inventoryItemId: item.materialId,
          quantity: item.quantity,
          price: item.price
        }))
      };
      
      if (editId) {
        try {
          await purchaseOrdersApi.delete(editId);
        } catch (e) {
          console.error("Failed to delete old PO", e);
        }
        await purchaseOrdersApi.create(payload);
        toast.success("Purchase Order updated successfully!");
      } else {
        await purchaseOrdersApi.create(payload);
        toast.success("Purchase Order created successfully!");
      }
      localStorage.removeItem('draftPurchaseOrder');
      router.push("/purchases/orders");
    } catch (error) {
      console.error("Failed to Create Purchase Order", error);
      toast.error(`Failed to ${editId ? 'update' : 'create'} Purchase Order. Please check your inputs.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Additional Fields Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {[
           { icon: Plus, label: "Add Terms & Conditions" },
           { icon: MessageSquare, label: "Add Notes" },
           { icon: Paperclip, label: "Add Attachments" },
           { icon: FileText, label: "Add Additional Info" },
           { icon: Phone, label: "Add Contact Details" }
         ].map((field, idx) => (
           <button key={idx} className="flex items-center gap-3 px-6 py-4 border border-[#F0EAF0] dark:border-slate-800 border-dashed rounded-xl text-xs font-bold text-[#666] hover:bg-slate-50 transition-all">
              <field.icon size={16} className="text-[#999]" />
              {field.label}
           </button>
         ))}
         <button className="flex items-center gap-3 px-6 py-4 border border-[#F0EAF0] dark:border-slate-800 border-dashed rounded-xl text-xs font-bold text-[#666] hover:bg-slate-50 transition-all">
            <UserPlus size={16} className="text-[#999]" />
            Add Signature
         </button>
      </div>

      {/* Validation Errors Display */}
      {!isValid && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
           <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle size={20} />
           </div>
           <div className="space-y-1">
              <h4 className="text-xs font-black text-red-900 uppercase tracking-widest">Action Required</h4>
              <ul className="list-disc list-inside space-y-0.5">
                {errors.map((err, idx) => (
                  <li key={idx} className="text-[11px] text-red-700 font-medium">{err}</li>
                ))}
              </ul>
           </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-[#F0EAF0] dark:border-slate-800 pt-10">
         <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => router.back()}
              className="w-full md:w-auto px-8 py-3 bg-white border-2 border-[#F0EAF0] text-[#666] rounded-xl font-bold text-sm tracking-wide hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
            >
               <X size={16} /> Cancel
            </button>
            <button className="w-full md:w-auto px-8 py-3 bg-white border-2 border-[#F0EAF0] text-[#1A1A1A] rounded-xl font-bold text-sm tracking-wide hover:bg-slate-50 transition-all active:scale-95">
               Save As Draft
            </button>
         </div>

         <button 
           id="final-submit-btn"
           onClick={handleCreatePO}
           disabled={!isValid || isSubmitting}
           className={`w-full md:w-auto px-12 py-4 rounded-2xl font-black text-sm tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
             isValid && !isSubmitting 
             ? 'bg-[#7C3AED] text-white shadow-purple-200 hover:bg-[#6D28D9] hover:-translate-y-0.5' 
             : 'bg-slate-100 text-[#CCC] shadow-none cursor-not-allowed'
           }`}
         >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send size={18} />
                {editId ? "Update Purchase Order" : "Create Purchase Order"}
              </>
            )}
         </button>
      </div>

      {/* Support Footer */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-[11px] font-bold text-[#999] pt-20 uppercase tracking-widest">
         <div className="flex items-center gap-2">Enterprise Ready <span className="text-[#7C3AED]">PREMIUM</span></div>
         <div className="flex items-center gap-2">Powered by Antigravity ERP</div>
         <div className="flex items-center gap-2 hover:text-[#7C3AED] transition-colors cursor-pointer">Security Policy</div>
         <div className="flex items-center gap-2 hover:text-[#7C3AED] transition-colors cursor-pointer">Help & Support</div>
      </div>
    </div>
  );
}
