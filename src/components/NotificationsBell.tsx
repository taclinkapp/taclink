import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

type Props = {
  to?: string;
  className?: string;
};

export const NotificationsBell = ({ to = "/notifications", className }: Props) => {
  const nav = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={() => nav(to)}
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      className={cn(
        "relative h-10 w-10 grid place-items-center rounded-full hover:bg-card transition-colors",
        className,
      )}
    >
      <Bell className="h-5 w-5 text-foreground" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center amber-glow">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};
