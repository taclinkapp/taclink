import { useAccountDeletion } from '@/hooks/useAccountDeletion';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const AccountDeletionBanner = () => {
  const { request, daysRemaining, cancelDeletion, loading } = useAccountDeletion();
  if (!request) return null;

  const handleCancel = async () => {
    try {
      await cancelDeletion();
      toast.success('Account deletion cancelled');
    } catch (e: any) {
      toast.error(e?.message || 'Could not cancel');
    }
  };

  return (
    <div className="mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 text-xs">
        <p className="font-semibold text-destructive">Account scheduled for deletion</p>
        <p className="text-foreground/80 mt-0.5">
          Your account will be permanently deleted in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}.
        </p>
      </div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="text-xs font-bold text-destructive underline-offset-2 hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
};
