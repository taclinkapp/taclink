import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles, ShieldAlert, CheckCircle2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const ContactSupport = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState(() => (searchParams.get('subject') ?? '').slice(0, 200));
  const [initial, setInitial] = useState(() => (searchParams.get('message') ?? '').slice(0, 4000));
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [creating, setCreating] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [needsHuman, setNeedsHuman] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const userRole = (user as any)?.user_metadata?.role ?? null;

  const startTicket = async () => {
    if (!user) { toast.error('Please sign in first'); return; }
    if (!subject.trim() || subject.trim().length < 3) { toast.error('Add a short subject'); return; }
    if (!initial.trim() || initial.trim().length < 10) { toast.error('Describe your issue (at least 10 chars)'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          user_role: userRole,
          contact_email: contactEmail.trim() || user.email,
          subject: subject.trim().slice(0, 200),
          initial_message: initial.trim().slice(0, 4000),
          page_url: window.location.href,
        })
        .select('id')
        .single();
      if (error) throw error;
      setTicketId(data.id);
      const firstMsg: ChatMsg = { role: 'user', content: initial.trim() };
      setMessages([firstMsg]);
      await sendToAI(data.id, [firstMsg], initial.trim());
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not start a support ticket');
    } finally {
      setCreating(false);
    }
  };

  const sendToAI = async (tid: string, history: ChatMsg[], userMessage: string) => {
    setStreaming(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-ai`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId: tid, messages: history, userMessage }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error('Rate limit — try again in a moment.');
        else if (resp.status === 402) toast.error('AI credits exhausted.');
        else toast.error('Support AI failed to respond.');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              const visible = acc.replace(/\[ESCALATE\]/g, '').trim();
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: visible };
                return next;
              });
            }
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }
      if (/\[ESCALATE\]/.test(acc)) setNeedsHuman(true);
    } catch (e) {
      console.error(e);
      toast.error('Connection error.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const sendFollowUp = async () => {
    if (!ticketId) return;
    const text = input.trim();
    if (!text) return;
    setInput('');
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    await sendToAI(ticketId, next, text);
  };

  const requestHuman = async () => {
    if (!ticketId) return;
    try {
      await supabase
        .from('support_tickets')
        .update({ needs_human: true, status: 'awaiting_human' })
        .eq('id', ticketId);
      setNeedsHuman(true);
      toast.success('A TacLink admin will follow up by email.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not flag for admin');
    }
  };

  return (
    <MobileShell>
      <PageHeader
        title="Contact Support"
        back
        onBack={() => (ticketId ? nav('/support') : window.history.back())}
      />
      <div className="px-4 py-4 pb-32">
        {!ticketId ? (
          <div className="space-y-4">
            <div className="tactical-card p-4 bg-gradient-to-br from-primary/10 to-card border border-primary/20">
              <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
                <Sparkles className="h-3.5 w-3.5" /> AI-Powered Support
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Tell us what's going on. Our AI handles common questions instantly. If it can't resolve your issue, your conversation is sent to a TacLink™ admin to follow up by email.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                placeholder="e.g. Can't cancel my booking"
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Describe your issue</label>
              <Textarea
                value={initial}
                onChange={(e) => setInitial(e.target.value.slice(0, 4000))}
                placeholder="What were you trying to do? What happened? Any error messages?"
                className="bg-card border-border min-h-32"
              />
              <div className="text-[10px] text-muted-foreground text-right">{initial.length}/4000</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Contact email</label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@email.com"
                className="bg-card border-border"
              />
            </div>

            <Button
              onClick={startTicket}
              disabled={creating}
              className="w-full bg-primary text-primary-foreground font-bold gap-2 h-11"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Start Support Chat
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {needsHuman && (
              <div className="tactical-card p-3 border border-amber-500/30 bg-amber-500/10 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-500">Sent to TacLink admin</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    A team member will follow up at <span className="font-semibold text-foreground">{contactEmail}</span> as soon as possible.
                  </p>
                </div>
              </div>
            )}

            <div ref={scrollRef} className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[88%]',
                    m.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'mr-auto bg-card border border-border',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*]:my-1.5 [&>p]:text-sm">
                      {m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendFollowUp();
                  }
                }}
                placeholder="Reply to the assistant…"
                disabled={streaming}
                className="bg-card border-border min-h-12 max-h-32"
              />
              <Button
                onClick={sendFollowUp}
                disabled={streaming || !input.trim()}
                className="bg-primary text-primary-foreground font-bold self-end h-11 px-3"
                aria-label="Send"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {!needsHuman && (
              <Button
                onClick={requestHuman}
                disabled={streaming}
                variant="outline"
                className="w-full bg-card border-border font-semibold gap-2"
              >
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Talk to a human admin instead
              </Button>
            )}

            <button
              onClick={() => nav('/support')}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2 flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> Done — back to Help Center
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  );
};

export default ContactSupport;
