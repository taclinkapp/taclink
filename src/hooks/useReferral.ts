import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ReferralStats = {
  code: string | null;
  totalInvites: number;
  rewardedInvites: number;
  pendingInvites: number;
};

export const useReferral = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats>({
    code: null,
    totalInvites: 0,
    rewardedInvites: 0,
    pendingInvites: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: codeRow }, { data: refs }] = await Promise.all([
        supabase.from('referral_codes').select('code').eq('user_id', user.id).maybeSingle(),
        supabase.from('referrals').select('status').eq('referrer_id', user.id),
      ]);
      if (cancelled) return;
      const all = refs ?? [];
      setStats({
        code: codeRow?.code ?? null,
        totalInvites: all.length,
        rewardedInvites: all.filter((r) => r.status === 'rewarded').length,
        pendingInvites: all.filter((r) => r.status === 'pending').length,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { ...stats, loading };
};

export type InviteSource = 'qr' | 'share' | 'copy' | 'link';

/**
 * Build a referral URL. Always tags the link with attribution params so we can
 * tell QR scans apart from copied/shared links once the recipient lands on
 * /auth/invite/:code.
 */
export const buildReferralUrl = (code: string, source: InviteSource = 'link') => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    src: source,
    utm_source: 'taclink_invite',
    utm_medium: source === 'qr' ? 'qr' : source === 'share' ? 'share' : 'link',
    utm_campaign: 'referral',
    ref: code,
  });
  return `${origin}/auth/invite/${encodeURIComponent(code)}?${params.toString()}`;
};

// Extract a referral code from a scanned QR payload. Accepts:
// - a full invite URL (/auth/invite/CODE)
// - a legacy signup URL (?ref=CODE)
// - a bare code string
export const extractReferralCode = (text: string): string | null => {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const refParam = url.searchParams.get('ref');
    if (refParam) return refParam.trim().toUpperCase();
    const match = url.pathname.match(/\/auth\/invite\/([A-Za-z0-9]+)/);
    if (match) return match[1].toUpperCase();
  } catch {
    /* not a URL */
  }
  if (/^[A-Za-z0-9]{6,16}$/.test(raw)) return raw.toUpperCase();
  return null;
};

