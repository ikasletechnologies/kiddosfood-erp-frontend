"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  hideHeader?: boolean;
  zIndex?: number;
  onMinimize?: () => void;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-2xl'
};

export function Modal({ isOpen, onClose, title, children, footer, size = 'md', hideHeader, zIndex, onMinimize }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-6 transition-all animate-in fade-in duration-200"
      style={{ zIndex: zIndex || 50 }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={clsx(
        "relative w-full bg-white dark:bg-[#020617] rounded-2xl sm:rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 min-w-0",
        sizes[size]
      )}>
        {/* Header */}
        {!hideHeader && (
          <div className="px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 gap-3">
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate flex-1">{title}</h2>
            <div className="flex items-center gap-1.5 shrink-0">
              {onMinimize && (
                <button 
                  type="button"
                  onClick={onMinimize}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 transition-all active:scale-95 cursor-pointer"
                  title="Minimize"
                >
                  <Minus size={18} />
                </button>
              )}
              <button 
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 transition-all active:scale-95 cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-4 sm:px-8 py-4 sm:py-8 overflow-y-auto custom-scrollbar flex-1 min-w-0">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-8 py-3.5 sm:py-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
