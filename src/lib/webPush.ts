// Client helpers to register the push service worker and subscribe the user.
import { supabase } from "@/integrations/supabase/client";

// Fallback public VAPID key (safe to ship to the client). The active key is
// fetched from the backend so client subscriptions always match server sends.
const FALLBACK_VAPID_PUBLIC_KEY =
  "BHsD8tWB_Bpjo3etmVmwbrx2v8vdAmKgUFiKlJyaD8CAWPq_fjrlcCTiIeJ-Dklj8F8dog6Ys2CxaWozxhw3pgg";

let cachedVapidPublicKey: string | null = null;

const getVapidPublicKey = async (): Promise<string> => {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;
  try {
    const { data, error } = await supabase.functions.invoke("send-web-push", {
      body: { action: "vapid-public-key" },
    });
    if (!error && typeof data?.publicKey === "string" && data.publicKey.length > 40) {
      cachedVapidPublicKey = data.publicKey;
      return cachedVapidPublicKey;
    }
  } catch (e) {
    console.warn("[push] failed to fetch active VAPID public key", e);
  }
  return FALLBACK_VAPID_PUBLIC_KEY;
};

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
    // If existing subscription was created with a different VAPID key, drop it and re-subscribe.
    if (sub) {
      const existingKey = sub.options?.applicationServerKey;
      const expected = urlBase64ToUint8Array(await getVapidPublicKey());
      const matches =
        existingKey instanceof ArrayBuffer &&
        new Uint8Array(existingKey).length === expected.length &&
        new Uint8Array(existingKey).every((b, i) => b === expected[i]);
      if (!matches) {
        try {
          const oldEndpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.from("push_subscriptions").delete().eq("endpoint", oldEndpoint);
        } catch (e) {
          console.warn("[push] failed to drop stale subscription", e);
        }
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(await getVapidPublicKey()) as BufferSource,
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

  const setup = await subscribeToPushDetailed();
  if (!setup.ok) {
    return {
      ok: false,
      error: setup.error || "Push delivery is not ready. Turn Web Push off, then on again.",
    };
  }

  const { data, error } = await supabase.functions.invoke("send-web-push", {
    body: { test: true },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  if (!data?.sent) return { ok: false, error: "No notification was delivered. Turn Web Push off, then on again." };
  return { ok: true };
};
