"use client";

export function DashboardSkeleton() {
  return (
    <div className="min-h-full p-4 md:p-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-2xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
          <div className="h-4 w-96 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-10 w-32 rounded-full bg-slate-200 dark:bg-white/10 animate-shimmer" />
          <div className="h-10 w-28 rounded-full bg-slate-200 dark:bg-white/10 animate-shimmer" />
          <div className="h-10 w-44 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
          <div className="h-11 w-36 rounded-2xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
        </div>
      </div>

      {/* Core KPI Skeleton (3 cards) */}
      <div className="space-y-3">
        <div className="h-4 w-48 rounded-lg bg-slate-200 dark:bg-white/10 animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-3xl bg-white dark:bg-[#12141c] border border-slate-200/70 dark:border-white/5 space-y-4 shadow-sm"
            >
              <div className="flex justify-between items-center">
                <div className="h-10 w-10 rounded-2xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
                <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-white/10 animate-shimmer" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
                <div className="h-8 w-40 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between">
                <div className="h-3 w-28 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pillar A: Financial Control Skeleton (4 cards) */}
      <div className="space-y-3">
        <div className="h-4 w-60 rounded-lg bg-slate-200 dark:bg-white/10 animate-shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-3xl bg-white dark:bg-[#12141c] border border-slate-200/70 dark:border-white/5 space-y-3 shadow-sm"
            >
              <div className="flex justify-between items-center">
                <div className="h-9 w-9 rounded-2xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
                <div className="h-4 w-12 rounded-full bg-slate-200 dark:bg-white/10 animate-shimmer" />
              </div>
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
              <div className="h-7 w-32 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
              <div className="h-3 w-28 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Pillar B: Production Skeleton (3 cards) */}
      <div className="space-y-3">
        <div className="h-4 w-60 rounded-lg bg-slate-200 dark:bg-white/10 animate-shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-3xl bg-white dark:bg-[#12141c] border border-slate-200/70 dark:border-white/5 space-y-3 shadow-sm"
            >
              <div className="flex justify-between items-center">
                <div className="h-9 w-9 rounded-2xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
              </div>
              <div className="h-3 w-28 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
              <div className="h-7 w-32 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
              <div className="h-3 w-36 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Mission Intelligence & Activity Feed Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white dark:bg-[#12141c] border border-slate-200/70 dark:border-white/5 min-h-[380px] space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="h-5 w-40 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
            <div className="h-8 w-48 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
          </div>
          <div className="h-64 w-full rounded-2xl bg-slate-100 dark:bg-white/5 animate-shimmer" />
        </div>
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white dark:bg-[#12141c] border border-slate-200/70 dark:border-white/5 min-h-[380px] space-y-4 shadow-sm">
          <div className="h-5 w-36 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
                  <div className="h-2 w-48 rounded bg-slate-200 dark:bg-white/10 animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reports Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-6 rounded-3xl bg-white dark:bg-[#12141c] border border-slate-200/70 dark:border-white/5 min-h-[260px] space-y-4 shadow-sm"
          >
            <div className="h-5 w-44 rounded-xl bg-slate-200 dark:bg-white/10 animate-shimmer" />
            <div className="space-y-2">
              <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-white/5 animate-shimmer" />
              <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-white/5 animate-shimmer" />
              <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-white/5 animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
