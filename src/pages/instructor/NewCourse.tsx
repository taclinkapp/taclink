import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATES } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Check, MapPin } from 'lucide-react';

const STEPS = ['Basics', 'Schedule & Location', 'Capacity & Pricing', 'Review'];

const NewCourse = () => {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const next = () => (step < 3 ? setStep(step + 1) : nav('/instructor/courses'));
  const back = () => (step > 0 ? setStep(step - 1) : nav(-1 as any));

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="New Course" back onBack={back} />
      {/* Stepper */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mt-2">Step {step + 1} of 4 · {STEPS[step]}</div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {step === 0 && (
          <>
            <Field label="Course Title"><Input className="bg-card border-border h-11" placeholder="e.g. Defensive Pistol Fundamentals" /></Field>
            <Field label="Category">
              <Select>
                <SelectTrigger className="bg-card border-border h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {['Pistol', 'Rifle', 'Shotgun', 'Combatives', 'Medical', 'Other'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description"><Textarea className="bg-card border-border min-h-28" placeholder="Describe your course…" /></Field>
            <Field label="What students will learn (one per line)"><Textarea className="bg-card border-border min-h-28" placeholder="Draw stroke from concealment&#10;Sight alignment under stress&#10;…" /></Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Date"><Input type="date" className="bg-card border-border h-11" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time"><Input type="time" className="bg-card border-border h-11" /></Field>
              <Field label="End Time"><Input type="time" className="bg-card border-border h-11" /></Field>
            </div>
            <Field label="Address"><Input className="bg-card border-border h-11" placeholder="Street address" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input className="bg-card border-border h-11" /></Field>
              <Field label="State">
                <Select><SelectTrigger className="bg-card border-border h-11"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-64">{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Zip"><Input className="bg-card border-border h-11" /></Field>
            <div className="tactical-card h-32 flex items-center justify-center">
              <div className="text-center text-muted-foreground text-xs"><MapPin className="h-6 w-6 text-primary mx-auto mb-1" />Map preview (Google Maps stub)</div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Max Students"><Input type="number" className="bg-card border-border h-11" placeholder="12" /></Field>
            <Field label="Booking Fee per Student (USD, min $5)"><Input type="number" className="bg-card border-border h-11" placeholder="185" /></Field>
            <Field label="Prerequisites (optional)"><Textarea className="bg-card border-border min-h-20" /></Field>
            <Field label="Equipment Required (optional)"><Textarea className="bg-card border-border min-h-20" /></Field>
          </>
        )}
        {step === 3 && (
          <>
            <div className="tactical-card p-5 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
              <h2 className="font-bold text-lg">Defensive Pistol Fundamentals</h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Category: Pistol</div>
                <div>Date: May 12, 2026 · 9:00 – 15:00</div>
                <div>Location: 4500 Range Rd, Austin TX</div>
                <div>Capacity: 12 students · $185 each</div>
              </div>
            </div>
            <div className="tactical-card border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-xs">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">This will use <span className="text-foreground font-bold">1 course credit</span>. You have <span className="text-primary font-bold">7 credits remaining.</span></span>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-4">
          {step > 0 && <Button variant="outline" onClick={back} className="flex-1 h-12 bg-card border-border font-semibold">Back</Button>}
          <Button onClick={next} className="flex-1 h-12 bg-primary text-primary-foreground font-bold">
            {step < 3 ? 'Continue' : 'Publish Course'}
          </Button>
        </div>
      </div>
    </MobileShell>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

export default NewCourse;
