import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Loader2, FileText, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  title: string;
  status: string;
  instructor_id: string;
  in_person_waiver: boolean;
  created_at: string;
  waiver_published: boolean;
  waiver_version: number | null;
  waiver_has_content: boolean;
  instructor_name: string | null;
};

type Filter = 'all' | 'in_person' | 'ai_with_content' | 'ai_missing_content';

export default function AdminWaivers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, status, instructor_id, in_person_waiver, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      const list = (courses ?? []) as any[];
      const courseIds = list.map((c) => c.id);
      const instructorIds = Array.from(new Set(list.map((c) => c.instructor_id)));

      const [{ data: waivers }, { data: profiles }] = await Promise.all([
        courseIds.length
          ? supabase
              .from('course_waivers')
              .select('course_id, content, version, published')
              .in('course_id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
        instructorIds.length
          ? supabase.from('profiles').select('id, display_name').in('id', instructorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const wMap = new Map<string, any>();
      (waivers ?? []).forEach((w: any) => wMap.set(w.course_id, w));
      const pMap = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => pMap.set(p.id, p.display_name ?? ''));

      setRows(
        list.map((c) => {
          const w = wMap.get(c.id);
          return {
            id: c.id,
            title: c.title,
            status: c.status,
            instructor_id: c.instructor_id,
            in_person_waiver: !!c.in_person_waiver,
            created_at: c.created_at,
            waiver_published: !!w?.published,
            waiver_version: w?.version ?? null,
            waiver_has_content: !!(w?.content && String(w.content).trim().length > 0),
            instructor_name: pMap.get(c.instructor_id) ?? null,
          } as Row;
        }),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'in_person') return r.in_person_waiver;
      if (filter === 'ai_with_content') return !r.in_person_waiver && r.waiver_has_content;
      if (filter === 'ai_missing_content') return !r.in_person_waiver && !r.waiver_has_content;
      return true;
    });
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    in_person: rows.filter((r) => r.in_person_waiver).length,
    ai_with_content: rows.filter((r) => !r.in_person_waiver && r.waiver_has_content).length,
    ai_missing_content: rows.filter((r) => !r.in_person_waiver && !r.waiver_has_content).length,
  }), [rows]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Course Waivers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit how each course collects its liability waiver — in-person on training day, or AI-generated and e-signed at checkout.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ['all', 'All courses', counts.all, 'border-border'],
          ['in_person', 'In-person waiver', counts.in_person, 'border-amber-500/40'],
          ['ai_with_content', 'AI waiver published', counts.ai_with_content, 'border-emerald-500/40'],
          ['ai_missing_content', 'AI mode · missing content', counts.ai_missing_content, 'border-destructive/50'],
        ] as const).map(([key, label, n, border]) => (
          <button
            key={key}
            onClick={() => setFilter(key as Filter)}
            className={cn(
              'rounded-lg border bg-card p-4 text-left transition hover:border-primary',
              border,
              filter === key && 'ring-2 ring-primary',
            )}
          >
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
            <div className="text-2xl font-extrabold mt-1">{n}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">No courses match this filter.</div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Course</th>
                <th className="text-left px-3 py-2">Instructor</th>
                <th className="text-left px-3 py-2">Mode</th>
                <th className="text-left px-3 py-2">Waiver content</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link to={`/admin/course-editor?id=${r.id}`} className="font-semibold hover:underline">
                      {r.title || 'Untitled'}
                    </Link>
                    <div className="text-[10px] text-muted-foreground font-mono">{r.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.instructor_name ?? r.instructor_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    {r.in_person_waiver ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-500 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                        <FileText className="h-3 w-3" /> In-person
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="h-3 w-3" /> AI / e-sign
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.in_person_waiver ? (
                      <span className="text-[11px] text-muted-foreground">— (collected on paper)</span>
                    ) : r.waiver_has_content ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Present {r.waiver_version != null && `· v${r.waiver_version}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive text-[11px] font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" /> Missing
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">{r.status}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
