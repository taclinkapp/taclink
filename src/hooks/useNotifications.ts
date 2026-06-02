import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/hooks/useIdentity";

export type NotificationRow = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  conversation_id: string | null;
  read_at: string | null;
  created_at: string;
};

export const useNotifications = () => {
  const user = useIdentity();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setItems((data as NotificationRow[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
    if (!user) return;

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          setItems((prev) => {
            const next = payload.new as NotificationRow;
            if (prev.some((n) => n.id === next.id)) return prev;
            return [next, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .is("read_at", null);
  }, [user?.id]);

  const markRead = useCallback(async (id: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("recipient_id", user.id);
    if (error) {
      console.error("markRead failed", error);
      // Roll back optimistic update so the UI doesn't lie.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)));
    }
  }, [user?.id]);

  const setReadState = useCallback(async (ids: string[], read: boolean) => {
    if (!user || ids.length === 0) return;
    const value = read ? new Date().toISOString() : null;
    const prevValues = new Map(items.filter((n) => ids.includes(n.id)).map((n) => [n.id, n.read_at]));
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: value } : n)));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: value })
      .in("id", ids)
      .eq("recipient_id", user.id);
    if (error) {
      console.error("setReadState failed", error);
      setItems((prev) => prev.map((n) => (prevValues.has(n.id) ? { ...n, read_at: prevValues.get(n.id) ?? null } : n)));
    }
  }, [user?.id, items]);

  return { items, loading, unreadCount, markAllRead, markRead, setReadState, reload: load };
};

