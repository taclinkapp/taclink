import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATES } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { createCourse, uploadCoursePhoto } from '@/lib/courses';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Check, MapPin, Loader2, ImagePlus, X, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { detectContactInfo } from '@/lib/contactRedaction';
import { logBypassAttempt } from '@/lib/bypassLogging';
import { ContactInfoWarning } from '@/components/ContactInfoWarning';

const STEPS = ['Basics', 'Schedule & Location', 'Capacity & Pricing', 'Review'];

const NewCourse = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');

  // ---- Draft autosave (localStorage) ----
  const DRAFT_KEY = user ? `course-draft:${user.id}` : 'course-draft:anon';
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const hydrated = useRef(false);

  // Hydrate once
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.title) setTitle(d.title);
      if (d.category) setCategory(d.category);
      if (d.description) setDescription(d.description);
      if (d.date) setDate(d.date);
      if (d.startTime) setStartTime(d.startTime);
      if (d.endTime) setEndTime(d.endTime);
      if (d.address) setAddress(d.address);
      if (d.city) setCity(d.city);
      if (d.state) setState(d.state);
      if (d.capacity) setCapacity(d.capacity);
      if (d.price) setPrice(d.price);
      if (typeof d.step === 'number') setStep(d.step);
      if (d.savedAt) setLastSavedAt(new Date(d.savedAt));
      toast.message('Draft restored', { description: 'Picked up where you left off.' });
    } catch {
      // ignore corrupt drafts
    }
  }, [DRAFT_KEY]);

  // Debounced autosave on changes
  useEffect(() => {
    if (!hydrated.current) return;
    const hasContent = title || category || description || date || startTime || endTime || address || city || state || capacity || price;
    if (!hasContent) return;
    setDraftStatus('saving');
    const t = setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ title, category, description, date, startTime, endTime, address, city, state, capacity, price, step, savedAt }),
        );
        setLastSavedAt(new Date(savedAt));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('idle');
      }
    }, 800);
    return () => clearTimeout(t);
  }, [title, category, description, date, startTime, endTime, address, city, state, capacity, price, step, DRAFT_KEY]);

  const saveDraftNow = () => {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title, category, description, date, startTime, endTime, address, city, state, capacity, price, step, savedAt }),
      );
      setLastSavedAt(new Date(savedAt));
      setDraftStatus('saved');
      toast.success('Draft saved');
    } catch {
      toast.error('Could not save draft');
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setLastSavedAt(null);
    setDraftStatus('idle');
    setTitle(''); setCategory(''); setDescription('');
    setDate(''); setStartTime(''); setEndTime('');
    setAddress(''); setCity(''); setState('');
    setCapacity(''); setPrice('');
    setStep(0);
    toast.success('Draft cleared');
  };

  const onPickCover = (file: File | null) => {
    if (!file) {
      setCoverFile(null);
      setCoverPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be 10MB or smaller');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const back = () => (step > 0 ? setStep(step - 1) : nav(-1 as any));

  const validate = (): string | null => {
    if (step === 0) {
      if (!title.trim()) return 'Title is required';
      if (!category) return 'Category is required';
      const titleHits = detectContactInfo(title);
      const descHits = detectContactInfo(description);
      if (titleHits.length || descHits.length) {
        if (user) {
          if (titleHits.length) logBypassAttempt({ userId: user.id, userRole: 'instructor', fieldName: 'course_title', originalContent: title, detections: titleHits, actionTaken: 'blocked' });
          if (descHits.length) logBypassAttempt({ userId: user.id, userRole: 'instructor', fieldName: 'course_description', originalContent: description, detections: descHits, actionTaken: 'blocked' });
        }
        return 'Remove contact info from the title or description before continuing.';
      }
    }
    if (step === 1) {
      if (!date || !startTime || !endTime) return 'Date and times are required';
      if (!city || !state) return 'City and state are required';
    }
    if (step === 2) {
      if (!capacity || Number(capacity) < 1) return 'Capacity must be at least 1';
      if (!price || Number(price) < 5) return 'Price must be at least $5';
    }
    return null;
  };

  const next = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (step < 3) { setStep(step + 1); return; }
    if (!user) { toast.error('You must be signed in'); return; }

    setSaving(true);
    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = new Date(`${date}T${endTime}:00`);
    const durationMin = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
    try {
      let coverUrl: string | undefined;
      if (coverFile) {
        try {
          coverUrl = await uploadCoursePhoto(user.id, coverFile);
        } catch (uploadErr: any) {
          toast.error(uploadErr?.message ?? 'Cover photo upload failed');
          setSaving(false);
          return;
        }
      }
      const created = await createCourse(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        price_cents: Math.round(Number(price) * 100),
        duration_minutes: durationMin,
        capacity: Number(capacity),
        address: address || undefined,
        city,
        state,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        cover_image_url: coverUrl,
        status: 'published',
      });

      // AI moderation — scan course text + cover photo for contact info or
      // off-platform communication attempts (phone, email, social handles, URLs).
      const { moderateContent } = await import('@/lib/moderation');
      moderateContent({
        contentType: 'course_text',
        contentId: created.id,
        courseId: created.id,
        text: `${title}\n\n${description}`,
        authorId: user.id,
        authorRole: 'instructor',
      }).catch(() => {});
      if (coverUrl) {
        moderateContent({
          contentType: 'course_image',
          contentId: created.id,
          courseId: created.id,
          imageUrl: coverUrl,
          authorId: user.id,
          authorRole: 'instructor',
        }).catch(() => {});
      }

      qc.invalidateQueries({ queryKey: ['courses'] });
      localStorage.removeItem(DRAFT_KEY);
      toast.success('Course published');
      nav('/instructor/courses');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="New Course" back onBack={back} />
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
            <Field label="Course Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-card border-border h-11" placeholder="e.g. Defensive Pistol Fundamentals" />
            </Field>
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-card border-border h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {['Pistol', 'Rifle', 'Shotgun', 'Combatives', 'Medical', 'Other'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-card border-border min-h-28" placeholder="Describe your course…" />
              <ContactInfoWarning value={description} />
            </Field>
            <Field label="Cover Photo">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
              />
              {coverPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={coverPreview} alt="Cover preview" className="w-full h-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => onPickCover(null)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-destructive hover:text-destructive-foreground transition"
                    aria-label="Remove cover photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 px-3 h-8 rounded-md bg-background/80 backdrop-blur text-xs font-bold hover:bg-primary hover:text-primary-foreground transition"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary hover:text-primary transition flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Add cover photo</span>
                  <span className="text-[10px] text-muted-foreground/80">Shown as the course header for students</span>
                </button>
              )}
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-card border-border h-11" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time"><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-card border-border h-11" /></Field>
              <Field label="End Time"><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-card border-border h-11" /></Field>
            </div>
            <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} className="bg-card border-border h-11" placeholder="Street address" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} className="bg-card border-border h-11" /></Field>
              <Field label="State">
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="bg-card border-border h-11"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-64">{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="tactical-card h-32 flex items-center justify-center">
              <div className="text-center text-muted-foreground text-xs"><MapPin className="h-6 w-6 text-primary mx-auto mb-1" />Map preview (coming soon)</div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Max Students"><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="bg-card border-border h-11" placeholder="12" /></Field>
            <Field label="Booking Fee per Student (USD, min $5)"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-card border-border h-11" placeholder="185" /></Field>
          </>
        )}
        {step === 3 && (
          <>
            <div className="tactical-card p-5 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
              <h2 className="font-bold text-lg">{title || 'Untitled course'}</h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Category: {category || '—'}</div>
                <div>Date: {date || '—'} · {startTime || '—'} – {endTime || '—'}</div>
                <div>Location: {[address, city, state].filter(Boolean).join(', ') || '—'}</div>
                <div>Capacity: {capacity || '—'} students · ${price || '—'} each</div>
              </div>
            </div>
            <div className="tactical-card border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-xs">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">Publishing makes this course visible to students immediately.</span>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-4">
          {step > 0 && <Button variant="outline" onClick={back} disabled={saving} className="flex-1 h-12 bg-card border-border font-semibold">Back</Button>}
          <Button onClick={next} disabled={saving} className="flex-1 h-12 bg-primary text-primary-foreground font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step < 3 ? 'Continue' : 'Publish Course'}
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
