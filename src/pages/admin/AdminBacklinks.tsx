import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Bell, ExternalLink, Link2, Megaphone, Plus, TrendingUp, Trash2, Check } from 'lucide-react';

type Backlink = {
  id: string;
  source_domain: string;
  source_url: string;
  target_url: string;
  anchor_text: string | null;
  link_type: string;
  domain_authority: number | null;
  first_seen_at: string;
  last_checked_at: string | null;
  status: string;
  notes: string | null;
  linked_course_id: string | null;
  linked_article_id: string | null;
  outreach_id: string | null;
};

type Outreach = {
  id: string;
  target_domain: string;
  target_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  outreach_type: string;
  status: string;
  pitch_notes: string | null;
  follow_up_at: string | null;
  responded_at: string | null;
  linked_course_id: string | null;
  linked_article_id: string | null;
  created_at: string;
};

type Alert = {
  id: string;
  source_domain: string;
  alert_type: string;
  message: string | null;
  acknowledged: boolean;
  created_at: string;
  backlink_id: string | null;
};

type CourseRef = { id: string; title: string };
type ArticleRef = { id: string; title: string; slug: string };

const domainFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'active': case 'responded': case 'acquired': return 'default';
    case 'planned': case 'sent': return 'secondary';
    case 'lost': case 'declined': return 'destructive';
    default: return 'outline';
  }
};

export default function AdminBacklinks() {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [courses, setCourses] = useState<CourseRef[]>([]);
  const [articles, setArticles] = useState<ArticleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [backlinkOpen, setBacklinkOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [b, o, a, c, ar] = await Promise.all([
      supabase.from('backlinks').select('*').order('first_seen_at', { ascending: false }),
      supabase.from('backlink_outreach').select('*').order('created_at', { ascending: false }),
      supabase.from('backlink_alerts').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('courses').select('id,title').eq('status', 'published').order('title').limit(500),
      supabase.from('seo_articles').select('id,title,slug').order('published_at', { ascending: false }).limit(500),
    ]);
    if (b.error) toast.error(b.error.message);
    setBacklinks((b.data ?? []) as Backlink[]);
    setOutreach((o.data ?? []) as Outreach[]);
    setAlerts((a.data ?? []) as Alert[]);
    setCourses((c.data ?? []) as CourseRef[]);
    setArticles((ar.data ?? []) as ArticleRef[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const active = backlinks.filter(b => b.status === 'active');
    const refDomains = new Set(active.map(b => b.source_domain));
    const dofollow = active.filter(b => b.link_type === 'dofollow').length;
    const avgDA = active.filter(b => b.domain_authority != null);
    const meanDA = avgDA.length ? Math.round(avgDA.reduce((s, b) => s + (b.domain_authority ?? 0), 0) / avgDA.length) : 0;
    return {
      total: active.length,
      domains: refDomains.size,
      dofollow,
      avgDA: meanDA,
      pendingOutreach: outreach.filter(o => ['planned', 'sent'].includes(o.status)).length,
      unreadAlerts: alerts.filter(a => !a.acknowledged).length,
    };
  }, [backlinks, outreach, alerts]);

  const domainGroups = useMemo(() => {
    const groups = new Map<string, Backlink[]>();
    backlinks.forEach(b => {
      const list = groups.get(b.source_domain) ?? [];
      list.push(b);
      groups.set(b.source_domain, list);
    });
    return Array.from(groups.entries())
      .map(([domain, items]) => ({
        domain,
        count: items.length,
        firstSeen: items.reduce((min, i) => i.first_seen_at < min ? i.first_seen_at : min, items[0].first_seen_at),
        maxDA: Math.max(0, ...items.map(i => i.domain_authority ?? 0)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [backlinks]);

  const targetGroups = useMemo(() => {
    const byCourse = new Map<string, Backlink[]>();
    const byArticle = new Map<string, Backlink[]>();
    backlinks.forEach(b => {
      if (b.linked_course_id) {
        const l = byCourse.get(b.linked_course_id) ?? [];
        l.push(b); byCourse.set(b.linked_course_id, l);
      }
      if (b.linked_article_id) {
        const l = byArticle.get(b.linked_article_id) ?? [];
        l.push(b); byArticle.set(b.linked_article_id, l);
      }
    });
    return {
      courses: Array.from(byCourse.entries()).map(([id, items]) => ({
        id, title: courses.find(c => c.id === id)?.title ?? '(deleted)', items,
      })).sort((a, b) => b.items.length - a.items.length),
      articles: Array.from(byArticle.entries()).map(([id, items]) => ({
        id,
        title: articles.find(a => a.id === id)?.title ?? '(deleted)',
        slug: articles.find(a => a.id === id)?.slug ?? '',
        items,
      })).sort((a, b) => b.items.length - a.items.length),
    };
  }, [backlinks, courses, articles]);

  const ackAlert = async (id: string) => {
    const { error } = await supabase.from('backlink_alerts').update({
      acknowledged: true, acknowledged_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Alert acknowledged'); load(); }
  };

  const deleteBacklink = async (id: string) => {
    if (!confirm('Delete this backlink record?')) return;
    const { error } = await supabase.from('backlinks').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  };

  const deleteOutreach = async (id: string) => {
    if (!confirm('Delete this outreach record?')) return;
    const { error } = await supabase.from('backlink_outreach').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" /> Backlink Tracker
          </h1>
          <p className="text-sm text-muted-foreground">Outreach, acquired links, and referring-domain monitoring</p>
        </div>
        <div className="flex gap-2">
          <NewOutreachDialog
            open={outreachOpen} setOpen={setOutreachOpen}
            courses={courses} articles={articles} onSaved={load}
          />
          <NewBacklinkDialog
            open={backlinkOpen} setOpen={setBacklinkOpen}
            courses={courses} articles={articles} outreach={outreach} onSaved={load}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Active Links" value={stats.total} />
        <StatCard label="Referring Domains" value={stats.domains} />
        <StatCard label="Dofollow" value={stats.dofollow} />
        <StatCard label="Avg DA" value={stats.avgDA} />
        <StatCard label="Pending Outreach" value={stats.pendingOutreach} />
        <StatCard label="New Alerts" value={stats.unreadAlerts} accent={stats.unreadAlerts > 0} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard"><TrendingUp className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="h-4 w-4 mr-1" />Alerts {stats.unreadAlerts > 0 && <Badge variant="destructive" className="ml-1">{stats.unreadAlerts}</Badge>}</TabsTrigger>
          <TabsTrigger value="backlinks"><Link2 className="h-4 w-4 mr-1" />Backlinks</TabsTrigger>
          <TabsTrigger value="outreach"><Megaphone className="h-4 w-4 mr-1" />Outreach</TabsTrigger>
          <TabsTrigger value="targets">By Course/Article</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Referring Domains</CardTitle>
              <CardDescription>Ranked by number of backlinks</CardDescription>
            </CardHeader>
            <CardContent>
              {domainGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No backlinks logged yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Links</TableHead>
                      <TableHead>Max DA</TableHead>
                      <TableHead>First Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domainGroups.slice(0, 25).map(g => (
                      <TableRow key={g.domain}>
                        <TableCell className="font-medium">{g.domain}</TableCell>
                        <TableCell>{g.count}</TableCell>
                        <TableCell>{g.maxDA || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(g.firstSeen).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Referring Domain Alerts</CardTitle>
              <CardDescription>Auto-generated when a new domain links to you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 && <p className="text-sm text-muted-foreground">No alerts.</p>}
              {alerts.map(a => (
                <div key={a.id} className={`flex items-center justify-between p-3 border rounded-md ${a.acknowledged ? 'opacity-50' : 'bg-accent/30'}`}>
                  <div>
                    <div className="font-medium text-sm">{a.message ?? a.source_domain}</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  {!a.acknowledged && (
                    <Button size="sm" variant="outline" onClick={() => ackAlert(a.id)}>
                      <Check className="h-4 w-4 mr-1" /> Acknowledge
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backlinks">
          <Card>
            <CardHeader>
              <CardTitle>Acquired Backlinks</CardTitle>
              <CardDescription>{backlinks.length} total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Anchor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>DA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Linked To</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backlinks.map(b => {
                      const course = courses.find(c => c.id === b.linked_course_id);
                      const article = articles.find(a => a.id === b.linked_article_id);
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <a href={b.source_url} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                              {b.source_domain} <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">{b.anchor_text || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{b.target_url}</TableCell>
                          <TableCell><Badge variant={b.link_type === 'dofollow' ? 'default' : 'outline'}>{b.link_type}</Badge></TableCell>
                          <TableCell>{b.domain_authority ?? '—'}</TableCell>
                          <TableCell><Badge variant={statusColor(b.status) as any}>{b.status}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {course && <div>📚 {course.title}</div>}
                            {article && <div>📝 {article.title}</div>}
                            {!course && !article && '—'}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteBacklink(b.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach">
          <Card>
            <CardHeader>
              <CardTitle>Outreach Log</CardTitle>
              <CardDescription>{outreach.length} campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Follow-up</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outreach.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.target_domain}</TableCell>
                        <TableCell className="text-sm">
                          {o.contact_name && <div>{o.contact_name}</div>}
                          {o.contact_email && <div className="text-xs text-muted-foreground">{o.contact_email}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{o.outreach_type}</Badge></TableCell>
                        <TableCell><Badge variant={statusColor(o.status) as any}>{o.status}</Badge></TableCell>
                        <TableCell className="text-xs">{o.follow_up_at ? new Date(o.follow_up_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => deleteOutreach(o.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Backlinks by Course</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {targetGroups.courses.length === 0 && <p className="text-sm text-muted-foreground">No course-linked backlinks.</p>}
              {targetGroups.courses.map(g => (
                <div key={g.id} className="p-3 border rounded-md">
                  <div className="flex justify-between font-medium text-sm">
                    <span>{g.title}</span>
                    <Badge>{g.items.length} links</Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {g.items.map(i => (
                      <a key={i.id} href={i.source_url} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-muted-foreground hover:text-primary">
                        ↪ {i.source_domain} {i.anchor_text && `— "${i.anchor_text}"`}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Backlinks by Article</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {targetGroups.articles.length === 0 && <p className="text-sm text-muted-foreground">No article-linked backlinks.</p>}
              {targetGroups.articles.map(g => (
                <div key={g.id} className="p-3 border rounded-md">
                  <div className="flex justify-between font-medium text-sm">
                    <span>{g.title}</span>
                    <Badge>{g.items.length} links</Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {g.items.map(i => (
                      <a key={i.id} href={i.source_url} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-muted-foreground hover:text-primary">
                        ↪ {i.source_domain} {i.anchor_text && `— "${i.anchor_text}"`}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {loading && <div className="text-center text-sm text-muted-foreground">Loading…</div>}
    </div>
  );
}

const StatCard = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <Card className={accent ? 'border-destructive' : ''}>
    <CardContent className="pt-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-destructive' : ''}`}>{value}</div>
    </CardContent>
  </Card>
);

function NewBacklinkDialog({
  open, setOpen, courses, articles, outreach, onSaved,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  courses: CourseRef[]; articles: ArticleRef[]; outreach: Outreach[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    source_url: '', target_url: '', anchor_text: '', link_type: 'dofollow',
    domain_authority: '', status: 'active', notes: '',
    linked_course_id: '', linked_article_id: '', outreach_id: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.source_url || !form.target_url) {
      toast.error('Source and target URLs are required');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('backlinks').insert({
      source_url: form.source_url,
      source_domain: domainFromUrl(form.source_url),
      target_url: form.target_url,
      anchor_text: form.anchor_text || null,
      link_type: form.link_type,
      domain_authority: form.domain_authority ? Number(form.domain_authority) : null,
      status: form.status,
      notes: form.notes || null,
      linked_course_id: form.linked_course_id || null,
      linked_article_id: form.linked_article_id || null,
      outreach_id: form.outreach_id || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Backlink logged');
      setOpen(false);
      setForm({ source_url: '', target_url: '', anchor_text: '', link_type: 'dofollow', domain_authority: '', status: 'active', notes: '', linked_course_id: '', linked_article_id: '', outreach_id: '' });
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Log Backlink</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Log Acquired Backlink</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Source URL *"><Input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://example.com/article" /></Field>
          <Field label="Target URL *"><Input value={form.target_url} onChange={e => setForm({ ...form, target_url: e.target.value })} placeholder="https://taclink.app/..." /></Field>
          <Field label="Anchor text"><Input value={form.anchor_text} onChange={e => setForm({ ...form, anchor_text: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.link_type} onValueChange={v => setForm({ ...form, link_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dofollow">dofollow</SelectItem>
                  <SelectItem value="nofollow">nofollow</SelectItem>
                  <SelectItem value="ugc">ugc</SelectItem>
                  <SelectItem value="sponsored">sponsored</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Domain Authority"><Input type="number" value={form.domain_authority} onChange={e => setForm({ ...form, domain_authority: e.target.value })} /></Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="lost">lost</SelectItem>
                <SelectItem value="pending">pending verification</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Link to course (optional)">
            <Select value={form.linked_course_id || 'none'} onValueChange={v => setForm({ ...form, linked_course_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Link to article (optional)">
            <Select value={form.linked_article_id || 'none'} onValueChange={v => setForm({ ...form, linked_article_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {articles.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From outreach (optional)">
            <Select value={form.outreach_id || 'none'} onValueChange={v => setForm({ ...form, outreach_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {outreach.map(o => <SelectItem key={o.id} value={o.id}>{o.target_domain}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewOutreachDialog({
  open, setOpen, courses, articles, onSaved,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  courses: CourseRef[]; articles: ArticleRef[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    target_domain: '', target_url: '', contact_name: '', contact_email: '',
    outreach_type: 'email', status: 'planned', pitch_notes: '', follow_up_at: '',
    linked_course_id: '', linked_article_id: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.target_domain) { toast.error('Target domain required'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('backlink_outreach').insert({
      target_domain: form.target_domain,
      target_url: form.target_url || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      outreach_type: form.outreach_type,
      status: form.status,
      pitch_notes: form.pitch_notes || null,
      follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
      linked_course_id: form.linked_course_id || null,
      linked_article_id: form.linked_article_id || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Outreach logged');
      setOpen(false);
      setForm({ target_domain: '', target_url: '', contact_name: '', contact_email: '', outreach_type: 'email', status: 'planned', pitch_notes: '', follow_up_at: '', linked_course_id: '', linked_article_id: '' });
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="h-4 w-4 mr-1" /> Log Outreach</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Log Outreach</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Target domain *"><Input value={form.target_domain} onChange={e => setForm({ ...form, target_domain: e.target.value })} placeholder="example.com" /></Field>
          <Field label="Target URL"><Input value={form.target_url} onChange={e => setForm({ ...form, target_url: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name"><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></Field>
            <Field label="Contact email"><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.outreach_type} onValueChange={v => setForm({ ...form, outreach_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="guest_post">guest post</SelectItem>
                  <SelectItem value="directory">directory</SelectItem>
                  <SelectItem value="partnership">partnership</SelectItem>
                  <SelectItem value="press">press</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">planned</SelectItem>
                  <SelectItem value="sent">sent</SelectItem>
                  <SelectItem value="responded">responded</SelectItem>
                  <SelectItem value="acquired">acquired</SelectItem>
                  <SelectItem value="declined">declined</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Follow-up date"><Input type="date" value={form.follow_up_at} onChange={e => setForm({ ...form, follow_up_at: e.target.value })} /></Field>
          <Field label="Link to course (optional)">
            <Select value={form.linked_course_id || 'none'} onValueChange={v => setForm({ ...form, linked_course_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Link to article (optional)">
            <Select value={form.linked_article_id || 'none'} onValueChange={v => setForm({ ...form, linked_article_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {articles.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pitch notes"><Textarea value={form.pitch_notes} onChange={e => setForm({ ...form, pitch_notes: e.target.value })} rows={3} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);
