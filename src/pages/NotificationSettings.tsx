import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Send, Loader2, AlertCircle, ShieldOff, Copy, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  isPushSupported,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from "@/lib/webPush";

const NotificationSettings = () => {
  const nav = useNavigate();
  const supported = isPushSupported();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const browserInfo = (() => {
    if (typeof navigator === "undefined") return { name: "your browser", steps: [] as string[] };
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const isFirefox = /firefox|fxios/i.test(ua);
    const isEdge = /edg\//i.test(ua);
    const isChrome = /chrome|crios/i.test(ua) && !isEdge;

    if (isIOS) return {
      name: "iOS Safari",
      steps: [
        "Open the iOS Settings app",
        "Scroll down and tap Safari → Advanced → Website Data",
        "Or go to Settings → Notifications and re-enable for this site (PWA only)",
      ],
    };
    if (isSafari) return {
      name: "Safari",
      steps: [
        "Open Safari → Settings (⌘,) → Websites → Notifications",
        "Find this site in the list and set it to Allow",
        "Reload this page",
      ],
    };
    if (isFirefox) return {
      name: "Firefox",
      steps: [
        "Click the lock icon in the address bar",
        "Click Clear permission next to Send Notifications",
        "Reload this page and click Allow when prompted",
      ],
    };
    if (isEdge) return {
      name: "Edge",
      steps: [
        "Click the lock icon in the address bar",
        "Set Notifications to Allow",
        "Reload this page",
      ],
    };
    if (isChrome) return {
      name: "Chrome",
      steps: [
        "Click the lock / tune icon at the left of the address bar",
        "Click Site settings",
        "Set Notifications to Allow, then reload this page",
      ],
    };
    return {
      name: "your browser",
      steps: [
        "Click the lock icon in the address bar",
        "Find Notifications in the site permissions list",
        "Set it to Allow, then reload this page",
      ],
    };
  })();

  const copySiteUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Site URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  };

  const refreshState = async () => {
    if (!supported) { setLoading(false); return; }
    const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
    setPermission(perm);
    const sub = await getPushSubscription();
    setEnabled(!!sub && perm === "granted");
    setLoading(false);
  };

  useEffect(() => {
    refreshState();
    if (!supported) return;

    // Listen for permission changes via the Permissions API (Chrome/Edge/Firefox).
    let permStatus: PermissionStatus | null = null;
    const onPermChange = () => refreshState();
    (async () => {
      try {
        permStatus = await navigator.permissions?.query({ name: "notifications" as PermissionName });
        permStatus?.addEventListener("change", onPermChange);
      } catch { /* Safari may not support querying notifications */ }
    })();

    // Fallback: re-check when the tab regains focus (e.g. after closing the
    // browser site settings panel).
    const onVisible = () => { if (document.visibilityState === "visible") refreshState(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      permStatus?.removeEventListener("change", onPermChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [supported]);

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        if (Notification.permission === "denied") {
          toast.error("Notifications blocked. Enable them in your browser settings.");
          return;
        }
        if (Notification.permission !== "granted") {
          const perm = await Notification.requestPermission();
          setPermission(perm);
          if (perm !== "granted") {
            toast.error("Permission denied");
            return;
          }
        }
        const ok = await subscribeToPush();
        if (ok) {
          setEnabled(true);
          toast.success("Web Push enabled");
        } else {
          toast.error("Could not subscribe to push");
        }
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success("Web Push disabled");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const res = await sendTestPush();
    setTesting(false);
    if (res.ok) toast.success("Test notification sent");
    else toast.error(res.error || "Failed to send");
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Notifications" back onBack={() => nav(-1)} />
      <div className="px-4 py-4 space-y-6">
        {!supported && (
          <div className="tactical-card p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Web Push not supported</p>
              <p className="text-muted-foreground text-xs mt-1">
                Your browser doesn't support push notifications. On iOS, install this app to your
                home screen first.
              </p>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 px-1">
            Web Push
          </h3>
          <div className="tactical-card divide-y divide-border">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-start gap-3">
                {enabled ? (
                  <Bell className="h-4 w-4 text-primary mt-0.5" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">Push notifications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get notified about bookings, messages, and reminders even when the app is closed.
                  </p>
                </div>
              </div>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={enabled}
                  disabled={!supported || busy || permission === "denied"}
                  onCheckedChange={handleToggle}
                />
              )}
            </div>
            {permission === "denied" && (
              <div className="px-4 py-3 space-y-2 bg-amber-500/5">
                <div className="flex items-start gap-2">
                  <ShieldOff className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-600 dark:text-amber-400">
                      Notifications blocked by {browserInfo.name}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      We can't ask again from inside the page — browsers require you to flip this
                      switch yourself in site settings.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pl-6">
                  <Button size="sm" variant="outline" onClick={() => setHelpOpen(true)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    How to unblock
                  </Button>
                  <Button size="sm" variant="ghost" onClick={copySiteUrl}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy site URL
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 px-1">
            Verify delivery
          </h3>
          <div className="tactical-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Send yourself a test notification to make sure everything is wired up.
            </p>
            <Button
              onClick={handleTest}
              disabled={testing || !enabled}
              className="w-full"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send test notification
            </Button>
            {!enabled && (
              <p className="text-[11px] text-muted-foreground text-center">
                Enable Web Push above to send a test.
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-enable notifications in {browserInfo.name}</DialogTitle>
            <DialogDescription>
              Browsers don't let websites open their own settings — follow these steps, then come
              back. The toggle here will update automatically.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 text-sm">
            {browserInfo.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={copySiteUrl}>
              <Copy className="h-4 w-4 mr-2" />
              Copy site URL
            </Button>
            <Button className="flex-1" onClick={() => setHelpOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </MobileShell>
  );
};

export default NotificationSettings;
