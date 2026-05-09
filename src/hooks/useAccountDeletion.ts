import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type DeletionRequest = {
  id: string;
  user_id: string;
  requested_at: string;
  scheduled_for: string;
  cancelled_at: string | null;
  processed_at: string | null;
  reason: string | null;
};

export const useAccountDeletion = () => {
  const { user } = useAuth();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setRequest(null);
      return;
    }
    const { data } = await supabase
      .from('account_deletion_requests')
      .select('*')
      .eq('user_id', user.id)
      .is('cancelled_at', null)
      .is('processed_at', null)
      .maybeSingle();
    setRequest((data as DeletionRequest) ?? null);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestDeletion = useCallback(async (reason?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-account-deletion', {
        body: { reason: reason ?? null },
      });
      if (error) throw error;
      await refresh();
      return data;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const cancelDeletion = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-account-deletion', { body: {} });
      if (error) throw error;
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const daysRemaining = request
    ? Math.max(0, Math.ceil((new Date(request.scheduled_for).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return { request, loading, requestDeletion, cancelDeletion, daysRemaining, refresh };
};
