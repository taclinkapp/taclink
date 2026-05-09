import { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAccountDeletion } from '@/hooks/useAccountDeletion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export const DeleteAccountDialog = ({ open, onOpenChange }: Props) => {
  const { requestDeletion, loading } = useAccountDeletion();
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');

  const canDelete = confirm.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    try {
      await requestDeletion(reason);
      toast.success('Account scheduled for deletion in 30 days. You can cancel any time before then by signing back in.');
      onOpenChange(false);
      await signOut();
      nav('/', { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'Could not schedule deletion');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>Your account will be <strong>scheduled for deletion in 30 days</strong>. During that grace period you can sign back in and cancel.</p>
              <p>After 30 days your profile, bookings, messages, payouts history, and all related data are permanently removed.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="del-reason" className="text-xs">Reason (optional)</Label>
            <Textarea id="del-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Help us improve…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm" className="text-xs">Type <span className="font-mono">DELETE</span> to confirm</Label>
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep account</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading ? 'Scheduling…' : 'Delete in 30 days'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
