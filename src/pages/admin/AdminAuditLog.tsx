import { AdminHeader } from './AdminDashboard';
import { useAuditLog } from '@/hooks/useAdminData';
import { Loader2 } from 'lucide-react';

export const AdminAuditLog = () => {
  const { data: log = [], isLoading } = useAuditLog(200);
  return (
    <>
      <AdminHeader title="Audit Log" subtitle={`${log.length} most recent admin actions`} />
      <div className="p-8">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="tactical-card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Time</th>
                  <th className="text-left px-4 py-3 font-bold">Admin</th>
                  <th className="text-left px-4 py-3 font-bold">Action</th>
                  <th className="text-left px-4 py-3 font-bold">Target</th>
                  <th className="text-left px-4 py-3 font-bold">Source</th>
                  <th className="text-left px-4 py-3 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {log.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/30 align-top">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-[10px]">{l.admin_id?.slice(0, 8)}</td>
                    <td className="px-4 py-3"><code className="text-xs text-primary font-bold">{l.action}</code></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{l.target_type} · <span className="font-mono">{l.target_id?.slice(0, 12)}</span></td>
                    <td className="px-4 py-3 text-xs">{l.source}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.reason ?? '—'}</td>
                  </tr>
                ))}
                {log.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No actions logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
