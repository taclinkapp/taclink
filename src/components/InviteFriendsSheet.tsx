import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, Check, Share2, Gift, Loader2, ScanLine, Mail, MessageSquare, Send, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useReferral, buildReferralUrl, extractReferralCode } from '@/hooks/useReferral';
import { QrScanner } from '@/components/QrScanner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewardLabel?: string;
};

const SHARE_TEXT = 'Train with me on TacLink. Sign up with my link and we both win.';

export const InviteFriendsSheet = ({ open, onOpenChange, rewardLabel }: Props) => {
  const { code, totalInvites, rewardedInvites, pendingInvites, loading } = useReferral();
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const nav = useNavigate();
  // QR encodes a separate URL so we can attribute scans vs shares server-side
  // (both still resolve to /auth/invite/:code via extractReferralCode).
  const qrLink = useMemo(() => (code ? buildReferralUrl(code, 'qr') : ''), [code]);
  const shareLink = useMemo(() => (code ? buildReferralUrl(code, 'share') : ''), [code]);
  const copyLink = useMemo(() => (code ? buildReferralUrl(code, 'copy') : ''), [code]);
  const link = copyLink; // visible link uses the copy attribution

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const onShare = async () => {
    if (!shareLink) return;
    const payload = { title: 'TacLink', text: SHARE_TEXT, url: shareLink };
    const hasShareApi =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (typeof (navigator as any).canShare !== 'function' || (navigator as any).canShare(payload));

    // iOS Safari blocks navigator.share() inside cross-origin iframes even when
    // the API exists — go straight to the fallback sheet there.
    if (!hasShareApi || (isIOS && isInIframe)) {
      setFallbackOpen(true);
      return;
    }

    try {
      await navigator.share(payload);
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // user dismissed share sheet
      // NotAllowedError / SecurityError (iframe permissions policy, http context, etc.)
      // → show the in-app fallback share menu instead of silently copying.
      setFallbackOpen(true);
    }
  };

  const onScanned = (text: string) => {
    const scanned = extractReferralCode(text);
    setScanning(false);
    if (!scanned) {
      toast.error('No referral code found in QR');
      return;
    }
    onOpenChange(false);
    nav(`/auth/invite/${scanned}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-background border-border max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-stencil uppercase tracking-[0.12em] flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Invite & Earn
          </SheetTitle>
        </SheetHeader>

        <div className="mt-2 mb-5">
          <p className="text-sm text-muted-foreground">
            Share your code. When a friend creates their first booking, you get{' '}
            <span className="text-primary font-bold">{rewardLabel ?? 'a free reward'}</span>.
          </p>
        </div>

        {loading || !code ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-md border-4 border-primary">
                <QRCodeSVG value={link} size={208} level="M" includeMargin={false} />
              </div>
            </div>

            <div className="mt-5 tactical-card p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">
                Your code
              </div>
              <div className="font-stencil text-2xl tracking-widest text-primary">{code}</div>
              <div className="mt-2 text-[11px] text-muted-foreground break-all">{link}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button onClick={onCopy} variant="outline" className="h-11 bg-card border-border font-bold uppercase text-xs tracking-wider">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button onClick={onShare} className="h-11 bg-primary text-primary-foreground font-bold uppercase text-xs tracking-wider">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>

            <Button
              onClick={() => setScanning(true)}
              variant="outline"
              className="w-full h-11 mt-2 bg-card border-border font-bold uppercase text-xs tracking-wider"
            >
              <ScanLine className="h-4 w-4" /> Scan a friend's QR
            </Button>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <Stat label="Invited" value={totalInvites} />
              <Stat label="Pending" value={pendingInvites} />
              <Stat label="Rewards" value={rewardedInvites} highlight />
            </div>
          </>
        )}
      </SheetContent>
      {scanning && <QrScanner onDecode={onScanned} onClose={() => setScanning(false)} />}
    </Sheet>
  );
};

const Stat = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
  <div className="tactical-card p-3 text-center">
    <div className={`text-xl font-black ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
  </div>
);
