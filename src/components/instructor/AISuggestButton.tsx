import { useState } from 'react';
import { Sparkles, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { suggestCourseField, type CourseAIField, type CourseAIContext } from '@/lib/courseAI';
import { useSubscription } from '@/hooks/useSubscription';

interface Props {
  field: CourseAIField;
  context: CourseAIContext;
  onApply: (value: string) => void;
  className?: string;
  label?: string;
}

export const AISuggestButton = ({ field, context, onApply, className, label }: Props) => {
  const [busy, setBusy] = useState(false);
  const { isActive } = useSubscription();

  if (!isActive) {
    return (
      <Link
        to="/instructor/subscription"
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
          'bg-muted text-muted-foreground hover:bg-muted/70 border border-border transition',
          className,
        )}
        aria-label="AI suggest is a Pro feature"
        title="Upgrade to Pro to use AI suggestions"
      >
        <Lock className="h-3 w-3" />
        {label ?? 'AI suggest'} · Pro
      </Link>
    );
  }

  const run = async () => {
    setBusy(true);
    try {
      const value = await suggestCourseField(field, context);
      if (!value) {
        toast.error('AI returned no suggestion');
        return;
      }
      onApply(value);
      toast.success('AI suggestion applied — review before saving');
    } catch (e: any) {
      toast.error(e?.message ?? 'AI suggestion failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
        'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30',
        'disabled:opacity-50 transition',
        className,
      )}
      aria-label={`Get AI suggestion for ${field}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {label ?? 'AI suggest'}
    </button>
  );
};
