import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Eye, EyeOff, Sword } from 'lucide-react';
import type { DisplayStyle, Rotation, WarriorQuoteRow } from '@/hooks/useWarriorQuotes';
import { pickQuote } from '@/hooks/useWarriorQuotes';

const DISPLAY_OPTIONS: { value: DisplayStyle; label: string; help: string }[] = [
  { value: 'watermark', label: 'Watermark (behind content)', help: 'Faint, large quote centered behind the page. Ambient.' },
  { value: 'banner',    label: 'Top banner card',            help: 'Visible neumorphic card at the top of the dashboard.' },
  { value: 'corner',    label: 'Corner card (dismissible)',  help: 'Small floating card in the bottom-right.' },
  { value: 'ticker',    label: 'Marquee ticker',             help: 'Scrolling ticker bar under the header.' },
];

const ROTATION_OPTIONS: { value: Rotation; label: string }[] = [
  { value: 'daily',     label: 'Daily — same quote all day' },
  { value: 'hourly',    label: 'Hourly — changes every hour' },
  { value: 'per_visit', label: 'Per visit — new on every page load' },
];

type Settings = {
  enabled: boolean;
  display_style: DisplayStyle;
  opacity: number;
  show_to_students: boolean;
  show_to_instructors: boolean;
  rotation: Rotation;
};

const DEFAULT: Settings = {
  enabled: true,
  display_style: 'watermark',
  opacity: 0.06,
  show_to_students: true,
  show_to_instructors: true,
  rotation: 'daily',
};

const AdminWarriorQuotes = () => {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [savingSettings, setSavingSettings] = useState(false);
  const [search, setSearch] = useState('');
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newNote, setNewNote] = useState('');

  // Settings query
  const { data: settingsData } = useQuery({
    queryKey: ['warrior-quote-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warrior_quote_settings')
        .select('enabled, display_style, opacity, show_to_students, show_to_instructors, rotation')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? DEFAULT) as Settings;
    },
  });

  useEffect(() => {
    if (settingsData) setSettings(settingsData);
  }, [settingsData]);

  // Quotes query
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<WarriorQuoteRow[]>({
    queryKey: ['warrior-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warrior_quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WarriorQuoteRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return quotes;
    return quotes.filter((q) => q.text.toLowerCase().includes(s) || q.author.toLowerCase().includes(s));
  }, [quotes, search]);

  const activeQuotes = useMemo(
    () => quotes.filter((q) => q.is_active).map((q) => ({ id: q.id, text: q.text, author: q.author })),
    [quotes],
  );
  const previewQuote = useMemo(() => pickQuote(activeQuotes, settings.rotation), [activeQuotes, settings.rotation]);

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase
      .from('warrior_quote_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSavingSettings(false);
    if (error) {
      toast.error('Could not save settings', { description: error.message });
      return;
    }
    toast.success('Settings saved');
    qc.invalidateQueries({ queryKey: ['warrior-quote-settings'] });
  };

  const addQuote = async () => {
    if (!newText.trim() || !newAuthor.trim()) {
      toast.error('Quote text and author are required');
      return;
    }
    const { error } = await supabase.from('warrior_quotes').insert({
      text: newText.trim(),
      author: newAuthor.trim(),
      source_note: newNote.trim() || null,
    });
    if (error) {
      toast.error('Could not add quote', { description: error.message });
      return;
    }
    setNewText(''); setNewAuthor(''); setNewNote('');
    toast.success('Quote added');
    qc.invalidateQueries({ queryKey: ['warrior-quotes'] });
  };

  const toggleActive = async (q: WarriorQuoteRow) => {
    const { error } = await supabase
      .from('warrior_quotes')
      .update({ is_active: !q.is_active })
      .eq('id', q.id);
    if (error) {
      toast.error('Could not update', { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ['warrior-quotes'] });
  };

  const deleteQuote = async (q: WarriorQuoteRow) => {
    if (!confirm(`Delete this quote by ${q.author}?\n\n"${q.text}"`)) return;
    const { error } = await supabase.from('warrior_quotes').delete().eq('id', q.id);
    if (error) {
      toast.error('Could not delete', { description: error.message });
      return;
    }
    toast.success('Deleted');
    qc.invalidateQueries({ queryKey: ['warrior-quotes'] });
  };

  const activeCount = quotes.filter((q) => q.is_active).length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Sword className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Warrior Quotes</h1>
          <p className="text-xs text-muted-foreground">
            Stoic / warrior philosophy quotes shown across student and instructor screens.
          </p>
        </div>
      </header>

      {/* Settings card */}
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">System</h2>
            <p className="text-xs text-muted-foreground mt-1">Master toggle and how the quote appears.</p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="enabled" className="text-sm font-semibold">
              {settings.enabled ? 'On' : 'Off'}
            </Label>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Display style</Label>
            <Select
              value={settings.display_style}
              onValueChange={(v) => setSettings({ ...settings, display_style: v as DisplayStyle })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISPLAY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {DISPLAY_OPTIONS.find((o) => o.value === settings.display_style)?.help}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Rotation</Label>
            <Select
              value={settings.rotation}
              onValueChange={(v) => setSettings({ ...settings, rotation: v as Rotation })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROTATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {settings.display_style === 'watermark' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider">Watermark opacity</Label>
              <span className="text-xs font-mono text-muted-foreground">{settings.opacity.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.opacity]}
              min={0.02}
              max={0.25}
              step={0.01}
              onValueChange={([v]) => setSettings({ ...settings, opacity: v })}
            />
            <p className="text-[11px] text-muted-foreground">Lower = more subtle. 0.06 is the default.</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-semibold">Show to students</div>
              <div className="text-[11px] text-muted-foreground">On the student Discover page.</div>
            </div>
            <Switch
              checked={settings.show_to_students}
              onCheckedChange={(v) => setSettings({ ...settings, show_to_students: v })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-semibold">Show to instructors</div>
              <div className="text-[11px] text-muted-foreground">On the instructor Dashboard.</div>
            </div>
            <Switch
              checked={settings.show_to_instructors}
              onCheckedChange={(v) => setSettings({ ...settings, show_to_instructors: v })}
            />
          </label>
        </div>

        {/* Live preview */}
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Preview · {settings.display_style}</div>
          {previewQuote ? (
            <div className="text-center py-4">
              <p className="font-stencil text-xl italic text-foreground/80">“{previewQuote.text}”</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-primary">— {previewQuote.author}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active quotes — add one below.</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </Card>

      {/* Quotes manager */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Library</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {quotes.length} total · <Badge variant="secondary">{activeCount} active</Badge>
            </p>
          </div>
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">All quotes</TabsTrigger>
            <TabsTrigger value="add">Add quote</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by text or author…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {quotesLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes match.</p>
            ) : (
              <ul className="divide-y divide-border max-h-[600px] overflow-y-auto rounded-md border border-border">
                {filtered.map((q) => (
                  <li key={q.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${q.is_active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                        “{q.text}”
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-primary font-bold">
                        — {q.author}
                      </p>
                      {q.source_note && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground italic">{q.source_note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={q.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleActive(q)}
                      >
                        {q.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={() => deleteQuote(q)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-text">Quote</Label>
              <Textarea
                id="q-text"
                placeholder="No great thing is created suddenly."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-author">Author</Label>
                <Input
                  id="q-author"
                  placeholder="Epictetus"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-note">Source note (optional)</Label>
                <Input
                  id="q-note"
                  placeholder="Discourses"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={addQuote}>
                <Plus className="h-4 w-4 mr-1.5" /> Add quote
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default AdminWarriorQuotes;
