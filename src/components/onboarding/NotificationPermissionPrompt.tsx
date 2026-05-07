import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";

/**
 * Shown after a user's first booking. Soft-asks for push notification permission.
 * Uses the browser Notification API so it works on the web shell; the underlying
 * native bridge can hook into the same handler later.
 */
export const NotificationPermissionPrompt = ({ onClose }: { onClose: () => void }) => {
  const { markNotifPromptShown } = useOnboarding();

  const allow = async () => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }
    await markNotifPromptShown();
    onClose();
  };

  const skip = async () => {
    await markNotifPromptShown();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm grid place-items-end sm:place-items-center px-4 pb-6 sm:pb-0">
      <div className="w-full max-w-sm neu rounded-2xl p-6 relative animate-scale-in">
        <button
          onClick={skip}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="h-12 w-12 rounded-full bg-primary/15 grid place-items-center mx-auto">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-black text-center">Stay Mission Ready</h2>
        <p className="mt-2 text-sm text-muted-foreground text-center leading-relaxed">
          Get reminders 24 hours before your course so you never miss a session.
        </p>

        <div className="mt-6 space-y-2">
          <Button size="lg" onClick={allow} className="w-full h-12 font-bold">
            Allow Notifications
          </Button>
          <button
            onClick={skip}
            className="w-full h-10 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};
