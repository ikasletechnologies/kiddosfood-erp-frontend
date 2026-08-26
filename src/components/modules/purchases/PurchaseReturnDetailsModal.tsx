import { X } from "lucide-react";
import { clsx } from "clsx";

export default function PurchaseReturnDetailsModal({ data, onClose, onUpdateStatus }: { data: any, onClose: () => void, onUpdateStatus: (id: string, status: string) => void }) {
  const isGRN = data.returnSource === "GRN_REJECTION";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-[#12141c] h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
        
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">PURCHASE RETURN <span className="text-orange-600">#{data.returnNumber}</span></h2>
            {isGRN ? (
               <p className="text-[10px] font-black tracking-widest text-purple-600 uppercase mt-1 bg-purple-50 inline-block px-2 py-0.5 rounded border border-purple-100">AUTO-GENERATED FROM GRN REJECTION</p>
            ) : (
               <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase mt-1 bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-200">NORMAL PURCHASE RETURN</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-6 bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div>
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1">Vendor</p>
              <p className="font-bold text-sm">{data.vendor?.name}</p>
              <p className="text-[11px] text-gray-500 font-medium">{data.vendor?.contact}</p>
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1">Return Date</p>
              <p className="font-bold text-sm">{new Date(data.createdAt).toLocaleDateString("en-IN")}</p>
            </div>
            {data.procurementOrderId && (
              <div>
                <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1">Original Reference</p>
                <p className="font-bold text-sm">{data.procurementOrder?.poNumber || "PO/GRN Reference"}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-1">Status</p>
              <span className={clsx(
                "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border inline-block mt-0.5",
                data.status === "PENDING" ? "bg-amber-50 text-amber-600 border-amber-100" :
                data.status === "APPROVED" || data.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                "bg-gray-50 text-gray-500 border-gray-200"
              )}>
                {data.status}
              </span>
            </div>
          </div>

          <div className="space-y-4">
             {isGRN ? (
               <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                 <p className="text-xs font-bold text-purple-800">GRN REJECTION</p>
                 <p className="text-[11px] text-purple-600 mt-1">No inventory deduction is applied because rejected stock never entered inventory.</p>
               </div>
             ) : (
               <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                 <p className="text-xs font-bold text-orange-800">NORMAL PURCHASE RETURN</p>
                 <p className="text-[11px] text-orange-600 mt-1">Approving this return will apply an inventory deduction (RETURN_OUT).</p>
               </div>
             )}
          </div>

          {/* Items */}
          <div>
            <h3 className="text-xs font-black tracking-widest text-gray-400 uppercase mb-4">Return Items</h3>
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Material</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Returned</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Rate</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-bold text-gray-900">{item.itemName}</td>
                      <td className="px-4 py-3 text-right">
                         <span className="font-black bg-gray-100 px-2 py-0.5 rounded text-xs">{item.quantity} {item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-500">₹{item.rate?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">₹{item.totalAmount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Total Refund Value</span>
                <span className="text-xl font-black text-gray-900">₹{data.refundAmount?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {data.status === "PENDING" && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button 
              onClick={() => onUpdateStatus(data.id, "CANCELLED")}
              className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel Return
            </button>
            {isGRN ? (
              <button 
                onClick={() => onUpdateStatus(data.id, "COMPLETED")}
                className="flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white bg-purple-600 shadow-lg shadow-purple-600/20 rounded-xl hover:bg-purple-700 transition-all"
              >
                Confirm Vendor Return
              </button>
            ) : (
              <button 
                onClick={() => onUpdateStatus(data.id, "APPROVED")}
                className="flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white bg-orange-600 shadow-lg shadow-orange-600/20 rounded-xl hover:bg-orange-700 transition-all"
              >
                Approve Return
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
