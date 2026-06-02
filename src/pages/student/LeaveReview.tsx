import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type BookingRow = {
  id: string;
  status: string;
  course_id: string;
  student_id: string;
  courses: { id: string; instructor_id: string; title: string } | null;
};

const LeaveReview = () => {
  const { id } = useParams(); // booking id
  const nav = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: b, error: bErr } = await supabase
        .from('bookings')
        .select('id, status, course_id, student_id, courses:course_id(id, instructor_id, title)')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (bErr || !b) {
        setError('We couldn\'t load this booking.');
        setLoading(false);
        return;
      }
      const row = b as unknown as BookingRow;
      if (row.student_id !== user.id) {
        setError('This booking isn\'t yours.');
        setLoading(false);
        return;
      }
      if (row.status !== 'attended') {
        setError('You can only review a course you\'ve attended.');
        setLoading(false);
        return;
      }
      setBooking(row);

      // Pre-fill if a review already exists.
      const { data: existing } = await supabase
        .from('reviews')
        .select('id, rating, comment')
        .eq('course_id', row.course_id)
        .eq('student_id', user.id)
        .maybeSingle();
      if (existing) {
        setExistingReviewId(existing.id);
        setRating(existing.rating);
        setComment(existing.comment ?? '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  const submit = async () => {
    if (!booking || !user || rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      const payload = {
        course_id: booking.course_id,
        instructor_id: booking.courses?.instructor_id ?? null,
        student_id: user.id,
        rating,
        comment: comment.trim().slice(0, 2000) || null,
      };
      const { error: rErr } = existingReviewId
        ? await supabase.from('reviews').update({ rating: payload.rating, comment: payload.comment }).eq('id', existingReviewId)
        : await supabase.from('reviews').insert(payload);
      if (rErr) throw rErr;
      toast.success(existingReviewId ? 'Review updated' : 'Thanks — your review is live.');
      nav(`/student/booking/${booking.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save your review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Leave a Review" back backTo="/student/bookings" />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
        </div>
      </MobileShell>
    );
  }

  if (error) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Leave a Review" back backTo="/student/bookings" />
        <div className="px-4 py-12 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => nav('/student/bookings')} variant="outline" className="w-full">
            Back to my bookings
          </Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Leave a Review" back backTo="/student/bookings" />
      <div className="px-4 py-6 space-y-6">
        {booking?.courses?.title && (
          <div className="text-center text-xs uppercase tracking-wider text-muted-foreground">
            {booking.courses.title}
          </div>
        )}
        <div className="text-center">
          <h2 className="text-lg font-bold">Rate your experience</h2>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="p-1" aria-label={`${n} star${n>1?'s':''}`}>
                <Star className={`h-9 w-9 ${n <= rating ? 'fill-primary text-primary' : 'text-border'}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
            className="bg-card border-border min-h-32"
            maxLength={2000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">{comment.length}/2000</div>
        </div>
        <Button
          onClick={submit}
          disabled={rating === 0 || submitting}
          className="w-full h-12 bg-primary text-primary-foreground font-bold"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {existingReviewId ? 'Update Review' : 'Submit Review'}
        </Button>
      </div>
    </MobileShell>
  );
};

export default LeaveReview;
