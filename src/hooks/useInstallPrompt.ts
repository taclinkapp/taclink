import { useCallback, useEffect, useState } from "react";

export type InstallPlatform = "ios-safari" | "ios-other" | "android-chrome" | "android-other" | "desktop" | "unknown";

const DISMISS_KEY = "install-prompt-dismissed-at";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const detectPlatform = (): InstallPlatform => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  if (isAndroid) return isChrome ? "android-chrome" : "android-other";
  return "desktop";
};

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
};

const inIframe = (() => {
  try { return typeof window !== "undefined" && window.self !== window.top; }
  catch { return true; }
})();

export const useInstallPrompt = () => {
  const [platform] = useState<InstallPlatform>(() => detectPlatform());
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [bip, setBip] = useState<BeforeInstallPromptEvent | null>(null);
  const [recentlyDismissed, setRecentlyDismissed] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerNativePrompt = useCallback(async () => {
    if (!bip) return false;
    await bip.prompt();
    const choice = await bip.userChoice;
    setBip(null);
    return choice.outcome === "accepted";
  }, [bip]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setRecentlyDismissed(true);
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
    setRecentlyDismissed(false);
  }, []);

  const canShow = !installed && !inIframe;
  const showBanner = canShow && !recentlyDismissed;

  return {
    platform,
    installed,
    inIframe,
    canShow,
    showBanner,
    hasNativePrompt: !!bip,
    triggerNativePrompt,
    dismiss,
    reset,
  };
};
