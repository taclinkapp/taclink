import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import splashBg from "@/assets/splash-bg.mp4.asset.json";

const POLICY_VERSION = "v1.0";

type Status = "loading" | "needs_ack" | "ok";

/**
 * Gate that requires every authenticated user to acknowledge TacLink's
 * anti-bypass / on-platform policy at least once. Acknowledgments are
 * append-only (immutable audit trail) — a new row is inserted every time
 * we ship a new POLICY_VERSION.
 */
export const PolicyAcknowledgmentGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStatus("ok");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("policy_acknowledgments")
        .select("id")
        .eq("user_id", user.id)
        .eq("policy_version", POLICY_VERSION)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Fail open to avoid locking users out due to a transient error.
        console.error("Policy ack lookup failed", error);
        setStatus("ok");
        return;
      }
      setStatus(data ? "ok" : "needs_ack");
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleAcknowledge = async () => {
    if (!user || !agree || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("policy_acknowledgments").insert({
      user_id: user.id,
      policy_version: POLICY_VERSION,
      user_agent: navigator.userAgent,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not record acknowledgment", { description: error.message });
      return;
    }
    setStatus("ok");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "needs_ack") {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center px-6 py-10 overflow-hidden">
        <video
          src={splashBg.url}
          autoPlay loop muted playsInline aria-hidden
          className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
        />
        <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
        <div className="relative z-10 max-w-md w-full bg-card border border-border rounded-2xl p-6 space-y-5">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth/instructor-signup";
            }}
            aria-label="Back"
            className="inline-flex items-center gap-1.5 -ml-1 -mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Keep TacLink™ safe</h1>
              <p className="text-xs text-muted-foreground">Quick policy acknowledgment</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-bold">Bookings, messages, and payments stay on TacLink.</span>{" "}
                Payment is processed securely in-app and held in escrow — funds only
                release to your instructor after the course runs. Don't share contact
                info or arrange training off-platform.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="ack"
              checked={agree}
              onCheckedChange={(v) => setAgree(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="ack" className="text-xs text-muted-foreground leading-relaxed">
              I understand and agree to keep all interactions, bookings, and payments
              on TacLink. I acknowledge the platform's{" "}
              <a className="text-primary underline" href="/legal/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </a>
              .
            </label>
          </div>

          <Button
            onClick={handleAcknowledge}
            disabled={!agree || submitting}
            className="w-full h-11 font-bold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acknowledge & continue"}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
