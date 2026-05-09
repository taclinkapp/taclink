import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useNavHistory } from '@/contexts/NavHistoryContext';
import { homeForRole, useAuth } from '@/contexts/AuthContext';

export const MobileShell = ({ children, className, withTabBar = true }: { children: ReactNode; className?: string; withTabBar?: boolean }) => (
  <div className="min-h-screen bg-background">
    <div className={cn('max-w-md mx-auto bg-background', withTabBar && 'pb-20', className)}>{children}</div>
  </div>
);

/**
 * PageHeader
 *  - title:  text title (sub-pages)
 *  - brand:  show the TacLink full lockup (top-level "home" pages). When set,
 *            the title is hidden in favour of the brand mark.
 *  - back / onBack: optional back button.
 *  - right:  trailing slot (notifications bell, actions, etc).
 */
export const PageHeader = ({
  title,
  brand,
  right,
  back,
  onBack,
  backTo,
}: {
  title?: string;
  brand?: boolean;
  right?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  /** Explicit destination for the back button. Strongly preferred over relying on history. */
  backTo?: string;
}) => {
  const navigate = useNavigate();
  const { depthRef } = useNavHistory();
  const { primaryRole } = useAuth();
  const handleBack = () => {
    if (onBack) return onBack();
    // Prefer the explicit destination — it's the page author's source of
    // truth and is reliable even when prior navigations used `replace: true`
    // (which still bumps in-app nav depth but doesn't add a real history
    // entry to step back to).
    if (backTo) return navigate(backTo);
    if (depthRef.current > 0) return navigate(-1);
    navigate(primaryRole ? homeForRole(primaryRole) : '/');
  };
  return (
  <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
    <div className="flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <button
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground -ml-2 p-2"
            aria-label="Back"
          >
            ←
          </button>
        )}
        {brand ? (
          <Logo showTagline className="h-9 w-auto" />
        ) : (
          title && <h1 className="text-base font-bold tracking-tight truncate">{title}</h1>
        )}
      </div>
      <div>{right}</div>
    </div>
  </header>
  );
};
