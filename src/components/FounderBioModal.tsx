import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { homeForRole, useAuth, type AppRole } from "@/contexts/AuthContext";
import founderBio from "@/assets/founder-bio.png";

const STORAGE_KEY = (userId: string) => `taclink_founder_bio_seen_v2:${userId}`;
const PENDING_KEY = "taclink_founder_bio_pending";

/**
 * Force the founder-bio modal to pop on the next page that mounts it
 * (e.g., right after signup, before AuthContext finishes hydrating roles).
 */
export function requestFounderBio() {
  try { sessionStorage.setItem(PENDING_KEY, "1"); } catch { /* ignore */ }
}

export function FounderBioModal({
  userId,
  onContinue,
}: {
  userId: string | undefined;
  onContinue?: (role: AppRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { primaryRole, loading } = useAuth();

  useEffect(() => {
    if (!userId) return;
    if (localStorage.getItem(STORAGE_KEY(userId))) return;

    // Fast-path: explicit post-signup request — open as soon as we have a userId,
    // even if roles are still loading. This prevents the welcome bio from being
    // missed due to an auth-context race.
    let pending = false;
    try { pending = sessionStorage.getItem(PENDING_KEY) === "1"; } catch { /* ignore */ }
    if (pending) {
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
      const t = setTimeout(() => setOpen(true), 200);
      return () => clearTimeout(t);
    }

    if (loading || !primaryRole) return;
    const t = setTimeout(() => setOpen(true), 300);
    return () => clearTimeout(t);
  }, [userId, loading, primaryRole]);

  const close = () => {
    if (userId) localStorage.setItem(STORAGE_KEY(userId), "1");
    setOpen(false);
  };

  const handleContinue = () => {
    close();
    if (primaryRole) {
      onContinue?.(primaryRole);
      nav(homeForRole(primaryRole), { replace: true });
    }
    // If role isn't ready yet, just close — the user is already on their home page
    // (the modal is mounted there) and AuthContext will finish hydrating shortly.
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden bg-background border-2 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Welcome to TacLink</DialogTitle>
        <DialogDescription className="sr-only">
          Continue to your TacLink profile.
        </DialogDescription>
        <img
          src={founderBio}
          alt="Founder's note from TacLink"
          className="w-full h-auto block"
        />
        <div className="px-4 py-4 border-t">
          <Button
            onClick={handleContinue}
            className="w-full h-12 font-bold"
          >
            Continue to your profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
