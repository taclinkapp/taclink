import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminHeader } from './AdminDashboard';
import { useAuditLog } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = ['Admin actions', 'Booking actions', 'Check-in attempts'] as const;
type Tab = typeof tabs[number];

const ACTION_TONE: Record<string, string> = {
  student_cancel_booking: 'text-amber-500',
  instructor_no_show_refund: 'text-destructive',
  student_no_show_refund: 'text-destructive',
};

const OUTCOME_TONE: Record<string, string> = {
  success: 'text-success',
  already_attended: 'text-primary',
  pending_proximity: 'text-amber-500',
  unsigned_warning: 'text-amber-500',
  wrong_course: 'text-destructive',
  invalid_qr: 'text-destructive',
  verification_failed: 'text-destructive',
  cannot_checkin: 'text-destructive',
  rpc_error: 'text-destructive',
};

const OUTCOME_LABEL: Record<string, string> = {
  success: 'First check-in',
  already_attended: 'Already checked in',
  pending_proximity: 'Awaiting proximity',
  unsigned_warning: 'Unsigned QR',
  wrong_course: 'Wrong course',
  invalid_qr: 'Invalid QR',
  verification_failed: 'Verification failed',
  cannot_checkin: 'Booking not active',
  rpc_error: 'Server error',
};

export const AdminAuditLog = () => {
  const [tab, setTab] = useState<Tab>('Admin actions');
  return (
    <>
      <AdminHeader title="Activity" subtitle="Admin actions, booking changes, and check-in attempts" />
      <div className="px-8 pt-4">
        <div className="flex gap-2 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-xs uppercase tracking-wider font-bold transition border-b-2 -mb-px',
                tab === t
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 pt-4">
        {tab === 'Admin actions' && <AuditTable filterRpc={false} />}
        {tab === 'Booking actions' && <AuditTable filterRpc={true} />}
        {tab === 'Check-in attempts' && <CheckinAttemptsTable />}
      </div>
    </>
  );
};

const AuditTable = ({ filterRpc }: { filterRpc: boolean }) => {
  const { data: log = [], isLoading } = useAuditLog(300);
  const rows = filterRpc
    ? log.filter((l: any) => l.source === 'rpc')
    : log.filter((l: any) => l.source !== 'rpc');

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="tactical-card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3 font-bold">Time</th>
            <th className="text-left px-4 py-3 font-bold">Actor</th>
            <th className="text-left px-4 py-3 font-bold">Action</th>
            <th className="text-left px-4 py-3 font-bold">Booking / Target</th>
            <th className="text-left px-4 py-3 font-bold">Outcome</th>
            <th className="text-left px-4 py-3 font-bold">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((l: any) => {
            const after = (l.after_value ?? {}) as Record<string, any>;
            const refund = after.student_refund_cents;
            const kept = after.instructor_kept_cents;
            return (
              <tr key={l.id} className="hover:bg-muted/30 align-top">
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-[10px]">
                  {l.admin_id?.slice(0, 8) ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <code className={cn('text-xs font-bold', ACTION_TONE[l.action] ?? 'text-primary')}>
                    {l.action}
                  </code>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {l.target_type} · <span className="font-mono">{l.target_id?.slice(0, 12)}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {refund !== undefined ? (
                    <div className="space-y-0.5">
                      <div>Refund: <span className="font-bold text-success">${(refund / 100).toFixed(2)}</span></div>
                      {kept !== undefined && kept > 0 && (
                        <div>Kept: <span className="font-bold">${(kept / 100).toFixed(2)}</span></div>
                      )}
                      {after.reason_category && (
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{after.reason_category}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">{l.reason ?? '—'}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const CheckinAttemptsTable = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['checkin_attempts', 200],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="tactical-card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3 font-bold">Time</th>
            <th className="text-left px-4 py-3 font-bold">Outcome</th>
            <th className="text-left px-4 py-3 font-bold">Source</th>
            <th className="text-left px-4 py-3 font-bold">Course</th>
            <th className="text-left px-4 py-3 font-bold">Instructor</th>
            <th className="text-left px-4 py-3 font-bold">Booking</th>
            <th className="text-left px-4 py-3 font-bold">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r: any) => (
            <tr key={r.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className={cn('px-4 py-3 text-xs font-bold', OUTCOME_TONE[r.outcome] ?? 'text-foreground')}>
                {OUTCOME_LABEL[r.outcome] ?? r.outcome}
              </td>
              <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">{r.source}</td>
              <td className="px-4 py-3 font-mono text-[10px]">{r.course_id?.slice(0, 8)}</td>
              <td className="px-4 py-3 font-mono text-[10px]">{r.instructor_id?.slice(0, 8)}</td>
              <td className="px-4 py-3 font-mono text-[10px]">{r.booking_id?.slice(0, 8) ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{r.reason ?? '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                No check-in attempts logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
