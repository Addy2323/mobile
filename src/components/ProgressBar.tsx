type ProgressBarProps = {
  percent: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
};

export default function ProgressBar({ percent, size = 'md', showLabel = false, animated = true }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

  const color =
    clamped === 100 ? 'from-success-400 to-success-600' :
    clamped >= 75 ? 'from-success-400 to-primary-500' :
    clamped >= 40 ? 'from-primary-400 to-primary-600' :
    clamped > 0 ? 'from-amber-400 to-amber-500' :
    'from-slate-300 to-slate-300';

  return (
    <div className="w-full">
      <div className={`w-full ${heights[size]} bg-slate-100 rounded-full overflow-hidden`}>
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700 ease-out ${animated ? 'animate-[slideRight_0.7s_ease-out]' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs font-medium text-slate-500">{clamped}% settled</span>
          <span className="text-xs font-medium text-slate-400">{100 - clamped}% remaining</span>
        </div>
      )}
    </div>
  );
}
