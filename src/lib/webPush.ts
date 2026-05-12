// Client helpers to register the push service worker and subscribe the user.
import { supabase } from "@/integrations/supabase/client";

// Public VAPID key (safe to ship to the client).
export const VAPID_PUBLIC_KEY =
  "BCdiwuBfarxq04NesayCjuSTgLiuH_J8TH4kO-yOtKVnQjIsiW45Xn5HjCOuWRCRbM5BVgS-dXxhz96Nkr3ro_U";

export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  typeof Notification !== "undefined";

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export const registerPushSW = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) return null;
  try {
    // Avoid registering inside the Lovable editor iframe.
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    if (inIframe) return null;
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("[push] sw register failed", e);
    return null;
  }
};

export const subscribeToPush = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerPushSW());
  if (!reg) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.warn("[push] save subscription failed", error);
    return false;
  }
  return true;
};
