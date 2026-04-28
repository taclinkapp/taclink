import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, X, Send, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Role = "instructor" | "student";
type Msg = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS: Record<Role, { label: string; prompt: string }[]> = {
  instructor: [
    { label: "Build curriculum", prompt: "Help me build a curriculum for a new course. Ask me about discipline, duration, and student level, then produce a time-blocked agenda with learning objectives." },
    { label: "Gear list", prompt: "Generate a recommended student gear & equipment list for my course. Ask which discipline (pistol/rifle/CQB/medical/etc.) and round count if relevant." },
    { label: "Draft message", prompt: "Help me draft a quick, professional message to my students. Ask the purpose (confirmation, reminder, weather, follow-up) and any specifics." },
    { label: "Generate waiver", prompt: "Draft a liability waiver and assumption-of-risk for my course. Ask discipline, location/state, live-fire vs dry, and minor participation. Include the attorney-review disclaimer." },
  ],
  student: [
    { label: "Message instructor", prompt: "Help me draft a polite message to an instructor. Ask what I want to ask or say." },
    { label: "Write a review", prompt: "Help me write a thoughtful course review. Ask my rating, what I liked, and what could improve, then produce 2-3 paragraphs." },
    { label: "Packing list", prompt: "Build a personal packing list for an upcoming course. Ask discipline, duration, and weather." },
    { label: "What to expect", prompt: "Explain what to expect at a tactical training course. Ask which discipline so you can tailor it." },
  ],
};

export function AIAssistant({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          role,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: `Current path: ${window.location.pathname}`,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Rate limit — wait a moment and try again.");
        else if (resp.status === 402) toast.error("AI credits exhausted. Add credits in Workspace Settings.");
        else toast.error("AI assistant failed. Please try again.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsert(delta);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setMessages([]); setInput(""); };

  const isInstructor = role === "instructor";
  const accent = isInstructor ? "from-primary to-orange-500" : "from-primary to-amber-400";

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Open AI assistant"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-50 bottom-24 right-4 h-14 w-14 rounded-full shadow-xl",
          "bg-gradient-to-br text-primary-foreground flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          accent,
        )}
      >
        <Sparkles className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md h-[85vh] sm:h-[80vh] sm:rounded-2xl bg-surface border border-border flex flex-col overflow-hidden">
            <div className={cn("px-4 py-3 flex items-center gap-2 border-b border-border bg-gradient-to-r", accent)}>
              <Sparkles className="h-5 w-5 text-primary-foreground" />
              <div className="flex-1">
                <div className="text-sm font-bold text-primary-foreground">
                  {isInstructor ? "TacLink AI Coach" : "TacLink AI Buddy"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-primary-foreground/80">
                  {isInstructor ? "Curriculum • Gear • Waivers • Messages" : "Messages • Reviews • Gear lists"}
                </div>
              </div>
              {messages.length > 0 && (
                <Button onClick={reset} size="sm" variant="ghost" className="h-8 text-primary-foreground hover:bg-white/10 text-xs">
                  New
                </Button>
              )}
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-primary-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Hi! I can help with these tasks — pick one or just ask:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS[role].map((q) => (
                      <button
                        key={q.label}
                        onClick={() => send(q.prompt)}
                        className="tactical-card p-3 text-left text-xs font-semibold hover:border-primary/50 transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => <MessageBubble key={i} msg={m} />)
              )}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            <div className="border-t border-border p-3 bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder={isInstructor ? "Ask about curriculum, gear, waivers…" : "Ask for a message draft, review, gear list…"}
                  className="min-h-[44px] max-h-32 resize-none bg-background border-border text-sm"
                  rows={1}
                />
                <Button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="h-11 w-11 p-0 bg-primary text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const copy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_code]:text-xs">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
            {msg.content && (
              <button onClick={copy} className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
