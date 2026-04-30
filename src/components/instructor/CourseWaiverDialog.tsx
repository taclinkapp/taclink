import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Save, Eye, Printer, FileText, AlertTriangle, Scale } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { generateCourseWaiver } from '@/lib/courseAI';

type Course = {
  id: string;
  title: string | null;
  category: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  duration_minutes: number | null;
};

type Waiver = {
  id: string;
  course_id: string;
  title: string;
  content: string;
  version: number;
  published: boolean;
};

type Signature = {
  id: string;
  signed_full_name: string;
  signed_at: string;
  waiver_version: number;
  student_id: string;
  student_name?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}

export const CourseWaiverDialog = ({ open, onOpenChange, courseId }: Props) => {
  const [tab, setTab] = useState<'edit' | 'preview' | 'signatures'>('edit');
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [waiver, setWaiver] = useState<Waiver | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Liability Waiver & Assumption of Risk');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: w }, { data: sigs }] = await Promise.all([
        supabase.from('courses').select('id, title, category, description, city, state, duration_minutes').eq('id', courseId).maybeSingle(),
        supabase.from('course_waivers').select('*').eq('course_id', courseId).maybeSingle(),
        supabase.from('waiver_signatures').select('id, signed_full_name, signed_at, waiver_version, student_id').eq('course_id', courseId).order('signed_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setCourse(c as Course | null);
      if (w) {
        setWaiver(w as Waiver);
        setTitle(w.title);
        setContent(w.content);
      } else {
        setWaiver(null);
        setContent('');
      }
      // Hydrate student names
      const ids = Array.from(new Set((sigs ?? []).map((s: any) => s.student_id)));
      let nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', ids);
        nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name ?? 'Student']));
      }
      setSignatures((sigs ?? []).map((s: any) => ({ ...s, student_name: nameMap.get(s.student_id) ?? 'Student' })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, courseId]);

  const generate = async () => {
    if (!course) return;
    setGenerating(true);
    try {
      const draft = await generateCourseWaiver({
        title: course.title ?? undefined,
        category: course.category ?? undefined,
        description: course.description ?? undefined,
        city: course.city ?? undefined,
        state: course.state ?? undefined,
        duration_minutes: course.duration_minutes ?? undefined,
      });
      setContent(draft);
      setTab('edit');
      toast.success('AI draft ready — review and edit before publishing');
    } catch (e: any) {
      toast.error(e?.message ?? 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const save = async (publish: boolean) => {
    if (!content.trim()) { toast.error('Waiver content is empty'); return; }
    setSaving(true);
    try {
      if (waiver) {
        const nextVersion = publish && !waiver.published ? waiver.version : waiver.version + (publish ? 0 : 0);
        const bumpVersion = waiver.content !== content || waiver.title !== title;
        const { data, error } = await supabase
          .from('course_waivers')
          .update({
            title,
            content,
            version: bumpVersion ? waiver.version + 1 : waiver.version,
            published: publish,
          })
          .eq('id', waiver.id)
          .select()
          .single();
        if (error) throw error;
        setWaiver(data as Waiver);
      } else {
        const { data, error } = await supabase
          .from('course_waivers')
          .insert({
            course_id: courseId,
            title,
            content,
            published: publish,
            ai_generated: true,
            ai_model: 'google/gemini-3-flash-preview',
          })
          .select()
          .single();
        if (error) throw error;
        setWaiver(data as Waiver);
      }
      toast.success(publish ? 'Waiver published' : 'Draft saved');
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const printWaiver = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
      <style>body{font:14px/1.6 -apple-system,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;}
      h1{font-size:22px;margin-bottom:4px;} h2{font-size:16px;margin-top:20px;} hr{margin:24px 0;border:0;border-top:1px solid #ccc;}
      .meta{color:#666;font-size:12px;margin-bottom:24px;} pre{white-space:pre-wrap;font-family:inherit;}</style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(course?.title ?? '')} · Version ${waiver?.version ?? 1}</div>
      <pre>${escapeHtml(content)}</pre>
      <hr/><div class="meta">Student signature: ____________________________ Date: ____________</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const downloadSignedPdf = (sig: Signature) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Signed waiver — ${escapeHtml(sig.student_name ?? '')}</title>
      <style>body{font:14px/1.6 -apple-system,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;}
      h1{font-size:22px;margin-bottom:4px;} .meta{color:#666;font-size:12px;margin-bottom:24px;}
      pre{white-space:pre-wrap;font-family:inherit;} .sig{margin-top:32px;padding:16px;border:2px solid #111;border-radius:6px;}
      .sig-name{font-family:'Brush Script MT',cursive;font-size:32px;}</style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(course?.title ?? '')} · Version signed: ${sig.waiver_version}</div>
      <pre>${escapeHtml(content)}</pre>
      <div class="sig"><div class="sig-name">${escapeHtml(sig.signed_full_name)}</div>
        <div class="meta">Signed by ${escapeHtml(sig.student_name ?? 'Student')} on ${new Date(sig.signed_at).toLocaleString()}</div></div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Course Waiver
            {waiver?.published && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">Published v{waiver.version}</span>}
            {waiver && !waiver.published && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30">Draft v{waiver.version}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border -mt-2">
          {(['edit', 'preview', 'signatures'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'signatures' ? `Signatures (${signatures.length})` : t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading…</div>
          ) : tab === 'edit' ? (
            <div className="space-y-3">
              {/* Prominent legal disclaimer */}
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2 mb-1">
                  <Scale className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                    Not Legal Advice
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  AI-generated waivers are <strong className="text-foreground">a starting draft only</strong> and do not constitute legal advice. Liability law varies by state and by training discipline. Before publishing, you must:
                </p>
                <ul className="mt-1.5 ml-4 text-[11px] text-muted-foreground list-disc space-y-0.5">
                  <li>Have this waiver reviewed by a <strong className="text-foreground">licensed attorney in your state</strong>.</li>
                  <li>Confirm it complies with local statutes on assumption of risk and minors.</li>
                  <li>Verify your insurance carrier accepts the language used.</li>
                </ul>
                <p className="mt-2 text-[10px] text-muted-foreground italic">
                  TacLink is the record-keeper for the signed waiver — the agreement itself is between you (the instructor) and the student. TacLink is not a party to the waiver and assumes no liability for its content or enforceability.
                </p>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 px-3 h-10 bg-card border border-border rounded-md text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Waiver Content (Markdown)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={generate} disabled={generating} className="h-7 text-[11px]">
                    {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    {waiver ? 'Regenerate with AI' : 'Generate with AI'}
                  </Button>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[300px] font-mono text-xs bg-card"
                  placeholder="Click 'Generate with AI' to draft a waiver, then edit it here…"
                />
              </div>
              <p className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                By publishing, you confirm you have reviewed (or had counsel review) this waiver and accept full responsibility for its content.
              </p>
            </div>
          ) : tab === 'preview' ? (
            <div className="prose prose-sm max-w-none px-1">
              <h2>{title}</h2>
              {content ? <ReactMarkdown>{content}</ReactMarkdown> : <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {signatures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No signatures yet.</div>
              ) : (
                signatures.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{s.signed_full_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.student_name} · v{s.waiver_version} · {new Date(s.signed_at).toLocaleString()}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadSignedPdf(s)} className="h-8 text-[11px]">
                      <Printer className="h-3 w-3 mr-1" /> Print
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-between border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={printWaiver} disabled={!content} className="text-xs">
            <Printer className="h-3.5 w-3.5 mr-1" /> Print blank
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => save(false)} disabled={saving || !content} className="text-xs">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save Draft
            </Button>
            <Button type="button" onClick={() => save(true)} disabled={saving || !content} className="text-xs bg-primary">
              <Eye className="h-3 w-3 mr-1" />
              {waiver?.published ? 'Update Published' : 'Publish'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
