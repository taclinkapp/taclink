import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Category = 'feature' | 'improvement' | 'general' | 'other';

const schema = z.object({
  submitter_name: z.string().trim().max(100).optional(),
  submitter_email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  category: z.enum(['feature', 'improvement', 'general', 'other']),
  subject: z.string().trim().min(3, 'Add a short subject (min 3 chars)').max(140),
  message: z.string().trim().min(10, 'Tell us a bit more (min 10 chars)').max(2000),
});

const getDevUser = () => {
  try {
    const raw = localStorage.getItem('taclink:devUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const FeedbackDialog = ({ open, onOpenChange }: Props) => {
  const location = useLocation();
  const devUser = getDevUser();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    submitter_name: devUser?.name ?? '',
    submitter_email: devUser?.email ?? '',
    category: 'feature' as Category,
    subject: '',
    message: '',
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from('feedback_submissions').insert({
      submitter_name: form.submitter_name || null,
      submitter_email: form.submitter_email || null,
      submitter_role: devUser?.role ?? null,
      category: form.category,
      subject: form.subject,
      message: form.message,
      page_url: location.pathname + location.search,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    setSubmitting(false);
    if (error) {
      toast.error('Could not send feedback. Try again.');
      return;
    }
    toast.success('Feedback sent — thank you!');
    onOpenChange(false);
    setForm((f) => ({ ...f, subject: '', message: '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Share Your Feedback
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Got an idea for a feature or something we could do better? We read every suggestion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name (opt.)</Label>
              <Input
                className="bg-background border-border h-10 mt-1"
                value={form.submitter_name}
                onChange={(e) => update('submitter_name', e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email (opt.)</Label>
              <Input
                type="email"
                className="bg-background border-border h-10 mt-1"
                value={form.submitter_email}
                onChange={(e) => update('submitter_email', e.target.value)}
                maxLength={255}
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
            <select
              className="w-full bg-background border border-border h-10 mt-1 rounded-md px-3 text-sm"
              value={form.category}
              onChange={(e) => update('category', e.target.value as Category)}
            >
              <option value="feature">Feature Request</option>
              <option value="improvement">Improvement</option>
              <option value="general">General Feedback</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject</Label>
            <Input
              className="bg-background border-border h-10 mt-1"
              placeholder="e.g. Add calendar sync"
              value={form.subject}
              onChange={(e) => update('subject', e.target.value)}
              maxLength={140}
            />
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Your idea
            </Label>
            <Textarea
              className="bg-background border-border min-h-28 mt-1"
              placeholder="What would you like us to add or change? How would it help you?"
              value={form.message}
              onChange={(e) => update('message', e.target.value)}
              maxLength={2000}
            />
            <div className="text-[10px] text-muted-foreground mt-1 text-right">
              {form.message.length}/2000
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 bg-primary text-primary-foreground font-bold"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Feedback'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
