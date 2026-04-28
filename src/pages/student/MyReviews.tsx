import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, Sparkles, Loader2, Pencil, Calendar, ImagePlus, X } from 'lucide-react';
import { StudentTabBar } from '@/components/StudentTabBar';
import { useReviewableCourses, type ReviewableBooking } from '@/hooks/useReviewableCourses';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MyReviews = () => {
  const nav = useNavigate();
  const { data, isLoading } = useReviewableCourses();
  const [editing, setEditing] = useState<ReviewableBooking | null>(null);

  const pending = (data ?? []).filter((b) => !b.existingReview);
  const submitted = (data ?? []).filter((b) => b.existingReview);

  return (
    <MobileShell>
      <PageHeader title="My Reviews" />
      <div className="px-4 py-4 space-y-6 pb-32">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-12">Loading…</div>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState onBrowse={() => nav('/student')} />
        ) : (
          <>
            {pending.length > 0 && (
              <Section title={`Awaiting Review · ${pending.length}`}>
                {pending.map((b) => (
                  <ReviewCard key={b.bookingId} booking={b} onAction={() => setEditing(b)} />
                ))}
              </Section>
            )}
            {submitted.length > 0 && (
              <Section title={`Your Reviews · ${submitted.length}`}>
                {submitted.map((b) => (
                  <ReviewCard key={b.bookingId} booking={b} onAction={() => setEditing(b)} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>

      {editing && (
        <ReviewDialog
          booking={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <StudentTabBar />
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3 px-1">{title}</h2>
    <div className="space-y-2">{children}</div>
  </div>
);

const EmptyState = ({ onBrowse }: { onBrowse: () => void }) => (
  <div className="tactical-card p-8 text-center space-y-4 mt-4">
    <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
      <Star className="h-7 w-7 text-primary" />
    </div>
    <div>
      <h3 className="font-bold">No courses to review yet</h3>
      <p className="text-sm text-muted-foreground mt-1">Once you attend a course, it will appear here so you can leave a review.</p>
    </div>
    <Button onClick={onBrowse} className="bg-primary text-primary-foreground font-bold">Discover Courses</Button>
  </div>
);

const ReviewCard = ({ booking, onAction }: { booking: ReviewableBooking; onAction: () => void }) => {
  const r = booking.existingReview;
  return (
    <div className="tactical-card p-3">
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0">
          {booking.course.cover_image_url ? (
            <img src={booking.course.cover_image_url} className="h-full w-full object-cover" alt="" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 to-surface" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{booking.course.title}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" />
            {booking.attended_at ? new Date(booking.attended_at).toLocaleDateString() : 'Attended'}
          </div>
          {r ? (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn('h-3 w-3', i < r.rating ? 'fill-primary text-primary' : 'text-border')} />
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-primary font-bold uppercase tracking-wider mt-1">Tap to review</div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onAction} className="bg-card border-border self-start">
          {r ? <><Pencil className="h-3 w-3 mr-1" /> Edit</> : 'Review'}
        </Button>
      </div>
      {r?.comment && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.comment}</p>}
      {r?.photo_url && (
        <img
          src={r.photo_url}
          alt="Review attachment"
          className="mt-2 rounded-lg w-full max-h-48 object-cover border border-border"
        />
      )}
    </div>
  );
};

const ReviewDialog = ({ booking, onClose }: { booking: ReviewableBooking; onClose: () => void }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const r = booking.existingReview;
  const [rating, setRating] = useState(r?.rating ?? 0);
  const [comment, setComment] = useState(r?.comment ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(r?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [liked, setLiked] = useState('');
  const [improve, setImprove] = useState('');

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${booking.course.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('review-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('review-photos').getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      toast.success('Photo added');
    } catch (e: any) {
      toast.error(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const generateWithAI = async () => {
    if (rating === 0) { toast.error('Pick a rating first'); return; }
    setAiLoading(true);
    let acc = '';
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const userPrompt = `Write a thoughtful, specific course review (2-3 short paragraphs) for the tactical training course "${booking.course.title}"${booking.course.category ? ` (${booking.course.category})` : ''}.
Star rating: ${rating}/5.
What I liked: ${liked || '(not specified)'}
What could improve: ${improve || '(not specified)'}
Tone: honest, helpful to future students. Output only the review text — no preamble, no headings.`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          role: 'student',
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error('Rate limit — try again in a moment.');
        else if (resp.status === 402) toast.error('AI credits exhausted.');
        else toast.error('AI failed to generate.');
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
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
              setComment(acc);
            }
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }
      setAiOpen(false);
      toast.success('Draft generated — edit before submitting.');
    } catch (e) {
      console.error(e);
      toast.error('Connection error.');
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (rating === 0) { toast.error('Please choose a rating'); return; }
    setSaving(true);
    try {
      if (r) {
        const { error } = await supabase
          .from('reviews')
          .update({ rating, comment: comment.trim() || null, photo_url: photoUrl })
          .eq('id', r.id);
        if (error) throw error;
        toast.success('Review updated');
      } else {
        const { error } = await supabase.from('reviews').insert({
          course_id: booking.course.id,
          instructor_id: booking.course.instructor_id,
          student_id: user.id,
          rating,
          comment: comment.trim() || null,
          photo_url: photoUrl,
        });
        if (error) throw error;
        toast.success('Review submitted');
      }
      qc.invalidateQueries({ queryKey: ['reviewable-courses'] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{r ? 'Edit Review' : 'Leave a Review'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">{booking.course.title}</div>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => !r && setRating(n)}
                  disabled={!!r}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className={cn(
                    'p-1 transition-transform',
                    r ? 'cursor-not-allowed' : 'hover:scale-110',
                  )}
                >
                  <Star className={cn('h-9 w-9', n <= rating ? 'fill-primary text-primary' : 'text-border')} />
                </button>
              ))}
            </div>
            {r && (
              <p className="text-[11px] text-muted-foreground">Rating is locked once submitted. You can still edit your comment and photo.</p>
            )}
          </div>

          <div className="relative">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience…"
              className="bg-card border-border min-h-32 pr-3"
            />
          </div>

          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt="Review" className="w-full max-h-56 object-cover rounded-lg border border-border" />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className={cn(
              'flex items-center justify-center gap-2 w-full rounded-md border border-dashed border-border bg-card py-3 text-sm font-semibold cursor-pointer hover:bg-card/70 transition-colors',
              uploading && 'opacity-60 pointer-events-none'
            )}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Add a photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          )}

          <Button
            onClick={() => setAiOpen(true)}
            variant="outline"
            className="w-full bg-gradient-to-r from-primary/10 to-amber-400/10 border-primary/30 text-primary font-semibold gap-2"
          >
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Button>

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1 bg-card border-border">Cancel</Button>
            <Button onClick={submit} disabled={saving || rating === 0} className="flex-1 bg-primary text-primary-foreground font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : r ? 'Update' : 'Submit'}
            </Button>
          </div>
        </div>

        {aiOpen && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg p-5 flex flex-col gap-3 z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">AI Review Helper</h3>
            </div>
            <p className="text-xs text-muted-foreground">A few quick notes — I'll turn them into a polished review.</p>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">What you liked</label>
              <Textarea value={liked} onChange={(e) => setLiked(e.target.value)} placeholder="e.g. instructor knowledge, drills, range setup…" className="bg-card border-border min-h-20 mt-1" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">What could improve</label>
              <Textarea value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="Optional — any suggestions" className="bg-card border-border min-h-16 mt-1" />
            </div>
            <div className="flex gap-2 mt-auto">
              <Button onClick={() => setAiOpen(false)} variant="outline" className="flex-1 bg-card border-border" disabled={aiLoading}>Back</Button>
              <Button onClick={generateWithAI} disabled={aiLoading} className="flex-1 bg-primary text-primary-foreground font-bold gap-2">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MyReviews;
