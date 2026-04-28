import { Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Logo = ({ size = 'md', showTagline = false }: { size?: 'sm' | 'md' | 'lg' | 'xl'; showTagline?: boolean }) => {
  const iconSize = { sm: 'h-5 w-5', md: 'h-7 w-7', lg: 'h-10 w-10', xl: 'h-14 w-14' }[size];
  const textSize = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl', xl: 'text-5xl' }[size];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <Crosshair className={cn(iconSize, 'text-primary')} strokeWidth={2.5} />
        <span className={cn(textSize, 'font-black tracking-tight text-foreground')}>
          Tac<span className="text-primary">Link</span>
        </span>
      </div>
      {showTagline && (
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Find. Book. Train.</p>
      )}
    </div>
  );
};
