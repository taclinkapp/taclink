import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, ShieldAlert, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ConversationRow } from "@/lib/messaging";

type Row = ConversationRow & { flagged_count?: number };

export const AdminConversations = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) {
        console.error(error);
        setRows([]);
      } else {
        // Pull flagged-message counts in a second query.
        const ids = (data ?? []).map((c) => c.id);
        let counts: Record<string, number> = {};
        if (ids.length) {
          const { data: flagged } = await supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", ids)
            .eq("is_flagged", true);
          (flagged ?? []).forEach((m: any) => {
            counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
          });
        }
        setRows(
          (data as ConversationRow[]).map((c) => ({
            ...c,
            flagged_count: counts[c.id] ?? 0,
          })),
        );
      }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      (r.student_name ?? "").toLowerCase().includes(needle) ||
      (r.instructor_name ?? "").toLowerCase().includes(needle) ||
      (r.course_title ?? "").toLowerCase().includes(needle) ||
      (r.last_message ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Conversations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin view of every student↔instructor thread. Booking gate is bypassed
          for moderation. Read-only — use the flagged column to triage bypass attempts.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, course, or message…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Student</th>
                <th className="text-left px-4 py-2.5 font-semibold">Instructor</th>
                <th className="text-left px-4 py-2.5 font-semibold">Course</th>
                <th className="text-left px-4 py-2.5 font-semibold">Last message</th>
                <th className="text-left px-4 py-2.5 font-semibold">Flagged</th>
                <th className="text-left px-4 py-2.5 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-card/60 transition"
                >
                  <td className="px-4 py-3">{r.student_name ?? "—"}</td>
                  <td className="px-4 py-3">{r.instructor_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.course_title ?? "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[280px] truncate text-muted-foreground">
                    {r.last_message ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.flagged_count ? (
                      <span className="inline-flex items-center gap-1 text-destructive font-bold">
                        <ShieldAlert className="h-3.5 w-3.5" /> {r.flagged_count}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.last_message_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/conversations/${r.id}`}
                      className="text-primary text-xs font-bold hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No conversations match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
