import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, X, Send, Loader2, Copy, Check, Pencil, Save } from "lucide-react";
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
                  {isInstructor ? "TacLink™ AI Coach" : "TacLink™ AI Buddy"}
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
                messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    msg={m}
                    onEdit={(next) =>
                      setMessages((prev) => prev.map((mm, ii) => (ii === i ? { ...mm, content: next } : mm)))
                    }
                  />
                ))
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

// Replace [placeholder] tokens with inline uncontrolled inputs.
// We use a ref-backed store so typing does not trigger re-renders
// (which would otherwise remount the input and steal focus after 1 char).
function makeBlankRenderer(blanksRef: React.MutableRefObject<Record<string, string>>) {
  const render = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child, idx) => {
      if (typeof child === "string") {
        const parts = child.split(/(\[[^\]\n]{1,60}\])/g);
        if (parts.length === 1) return child;
        return parts.map((part, i) => {
          const m = part.match(/^\[([^\]\n]{1,60})\]$/);
          if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
          const key = m[1].trim().toLowerCase();
          const initial = blanksRef.current[key] ?? "";
          const width = Math.max(key.length, initial.length, 8) + 2;
          return (
            <input
              key={`blank-${key}-${idx}-${i}`}
              type="text"
              defaultValue={initial}
              onChange={(e) => {
                blanksRef.current[key] = e.target.value;
                // sync any sibling inputs with the same key on blur instead of every keystroke
              }}
              placeholder={key}
              style={{ width: `${width}ch` }}
              className="inline-block mx-0.5 px-1.5 py-0.5 rounded border border-primary/40 bg-primary/5 text-foreground placeholder:text-muted-foreground/70 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          );
        });
      }
      if (React.isValidElement(child) && (child as any).props?.children) {
        return React.cloneElement(child as any, {
          children: render((child as any).props.children),
        });
      }
      return child;
    });
  };
  return render;
}

function MessageBubble({ msg, onEdit }: { msg: Msg; onEdit?: (next: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const blanksRef = useRef<Record<string, string>>({});
  const isUser = msg.role === "user";

  useEffect(() => {
    if (!editing) setDraft(msg.content);
  }, [msg.content, editing]);

  const filled = (text: string) =>
    text.replace(/\[([^\]\n]{1,60})\]/g, (_, raw) => {
      const k = String(raw).trim().toLowerCase();
      const v = blanksRef.current[k];
      return v && v.trim() ? v : `[${raw}]`;
    });

  const copy = async () => {
    const base = editing ? draft : msg.content;
    await navigator.clipboard.writeText(filled(base));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveEdit = () => {
    onEdit?.(draft);
    setEditing(false);
    toast.success("Draft updated");
  };

  // Build the renderer once per message (stable across keystrokes).
  const renderWithBlanks = React.useMemo(() => makeBlankRenderer(blanksRef), []);

  const mdComponents = React.useMemo(
    () =>
      !isUser
        ? {
            p: ({ children }: any) => <p>{renderWithBlanks(children)}</p>,
            li: ({ children }: any) => <li>{renderWithBlanks(children)}</li>,
            strong: ({ children }: any) => <strong>{renderWithBlanks(children)}</strong>,
            em: ({ children }: any) => <em>{renderWithBlanks(children)}</em>,
            h1: ({ children }: any) => <h1>{renderWithBlanks(children)}</h1>,
            h2: ({ children }: any) => <h2>{renderWithBlanks(children)}</h2>,
            h3: ({ children }: any) => <h3>{renderWithBlanks(children)}</h3>,
            td: ({ children }: any) => <td>{renderWithBlanks(children)}</td>,
          }
        : undefined,
    [isUser, renderWithBlanks],
  );

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
        ) : editing ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[320px] w-[80vw] max-w-[520px] bg-background border-border text-sm font-mono leading-relaxed"
              autoFocus
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary hover:text-primary/80"
              >
                <Save className="h-3 w-3" /> Save
              </button>
              <button
                onClick={() => { setDraft(msg.content); setEditing(false); }}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={copy}
                className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_code]:text-xs">
              <ReactMarkdown components={mdComponents as any}>{msg.content}</ReactMarkdown>
            </div>
            {msg.content && (
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
