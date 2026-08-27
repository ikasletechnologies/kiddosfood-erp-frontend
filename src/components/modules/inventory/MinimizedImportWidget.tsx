"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, UploadCloud, Maximize2, X, GripVertical } from "lucide-react";

interface MinimizedImportWidgetProps {
  title: string;
  importing: boolean;
  importProgress: { current: number; total: number; percent: number };
  importResult: any;
  importRowsCount: number;
  onRestore: () => void;
  onClose: () => void;
}

export default function MinimizedImportWidget({
  title,
  importing,
  importProgress,
  importResult,
  importRowsCount,
  onRestore,
  onClose,
}: MinimizedImportWidgetProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragDistance = useRef(0);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    isDragging.current = true;
    dragDistance.current = 0;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      dragDistance.current += 1;
      const newX = Math.max(10, Math.min(window.innerWidth - 240, e.clientX - dragOffset.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (dragDistance.current < 5) {
      onRestore();
    }
  };

  if (typeof window === "undefined") return null;

  const stylePosition: React.CSSProperties = position
    ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" }
    : {};

  return createPortal(
    <div
      style={stylePosition}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`fixed z-[9999] transition-shadow duration-200 select-none cursor-grab active:cursor-grabbing ${
        !position ? "top-20 right-8" : ""
      }`}
    >
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl pl-2.5 pr-3.5 py-2 shadow-lg border border-slate-200 dark:border-slate-800 flex items-center gap-2 max-w-[250px] hover:shadow-xl hover:border-[#f58220]/60 transition-all text-xs">
        {/* Grip drag handle */}
        <div className="text-slate-300 dark:text-slate-600 hover:text-slate-500 cursor-grab shrink-0">
          <GripVertical size={13} />
        </div>

        {/* Small icon */}
        <div className="p-1 bg-orange-50 dark:bg-orange-950/40 text-[#f58220] rounded-lg shrink-0">
          {importing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UploadCloud size={14} />
          )}
        </div>

        {/* Content text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 truncate">
              {importing ? `Importing (${importProgress.percent}%)` : "Excel Import"}
            </span>
          </div>
          {importing ? (
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-[#f58220] h-full transition-all duration-300"
                style={{ width: `${importProgress.percent}%` }}
              />
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium truncate">
              {importResult ? "Completed" : `${importRowsCount} rows loaded`}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-2 ml-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            title="Restore full view"
          >
            <Maximize2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
