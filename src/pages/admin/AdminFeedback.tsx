import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Lightbulb, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { AdminHeader } from './AdminDashboard';

type Feedback = {
  id: string;
  created_at: string;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_role: string | null;
  category: string;
  subject: string;
  message: string;
  page_url: string | null;
  status: string;
  admin_notes: string | null;
};

const STATUSES = ['new', 'reviewing', 'planned', 'shipped', 'declined', 'all'] as const;
type StatusFilter = (typeof STATUSES)[number];

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  new: 'default',
  reviewing: 'secondary',
  planned: 'secondary',
  shipped: 'outline',
  declined: 'destructive',
};

export default function AdminFeedback() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin_feedback', filter],
    queryFn: async () => {
      let q = supabase
        .from('feedback_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });

  const rows = data ?? [];

  async function setStatus(f: Feedback, next: string) {
    setBusyId(f.id);
    try {
      const { error } = await supabase
        .from('feedback_submissions')
        .update({ status: next })
        .eq('id', f.id);
      if (error) throw error;
      toast({ title: `Marked ${next}` });
      qc.invalidateQueries({ queryKey: ['admin_feedback'] });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminHeader
        title="User Suggestions"
        subtitle={`${rows.length} ${filter === 'all' ? 'total' : filter} suggestion${rows.length === 1 ? '' : 's'}`}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? 'default' : 'outline'}
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="tactical-card p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading suggestions…
          </div>
        ) : rows.length === 0 ? (
          <div className="tactical-card p-12 text-center text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No suggestions match this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((f) => (
              <div key={f.id} className="tactical-card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={statusVariant[f.status] ?? 'outline'} className="capitalize">
                        {f.status}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{f.category}</Badge>
                      {f.submitter_role && (
                        <Badge variant="secondary" className="capitalize">{f.submitter_role}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-base">{f.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{f.message}</p>
                    <div className="mt-3 text-xs text-muted-foreground space-y-1">
                      {(f.submitter_name || f.submitter_email) && (
                        <div>
                          From: {f.submitter_name ?? 'Anonymous'}
                          {f.submitter_email ? ` · ${f.submitter_email}` : ''}
                        </div>
                      )}
                      {f.page_url && (
                        <div className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          <a href={f.page_url} target="_blank" rel="noreferrer" className="underline">
                            {f.page_url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['reviewing', 'planned', 'shipped', 'declined'].map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={f.status === next ? 'default' : 'outline'}
                      disabled={busyId === f.id || f.status === next}
                      onClick={() => setStatus(f, next)}
                      className="capitalize"
                    >
                      Mark {next}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
