import { SplitSquareHorizontal } from 'lucide-react';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'dark' | 'light';
};

export default function Logo({ size = 'md', showText = true, variant = 'dark' }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-8 w-8', text: 'text-lg' },
    md: { icon: 'h-10 w-10', text: 'text-xl' },
    lg: { icon: 'h-14 w-14', text: 'text-3xl' },
  };

  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const subColor = variant === 'light' ? 'text-white/60' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${sizes[size].icon} rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20`}>
        <SplitSquareHorizontal className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${sizes[size].text} font-extrabold ${textColor} tracking-tight`}>
            LUMO<span className="text-primary-500">Split</span>
          </span>
          <span className={`text-[10px] font-medium ${subColor} uppercase tracking-widest`}>
            Group Bills, Settled
          </span>
        </div>
      )}
    </div>
  );
}
