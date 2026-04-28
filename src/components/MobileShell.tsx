import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const MobileShell = ({ children, className, withTabBar = true }: { children: ReactNode; className?: string; withTabBar?: boolean }) => (
  <div className="min-h-screen bg-background">
    <div className={cn('max-w-md mx-auto bg-background', withTabBar && 'pb-20', className)}>{children}</div>
  </div>
);

export const PageHeader = ({ title, right, back, onBack }: { title?: string; right?: ReactNode; back?: boolean; onBack?: () => void }) => (
  <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
    <div className="flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={onBack ?? (() => window.history.back())}
            className="text-muted-foreground hover:text-foreground -ml-2 p-2"
            aria-label="Back"
          >
            ←
          </button>
        )}
        {title && <h1 className="text-base font-bold tracking-tight">{title}</h1>}
      </div>
      <div>{right}</div>
    </div>
  </header>
);
