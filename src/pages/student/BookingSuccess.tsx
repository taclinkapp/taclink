import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, MapPin, Clock, FileText, ShieldCheck, Loader2 } from 'lucide-react';
import { CancelGraceBadge } from '@/components/student/CancelGraceBadge';

type Course = {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type Signature = {
  id: string;
  signed_full_name: string;
  waiver_version: number;
  signed_at: string;
};

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

const BookingSuccess = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from('courses')
        .select('id, title, address, city, state, starts_at, ends_at')
        .eq('id', id)
        .maybeSingle();

      let bId: string | null = null;
      let sig: Signature | null = null;
      if (user && c) {
        const { data: b } = await supabase
          .from('bookings')
          .select('id')
          .eq('student_id', user.id)
          .eq('course_id', c.id)
          .order('booked_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        bId = b?.id ?? null;
        if (bId) {
          const { data: s } = await supabase
            .from('waiver_signatures')
            .select('id, signed_full_name, waiver_version, signed_at')
            .eq('booking_id', bId)
            .maybeSingle();
          sig = (s as Signature) ?? null;
        }
      }
      if (cancelled) return;
      setCourse((c as Course) ?? null);
      setBookingId(bId);
      setSignature(sig);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  if (loading) {
    return (
      <MobileShell withTabBar={false}>
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading…
        </div>
      </MobileShell>
    );
  }

  const ref = bookingId ? `TL-${bookingId.slice(0, 8).toUpperCase()}` : '—';

  return (
    <MobileShell withTabBar={false}>
      <div className="px-6 py-12 text-center">
        <div className="h-24 w-24 rounded-full bg-success/15 border-2 border-success/40 flex items-center justify-center mx-auto mb-6 amber-glow" style={{ boxShadow: '0 8px 24px -8px hsl(142 71% 45% / 0.5)' }}>
          <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-black mb-2">You're Booked!</h1>
        <p className="text-muted-foreground text-sm mb-8">Confirmation sent to your email.</p>

        <div className="tactical-card p-5 text-left mb-6">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Booking Reference</div>
          <div className="font-mono text-primary font-bold mb-4">{ref}</div>
          {course && (
            <>
              <h2 className="font-bold mb-3">{course.title}</h2>
              <div className="space-y-2 text-xs text-muted-foreground">
                {course.starts_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {new Date(course.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                )}
                {course.starts_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {fmtTime(course.starts_at)}{course.ends_at ? ` – ${fmtTime(course.ends_at)}` : ''}
                  </div>
                )}
                {(course.address || course.city || course.state) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {[course.address, course.city, course.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {signature && (
          <div className="tactical-card p-5 text-left mb-6 border-primary/40">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Waiver Signature Receipt</div>
              <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">v{signature.waiver_version}</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Signed by</span>
                <span className="font-serif italic text-foreground text-sm">{signature.signed_full_name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="font-mono text-foreground">{new Date(signature.signed_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Receipt ID</span>
                <span className="font-mono text-foreground">{signature.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-primary" />
              Stored securely with a snapshot of the waiver content.
            </div>
          </div>
        )}

        {/* Check-in QR */}
        <div className="tactical-card p-5 mb-6">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Check-In QR Code</div>
          <div className="mx-auto h-44 w-44 bg-white p-3 rounded-sm">
            <div className="h-full w-full" style={{
              backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
            }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-3">Show this on the day of training</div>
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full h-11 bg-card border-border font-semibold">Add to Calendar</Button>
          <Button onClick={() => nav('/student/bookings')} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">View My Bookings</Button>
        </div>
      </div>
    </MobileShell>
  );
};

export default BookingSuccess;
