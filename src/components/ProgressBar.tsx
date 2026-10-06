import React from 'react';

type ProgressBarProps = {
  percent?: number;
  collected?: number;
  total?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
};

export default function ProgressBar({
  percent,
  collected,
  total,
  size = 'md',
  showLabel = false,
  animated = true,
}: ProgressBarProps) {
  let computedPercent = 0;
  if (typeof percent === 'number') {
    computedPercent = percent;
  } else if (typeof collected === 'number' && typeof total === 'number' && total > 0) {
    computedPercent = Math.round((collected / total) * 100);
  }

  const clamped = Math.min(100, Math.max(0, computedPercent));
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

  return (
    <div className="w-full">
      {/* Track #E2E8F0 */}
      <div className={`w-full ${heights[size]} bg-[#E2E8F0] rounded-full overflow-hidden flex`}>
        {/* Fill #3B6FF5 (Accent) */}
        <div
          className={`h-full bg-[#3B6FF5] rounded-full transition-all duration-500 ease-out ${
            animated ? 'animate-[slideRight_0.5s_ease-out]' : ''
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-[11px] font-bold text-[#12285C]">{clamped}% settled</span>
          <span className="text-[11px] font-semibold text-slate-400">{100 - clamped}% remaining</span>
        </div>
      )}
    </div>
  );
}
