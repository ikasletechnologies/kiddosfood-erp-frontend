"use client";

import React, { memo } from 'react';
import { clsx } from 'clsx';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  onRowClick?: (item: T) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export const DataTable = memo(function DataTable<T>({
  columns,
  data,
  loading,
  searchPlaceholder = "Search items...",
  onSearch,
  onRowClick,
  pagination
}: DataTableProps<T>) {
  return (
    <div className="space-y-4 w-full min-w-0">
      {onSearch && (
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>
      )}

      <div className="relative bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm w-full min-w-0">
        <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                {columns.map((column, idx) => (
                  <th key={idx} className={clsx(
                    "px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap",
                    column.className
                  )}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, idx) => (
                      <td key={idx} className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md w-3/4"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length > 0 ? (
                data.map((item, rowIdx) => (
                  <tr
                    key={rowIdx}
                    onClick={() => onRowClick?.(item)}
                    className={clsx(
                      "group hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-default",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((column, colIdx) => (
                      <td key={colIdx} className={clsx(
                        "px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap",
                        column.className
                      )}>
                        {typeof column.accessor === 'function' 
                          ? column.accessor(item) 
                          : (item[column.accessor] as React.ReactNode)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 sm:px-6 py-16 sm:py-20 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center gap-2">
                       <Search size={28} className="opacity-20" />
                       <span className="text-xs uppercase font-black tracking-widest">No matching records found</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Page {pagination.currentPage} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.currentPage === 1}
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}) as <T>(props: DataTableProps<T>) => React.ReactElement;
