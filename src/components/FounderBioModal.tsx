import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { homeForRole, useAuth } from "@/contexts/AuthContext";
import founderBio from "@/assets/founder-bio.png";

const STORAGE_KEY = (userId: string) => `taclink_founder_bio_seen:${userId}`;

export function FounderBioModal({ userId }: { userId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { primaryRole, loading } = useAuth();

  useEffect(() => {
    if (!userId || loading || !primaryRole) return;
    if (localStorage.getItem(STORAGE_KEY(userId))) return;
    const t = setTimeout(() => setOpen(true), 300);
    return () => clearTimeout(t);
  }, [userId, loading, primaryRole]);

  const close = () => {
    if (userId) localStorage.setItem(STORAGE_KEY(userId), "1");
    setOpen(false);
  };

  const handleContinue = () => {
    close();
    nav(homeForRole(primaryRole), { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background border-2">
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
