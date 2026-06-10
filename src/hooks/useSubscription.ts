import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPaymentEnvironment } from "@/lib/paymentEnv";
import { useFounderStatus } from "@/hooks/useFounderStatus";

export type SubscriptionRow = {
  id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
};

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTestAccount, setIsTestAccount] = useState(false);

  const refetch = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setIsTestAccount(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data }, { data: testRows }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("environment", getPaymentEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("test_accounts").select("id").eq("user_id", user.id).limit(1),
    ]);
    setSubscription((data as SubscriptionRow | null) ?? null);
    setIsTestAccount(Array.isArray(testRows) && testRows.length > 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);


  // Realtime updates — depend only on user.id so refetch identity changes don't
  // cause us to re-add listeners to an already-subscribed channel.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subs-${user.id}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => { refetch(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const founder = useFounderStatus();

  const now = Date.now();
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
  const status = subscription?.status;

  const paidActive = !!subscription && (
    ((status === "active" || status === "trialing" || status === "past_due") && (!periodEnd || periodEnd > now))
    || (status === "canceled" && !!periodEnd && periodEnd > now)
  );

  // Paid Pro takes precedence; founder free Pro layers in cleanly when no paid sub is active.
  const isActive = paidActive || founder.hasFreeProNow;
  const isFounderPro = !paidActive && founder.hasFreeProNow;

  const isPastDue = status === "past_due" && (!periodEnd || periodEnd > now);
  const isCanceledGrace = status === "canceled" && !!periodEnd && periodEnd > now;
  const isLapsed = !!subscription && !paidActive && !founder.hasFreeProNow;
  const hasNeverSubscribed = !subscription && !founder.hasFreeProNow;

  return {
    subscription,
    loading: loading || founder.loading,
    isActive,
    isFounderPro,
    isPastDue,
    isCanceledGrace,
    isLapsed,
    hasNeverSubscribed,
    refetch,
  };
}
