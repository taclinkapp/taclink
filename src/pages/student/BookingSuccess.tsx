import { useNavigate, useParams } from 'react-router-dom';
import { mockCourses } from '@/lib/mockData';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, MapPin, Clock } from 'lucide-react';

const BookingSuccess = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const course = mockCourses.find((c) => c.id === id) ?? mockCourses[0];
  const ref = `TL-${(Math.random() * 1e6).toFixed(0).padStart(6, '0')}`;

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
          <h2 className="font-bold mb-3">{course.title}</h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" />{new Date(course.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" />{course.startTime} – {course.endTime}</div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" />{course.address}, {course.city}, {course.state}</div>
          </div>
        </div>

        {/* Fake QR */}
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
