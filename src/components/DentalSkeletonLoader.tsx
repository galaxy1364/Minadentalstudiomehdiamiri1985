import React from 'react';

export interface DentalSkeletonLoaderProps {
  type?: 'patient-card' | 'tooth-chart' | 'dashboard' | 'tile-grid' | 'single-tile' | 'table';
  count?: number;
  columns?: 1 | 2;
}

const SingleQBankTileSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => (
  <div
    style={{ '--tile-index': index } as React.CSSProperties}
    className="tile relative w-full min-w-0 max-w-full overflow-hidden h-full min-h-[72px] sm:min-h-[76px] rounded-[18px] bg-white/95 border border-slate-200/85 p-3 flex flex-col justify-between shadow-[var(--shadow-card)]"
    aria-hidden="true"
  >
    {/* Asymmetric Q-Bank Top-Left Notch Skeleton */}
    <div className="absolute top-0 left-0 w-9 h-7 rounded-br-[16px] bg-slate-100/90 border-b border-r border-slate-200/70 flex items-center justify-center">
      <div className="w-3.5 h-3.5 rounded-md dental-shimmer" />
    </div>

    <div className="flex items-start justify-between gap-2 pr-0.5 pl-8">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-[12px] dental-shimmer shrink-0" />
        <div className="space-y-1.5 min-w-0">
          <div className="h-3.5 w-24 sm:w-28 dental-shimmer rounded-md" />
          <div className="h-2.5 w-32 sm:w-36 dental-shimmer rounded-md" />
        </div>
      </div>
      <div className="h-5 w-12 rounded-lg dental-shimmer shrink-0" />
    </div>
  </div>
);

export const DentalSkeletonLoader: React.FC<DentalSkeletonLoaderProps> = ({
  type = 'patient-card',
  count = 3,
  columns = 2
}) => {
  if (type === 'single-tile') {
    return <SingleQBankTileSkeleton />;
  }

  if (type === 'tile-grid') {
    const gridCount = count > 3 ? count : 12;
    return (
      <div
        className="w-full space-y-3"
        dir="rtl"
        aria-busy="true"
        aria-label="در حال بارگذاری شبکه کاشی‌های داشبورد"
      >
        {[0, 1, 2].map((zoneIdx) => (
          <div
            key={`skeleton-zone-${zoneIdx}`}
            className="dashboard-zone space-y-2 p-2.5 rounded-[20px] bg-slate-50/80 border border-slate-200/70"
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="h-3.5 w-36 dental-shimmer rounded-md" />
              <div className="h-4 w-12 dental-shimmer rounded-md" />
            </div>
            <div
              className={`grid ${
                columns === 1 ? 'grid-cols-1 gap-2.5' : 'grid-cols-2 gap-2.5 sm:gap-3'
              } w-full`}
            >
              {Array.from({ length: Math.min(4, Math.ceil(gridCount / 3)) }).map((_, idx) => (
                <SingleQBankTileSkeleton key={`tile-skel-${zoneIdx}-${idx}`} index={zoneIdx * 4 + idx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'tooth-chart') {
    return (
      <div
        className="w-full p-3.5 rounded-[20px] bg-white border border-slate-200/80 shadow-[var(--shadow-card)] space-y-3"
        aria-busy="true"
        aria-label="در حال بارگذاری چارت دندانی پالمر"
      >
        <div className="flex justify-between items-center">
          <div className="h-4 w-32 dental-shimmer rounded-md" />
          <div className="h-4 w-20 dental-shimmer rounded-md" />
        </div>
        <div className="grid grid-cols-8 gap-1.5 pt-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`u_${i}`}
              className="h-14 rounded-xl bg-slate-100/80 border border-slate-200/60 flex flex-col items-center justify-between p-1.5"
            >
              <div className="w-3 h-3 rounded-full dental-shimmer" />
              <div className="w-5 h-6 rounded-md dental-shimmer" />
            </div>
          ))}
        </div>
        <div className="h-px w-full bg-slate-200" />
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`l_${i}`}
              className="h-14 rounded-xl bg-slate-100/80 border border-slate-200/60 flex flex-col items-center justify-between p-1.5"
            >
              <div className="w-5 h-6 rounded-md dental-shimmer" />
              <div className="w-3 h-3 rounded-full dental-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'dashboard') {
    return (
      <div
        className="w-full max-w-full min-w-0 overflow-x-hidden pb-20 pt-1 space-y-2.5 sm:space-y-3 px-2 sm:px-2.5"
        dir="rtl"
        aria-busy="true"
        aria-label="در حال بارگذاری داشبورد مینادنتال"
      >
        {/* Search Bar Skeleton */}
        <div className="w-full rounded-[20px] p-2.5 bg-white border border-slate-200/90 shadow-2xs">
          <div className="h-9 w-full rounded-xl dental-shimmer" />
        </div>

        {/* Multi-Color Clinic Hero Hub Skeleton */}
        <div className="w-full rounded-[22px] bg-white border border-slate-200/85 p-3.5 space-y-3 shadow-[var(--shadow-card)]">
          <div className="flex justify-between items-center">
            <div className="h-4 w-44 dental-shimmer rounded-md" />
            <div className="h-7 w-28 dental-shimmer rounded-xl" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-[14px] dental-shimmer" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-[12px] dental-shimmer" />
            ))}
          </div>
        </div>

        {/* Exact 2-Column Q-Bank Tile Grid Skeleton (Zero Layout Shift) */}
        <DentalSkeletonLoader type="tile-grid" count={12} columns={columns} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5" dir="rtl" aria-busy="true" aria-label="در حال بارگذاری لیست">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-[20px] bg-white border border-slate-200/80 shadow-[var(--shadow-card)] flex items-center justify-between gap-3 min-h-[60px]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl dental-shimmer shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 dental-shimmer rounded" />
              <div className="h-2.5 w-20 dental-shimmer rounded" />
            </div>
          </div>
          <div className="h-8 w-16 dental-shimmer rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
};
