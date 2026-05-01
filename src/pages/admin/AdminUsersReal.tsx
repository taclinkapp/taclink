import { useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Input } from '@/components/ui/input';
import { Search, Loader2, ShieldCheck, ShieldOff, RotateCcw, Trash2, Ban, Undo2 } from 'lucide-react';
import { useAdminUsers, useAdminUserAction, useGrantCredit } from '@/hooks/useAdminData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId, reason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_users'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
      toast({ title: 'Account permanently deleted' });
    },
    onError: (e: any) =>
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
}

export const AdminUsersReal = () => {
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading } = useAdminUsers(search);
  const action = useAdminUserAction();
  const grant = useGrantCredit();
  const del = useDeleteAccount();
  const { user: currentUser } = useAuth();

  return (
    <>
      <AdminHeader title="Users" subtitle={`${users.length} loaded`} />
      <div className="p-8">
        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by display name…"
            className="bg-card border-border pl-9 h-11 max-w-md"
          />
        </div>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="tactical-card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Name</th>
                  <th className="text-left px-4 py-3 font-bold">Roles</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Strikes</th>
                  <th className="text-left px-4 py-3 font-bold">Joined</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u: any) => {
                  const isAdmin = u.roles.includes('admin');
                  const isInstructor = u.roles.includes('instructor');
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold">{u.display_name ?? '(no name)'}<div className="text-[10px] text-muted-foreground font-mono">{u.id.slice(0, 8)}</div></td>
                      <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider font-bold text-primary">{u.roles.join(', ') || '—'}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${u.account_status === 'active' ? 'text-success' : u.account_status === 'warned' ? 'text-orange-400' : 'text-destructive'}`}>{u.account_status}</span>
                      </td>
                      <td className="px-4 py-3">{u.strike_points ?? 0}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {u.account_status === 'suspended' ? (
                          <ConfirmAction label="Reactivate" onConfirm={(reason) => action.mutate({ action: 'reactivate', userId: u.id, reason })} />
                        ) : (
                          <ConfirmAction label="Suspend" destructive onConfirm={(reason) => action.mutate({ action: 'suspend', userId: u.id, reason })} />
                        )}
                        <ConfirmAction label="Reset strikes" icon={<RotateCcw className="h-3 w-3" />} onConfirm={(reason) => action.mutate({ action: 'reset_strikes', userId: u.id, reason })} />
                        {isAdmin ? (
                          <ConfirmAction label="Revoke admin" destructive icon={<ShieldOff className="h-3 w-3" />} onConfirm={(reason) => action.mutate({ action: 'revoke_admin', userId: u.id, reason })} />
                        ) : (
                          <ConfirmAction label="Grant admin" icon={<ShieldCheck className="h-3 w-3" />} onConfirm={(reason) => action.mutate({ action: 'grant_admin', userId: u.id, reason })} />
                        )}
                        <ConfirmAction
                          label={isInstructor ? "Free listing" : "Free booking"}
                          onConfirm={(reason) => grant.mutate({ userType: isInstructor ? 'instructor' : 'student', userId: u.id, note: reason })}
                        />
                        {currentUser?.id !== u.id && (
                          <ConfirmAction
                            label="Delete account"
                            destructive
                            icon={<Trash2 className="h-3 w-3" />}
                            confirmText="Permanently delete"
                            description="This permanently deletes the auth user, profile, roles, and related data. This CANNOT be undone."
                            onConfirm={(reason) => del.mutate({ userId: u.id, reason })}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

function ConfirmAction({
  label,
  onConfirm,
  destructive,
  icon,
  confirmText,
  description,
}: {
  label: string;
  onConfirm: (reason: string) => void;
  destructive?: boolean;
  icon?: React.ReactNode;
  confirmText?: string;
  description?: string;
}) {
  const [reason, setReason] = useState('');
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className={`text-xs font-bold inline-flex items-center gap-1 hover:underline ${destructive ? 'text-destructive' : 'text-primary'}`}>
          {icon}{label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? 'Optional reason (logged to audit log).'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(reason)}
            className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
          >
            {confirmText ?? label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
