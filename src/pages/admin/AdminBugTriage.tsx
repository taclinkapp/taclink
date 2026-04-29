import { useEffect, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, Sparkles, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type Cluster = {
  title: string;
  root_cause: string;
  suggested_fix: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  report_ids: string[];
};

type Report = {
  id: string;
  description: string;
  page_url: string;
  severity: string;
  status: string;
  created_at: string;
};

const sevColor: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary border border-primary/30',
  high: 'bg-warning/10 text-warning border border-warning/30',
  critical: 'bg-destructive/10 text-destructive border border-destructive/30',
};

export const AdminBugTriage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ idx: number; action: 'mark_in_progress' | 'mark_resolved' | 'mark_wont_fix' } | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('issue_reports')
      .select('id, description, page_url, severity, status, created_at')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });
    setReports((data ?? []) as Report[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runTriage = async () => {
    setTriaging(true);
    setClusters([]);
    try {
      const { data, error } = await supabase.functions.invoke('bug-triage', { body: {} });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Triage failed', description: data.error, variant: 'destructive' });
      } else {
        setClusters(data?.clusters ?? []);
        if (!data?.clusters?.length) {
          toast({ title: 'Nothing to triage', description: 'No open reports found.' });
        }
      }
    } catch (e: any) {
      toast({ title: 'Triage error', description: e.message, variant: 'destructive' });
    }
    setTriaging(false);
  };

  const runAction = async () => {
    if (!confirm) return;
    setRunning(true);
    const cluster = clusters[confirm.idx];
    const newStatus =
      confirm.action === 'mark_resolved' ? 'resolved'
      : confirm.action === 'mark_wont_fix' ? 'wont_fix'
      : 'in_progress';

    const { error } = await supabase
      .from('issue_reports')
      .update({
        status: newStatus,
        triaged_at: new Date().toISOString(),
        root_cause: cluster.root_cause,
        suggested_fix: cluster.suggested_fix,
        admin_notes: cluster.title,
      })
      .in('id', cluster.report_ids);

    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      await supabase.rpc('log_admin_action', {
        _action: `bug_triage_${confirm.action}`,
        _target_type: 'issue_cluster',
        _target_id: cluster.title.slice(0, 80),
        _before: null,
        _after: { report_ids: cluster.report_ids, suggested_fix: cluster.suggested_fix },
        _reason: cluster.root_cause,
        _source: 'admin_ai',
      });
      toast({ title: `${cluster.report_ids.length} report(s) updated` });
      setClusters((prev) => prev.filter((_, i) => i !== confirm.idx));
      load();
    }
    setRunning(false);
    setConfirm(null);
  };

  return (
    <>
      <AdminHeader
        title="Bug Triage"
        subtitle={`${reports.length} open report(s) · AI-grouped by root cause`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={runTriage} disabled={triaging || reports.length === 0}>
              {triaging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Run AI triage
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        {clusters.length === 0 ? (
          <div className="tactical-card p-8 text-center text-sm text-muted-foreground">
            {triaging
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Clustering reports…</span>
              : 'Click "Run AI triage" to group open reports by root cause.'}
          </div>
        ) : (
          <div className="space-y-3">
            {clusters.map((c, idx) => (
              <div key={idx} className="tactical-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sevColor[c.severity]}`}>{c.severity}</span>
                      <Badge variant="outline">{c.report_ids.length} reports</Badge>
                    </div>
                    <h3 className="font-bold text-base">{c.title}</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Root cause</div>
                        <div>{c.root_cause}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Suggested fix</div>
                        <div>{c.suggested_fix}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ idx, action: 'mark_in_progress' })}>
                    Mark in progress
                  </Button>
                  <Button size="sm" onClick={() => setConfirm({ idx, action: 'mark_resolved' })}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark resolved
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm({ idx, action: 'mark_wont_fix' })}>
                    Won't fix
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === idx ? null : idx)}>
                    {expanded === idx ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
                    {expanded === idx ? 'Hide' : 'Show'} reports
                  </Button>
                </div>
                {expanded === idx && (
                  <ul className="mt-3 space-y-1.5 text-xs border-t border-border pt-3">
                    {c.report_ids.map((id) => {
                      const r = reports.find((x) => x.id === id);
                      if (!r) return <li key={id} className="text-muted-foreground">— {id}</li>;
                      return (
                        <li key={id} className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
                          <span className="text-muted-foreground shrink-0">{r.page_url}</span>
                          <span className="truncate">{r.description}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this action?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && `This will update ${clusters[confirm.idx]?.report_ids.length} report(s) and write to the audit log.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runAction(); }} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminBugTriage;
