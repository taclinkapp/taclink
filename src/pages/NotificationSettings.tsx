import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Send, Loader2, AlertCircle } from "lucide-react";
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
        // @ts-expect-error - "notifications" is a valid PermissionName
        permStatus = await navigator.permissions?.query({ name: "notifications" });
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
              <div className="px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
                Notifications are blocked at the browser level. Update your browser site settings to
                re-enable.
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
    </MobileShell>
  );
};

export default NotificationSettings;
