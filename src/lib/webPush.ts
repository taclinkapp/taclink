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
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    if (inIframe) return null;
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    try {
      await navigator.serviceWorker.ready;
    } catch {
      // The registration object is still usable even if `ready` is delayed.
    }
    return reg;
  } catch (e) {
    console.warn("[push] sw register failed", e);
    return null;
  }
};

export const getPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.getRegistration());
  if (!reg) return null;
  return reg.pushManager.getSubscription();
};

export type PushSubscribeResult = {
  ok: boolean;
  reason?: "unsupported" | "permission" | "registration" | "subscription" | "auth" | "save" | "unknown";
  error?: string;
};

export const subscribeToPushDetailed = async (): Promise<PushSubscribeResult> => {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (Notification.permission !== "granted") return { ok: false, reason: "permission" };

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration("/")) ||
      (await navigator.serviceWorker.getRegistration()) ||
      (await registerPushSW());
    if (!reg) return { ok: false, reason: "registration" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "subscription" };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "auth" };

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
      return { ok: false, reason: "save", error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[push] subscribe failed", e);
    return { ok: false, reason: "unknown", error: e instanceof Error ? e.message : String(e) };
  }
};

export const subscribeToPush = async (): Promise<boolean> => {
  const result = await subscribeToPushDetailed();
  return result.ok;
};

export const unsubscribeFromPush = async (): Promise<boolean> => {
  const sub = await getPushSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch (e) {
    console.warn("[push] unsubscribe failed", e);
  }
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return true;
};

export const sendTestPush = async (): Promise<{ ok: boolean; error?: string }> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase.functions.invoke("send-web-push", {
    body: { test: true },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
};
