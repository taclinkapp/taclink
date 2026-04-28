import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockCourses } from '@/lib/mockData';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Lock, AlertTriangle } from 'lucide-react';

const Checkout = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const course = mockCourses.find((c) => c.id === id) ?? mockCourses[0];
  const [waiver, setWaiver] = useState(false);

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Confirm Booking" back />
      <div className="px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Course</div>
          <h2 className="font-bold">{course.title}</h2>
          <div className="text-xs text-muted-foreground mt-1">
            {course.instructorName} · {new Date(course.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {course.city}, {course.state}
          </div>
        </div>

        {/* Price */}
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Price Breakdown</div>
          <div className="space-y-2 text-sm">
            <Row label="Booking fee" value={`$${course.bookingFee.toFixed(2)}`} />
            <Row label="Service fee" value="$0.00" muted />
            <div className="border-t border-border pt-2 mt-2 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-black text-primary text-lg">${course.bookingFee.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5" /> Payment Method <span className="ml-auto text-[10px] flex items-center gap-1"><Lock className="h-3 w-3" /> Stripe</span>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Card number</Label>
              <Input placeholder="4242 4242 4242 4242" className="bg-background border-border h-11 mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Expiry</Label><Input placeholder="MM / YY" className="bg-background border-border h-11 mt-1" /></div>
              <div><Label className="text-xs text-muted-foreground">CVC</Label><Input placeholder="123" className="bg-background border-border h-11 mt-1" /></div>
            </div>
          </div>
        </div>

        {/* Waiver */}
        <div className="tactical-card p-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              Booking fees are <span className="text-foreground font-bold">non-refundable</span>. Training involves inherent risks.
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={waiver} onCheckedChange={(v) => setWaiver(!!v)} className="mt-0.5" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I understand this training involves inherent risks including risk of injury or death. I release the instructor and TacLink from liability.
            </span>
          </label>
        </div>

        <Button
          disabled={!waiver}
          onClick={() => nav(`/student/booking-success/${course.id}`)}
          className="w-full h-13 bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-4 disabled:opacity-40"
        >
          Confirm & Pay ${course.bookingFee.toFixed(2)}
        </Button>
      </div>
    </MobileShell>
  );
};

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={muted ? 'text-muted-foreground' : 'text-foreground font-semibold'}>{value}</span></div>
);

export default Checkout;
