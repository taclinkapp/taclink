import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';

const LeaveReview = () => {
  const nav = useNavigate();
  const [rating, setRating] = useState(0);
  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Leave a Review" back />
      <div className="px-4 py-6 space-y-6">
        <div className="text-center">
          <h2 className="text-lg font-bold">Rate your experience</h2>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="p-1">
                <Star className={`h-9 w-9 ${n <= rating ? 'fill-primary text-primary' : 'text-border'}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Textarea placeholder="Share your experience…" className="bg-card border-border min-h-32" />
        </div>
        <Button onClick={() => nav(-1 as any)} className="w-full h-12 bg-primary text-primary-foreground font-bold" disabled={rating === 0}>
          Submit Review
        </Button>
      </div>
    </MobileShell>
  );
};

export default LeaveReview;
