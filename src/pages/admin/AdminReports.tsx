import { useEffect, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Loader2, RefreshCw } from 'lucide-react';

interface Report {
  id: string;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_role: string | null;
  page_url: string;
  category: string;
  severity: string;
  description: string;
  user_agent: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const sevColor: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-primary',
  high: 'text-warning',
  critical: 'text-destructive',
};

const statusColor: Record<string, string> = {
  open: 'text-destructive',
  in_progress: 'text-primary',
  resolved: 'text-success',
  wont_fix: 'text-muted-foreground',
};

export const AdminReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('issue_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load reports');
    } else {
      setReports((data ?? []) as Report[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateReport = async (id: string, patch: Partial<Report>) => {
    const { error } = await supabase.from('issue_reports').update(patch).eq('id', id);
    if (error) {
      toast.error('Update failed');
      return;
    }
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    toast.success('Updated');
  };

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);
  const openCount = reports.filter((r) => r.status === 'open').length;

  return (
    <>
      <AdminHeader
        title="Issue Reports"
        subtitle={`${openCount} open · ${reports.length} total`}
        action={
          <Button onClick={load} variant="outline" className="h-10 font-bold">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex gap-2">
          {['all', 'open', 'in_progress', 'resolved', 'wont_fix'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 h-9 rounded-md text-xs uppercase tracking-wider font-bold transition ${
                filter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface text-muted-foreground hover:bg-muted'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="tactical-card p-12 text-center text-muted-foreground text-sm">
            No reports {filter !== 'all' && `with status "${filter}"`}.
          </div>
        ) : (
          <div className="tactical-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">When</th>
                  <th className="text-left px-4 py-3 font-bold">Reporter</th>
                  <th className="text-left px-4 py-3 font-bold">Category</th>
                  <th className="text-left px-4 py-3 font-bold">Severity</th>
                  <th className="text-left px-4 py-3 font-bold">Page</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {r.reporter_name || r.reporter_email || (
                          <span className="text-muted-foreground italic">Anonymous</span>
                        )}
                        {r.reporter_role && (
                          <div className="text-[10px] uppercase tracking-wider text-primary">
                            {r.reporter_role}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-primary font-bold">{r.category}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold ${
                            sevColor[r.severity] ?? ''
                          }`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                        {r.page_url}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold ${
                            statusColor[r.status] ?? ''
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`} className="bg-surface/50">
                        <td colSpan={6} className="px-6 py-5 space-y-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                              Description
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{r.description}</p>
                          </div>
                          {r.reporter_email && (
                            <div className="text-xs text-muted-foreground">
                              Email:{' '}
                              <a href={`mailto:${r.reporter_email}`} className="text-primary">
                                {r.reporter_email}
                              </a>
                            </div>
                          )}
                          {r.user_agent && (
                            <div className="text-[10px] text-muted-foreground font-mono break-all">
                              {r.user_agent}
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                              Admin notes
                            </div>
                            <Textarea
                              defaultValue={r.admin_notes ?? ''}
                              className="bg-background border-border min-h-20"
                              onBlur={(e) => {
                                if (e.target.value !== (r.admin_notes ?? '')) {
                                  updateReport(r.id, { admin_notes: e.target.value });
                                }
                              }}
                            />
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {(['open', 'in_progress', 'resolved', 'wont_fix'] as const).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant={r.status === s ? 'default' : 'outline'}
                                onClick={() => updateReport(r.id, { status: s })}
                                className="text-xs uppercase tracking-wider font-bold"
                              >
                                {s.replace('_', ' ')}
                              </Button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
