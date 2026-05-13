import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Smartphone, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { InstallAppDialog } from "./InstallAppDialog";

const HIDDEN_PREFIXES = ["/admin", "/auth", "/welcome", "/unsubscribe", "/i/"];
const HIDDEN_EXACT = new Set(["/", "/onboarding"]);

export const InstallAppBanner = () => {
  const { showBanner, dismiss } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const hidden =
    HIDDEN_EXACT.has(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));

  if (!showBanner || hidden) return <InstallAppDialog open={open} onOpenChange={setOpen} />;

  return (
    <>
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
      >
        <div className="tactical-card border border-border bg-background/95 backdrop-blur shadow-lg flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
            aria-label="Install TacLink as an app"
          >
            <span className="h-8 w-8 rounded-md bg-primary/15 text-primary grid place-items-center flex-shrink-0">
              <Smartphone className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold tracking-tight truncate">Install TacLink</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                Add to home screen — opens like an app
              </span>
            </span>
          </button>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground p-1 -mr-1 flex-shrink-0"
            aria-label="Dismiss install reminder"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <InstallAppDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
