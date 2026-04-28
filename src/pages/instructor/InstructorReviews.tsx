import { useEffect, useMemo, useState } from 'react';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Star, Sparkles, Loader2, MessageSquareReply, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  course_id: string;
  student_id: string;
  instructor_reply: string | null;
  instructor_reply_at: string | null;
  courseTitle: string;
  studentName: string;
  studentPhoto: string | null;
};

type Tone = 'friendly' | 'professional' | 'apologetic';

const filters = ['All', 'Needs reply', 'Replied'] as const;

const InstructorReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<typeof filters[number]>('Needs reply');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tones, setTones] = useState<Record<string, Tone>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const confirmReview = reviews.find((r) => r.id === confirmId) ?? null;
  const confirmDraft = confirmId ? (drafts[confirmId] ?? '').trim() : '';
  const confirmIsUpdate = !!confirmReview?.instructor_reply;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rs } = await supabase
        .from('reviews')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });
      const list = rs ?? [];
      const courseIds = Array.from(new Set(list.map((r) => r.course_id)));
      const studentIds = Array.from(new Set(list.map((r) => r.student_id)));
      const [{ data: courses }, { data: profs }] = await Promise.all([
        courseIds.length
          ? supabase.from('courses').select('id, title').in('id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
        studentIds.length
          ? supabase.from('profiles').select('id, display_name, photo_url').in('id', studentIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap = new Map((courses ?? []).map((c: any) => [c.id, c.title]));
      const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const enriched: Review[] = list.map((r: any) => ({
        ...r,
        courseTitle: cMap.get(r.course_id) ?? 'Course',
        studentName: pMap.get(r.student_id)?.display_name ?? 'Student',
        studentPhoto: pMap.get(r.student_id)?.photo_url ?? null,
      }));
      if (!cancelled) {
        setReviews(enriched);
        const initialDrafts: Record<string, string> = {};
        enriched.forEach((r) => {
          if (r.instructor_reply) initialDrafts[r.id] = r.instructor_reply;
        });
        setDrafts(initialDrafts);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (tab === 'Needs reply') return reviews.filter((r) => !r.instructor_reply);
    if (tab === 'Replied') return reviews.filter((r) => r.instructor_reply);
    return reviews;
  }, [reviews, tab]);

  const counts = useMemo(
    () => ({
      All: reviews.length,
      'Needs reply': reviews.filter((r) => !r.instructor_reply).length,
      Replied: reviews.filter((r) => r.instructor_reply).length,
    }),
    [reviews],
  );

  const generateReply = async (r: Review) => {
    setAiBusy(r.id);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-review-reply', {
        body: {
          rating: r.rating,
          comment: r.comment,
          courseTitle: r.courseTitle,
          instructorName: user?.user_metadata?.display_name,
          tone: tones[r.id] ?? (r.rating >= 4 ? 'friendly' : 'apologetic'),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply?.trim();
      if (reply) {
        setDrafts((d) => ({ ...d, [r.id]: reply }));
        toast.success('AI reply ready — review and post when you like it');
      }
    } catch (e: any) {
      toast.error('Could not generate reply', { description: e?.message ?? 'Please try again.' });
    } finally {
      setAiBusy(null);
    }
  };

  const postReply = async (r: Review) => {
    const text = drafts[r.id]?.trim();
    if (!text) {
      toast.error('Reply is empty');
      return;
    }
    setSavingId(r.id);
    const { error } = await supabase
      .from('reviews')
      .update({ instructor_reply: text, instructor_reply_at: new Date().toISOString() })
      .eq('id', r.id);
    setSavingId(null);
    if (error) {
      toast.error('Could not post reply', { description: error.message });
      return;
    }
    setReviews((rs) =>
      rs.map((x) =>
        x.id === r.id
          ? { ...x, instructor_reply: text, instructor_reply_at: new Date().toISOString() }
          : x,
      ),
    );
    toast.success('Reply posted');
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="My Reviews" back />
      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
          {filters.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors',
                tab === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {t}
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]',
                  tab === t ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-12">Loading reviews…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            {tab === 'Needs reply' ? "You're all caught up." : 'No reviews here yet.'}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const draft = drafts[r.id] ?? '';
              const tone = tones[r.id] ?? (r.rating >= 4 ? 'friendly' : 'apologetic');
              const isAi = aiBusy === r.id;
              const isSaving = savingId === r.id;
              return (
                <li key={r.id} className="rounded-md border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2">
                      {r.studentPhoto ? (
                        <img src={r.studentPhoto} alt={r.studentName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {r.studentName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{r.studentName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.courseTitle}</div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-3.5 w-3.5',
                              i < r.rating ? 'fill-amber-500 text-amber-500' : 'text-muted',
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm leading-relaxed">{r.comment}</p>}
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        {r.instructor_reply ? 'Your reply' : 'Reply'}
                      </span>
                      <div className="flex gap-1">
                        {(['friendly', 'professional', 'apologetic'] as Tone[]).map((tn) => (
                          <button
                            key={tn}
                            onClick={() => setTones((s) => ({ ...s, [r.id]: tn }))}
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                              tone === tn
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-muted-foreground border-border',
                            )}
                          >
                            {tn}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      rows={3}
                      placeholder="Write a reply or use the AI helper…"
                      className="w-full text-sm rounded-md border border-border bg-background p-2 resize-y min-h-[72px]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => generateReply(r)}
                        disabled={isAi}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-primary/40 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/20 disabled:opacity-50"
                      >
                        {isAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {draft ? 'Regenerate' : 'AI reply'}
                      </button>
                      <button
                        onClick={() => {
                          const text = (drafts[r.id] ?? '').trim();
                          if (!text) {
                            toast.error('Reply is empty');
                            return;
                          }
                          setConfirmId(r.id);
                        }}
                        disabled={isSaving || !draft.trim() || draft.trim() === (r.instructor_reply ?? '').trim()}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : r.instructor_reply ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <MessageSquareReply className="h-3.5 w-3.5" />
                        )}
                        {r.instructor_reply ? 'Update' : 'Post reply'}
                      </button>
                    </div>
                    {r.instructor_reply_at && (
                      <div className="text-[10px] text-muted-foreground">
                        Last replied {new Date(r.instructor_reply_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmIsUpdate ? 'Update your reply?' : 'Post this reply?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmIsUpdate
                ? 'This will replace your previous reply on this review.'
                : 'Your reply will be visible publicly under this review.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmReview && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Replying to {confirmReview.studentName} · {confirmReview.rating}★
                </div>
                {confirmReview.comment && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    “{confirmReview.comment}”
                  </p>
                )}
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">
                  Your reply
                </div>
                <p className="text-sm whitespace-pre-wrap">{confirmDraft}</p>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!savingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!savingId || !confirmReview}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmReview) return;
                await postReply(confirmReview);
                setConfirmId(null);
              }}
            >
              {savingId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              {confirmIsUpdate ? 'Update reply' : 'Post reply'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileShell>
  );
};

export default InstructorReviews;
