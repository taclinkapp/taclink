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
import { Link } from 'react-router-dom';
import { createCourse, uploadCoursePhoto, SKILL_LEVEL_LABELS, type SkillLevel } from '@/lib/courses';
import { COURSE_CATALOG, getCategoryTypes } from '@/lib/courseCatalog';
import { supabase } from '@/integrations/supabase/client';
import { computeListingFeeCents, fmt, INSTRUCTOR_LISTING_FEE_PCT } from '@/lib/fees';
import { redeemFreeListingCredit, fetchPunchCardState } from '@/lib/punchCard';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Check, MapPin, Loader2, ImagePlus, X, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { detectContactInfo } from '@/lib/contactRedaction';
import { logBypassAttempt } from '@/lib/bypassLogging';
import { ContactInfoWarning } from '@/components/ContactInfoWarning';
import { AISuggestButton } from '@/components/instructor/AISuggestButton';
import { usePrelaunch } from '@/hooks/usePrelaunch';
import { AddressMapPreview } from '@/components/AddressMapPreview';
import { useActivePaymentProvider } from '@/hooks/useActivePaymentProvider';

const STEPS = ['Basics', 'Schedule & Location', 'Capacity & Pricing', 'Review'];

const durationMinutesFromTimes = (date: string, start: string, end: string): number | undefined => {
  if (!date || !start || !end) return undefined;
  const s = new Date(`${date}T${start}:00`);
  const e = new Date(`${date}T${end}:00`);
  const diff = Math.round((e.getTime() - s.getTime()) / 60000);
  return diff > 0 ? diff : undefined;
};

const NewCourse = () => {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const hasPM = !!profile?.payment_method_added;
  const subActive = profile?.subscription_status === 'active';
  const [connectActive, setConnectActive] = useState(false);
  const [payoutHint, setPayoutHint] = useState<{ method_type: string; handle: string } | null>(null);
  const [pmHint, setPmHint] = useState<{ brand: string | null; last4: string | null; method_type: string; handle: string | null } | null>(null);
  const { data: prelaunch } = usePrelaunch();
  const { provider: activeProvider } = useActivePaymentProvider();
  const { roles } = useAuth() as any;
  const [isTestAccount, setIsTestAccount] = useState(false);
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const prelaunchExempt = isAdmin || isTestAccount;
  const isPrelaunch = !!prelaunch?.enabled && !prelaunchExempt;
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (activeProvider === 'helcim') {
        const [{ data: acct }, { data: methods }] = await Promise.all([
          supabase.from('instructor_payout_accounts').select('status').eq('instructor_id', user.id).eq('provider', 'helcim').maybeSingle(),
          supabase.from('instructor_payout_methods').select('method_type, handle, is_preferred').eq('instructor_id', user.id).order('is_preferred', { ascending: false }).limit(1),
        ]);
        const hasMethod = Array.isArray(methods) && methods.length > 0;
        // For Helcim, having a saved payout method is sufficient to publish.
        // Backfill the payout account row if it's missing so admin/edge views stay consistent.
        if (hasMethod && (acct as any)?.status !== 'active') {
          await supabase.from('instructor_payout_accounts').upsert({
            instructor_id: user.id,
            provider: 'helcim',
            status: 'active',
            payouts_enabled: true,
            charges_enabled: true,
          }, { onConflict: 'instructor_id,provider' });
        }
        setConnectActive(hasMethod);
        const m = (methods as any[])?.[0];
        setPayoutHint(m ? { method_type: m.method_type, handle: m.handle } : null);
      } else {
        const { data } = await supabase.from('profiles').select('stripe_connect_status').eq('id', user.id).maybeSingle();
        setConnectActive((data as any)?.stripe_connect_status === 'active');
        setPayoutHint(null);
      }
    })();
  }, [user?.id, activeProvider]);
        const { data } = await supabase.from('profiles').select('stripe_connect_status').eq('id', user.id).maybeSingle();
        setConnectActive((data as any)?.stripe_connect_status === 'active');
        setPayoutHint(null);
      }
    })();
  }, [user?.id, activeProvider]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('test_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsTestAccount(!!data));
  }, [user?.id]);

  useEffect(() => {
    if (!user || !hasPM) { setPmHint(null); return; }
    supabase
      .from('payment_methods')
      .select('method_type, brand, last4, handle, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPmHint(data as any));
  }, [user?.id, hasPM]);


  // form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('');
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
  const [feeAck, setFeeAck] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);

  useEffect(() => {
    if (!user || !subActive) return;
    fetchPunchCardState(user.id).then((s) => setAvailableCredits(s.unredeemedCredits)).catch(() => {});
  }, [user, subActive]);


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
      if (d.skillLevel) setSkillLevel(d.skillLevel);
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
          JSON.stringify({ title, category, skillLevel, description, date, startTime, endTime, address, city, state, capacity, price, step, savedAt }),
        );
        setLastSavedAt(new Date(savedAt));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('idle');
      }
    }, 800);
    return () => clearTimeout(t);
  }, [title, category, skillLevel, description, date, startTime, endTime, address, city, state, capacity, price, step, DRAFT_KEY]);

  const saveDraftNow = () => {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title, category, skillLevel, description, date, startTime, endTime, address, city, state, capacity, price, step, savedAt }),
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
    setTitle(''); setCategory(''); setSkillLevel(''); setDescription('');
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
      if (!skillLevel) return 'Please select a skill level before continuing';
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
      const startsAt = new Date(`${date}T${startTime}:00`);
      const minStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (startsAt < minStart) {
        return 'Course must start at least 7 days from today so students have time to find and book it.';
      }
    }
    if (step === 2) {
      if (!capacity || Number(capacity) < 1) return 'Capacity must be at least 1';
      if (!price || Number(price) < 5) return 'Price must be at least $5';
    }
    if (step === 3) {
      if (!skillLevel) return 'Skill level is required — go back to Basics and pick a level';
      if (!isPrelaunch && !feeAck) return 'Please acknowledge the non-refundable listing fee before publishing';
    }
    return null;
  };

  const next = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (step < 3) { setStep(step + 1); return; }
    if (!user) { toast.error('You must be signed in'); return; }
    // Pre-launch: allow saving as draft only. Skip listing-fee/payout guards
    // since nothing is being published or charged yet.
    if (!isPrelaunch) {
      if (!hasPM) {
        toast.error('Add a payment method before publishing', { description: 'Required to charge the listing fee.' });
        nav('/instructor/payment-methods');
        return;
      }
      if (!connectActive) {
        toast.error('Set up payouts before publishing', {
          description: 'Students pay the full course price online — you need a payout account to receive funds.',
        });
        nav('/instructor/payout-methods');
        return;
      }
    }

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
        skill_level: skillLevel as SkillLevel,
        price_cents: Math.round(Number(price) * 100),
        duration_minutes: durationMin,
        capacity: Number(capacity),
        address: address || undefined,
        city,
        state,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        cover_image_url: coverUrl,
        status: isPrelaunch ? 'draft' : 'published',
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

      // Pre-launch: don't charge a listing fee — the course is saved as a
      // draft and can't go live until the platform launches.
      if (isPrelaunch) {
        qc.invalidateQueries({ queryKey: ['courses'] });
        localStorage.removeItem(DRAFT_KEY);
        toast.success('Draft saved', {
          description: "Pre-launch mode is on — your course is saved as a draft and will be publishable when TacLink goes live.",
        });
        nav('/instructor/courses');
        return;
      }

      // Listing fee charge — flat 10% of course price, non-refundable.
      // Subscribers can redeem a punch-card credit to waive the fee on this course.
      const priceCents = Math.round(Number(price) * 100);
      const listingFeeCents = computeListingFeeCents(priceCents);

      let redeemedCreditId: string | null = null;
      if (subActive && availableCredits > 0) {
        redeemedCreditId = await redeemFreeListingCredit(user.id, created.id);
      }

      await supabase.from('instructor_charges').insert({
        instructor_id: user.id,
        course_id: created.id,
        charge_type: 'listing_fee',
        course_price_cents: priceCents,
        capacity: Number(capacity),
        amount_cents: redeemedCreditId ? 0 : listingFeeCents,
        status: redeemedCreditId ? 'waived' : 'charged',
        refundable: false,
        note: redeemedCreditId
          ? 'Listing fee waived — punch-card free credit redeemed'
          : '10% listing fee at publish (non-refundable)',
      });

      qc.invalidateQueries({ queryKey: ['courses'] });
      localStorage.removeItem(DRAFT_KEY);
      if (redeemedCreditId) {
        toast.success('Course published', { description: `Free listing credit applied — ${fmt(listingFeeCents)} waived 🎉` });
      } else {
        toast.success('Course published', { description: `Listing fee charged: ${fmt(listingFeeCents)}` });
      }
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Step {step + 1} of 4 · {STEPS[step]}</div>
          <div className="text-[10px] text-muted-foreground">
            {draftStatus === 'saving' && 'Saving draft…'}
            {draftStatus === 'saved' && lastSavedAt && `Draft saved ${lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {step === 0 && (
          <>
            <Field
              label="Course Title"
              action={
                <AISuggestButton
                  field="title"
                  context={{ category, description }}
                  onApply={setTitle}
                />
              }
            >
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-card border-border h-11" placeholder="e.g. Defensive Pistol Fundamentals" />
            </Field>
            <Field label="Category">
              <Select value={category} onValueChange={(v) => { setCategory(v); }}>
                <SelectTrigger className="bg-card border-border h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-72">
                  {COURSE_CATALOG.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {category && getCategoryTypes(category).length > 0 && (
              <Field label="Course Type (optional — prefills title)">
                <Select
                  value=""
                  onValueChange={(v) => { if (v) setTitle(v); }}
                >
                  <SelectTrigger className="bg-card border-border h-11"><SelectValue placeholder="Pick a standard course type" /></SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-72">
                    {getCategoryTypes(category).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Skill Level *">
              <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as SkillLevel)}>
                <SelectTrigger className={cn('bg-card border-border h-11', !skillLevel && 'border-destructive/60')}><SelectValue placeholder="Select level (required)" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(Object.keys(SKILL_LEVEL_LABELS) as SkillLevel[]).map((lv) => (
                    <SelectItem key={lv} value={lv}>{SKILL_LEVEL_LABELS[lv]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Description"
              action={
                <AISuggestButton
                  field="description"
                  context={{ title, category, description }}
                  onApply={setDescription}
                  label="AI write"
                />
              }
            >
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
            <Field label="Date">
              <Input
                type="date"
                value={date}
                min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="bg-card border-border h-11"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Earliest start: <strong className="text-foreground">7 days from today</strong> — gives students time to discover and book.
              </p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <div className="relative">
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={cn("bg-card border-border h-11", date && !startTime && "border-primary ring-2 ring-primary/40 animate-pulse")} />
                  {date && !startTime && (
                    <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span>Pick start time</span>
                      <span className="animate-bounce">↓</span>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="End Time">
                <div className="relative">
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={cn("bg-card border-border h-11", startTime && !endTime && "border-primary ring-2 ring-primary/40 animate-pulse")} />
                  {startTime && !endTime && (
                    <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span>Pick end time</span>
                      <span className="animate-bounce">↓</span>
                    </div>
                  )}
                </div>
              </Field>
            </div>
            {startTime && endTime && new Date(`2000-01-01T${endTime}:00`) <= new Date(`2000-01-01T${startTime}:00`) && (
              <p className="text-[11px] font-semibold text-destructive">End time must be after start time — check AM/PM.</p>
            )}
            <Field label="Address">
              <div className="relative">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} className={cn("bg-card border-border h-11", endTime && !address && "border-primary ring-2 ring-primary/40 animate-pulse")} placeholder="Street address" />
                {endTime && !address && (
                  <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                    <span>Add street address</span><span className="animate-bounce">↓</span>
                  </div>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <div className="relative">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} className={cn("bg-card border-border h-11", address && !city && "border-primary ring-2 ring-primary/40 animate-pulse")} />
                  {address && !city && (
                    <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span>Add city</span><span className="animate-bounce">↓</span>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="State">
                <div className={cn("relative rounded-md", city && !state && "ring-2 ring-primary/40 animate-pulse")}>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className={cn("bg-card border-border h-11", city && !state && "border-primary")}><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-64">{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  {city && !state && (
                    <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span>Pick state</span><span className="animate-bounce">↓</span>
                    </div>
                  )}
                </div>
              </Field>
            </div>
            <AddressMapPreview address={address} city={city} state={state} />
          </>
        )}
        {step === 2 && (
          <>
            <Field
              label="Max Students"
              action={
                <AISuggestButton
                  field="capacity"
                  context={{ title, category, description, duration_minutes: durationMinutesFromTimes(date, startTime, endTime) }}
                  onApply={(v) => setCapacity(v.replace(/[^0-9]/g, ''))}
                />
              }
            >
              <div className="relative">
                <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={cn("bg-card border-border h-11", !capacity && "border-primary ring-2 ring-primary/40 animate-pulse")} placeholder="12" />
                {!capacity && (
                  <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                    <span>Set max students</span><span className="animate-bounce">↓</span>
                  </div>
                )}
              </div>
            </Field>
            <Field
              label="Booking Fee per Student (USD, min $5)"
              action={
                <AISuggestButton
                  field="price"
                  context={{ title, category, description, duration_minutes: durationMinutesFromTimes(date, startTime, endTime), city, state, capacity }}
                  onApply={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
                />
              }
            >
              <div className="relative">
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={cn("bg-card border-border h-11", capacity && (!price || Number(price) < 5) && "border-primary ring-2 ring-primary/40 animate-pulse")} placeholder="185" />
                {capacity && (!price || Number(price) < 5) && (
                  <div className="pointer-events-none absolute -top-6 left-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                    <span>{!price ? 'Set booking fee' : 'Minimum $5'}</span><span className="animate-bounce">↓</span>
                  </div>
                )}
              </div>
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            <div className="tactical-card p-5 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
              <h2 className="font-bold text-lg">{title || 'Untitled course'}</h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Category: {category || '—'} · Level: {SKILL_LEVEL_LABELS[skillLevel]}</div>
                <div>Date: {date || '—'} · {startTime || '—'} – {endTime || '—'}</div>
                <div>Location: {[address, city, state].filter(Boolean).join(', ') || '—'}</div>
                <div>Capacity: {capacity || '—'} students · ${price || '—'} each</div>
              </div>
            </div>
            {isPrelaunch ? (
              <div className="tactical-card border-primary/40 bg-primary/10 p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider font-bold text-primary">Pre-launch mode</div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  TacLink™ hasn't launched yet. You can finish this course and save it as a
                  <strong className="text-foreground"> draft</strong> — the listing fee is <strong className="text-foreground">not</strong> charged
                  during pre-launch, and your course will be publishable the moment we go live.
                </p>
              </div>
            ) : (
              <>
                {/* Free credit banner — auto-applied if available */}
                {availableCredits > 0 && (
                  <div className="tactical-card border-success/40 bg-success/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🎉</div>
                      <div className="flex-1">
                        <div className="text-xs uppercase tracking-wider font-bold text-success">Free Listing Credit</div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Your punch card credit will be auto-applied — <strong className="text-foreground">no listing fee</strong> for this course.
                          You'll have <strong>{availableCredits - 1}</strong> credit{availableCredits - 1 === 1 ? '' : 's'} left after publishing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {/* Listing fee preview — non-refundable disclosure */}
                <div className={cn(
                  "tactical-card border-primary/40 bg-primary/10 p-4 space-y-3",
                  availableCredits > 0 && "opacity-50"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold">Instructor Booking Fee</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{Math.round(INSTRUCTOR_LISTING_FEE_PCT * 100)}% of course price · charged at publish</div>
                    </div>
                    <div className="text-2xl font-black text-primary">
                      {availableCredits > 0 ? <span className="line-through text-muted-foreground">{fmt(computeListingFeeCents(Math.round(Number(price || 0) * 100)))}</span> : fmt(computeListingFeeCents(Math.round(Number(price || 0) * 100)))}
                    </div>
                  </div>
                  <div className="border-t border-primary/20 pt-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
                    <p>
                      When you tap <strong className="text-foreground">Publish</strong>, your card on file will be charged
                      <strong className="text-foreground"> {fmt(computeListingFeeCents(Math.round(Number(price || 0) * 100)))}</strong> ({Math.round(INSTRUCTOR_LISTING_FEE_PCT * 100)}% × ${price || 0}).
                    </p>
                    <p className="text-foreground font-bold uppercase tracking-wider text-[10px]">
                      ⚠ Refund rules for this listing fee
                    </p>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li>
                        <strong className="text-foreground">Timely cancellation (48+ hours before start):</strong> listing
                        fee is <strong className="text-success">released back to you</strong> within 48 hours. No strike.
                      </li>
                      <li>
                        <strong className="text-foreground">Late cancellation (under 48 hours), no-show, or you delete the
                        course after a student books:</strong> listing fee is <strong className="text-destructive">
                        forfeited</strong> and 1 strike is added to your account.
                      </li>
                      <li>
                        Editing, unpublishing before any bookings, or no students booking does <strong className="text-foreground">not</strong> trigger a refund — the fee covers the cost of listing your course on the platform.
                      </li>
                    </ul>
                  </div>
                  <label className="flex items-start gap-2 pt-2 border-t border-primary/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feeAck}
                      onChange={(e) => setFeeAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                    />
                    <span className="text-[11px] leading-relaxed">
                      I understand the <strong>{fmt(computeListingFeeCents(Math.round(Number(price || 0) * 100)))}</strong> listing fee is charged immediately when I publish{availableCredits > 0 ? ' (waived this time by your free credit)' : ''}, is <strong className="text-success">released back</strong> if I cancel 48+ hours before start, and is <strong className="text-destructive">forfeited</strong> on late cancellation, no-show, or deletion after a booking.
                    </span>
                  </label>
                </div>
                <div className="tactical-card border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-xs">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Publishing makes this course visible to students immediately.</span>
                </div>
                {hasPM && (
                  <div className="tactical-card border-success/40 bg-success/10 p-3 flex items-center gap-2 text-xs">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="text-foreground">
                      {pmHint && pmHint.method_type === 'card' && pmHint.last4
                        ? <>Payment method: <strong className="text-foreground">{pmHint.brand || 'Card'} •••• {pmHint.last4}</strong>. </>
                        : pmHint && pmHint.handle
                          ? <>Payment method: <strong className="text-foreground">{pmHint.method_type} · {pmHint.handle}</strong>. </>
                          : <>Payment method on file. </>}
                      <Link to="/instructor/payment-methods" className="text-primary underline">Manage</Link>
                    </span>
                  </div>
                )}
                {!hasPM && (
                  <div className="tactical-card border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                    <div className="font-bold text-destructive">Required to publish:</div>
                    <Link to="/instructor/payment-methods" className="block text-primary underline">Add a payment method →</Link>
                  </div>
                )}
                {connectActive ? (
                  <div className="tactical-card border-success/40 bg-success/10 p-3 flex items-center gap-2 text-xs">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="text-foreground">
                      {payoutHint
                        ? <>Payout method: <strong className="text-foreground capitalize">{payoutHint.method_type} · {payoutHint.handle}</strong> (preferred). </>
                        : <>Payout account connected. </>}
                      <Link to="/instructor/payout-methods" className="text-primary underline">Change</Link>
                    </span>
                  </div>
                ) : (
                  <div className="tactical-card border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                    <div className="font-bold text-destructive">Required to publish:</div>
                    <Link to="/instructor/payout-methods" className="block text-primary underline">Set up a payout method →</Link>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="flex gap-2 pt-4">
          {step > 0 && <Button variant="outline" onClick={back} disabled={saving} className="flex-1 h-12 bg-card border-border font-semibold">Back</Button>}
          <Button onClick={next} disabled={saving || (step === 3 && !isPrelaunch && !feeAck)} className="flex-1 h-12 bg-primary text-primary-foreground font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step < 3
              ? 'Continue'
              : isPrelaunch
                ? 'Save Draft'
                : availableCredits > 0
                  ? 'Publish · FREE 🎉'
                  : `Publish · Pay ${fmt(computeListingFeeCents(Math.round(Number(price || 0) * 100)))}`}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={saveDraftNow}
            disabled={saving}
            className="flex-1 h-11 bg-card border-border font-semibold"
          >
            <Save className="h-4 w-4 mr-1.5" /> Save Draft
          </Button>
          {lastSavedAt && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearDraft}
              disabled={saving}
              className="h-11 px-3 text-destructive hover:bg-destructive/10 font-semibold"
              aria-label="Clear draft"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </MobileShell>
  );
};

const Field = ({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div>
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {action}
    </div>
    <div className="mt-1.5">{children}</div>
  </div>
);

export default NewCourse;
