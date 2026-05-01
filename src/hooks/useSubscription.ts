import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStripeEnvironment } from "@/lib/stripe";

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

  const refetch = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("environment", getStripeEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as SubscriptionRow | null) ?? null);
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

  const now = Date.now();
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
  const status = subscription?.status;

  const isActive = !!subscription && (
    ((status === "active" || status === "trialing" || status === "past_due") && (!periodEnd || periodEnd > now))
    || (status === "canceled" && !!periodEnd && periodEnd > now)
  );

  const isPastDue = status === "past_due" && (!periodEnd || periodEnd > now);
  const isCanceledGrace = status === "canceled" && !!periodEnd && periodEnd > now;
  const isLapsed = !!subscription && !isActive;
  const hasNeverSubscribed = !subscription;

  return {
    subscription,
    loading,
    isActive,
    isPastDue,
    isCanceledGrace,
    isLapsed,
    hasNeverSubscribed,
    refetch,
  };
}
