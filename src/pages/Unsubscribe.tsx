import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("ready");
        } else {
          setStatus("invalid");
        }
      } catch (e) {
        setStatus("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.success) {
        setStatus("done");
      } else if ((data as any)?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setErrorMsg("Something went wrong.");
        setStatus("error");
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Something went wrong.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md p-8 space-y-6 text-center">
        <h1 className="text-xl font-bold tracking-wider uppercase text-foreground">
          Email preferences
        </h1>

        {status === "loading" && (
          <p className="text-sm text-muted-foreground">Verifying your link…</p>
        )}

        {status === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">
              Confirm you'd like to unsubscribe from TacLink™ app emails. You'll
              still receive critical account emails like password resets.
            </p>
            <Button onClick={confirm} className="w-full">
              Confirm unsubscribe
            </Button>
          </>
        )}

        {status === "submitting" && (
          <p className="text-sm text-muted-foreground">Updating your preferences…</p>
        )}

        {status === "done" && (
          <p className="text-sm text-foreground">
            You've been unsubscribed. We're sorry to see you go.
          </p>
        )}

        {status === "already" && (
          <p className="text-sm text-foreground">
            This email is already unsubscribed. No further action needed.
          </p>
        )}

        {status === "invalid" && (
          <p className="text-sm text-destructive">
            This unsubscribe link is invalid or has expired.
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}
      </Card>
    </div>
  );
}
