import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { StudentTabBar } from "@/components/StudentTabBar";
import { supabase } from "@/integrations/supabase/client";
import { type ConversationRow } from "@/lib/messaging";
import { useIdentity } from "@/hooks/useIdentity";
import { MessageSquare, ChevronRight } from "lucide-react";

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

type Props = {
  variant: "student" | "instructor";
  basePath: string;
  TabBar?: React.ComponentType;
};

export const Inbox = ({ variant, basePath, TabBar }: Props) => {
  const user = useIdentity();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const column = variant === "student" ? "student_id" : "instructor_id";

    const load = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq(column, user.id)
        .order("last_message_at", { ascending: false });
      if (error) console.error(error);
      setConversations((data as ConversationRow[]) ?? []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `${column}=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, variant]);

  return (
    <MobileShell>
      <PageHeader title="Messages" />
      <div className="px-4 pb-32">
        {!user && (
          <div className="tactical-card p-6 text-center text-sm text-muted-foreground">
            Sign in to see your messages.
          </div>
        )}
        {user && loading && (
          <div className="text-center text-xs text-muted-foreground py-8">Loading…</div>
        )}
        {user && !loading && conversations.length === 0 && (
          <div className="tactical-card p-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">No messages yet</p>
            <p className="text-xs text-muted-foreground">
              {variant === "student"
                ? "Open a course and tap “Message” to chat with the instructor."
                : "Students who book your courses will appear here."}
            </p>
          </div>
        )}
        <div className="space-y-2 mt-2">
          {conversations.map((c) => {
            const otherName = variant === "student" ? c.instructor_name : c.student_name;
            const otherPhoto = variant === "student" ? c.instructor_photo : c.student_photo;
            return (
              <Link
                key={c.id}
                to={`${basePath}/${c.id}`}
                className="tactical-card p-3 flex items-center gap-3 hover:border-primary/50 transition"
              >
                <img
                  src={otherPhoto ?? `https://i.pravatar.cc/100?u=${c.id}`}
                  className="h-12 w-12 rounded-full object-cover border border-border shrink-0"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm truncate">{otherName ?? "Unknown"}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatWhen(c.last_message_at)}
                    </span>
                  </div>
                  {c.course_title && (
                    <div className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5 truncate">
                      {c.course_title}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    {sanitizePreview(c.last_message) ?? "Start the conversation"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
      {TabBar ? <TabBar /> : variant === "student" ? <StudentTabBar /> : null}
    </MobileShell>
  );
};
