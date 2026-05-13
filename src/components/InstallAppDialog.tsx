import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, PlusSquare, MoreVertical, Download, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";
import { useInstallPrompt, type InstallPlatform } from "@/hooks/useInstallPrompt";

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const stepsFor = (platform: InstallPlatform): Step[] => {
  switch (platform) {
    case "ios-safari":
      return [
        { icon: <Share className="h-4 w-4" />, title: "Tap the Share button", body: "It's at the bottom of Safari (a square with an arrow pointing up)." },
        { icon: <PlusSquare className="h-4 w-4" />, title: "Choose Add to Home Screen", body: "Scroll the share menu — you may need to tap Edit Actions to enable it." },
        { icon: <Smartphone className="h-4 w-4" />, title: "Tap Add", body: "TacLink will appear on your Home Screen. Open it from there to use it like an app and receive push notifications." },
      ];
    case "ios-other":
      return [
        { icon: <Copy className="h-4 w-4" />, title: "Open this page in Safari", body: "Other browsers on iPhone can't install web apps. Copy the link or open the site in Safari." },
        { icon: <Share className="h-4 w-4" />, title: "Tap the Share button", body: "In Safari, tap the share icon at the bottom of the screen." },
        { icon: <PlusSquare className="h-4 w-4" />, title: "Add to Home Screen", body: "Scroll the share sheet, choose Add to Home Screen, then Add." },
      ];
    case "android-chrome":
      return [
        { icon: <MoreVertical className="h-4 w-4" />, title: "Open the menu", body: "Tap the three-dot menu at the top right of Chrome." },
        { icon: <Download className="h-4 w-4" />, title: "Tap Install app", body: "It may also appear as Add to Home screen. Confirm to install." },
        { icon: <Smartphone className="h-4 w-4" />, title: "Open from your launcher", body: "TacLink will run in its own window and can deliver push notifications." },
      ];
    case "android-other":
      return [
        { icon: <MoreVertical className="h-4 w-4" />, title: "Open the browser menu", body: "Look for an option called Install app, Add to Home screen, or similar." },
        { icon: <Download className="h-4 w-4" />, title: "Confirm install", body: "If you don't see the option, open this site in Chrome — it has the best support for installing." },
        { icon: <Smartphone className="h-4 w-4" />, title: "Launch from your home screen", body: "Open TacLink from the new icon to use it like an app." },
      ];
    case "desktop":
      return [
        { icon: <Download className="h-4 w-4" />, title: "Look for the install icon", body: "In Chrome, Edge, or Brave, an install icon appears at the right of the address bar." },
        { icon: <PlusSquare className="h-4 w-4" />, title: "Click Install", body: "Confirm the prompt to add TacLink as a desktop app." },
        { icon: <Smartphone className="h-4 w-4" />, title: "Launch from your apps", body: "TacLink opens in its own window and supports notifications." },
      ];
    default:
      return [
        { icon: <Smartphone className="h-4 w-4" />, title: "Use a supported browser", body: "Install works best in Safari on iPhone and Chrome/Edge on Android and desktop." },
        { icon: <Download className="h-4 w-4" />, title: "Find the install option", body: "Open the browser menu and look for Install app or Add to Home Screen." },
      ];
  }
};

const platformLabel = (p: InstallPlatform) => {
  switch (p) {
    case "ios-safari": return "iPhone · Safari";
    case "ios-other": return "iPhone";
    case "android-chrome": return "Android · Chrome";
    case "android-other": return "Android";
    case "desktop": return "Desktop";
    default: return "Your device";
  }
};

export const InstallAppDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { platform, hasNativePrompt, triggerNativePrompt } = useInstallPrompt();
  const steps = useMemo(() => stepsFor(platform), [platform]);

  const handleNative = async () => {
    const accepted = await triggerNativePrompt();
    if (accepted) {
      toast.success("App installed");
      onOpenChange(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install TacLink as an app</DialogTitle>
          <DialogDescription>
            {platformLabel(platform)} · Add TacLink to your home screen for a faster,
            full-screen experience and push notifications.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-muted-foreground">{step.icon}</span>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2 pt-2">
          {hasNativePrompt && (
            <Button onClick={handleNative} className="flex-1 min-w-[140px]">
              <Download className="h-4 w-4 mr-2" />
              Install now
            </Button>
          )}
          {(platform === "ios-other") && (
            <Button variant="outline" onClick={copyLink} className="flex-1 min-w-[140px]">
              <Copy className="h-4 w-4 mr-2" />
              Copy site link
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 min-w-[100px]">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
