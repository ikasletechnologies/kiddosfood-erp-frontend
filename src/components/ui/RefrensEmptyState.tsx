"use client";

import { Play, Plus, Upload, FileText } from "lucide-react";
import { clsx } from "clsx";

interface RefrensEmptyStateProps {
  title: string;
  description: string;
  type?: "video" | "illustration";
  primaryAction: {
    label: string;
    onAction?: () => void;
  };
  secondaryAction?: {
    label: string;
    onAction?: () => void;
  };
}

export default function RefrensEmptyState({
  title,
  description,
  type = "video",
  primaryAction,
  secondaryAction
}: RefrensEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] sm:min-h-[70vh] px-3 sm:px-4 py-6 animate-in fade-in duration-500 w-full min-w-0">
      <div className="bg-white dark:bg-slate-900 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-xl w-full text-center shadow-2xl shadow-purple-200/20 space-y-6 sm:space-y-8 min-w-0">
        {/* Title & Description */}
        <div className="space-y-2 sm:space-y-3">
          <h2 className="text-lg sm:text-2xl font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-[#666] dark:text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Media Placeholder */}
        <div className="relative w-full aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-[#2D3748] shadow-lg group cursor-pointer border border-[#F0EAF0] dark:border-slate-800">
          {type === "video" ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 sm:space-y-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 sm:border-4 border-white flex items-center justify-center bg-white/10 group-hover:scale-110 transition-transform duration-300">
                   <Play size={24} className="text-white fill-white ml-0.5" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">Watch Demo Video</span>
             </div>
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-50 dark:bg-slate-800">

             </div>
          )}
          {/* Subtle Glow Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent group-hover:from-black/10 transition-all duration-300" />
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
          <button 
            onClick={primaryAction.onAction}
            className="w-full py-3 sm:py-4 bg-[#7C3AED] text-white rounded-xl font-black text-xs sm:text-sm shadow-xl shadow-purple-200/50 hover:bg-purple-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> {primaryAction.label}
          </button>
          
          {secondaryAction && (
             <button 
                onClick={secondaryAction.onAction}
                className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black text-[#999] hover:text-[#7C3AED] transition-colors uppercase tracking-[0.2em] py-1"
             >
                <Upload size={13} /> {secondaryAction.label}
             </button>
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="pt-10 sm:pt-20 flex flex-col items-center gap-4 sm:gap-6 opacity-60 w-full min-w-0 text-center">
         <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-8 text-[10px] sm:text-[11px] font-bold text-[#AAA] transition-colors uppercase tracking-[0.1em]">
            <span className="hover:text-[#7C3AED] cursor-pointer">Reach out to us for any help</span>
            <span className="hover:text-[#7C3AED] cursor-pointer underline">+91 91040 43038</span>
            <span className="hover:text-[#7C3AED] cursor-pointer flex items-center gap-1.5 underline">
               Care@Refrens.com
            </span>
            <span className="hover:text-[#7C3AED] cursor-pointer">FAQs</span>
         </div>
         <p className="text-[9px] sm:text-[10px] text-[#BBB] pt-2 max-w-sm mx-auto">This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</p>
      </div>
    </div>
  );
}
