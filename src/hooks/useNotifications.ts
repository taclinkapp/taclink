import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/messaging";

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
  const user = getCurrentUser();
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
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
  }, []);

  return { items, loading, unreadCount, markAllRead, markRead, reload: load };
};
