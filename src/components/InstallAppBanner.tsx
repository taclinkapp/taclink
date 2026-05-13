import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { InstallAppDialog } from "./InstallAppDialog";

const HIDDEN_PREFIXES = ["/admin", "/auth", "/welcome", "/unsubscribe", "/i/"];
const HIDDEN_EXACT = new Set(["/", "/onboarding"]);

const hasPendingTour = () => {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('taclink_tour_pending')) return true;
    }
  } catch { /* ignore */ }
  return false;
};

export const InstallAppBanner = () => {
  const { showBanner, snooze } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [tourBlocking, setTourBlocking] = useState<boolean>(() => hasPendingTour());

  useEffect(() => {
    const onOpen = () => setTourBlocking(true);
    const onClosed = () => setTourBlocking(false);
    const recheck = () => { if (hasPendingTour()) setTourBlocking(true); };
    window.addEventListener('taclink:tour-open', onOpen);
    window.addEventListener('taclink:tour-closed', onClosed);
    const interval = window.setInterval(recheck, 1500);
    return () => {
      window.removeEventListener('taclink:tour-open', onOpen);
      window.removeEventListener('taclink:tour-closed', onClosed);
      window.clearInterval(interval);
    };
  }, []);

  const hidden =
    HIDDEN_EXACT.has(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));

  if (!showBanner || hidden || tourBlocking) return <InstallAppDialog open={open} onOpenChange={setOpen} />;

  return (
    <>
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
      >
        <div className="relative tactical-card border border-primary/40 bg-background/95 backdrop-blur shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)] flex items-center gap-3 px-3 py-2.5 overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <button
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-3 min-w-0 flex-1 text-left"
            aria-label="Install TacLink as an app"
          >
            <span className="relative h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center flex-shrink-0 shadow-md">
              <Download className="h-4 w-4" />
              <span aria-hidden className="absolute inset-0 rounded-md ring-2 ring-primary/50 animate-ping opacity-60" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Recommended
                </span>
              </span>
              <span className="block text-sm font-bold tracking-tight truncate">Install TacLink for faster access</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                One tap — works offline, push alerts, no app store
              </span>
            </span>
          </button>
          <div className="relative flex flex-col items-end gap-1 flex-shrink-0">
            <button
              onClick={() => snooze(7)}
              className="text-muted-foreground hover:text-foreground p-1 -mr-1"
              aria-label="Hide install reminder for 7 days"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => snooze(3)}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline whitespace-nowrap"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>
      <InstallAppDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
