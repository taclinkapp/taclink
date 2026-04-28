import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AdminHeader } from './AdminDashboard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Loader2, RefreshCw, ShieldAlert, MessageSquare, User, Bot, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

type Ticket = {
  id: string;
  user_id: string;
  user_role: string | null;
  contact_email: string | null;
  subject: string;
  initial_message: string;
  status: 'open' | 'awaiting_human' | 'resolved' | 'closed';
  needs_human: boolean;
  page_url: string | null;
  created_at: string;
  last_message_at: string;
};

type Msg = {
  id: string;
  ticket_id: string;
  sender: 'user' | 'ai' | 'admin';
  body: string;
  created_at: string;
};

const STATUS_OPTIONS: Ticket['status'][] = ['open', 'awaiting_human', 'resolved', 'closed'];

const statusBadge: Record<Ticket['status'], string> = {
  open: 'bg-primary/15 text-primary border-primary/30',
  awaiting_human: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

export const AdminSupportTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Ticket['status'] | 'needs_human'>('needs_human');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('support_tickets')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(200);
    if (filter === 'needs_human') q = q.eq('needs_human', true);
    else if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    setMessages([]);
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', t.id)
      .order('created_at');
    if (error) toast.error(error.message);
    setMessages((data ?? []) as Msg[]);
  };

  const updateStatus = async (status: Ticket['status']) => {
    if (!selected) return;
    const { error } = await supabase
      .from('support_tickets')
      .update({ status, needs_human: status === 'awaiting_human' })
      .eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status.replace('_', ' ')}`);
    setSelected({ ...selected, status });
    load();
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const adminId = sess.session?.user?.id;
      const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: selected.id,
        sender: 'admin',
        sender_user_id: adminId,
        body: reply.trim(),
      });
      if (error) throw error;
      setReply('');
      toast.success('Reply posted');
      openTicket(selected);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <AdminHeader title="Support Tickets" subtitle="AI-handled support conversations and human escalations" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {([
            ['needs_human', 'Needs Human'],
            ['all', 'All'],
            ['open', 'Open'],
            ['awaiting_human', 'Awaiting Human'],
            ['resolved', 'Resolved'],
            ['closed', 'Closed'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={cn(
                'px-3 h-8 rounded-md text-xs font-bold border transition',
                filter === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={load} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : tickets.length === 0 ? (
        <div className="tactical-card p-10 text-center text-sm text-muted-foreground">No tickets match this filter.</div>
      ) : (
        <div className="tactical-card divide-y divide-border overflow-hidden">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className="w-full p-4 text-left hover:bg-muted/30 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm truncate">{t.subject}</span>
                  <span className={cn('text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border', statusBadge[t.status])}>
                    {t.status.replace('_', ' ')}
                  </span>
                  {t.needs_human && t.status !== 'awaiting_human' && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-amber-500/15 text-amber-500 border-amber-500/30 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Needs human
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.initial_message}</p>
                <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-3">
                  <span>{t.contact_email ?? '—'}</span>
                  <span>{t.user_role ?? 'user'}</span>
                  <span>Updated {new Date(t.last_message_at).toLocaleString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          >
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-base">{selected.subject}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.contact_email} · {selected.user_role ?? 'user'} · Opened {new Date(selected.created_at).toLocaleString()}
                  </p>
                  {selected.page_url && (
                    <p className="text-[10px] text-muted-foreground truncate mt-1">From: {selected.page_url}</p>
                  )}
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xl px-2">×</button>
              </div>
              <div className="flex gap-1.5 mt-3">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={cn(
                      'px-2.5 h-7 rounded text-[10px] uppercase tracking-wider font-bold border transition',
                      selected.status === s ? statusBadge[s] : 'bg-background border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]',
                    m.sender === 'user' && 'bg-primary/10 border border-primary/20 mr-auto',
                    m.sender === 'ai' && 'bg-muted/40 border border-border mr-auto',
                    m.sender === 'admin' && 'bg-emerald-500/10 border border-emerald-500/30 ml-auto',
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1 opacity-70">
                    {m.sender === 'user' && <><User className="h-3 w-3" /> User</>}
                    {m.sender === 'ai' && <><Bot className="h-3 w-3" /> AI</>}
                    {m.sender === 'admin' && <><Shield className="h-3 w-3" /> Admin</>}
                    <span className="ml-1 font-normal opacity-70">· {new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  {m.sender === 'ai' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*]:my-1.5">
                      <ReactMarkdown>{m.body}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply as admin (visible to the user)…"
                className="bg-background border-border min-h-20"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelected(null)} className="bg-card">Close</Button>
                <Button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="bg-primary text-primary-foreground font-bold gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Send Reply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
