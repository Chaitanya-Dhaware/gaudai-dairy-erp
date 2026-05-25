import React from 'react';

// Card Skeleton Loader
export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-6 border border-black/[0.08] shadow-subtle flex flex-col space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full shimmer bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded shimmer bg-gray-200" />
              <div className="h-3 w-1/4 rounded shimmer bg-gray-200" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full rounded shimmer bg-gray-200" />
            <div className="h-3 w-5/6 rounded shimmer bg-gray-200" />
          </div>
          <div className="h-8 w-24 rounded-lg shimmer bg-gray-200 self-end mt-2" />
        </div>
      ))}
    </div>
  );
}

// Table Skeleton Loader
export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="w-full bg-white rounded-xl border border-black/[0.08] overflow-hidden shadow-subtle">
      <div className="h-12 border-b border-black/[0.08] bg-gray-50 flex items-center px-6 space-x-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 flex-1 rounded shimmer bg-gray-200" />
        ))}
      </div>
      <div className="divide-y divide-black/[0.08]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 flex items-center px-6 space-x-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 flex-1 rounded shimmer bg-gray-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Metrics Panel Skeleton Loader
export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-5 border border-black/[0.08] shadow-subtle space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3 w-1/3 rounded shimmer bg-gray-200" />
            <div className="w-8 h-8 rounded-lg shimmer bg-gray-200" />
          </div>
          <div className="h-6 w-2/3 rounded shimmer bg-gray-200" />
          <div className="h-3 w-1/2 rounded shimmer bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// Fullscreen Spinner
export function FullscreenSpinner({ message = 'लोड होत आहे / Loading...' }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col justify-center items-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-primary font-medium text-sm animate-pulse">{message}</p>
    </div>
  );
}
export default FullscreenSpinner;
