import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert, Check, Trash2, X, Loader2, ImageIcon } from "lucide-react";

type Flag = {
  id: string;
  content_type: string;
  content_id: string | null;
  conversation_id: string | null;
  course_id: string | null;
  author_id: string | null;
  author_role: string | null;
  category: string;
  severity: string;
  reason: string | null;
  excerpt: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
};

const sevColor = (sev: string) =>
  sev === "high"
    ? "bg-destructive text-destructive-foreground"
    : sev === "medium"
      ? "bg-amber-500 text-white"
      : "bg-muted text-muted-foreground";

const AdminModeration = () => {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("flagged_content")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setFlags((data as Flag[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const act = async (
    flag: Flag,
    action: "approve" | "remove" | "dismiss",
  ) => {
    setActing(flag.id);
    try {
      const newStatus =
        action === "approve" ? "approved" : action === "remove" ? "removed" : "dismissed";

      // If approving, restore the source row visibility.
      // If removing, keep it hidden (already flagged).
      if (action === "approve" && flag.content_id) {
        if (flag.content_type === "message") {
          await supabase
            .from("messages")
            .update({
              moderation_status: "approved",
              is_flagged: false,
              flag_reason: null,
            })
            .eq("id", flag.content_id);
        } else if (
          flag.content_type === "course_text" ||
          flag.content_type === "course_image"
        ) {
          await supabase
            .from("courses")
            .update({ moderation_status: "approved" })
            .eq("id", flag.content_id);
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from("flagged_content")
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userData.user?.id ?? null,
        })
        .eq("id", flag.id);

      toast.success(`Marked ${newStatus}`);
      setFlags((prev) => prev.filter((f) => f.id !== flag.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            AI Moderation Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Content flagged by AI for explicit material, off-platform attempts, or harassment.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-lg">
          No flagged content. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <div
              key={f.id}
              className="border border-border rounded-lg p-4 bg-card flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={sevColor(f.severity)}>{f.severity}</Badge>
                <Badge variant="outline">{f.category}</Badge>
                <Badge variant="secondary">{f.content_type}</Badge>
                <Badge variant="outline">{f.status}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(f.created_at).toLocaleString()}
                </span>
              </div>

              {f.reason && (
                <div className="text-sm">
                  <span className="font-semibold">AI reason: </span>
                  <span className="text-muted-foreground">{f.reason}</span>
                </div>
              )}

              {f.excerpt && (
                <div className="bg-muted/50 rounded p-3 text-sm whitespace-pre-wrap break-words">
                  {f.excerpt}
                </div>
              )}

              {f.image_url && (
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={f.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline truncate max-w-md"
                  >
                    {f.image_url}
                  </a>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Author: {f.author_role ?? "?"} · {f.author_id ?? "unknown"}
              </div>

              {f.status === "pending" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(f, "approve")}
                    disabled={acting === f.id}
                  >
                    <Check className="h-4 w-4 mr-1" /> Approve & Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => act(f, "remove")}
                    disabled={acting === f.id}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Keep Removed
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(f, "dismiss")}
                    disabled={acting === f.id}
                  >
                    <X className="h-4 w-4 mr-1" /> Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminModeration;
