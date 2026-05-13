import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Send, Loader2, AlertCircle, ShieldOff, Copy, ExternalLink, RefreshCw } from "lucide-react";
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
  subscribeToPushDetailed,
  unsubscribeFromPush,
  sendTestPush,
} from "@/lib/webPush";

const inIframe = (() => {
  try { return typeof window !== "undefined" && window.self !== window.top; }
  catch { return true; }
})();

const isIOSBrowser = (() => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
})();

const isStandaloneWebApp = (() => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
})();

const isIOSSafariBrowser = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
})();

const NotificationSettings = () => {
  const nav = useNavigate();
  const supported = isPushSupported();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [enabled, setEnabled] = useState(false);
  const [deliveryReady, setDeliveryReady] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  // Reconcile UI state with the live browser permission. If the user has
  // granted permission but no push subscription exists yet, we transparently
  // create one so the toggle reflects reality.
  const reconcile = useCallback(async (opts: { autoSubscribe?: boolean } = {}) => {
    if (!supported) {
      setLoading(false);
      setEnabled(false);
      setDeliveryReady(false);
      return { permission: "default" as NotificationPermission, deliveryReady: false };
    }
    const perm = Notification.permission;
    setPermission(perm);
    let sub = await getPushSubscription();
    if (!sub && perm === "granted" && opts.autoSubscribe && !inIframe) {
      const result = await subscribeToPushDetailed();
      if (result.ok) {
        sub = await getPushSubscription();
        setSetupMessage(null);
      } else {
        setSetupMessage(result.error || "Browser permission is allowed, but delivery setup did not finish.");
      }
    }
    const ready = !!sub && perm === "granted";
    setEnabled(perm === "granted");
    setDeliveryReady(ready);
    if (perm !== "granted") setSetupMessage(null);
    if (ready) setSetupMessage(null);
    setLoading(false);
    return { permission: perm, deliveryReady: ready };
  }, [supported]);

  const handleCheckAgain = async () => {
    setChecking(true);
    const before = Notification.permission;
    const result = await reconcile({ autoSubscribe: true });
    setChecking(false);
    if (result.permission === "granted") {
      if (result.deliveryReady) toast.success(before !== "granted" ? "Permission granted — push enabled" : "Push is already enabled");
      else toast("Notifications are allowed. Use Finish setup to enable delivery.");
    } else if (result.permission === "denied") {
      toast.error("Still blocked — update your browser site settings");
    } else {
      toast("Permission not granted yet");
    }
  };

  const finishDeliverySetup = async () => {
    setBusy(true);
    try {
      const result = await subscribeToPushDetailed();
      const sub = result.ok ? await getPushSubscription() : null;
      setPermission(Notification.permission);
      setEnabled(Notification.permission === "granted");
      setDeliveryReady(!!sub && Notification.permission === "granted");
      if (result.ok && sub) {
        setSetupMessage(null);
        toast.success("Push delivery enabled");
      } else if (result.reason === "auth") {
        toast.error("Sign in again to finish notification setup");
      } else {
        setSetupMessage(result.error || "Delivery setup did not finish. Try again.");
        toast.error("Could not finish push delivery setup");
      }
    } finally {
      setBusy(false);
    }
  };

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
      await navigator.clipboard.writeText(`${window.location.origin}/settings/notifications`);
      toast.success("Site URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  };

  useEffect(() => {
    // On mount, auto-subscribe if permission is already granted (e.g. user
    // granted via the browser site settings while the page was closed).
    reconcile({ autoSubscribe: true });
    if (!supported) return;

    // Listen for permission changes via the Permissions API (Chrome/Edge/Firefox).
    let permStatus: PermissionStatus | null = null;
    const onPermChange = () => reconcile({ autoSubscribe: true });
    (async () => {
      try {
        permStatus = await navigator.permissions?.query({ name: "notifications" as PermissionName });
        permStatus?.addEventListener("change", onPermChange);
      } catch { /* Safari may not support querying notifications */ }
    })();

    // Fallback: re-check when the tab regains focus (e.g. after closing the
    // browser site settings panel). Auto-subscribe so flipping the OS/browser
    // toggle is reflected here without an extra click.
    const onVisible = () => {
      if (document.visibilityState === "visible") reconcile({ autoSubscribe: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      permStatus?.removeEventListener("change", onPermChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [reconcile, supported]);

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
        const result = await subscribeToPushDetailed();
        const sub = result.ok ? await getPushSubscription() : null;
        setEnabled(Notification.permission === "granted");
        setDeliveryReady(!!sub && Notification.permission === "granted");
        if (result.ok && sub) {
          setSetupMessage(null);
          toast.success("Web Push enabled");
        } else {
          setSetupMessage(result.error || "Browser permission is allowed, but delivery setup did not finish.");
          toast.error(result.reason === "auth" ? "Sign in again to finish notification setup" : "Could not finish push delivery setup");
        }
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
        setDeliveryReady(false);
        setSetupMessage(null);
        toast.success("Web Push disabled");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEnablePush = () => handleToggle(true);

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
              <p className="font-bold">
                {isIOSBrowser && !isStandaloneWebApp ? "Install TacLink to enable Web Push" : "Web Push not supported"}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {isIOSBrowser && !isStandaloneWebApp
                  ? "iPhone only allows website push notifications after you add TacLink to your Home Screen and open it from there."
                  : "This browser doesn't support website push notifications on this device."}
              </p>
              {isIOSBrowser && !isStandaloneWebApp && (
                <>
                  <ol className="mt-3 space-y-1 text-xs text-muted-foreground list-decimal pl-4">
                    {!isIOSSafariBrowser && <li>Open this page in the Safari app first.</li>}
                    <li>Tap Safari's share button.</li>
                    <li>Scroll down and choose Add to Home Screen.</li>
                    <li>If it is missing, tap Edit Actions and enable Add to Home Screen, or paste this link directly into Safari.</li>
                    <li>Open TacLink from the new Home Screen icon, then return here.</li>
                  </ol>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="default" asChild>
                      <a
                        href={`x-safari-https://${typeof window !== 'undefined' ? window.location.host : 'taclink.app'}/settings/notifications`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open in Safari
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href="/settings/notifications" target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open full site
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={copySiteUrl}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy link
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {supported && inIframe && (
          <div className="tactical-card p-4 flex gap-3 border border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-bold">You're in the Lovable preview</p>
              <p className="text-muted-foreground text-xs mt-1">
                Browsers block service workers and push delivery inside iframes, so the page can
                detect permission but can't complete delivery here. Open the published app at
                <a
                  href="https://taclink.app/settings/notifications"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline ml-1"
                >
                  taclink.app
                </a>{" "}
                to test push end-to-end.
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
              <div className="flex items-start gap-3 min-w-0 pr-3">
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
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Browser: {permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked" : "Not allowed yet"}
                    {permission === "granted" ? ` · Delivery: ${deliveryReady ? "Ready" : "Pending"}` : ""}
                  </p>
                </div>
              </div>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : !enabled && permission !== "denied" ? (
                <Button size="sm" onClick={handleEnablePush} disabled={!supported || busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Bell className="h-3.5 w-3.5 mr-1.5" />}
                  Enable
                </Button>
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
                <div className="flex flex-wrap gap-2 pl-6">
                  <Button size="sm" onClick={handleCheckAgain} disabled={checking}>
                    {checking ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Check again
                  </Button>
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
            {permission === "granted" && !deliveryReady && (
              <div className="px-4 py-3 space-y-2 bg-amber-500/5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-600 dark:text-amber-400">
                      Notifications are allowed — delivery setup is pending
                    </p>
                    <p className="text-muted-foreground mt-1">
                      {inIframe
                        ? "Open the published app to finish push delivery; browser previews cannot create push subscriptions."
                        : setupMessage || "Tap Finish setup to create the push subscription used for delivery and testing."}
                    </p>
                  </div>
                </div>
                {!inIframe && (
                  <div className="pl-6">
                    <Button size="sm" onClick={finishDeliverySetup} disabled={busy}>
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Finish setup
                    </Button>
                  </div>
                )}
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
              disabled={testing || !deliveryReady}
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
                {isIOSBrowser && !isStandaloneWebApp
                  ? "Open this page in Safari, add TacLink to your Home Screen, then enable Web Push from the installed app."
                  : "Enable Web Push above to send a test."}
              </p>
            )}
            {enabled && !deliveryReady && (
              <p className="text-[11px] text-muted-foreground text-center">
                Notifications are allowed. Finish delivery setup to send a test.
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
    </MobileShell>
  );
};

export default NotificationSettings;
