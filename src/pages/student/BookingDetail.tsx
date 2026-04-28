import { useNavigate, useParams } from 'react-router-dom';
import { mockBookings } from '@/lib/mockData';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, AlertTriangle, Star } from 'lucide-react';

const BookingDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const booking = mockBookings.find((b) => b.id === id) ?? mockBookings[0];
  const c = booking.course;
  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Booking Detail" back />
      <div className="px-4 py-4 space-y-4">
        <div className="tactical-card p-4">
          <h2 className="font-bold mb-3">{c.title}</h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" />{new Date(c.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" />{c.startTime} – {c.endTime}</div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" />{c.address}, {c.city}, {c.state}</div>
          </div>
        </div>

        {booking.status === 'upcoming' && (
          <div className="tactical-card p-5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Check-In QR</div>
            <div className="mx-auto h-56 w-56 bg-white p-3 rounded-sm">
              <div className="h-full w-full" style={{
                backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                backgroundSize: '14px 14px',
                backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
              }} />
            </div>
          </div>
        )}

        <div className="tactical-card border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Cancellation policy:</strong> Booking fees are non-refundable. If the instructor cancels, refunds are handled by them directly.
          </div>
        </div>

        {booking.status === 'past' && !booking.reviewed && (
          <Button onClick={() => nav(`/student/review/${booking.id}`)} className="w-full h-12 bg-primary text-primary-foreground font-bold">
            <Star className="mr-2" /> Leave a Review
          </Button>
        )}
      </div>
    </MobileShell>
  );
};

export default BookingDetail;
