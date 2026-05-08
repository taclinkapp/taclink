import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Wallet, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { fmt } from '@/lib/fees';
import { AdminHeader } from './AdminDashboard';

type Booking = {
  id: string;
  student_id: string;
  course_id: string;
  status: string;
  created_at: string;
  deposit_status: string | null;
  deposit_method: string | null;
  deposit_handle_used: string | null;
  deposit_amount_cents: number | null;
  deposit_sent_at: string | null;
  deposit_expires_at: string | null;
};

const STATUSES = ['awaiting_confirmation', 'pending', 'failed', 'all'] as const;
type StatusFilter = (typeof STATUSES)[number];

export default function AdminDepositReview() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('awaiting_confirmation');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin_deposit_review', filter],
    queryFn: async () => {
      let q = supabase
        .from('bookings')
        .select(
          'id, student_id, course_id, status, created_at, deposit_status, deposit_method, deposit_handle_used, deposit_amount_cents, deposit_sent_at, deposit_expires_at',
        )
        .order('deposit_expires_at', { ascending: true, nullsFirst: false })
        .limit(200);
      if (filter !== 'all') {
        q = q.eq('deposit_status', filter);
      } else {
        q = q.not('deposit_status', 'is', null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

  const rows = data ?? [];
  const stuck = rows.filter(
    (r) =>
      r.deposit_status === 'awaiting_confirmation' &&
      r.deposit_expires_at &&
      new Date(r.deposit_expires_at) < new Date(),
  ).length;

  async function setStatus(b: Booking, next: 'confirmed' | 'failed') {
    setBusyId(b.id);
    try {
      const patch: Record<string, any> = { deposit_status: next };
      if (next === 'confirmed') patch.deposit_confirmed_at = new Date().toISOString();
      const { error } = await supabase.from('bookings').update(patch).eq('id', b.id);
      if (error) throw error;
      await supabase.rpc('log_admin_action', {
        _action: next === 'confirmed' ? 'confirm_deposit' : 'fail_deposit',
        _target_type: 'booking',
        _target_id: b.id,
        _before: { deposit_status: b.deposit_status },
        _after: patch,
        _reason: null,
        _source: 'admin_ui',
      });
      toast({ title: `Deposit marked ${next}` });
      qc.invalidateQueries({ queryKey: ['admin_deposit_review'] });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminHeader
        title="Deposit Review"
        subtitle={`${rows.length} record${rows.length === 1 ? '' : 's'} · ${stuck} stuck past expiry`}
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
              {s.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>

        <div className="tactical-card overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading deposits…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-3 opacity-50" />
              No deposits match this filter.
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Booking</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Amount</th>
                  <th className="text-left px-4 py-3 font-bold">Method</th>
                  <th className="text-left px-4 py-3 font-bold">Sent</th>
                  <th className="text-left px-4 py-3 font-bold">Expires</th>
                  <th className="text-right px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((b) => {
                  const expired =
                    b.deposit_expires_at && new Date(b.deposit_expires_at) < new Date();
                  return (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{b.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            b.deposit_status === 'confirmed'
                              ? 'default'
                              : b.deposit_status === 'failed'
                                ? 'destructive'
                                : expired
                                  ? 'destructive'
                                  : 'secondary'
                          }
                          className="capitalize"
                        >
                          {(b.deposit_status ?? 'none').replace(/_/g, ' ')}
                          {expired && b.deposit_status === 'awaiting_confirmation' ? ' · stuck' : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{fmt(b.deposit_amount_cents ?? 0)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {b.deposit_method ?? '—'}
                        {b.deposit_handle_used ? (
                          <span className="block text-xs">{b.deposit_handle_used}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {b.deposit_sent_at ? new Date(b.deposit_sent_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {b.deposit_expires_at
                          ? new Date(b.deposit_expires_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === b.id || b.deposit_status === 'confirmed'}
                            onClick={() => setStatus(b, 'confirmed')}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === b.id || b.deposit_status === 'failed'}
                            onClick={() => setStatus(b, 'failed')}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Fail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
