import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import founderBio from "@/assets/founder-bio.png";

const STORAGE_KEY = (userId: string) => `taclink_founder_bio_seen:${userId}`;
const AUTO_DISMISS_MS = 15000;

export function FounderBioModal({ userId }: { userId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(15);

  useEffect(() => {
    if (!userId) return;
    if (localStorage.getItem(STORAGE_KEY(userId))) return;
    const t = setTimeout(() => setOpen(true), 300);
    return () => clearTimeout(t);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setRemaining(15);
    const start = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, AUTO_DISMISS_MS - (Date.now() - start));
      setRemaining(Math.ceil(left / 1000));
    }, 250);
    const timeout = setTimeout(() => close(), AUTO_DISMISS_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    if (userId) localStorage.setItem(STORAGE_KEY(userId), "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background border-2">
        <div className="relative">
          <img
            src={founderBio}
            alt="Founder's note from TacLink"
            className="w-full h-auto block"
          />
          <button
            onClick={close}
            aria-label="Skip"
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur grid place-items-center hover:bg-background transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t">
          <div className="text-xs font-medium text-muted-foreground">
            Auto-closes in {remaining}s
          </div>
          <Button size="sm" variant="outline" onClick={close}>
            Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
