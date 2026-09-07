"use client";

import { Camera, User, Share2, Mail, Users, Pencil } from "lucide-react";
import { shareText } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

export default function ProfileHero() {
  const { showToast } = useToast();

  const handleShare = async () => {
    const result = await shareText(
      typeof window !== "undefined" ? window.location.href : "",
      "Business Profile"
    );
    if (result === "copied") showToast("Profile link copied to clipboard!", "success");
    else if (result === "unsupported") showToast("Sharing is not supported in this browser", "error");
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-[#F0EAF0] dark:border-slate-800">


      {/* Profile Detail Area */}
      <div className="max-w-[1200px] mx-auto px-10 -mt-16 pb-10 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative group">
          <div className="w-32 h-32 rounded-3xl bg-[#2D3748] border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-xl overflow-hidden relative">
             <span className="text-5xl font-black text-white">A</span>
             <div className="absolute bottom-0 right-0 p-1.5 bg-white/20 backdrop-blur-sm">
                <Camera size={12} className="text-white/80" />
             </div>
          </div>
          <button className="absolute bottom-1 right-1 p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-300 z-10">
             <Camera size={14} className="text-[#666]" />
          </button>
        </div>

        {/* Business Info */}
        <div className="mt-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black text-[#1A1A1A] dark:text-white">Azeez</h1>
            <button className="p-1 hover:bg-slate-100 rounded transition-colors">
              <Pencil size={14} className="text-[#7C3AED]" />
            </button>
          </div>

          <button className="px-6 py-2 border border-dashed border-[#F0EAF0] rounded-lg text-xs font-bold text-[#7C3AED] hover:bg-purple-50 transition-all">
            + Add Business Tagline
          </button>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button className="flex items-center gap-2 px-6 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#1A1A1A] dark:text-white hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
              <Users size={16} /> Follow
            </button>
            <button onClick={handleShare} className="flex items-center gap-2 px-6 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#1A1A1A] dark:text-white hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
              <Share2 size={16} /> Share
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-[#7C3AED] text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all active:scale-95 shadow-xl shadow-purple-200/50">
              <Mail size={16} /> Contact for Work
            </button>
          </div>
          
          <p className="text-xs font-bold text-[#999] pt-4">Agency based in India</p>
        </div>
      </div>
    </div>
  );
}
