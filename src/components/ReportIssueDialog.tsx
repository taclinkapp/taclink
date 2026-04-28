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
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const schema = z.object({
  reporter_name: z.string().trim().max(100).optional(),
  reporter_email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  category: z.enum(['bug', 'broken_button', 'ui', 'suggestion', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().trim().min(10, 'Please describe the issue (min 10 chars)').max(2000),
});

const getDevUser = () => {
  try {
    const raw = localStorage.getItem('taclink:devUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const ReportIssueDialog = ({ open, onOpenChange }: Props) => {
  const location = useLocation();
  const devUser = getDevUser();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    reporter_name: devUser?.name ?? '',
    reporter_email: devUser?.email ?? '',
    category: 'bug' as 'bug' | 'broken_button' | 'ui' | 'suggestion' | 'other',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    description: '',
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
    const { error } = await supabase.from('issue_reports').insert({
      reporter_name: form.reporter_name || null,
      reporter_email: form.reporter_email || null,
      reporter_role: devUser?.role ?? null,
      page_url: location.pathname + location.search,
      category: form.category,
      severity: form.severity,
      description: form.description,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    setSubmitting(false);
    if (error) {
      toast.error('Could not send report. Try again.');
      return;
    }
    toast.success('Report sent — thank you!');
    onOpenChange(false);
    setForm((f) => ({ ...f, description: '' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">Report an Issue</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Found a bug or broken button? Tell us. The admin team reviews every report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name (opt.)</Label>
              <Input
                className="bg-background border-border h-10 mt-1"
                value={form.reporter_name}
                onChange={(e) => update('reporter_name', e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email (opt.)</Label>
              <Input
                type="email"
                className="bg-background border-border h-10 mt-1"
                value={form.reporter_email}
                onChange={(e) => update('reporter_email', e.target.value)}
                maxLength={255}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
              <select
                className="w-full bg-background border border-border h-10 mt-1 rounded-md px-3 text-sm"
                value={form.category}
                onChange={(e) => update('category', e.target.value as typeof form.category)}
              >
                <option value="bug">Bug</option>
                <option value="broken_button">Broken Button</option>
                <option value="ui">UI / Layout</option>
                <option value="suggestion">Suggestion</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Severity</Label>
              <select
                className="w-full bg-background border border-border h-10 mt-1 rounded-md px-3 text-sm"
                value={form.severity}
                onChange={(e) => update('severity', e.target.value as typeof form.severity)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              What happened?
            </Label>
            <Textarea
              className="bg-background border-border min-h-28 mt-1"
              placeholder="Describe the issue, what you expected, and steps to reproduce…"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={2000}
            />
            <div className="text-[10px] text-muted-foreground mt-1 text-right">
              {form.description.length}/2000
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">
            We'll attach the page URL (<span className="font-mono">{location.pathname}</span>) automatically.
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
