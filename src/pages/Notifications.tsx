import { useNavigate } from "react-router-dom";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { useNotifications } from "@/hooks/useNotifications";
import { getCurrentUser } from "@/lib/messaging";
import { Bell, MessageSquare, Loader2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const iconFor = (type: string) => {
  switch (type) {
    case "message":
      return MessageSquare;
    default:
      return Bell;
  }
};

const Notifications = () => {
  const nav = useNavigate();
  const user = getCurrentUser();
  const { items, loading, unreadCount, markAllRead, markRead } = useNotifications();

  const handleClick = (id: string, link: string | null) => {
    markRead(id);
    if (link) nav(link);
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader
        back
        onBack={() => nav(-1)}
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="text-xs h-8 text-primary hover:text-primary"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          ) : null
        }
      />

      {!user && (
        <div className="text-center py-16 px-6">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">Sign in to view your notifications.</p>
        </div>
      )}

      {user && loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {user && !loading && items.length === 0 && (
        <div className="text-center py-16 px-6">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold">All caught up</p>
          <p className="text-xs text-muted-foreground mt-1">
            New messages and updates will appear here.
          </p>
        </div>
      )}

      <div className="divide-y divide-border">
        {items.map((n) => {
          const Icon = iconFor(n.type);
          const unread = !n.read_at;
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n.id, n.link)}
              className={cn(
                "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-card/60 transition-colors",
                unread && "bg-card/40",
              )}
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-full grid place-items-center flex-shrink-0",
                  unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("text-sm truncate", unread ? "font-bold" : "font-medium")}>
                    {n.title}
                  </p>
                  {unread && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                  {formatRelative(n.created_at)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </MobileShell>
  );
};

export default Notifications;
