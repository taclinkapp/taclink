import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { geocodeAddress } from '@/lib/geocode';
import { COURSE_CATALOG, getCategoryTypes } from '@/lib/courseCatalog';
import { supabase } from '@/integrations/supabase/client';
import { computeListingFeeCents, fmt, INSTRUCTOR_LISTING_FEE_PCT } from '@/lib/fees';
import { redeemFreeListingCredit, fetchPunchCardState } from '@/lib/punchCard';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Check, MapPin, Loader2, ImagePlus, X, Save, Trash2, Lightbulb, Sparkles, Scale, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { detectContactInfo } from '@/lib/contactRedaction';
import { logBypassAttempt } from '@/lib/bypassLogging';
import { ContactInfoWarning } from '@/components/ContactInfoWarning';
import { AISuggestButton } from '@/components/instructor/AISuggestButton';
import { usePrelaunch } from '@/hooks/usePrelaunch';
import { AddressMapPreview } from '@/components/AddressMapPreview';
import { generateCourseWaiver, type WaiverCriteria } from '@/lib/courseAI';
import ReactMarkdown from 'react-markdown';
import { Checkbox } from '@/components/ui/checkbox';


const STEPS = ['Basics', 'Schedule & Location', 'Capacity & Pricing', 'Waiver', 'Review'];

const durationMinutesFromTimes = (date: string, start: string, end: string): number | undefined => {
  if (!date || !start || !end) return undefined;
  const s = new Date(`${date}T${start}:00`);
  const e = new Date(`${date}T${end}:00`);
  const diff = Math.round((e.getTime() - s.getTime()) / 60000);
  return diff > 0 ? diff : undefined;
};

const NewCourse = () => {
  const nav = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const { user, profile } = useAuth();
  const hasPM = !!profile?.payment_method_added;
  const subActive = profile?.subscription_status === 'active';
  const [connectActive, setConnectActive] = useState(false);
  const [payoutHint, setPayoutHint] = useState<{ method_type: string; handle: string } | null>(null);
  const [pmHint, setPmHint] = useState<{ brand: string | null; last4: string | null; method_type: string; handle: string | null } | null>(null);
  const hasPaymentMethodOnFile = hasPM || !!pmHint;
  const { data: prelaunch } = usePrelaunch();
  
  const { roles } = useAuth() as any;
  const [isTestAccount, setIsTestAccount] = useState(false);
  const isAdmin = Array.isArray(roles) && roles.includes('admin');
  const prelaunchExempt = isAdmin || isTestAccount;
  const isPrelaunch = !!prelaunch?.enabled && !prelaunchExempt;
  // Fake QA test instructors and admins skip the listing-fee, payment-method,
  // payout-setup, and geocode requirements so they can publish QA courses
  // freely (especially during pre-launch). Their courses are still hidden
  // from regular students by RLS — only fake QA students see them.
  const skipPublishGuards = isAdmin || isTestAccount;
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: acct }, { data: methods }] = await Promise.all([
        supabase.from('instructor_payout_accounts').select('status').eq('instructor_id', user.id).eq('provider', 'helcim').maybeSingle(),
        supabase.from('instructor_payout_methods').select('method_type, handle, is_preferred').eq('instructor_id', user.id).order('is_preferred', { ascending: false }).limit(1),
      ]);
      const hasMethod = Array.isArray(methods) && methods.length > 0;
      // Having a saved payout method is sufficient to publish.
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
    })();
  }, [user?.id]);

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
    if (!user) { setPmHint(null); return; }
    supabase
      .from('payment_methods')
      .select('method_type, brand, last4, handle, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPmHint(data as any));
  }, [user?.id]);

  const refreshPaymentMethodHint = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('payment_methods')
      .select('method_type, brand, last4, handle, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPmHint(data as any);
    return data;
  };


  // form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Gallery (up to 8 extra photos). `galleryUrls` are already-uploaded URLs
  // (loaded when editing); `galleryFiles` are new files queued for upload.
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const galleryCount = galleryUrls.length + galleryFiles.length;
  const galleryPreviews = galleryFiles.map((f) => URL.createObjectURL(f));

  const onPickGallery = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 8 - galleryCount;
    if (remaining <= 0) {
      toast.error('You can attach up to 8 gallery photos');
      return;
    }
    const arr = Array.from(files).slice(0, remaining);
    for (const f of arr) {
      if (!f.type.startsWith('image/')) { toast.error('Only image files allowed'); return; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} is over 10MB`); return; }
    }
    setGalleryFiles((prev) => [...prev, ...arr]);
  };
  const removeGalleryUrl = (i: number) => setGalleryUrls((p) => p.filter((_, idx) => idx !== i));
  const removeGalleryFile = (i: number) => setGalleryFiles((p) => p.filter((_, idx) => idx !== i));

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

  // Waiver step state
  const [waiverCriteria, setWaiverCriteria] = useState<WaiverCriteria>({});
  const [waiverNotes, setWaiverNotes] = useState('');
  const [waiverContent, setWaiverContent] = useState('');
  const [waiverTitle, setWaiverTitle] = useState('Liability Waiver & Assumption of Risk');
  const [waiverGenerating, setWaiverGenerating] = useState(false);
  const [waiverLegalAck, setWaiverLegalAck] = useState(false);
  const [waiverPreview, setWaiverPreview] = useState(false);
  const [skipWaiver, setSkipWaiver] = useState(false);
  const [freePlanWaiverAck, setFreePlanWaiverAck] = useState(false);

  const toggleCriterion = (k: keyof WaiverCriteria) =>
    setWaiverCriteria((p) => ({ ...p, [k]: !p[k] }));

  const generateWaiver = async () => {
    setWaiverGenerating(true);
    try {
      const draft = await generateCourseWaiver(
        {
          title: title.trim() || undefined,
          category: category || undefined,
          description: description.trim() || undefined,
          duration_minutes: durationMinutesFromTimes(date, startTime, endTime),
          city: city || undefined,
          state: state || undefined,
        },
        { ...waiverCriteria, customNotes: waiverNotes },
      );
      setWaiverContent(draft);
      setWaiverPreview(false);
      toast.success('Draft ready — review, edit, then continue.');
    } catch (e: any) {
      toast.error(e?.message ?? 'AI generation failed');
    } finally {
      setWaiverGenerating(false);
    }
  };

  useEffect(() => {
    if (!user || !subActive) return;
    fetchPunchCardState(user.id).then((s) => setAvailableCredits(s.unredeemedCredits)).catch(() => {});
  }, [user, subActive]);


  // ---- Draft autosave (localStorage) ----
  const DRAFT_KEY = user ? `course-draft:${user.id}` : 'course-draft:anon';
  const wizardReturnTo = isEdit && editId ? `/instructor/courses/${editId}/edit` : '/instructor/courses/new';
  const paymentMethodsPath = `/instructor/payment-methods?returnTo=${encodeURIComponent(wizardReturnTo)}`;
  const payoutMethodsPath = `/instructor/payout-methods?returnTo=${encodeURIComponent(wizardReturnTo)}`;
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const hydrated = useRef(false);

  // Hydrate once. When editing an existing draft (?:id in URL), load the
  // course row from the DB so the instructor picks up where they left off.
  // Otherwise fall back to the localStorage autosave for new courses.
  useEffect(() => {
    if (hydrated.current) return;
    if (isEdit && !user) return; // wait for auth before hitting the DB
    hydrated.current = true;

    if (isEdit && editId) {
      (async () => {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', editId)
          .maybeSingle();
        if (error || !data) {
          toast.error('Could not load draft');
          nav('/instructor/courses');
          return;
        }
        if (data.instructor_id !== user!.id) {
          toast.error('You can only edit your own drafts');
          nav('/instructor/courses');
          return;
        }
        setTitle(data.title ?? '');
        setCategory(data.category ?? '');
        setSkillLevel((data.skill_level as SkillLevel) ?? '');
        setDescription(data.description ?? '');
        if (data.starts_at) {
          const s = new Date(data.starts_at);
          setDate(s.toISOString().slice(0, 10));
          setStartTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`);
        }
        if (data.ends_at) {
          const e = new Date(data.ends_at);
          setEndTime(`${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`);
        }
        setAddress(data.address ?? '');
        setCity(data.city ?? '');
        setState(data.state ?? '');
        setCapacity(data.capacity ? String(data.capacity) : '');
        setPrice(data.price_cents ? String(Math.round(data.price_cents / 100)) : '');
        if (data.cover_image_url) setCoverPreview(data.cover_image_url);
        if (Array.isArray((data as any).gallery_urls)) setGalleryUrls((data as any).gallery_urls);
        // Load existing waiver, if any
        const { data: w } = await supabase
          .from('course_waivers')
          .select('title, content')
          .eq('course_id', editId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (w) {
          setWaiverTitle(w.title);
          setWaiverContent(w.content);
        }
        toast.message('Draft loaded', { description: 'Pick up where you left off.' });
      })();
      return;
    }

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
  }, [DRAFT_KEY, isEdit, editId, user?.id]);

  // Debounced autosave on changes
  useEffect(() => {
    if (!hydrated.current) return;
    if (isEdit) return; // editing a real DB draft — skip localStorage autosave
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
      if (!coverFile) return 'A cover photo is required so students can recognize your course on the map and listings';
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
      if (!skipWaiver) {
        if (!waiverContent.trim()) return subActive ? 'Generate or paste your waiver, or check "Skip waiver for this course"' : 'Paste your waiver text, upgrade to Pro to AI-generate, or check "Skip waiver for this course"';
        if (!waiverLegalAck) return 'Please acknowledge the legal notice before continuing';
      }
    }
    if (step === 4) {
      if (!skillLevel) return 'Skill level is required — go back to Basics and pick a level';
      if (!isPrelaunch && !skipPublishGuards && !feeAck) return 'Please acknowledge the non-refundable listing fee before publishing';
    }
    return null;
  };

  const next = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (step < 4) { setStep(step + 1); return; }
    if (!user) { toast.error('You must be signed in'); return; }
    // Pre-launch: allow saving as draft only. Skip listing-fee/payout guards
    // since nothing is being published or charged yet.
    if (!isPrelaunch && !skipPublishGuards) {
      const confirmedPaymentMethod = hasPaymentMethodOnFile || !!(await refreshPaymentMethodHint());
      if (!confirmedPaymentMethod) {
        toast.error('Add a payment method before publishing', { description: 'Required to charge the listing fee.' });
        saveDraftNow();
        nav(paymentMethodsPath);
        return;
      }
      if (!connectActive) {
        toast.error('Set up payouts before publishing', {
          description: 'Students pay the full course price online — you need a payout account to receive funds.',
        });
        saveDraftNow();
        nav(payoutMethodsPath);
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
      // Upload any new gallery files. Combine with already-saved gallery URLs.
      let finalGallery: string[] = [...galleryUrls];
      if (galleryFiles.length > 0) {
        try {
          const uploaded = await Promise.all(galleryFiles.map((f) => uploadCoursePhoto(user.id, f)));
          finalGallery = [...finalGallery, ...uploaded].slice(0, 8);
        } catch (e: any) {
          toast.error(e?.message ?? 'Gallery photo upload failed');
          setSaving(false);
          return;
        }
      }
      // Geocode the address so the course pins on the map. We require a hit
      // for published courses — without coordinates the map can't render the
      // marker and students lose location context. Drafts are allowed to
      // skip (instructor may still be drafting an address).
      const geo = await geocodeAddress({ address, city, state });
      if (!isPrelaunch && !skipPublishGuards && !geo) {
        toast.error("We couldn't locate that address on the map", {
          description: 'Double-check the address, city, and state so students can find your course.',
        });
        setSaving(false);
        return;
      }
      let created: any;
      if (isEdit && editId) {
        const { data, error } = await supabase
          .from('courses')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            category,
            skill_level: skillLevel as SkillLevel,
            price_cents: Math.round(Number(price) * 100),
            duration_minutes: durationMin,
            capacity: Number(capacity),
            address: address || null,
            city,
            state,
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            ...(coverUrl ? { cover_image_url: coverUrl } : {}),
            gallery_urls: finalGallery,
            status: (isPrelaunch && !skipPublishGuards) ? 'draft' : 'published',
          })
          .eq('id', editId)
          .select()
          .single();
        if (error) throw error;
        created = data;
      } else {
        created = await createCourse(user.id, {
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
          lat: geo?.lat,
          lng: geo?.lng,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          cover_image_url: coverUrl,
          gallery_urls: finalGallery,
          status: (isPrelaunch && !skipPublishGuards) ? 'draft' : 'published',
        });
      }

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

      // Persist the waiver tied to this course (published so students must e-sign at checkout).
      if (!skipWaiver && waiverContent.trim()) {
        const { error: wErr } = await supabase.from('course_waivers').insert({
          course_id: created.id,
          title: waiverTitle.trim() || 'Liability Waiver & Assumption of Risk',
          content: waiverContent.trim(),
          published: true,
          ai_generated: subActive,
          ai_model: subActive ? 'google/gemini-3-flash-preview' : null,
        });
        if (wErr) {
          console.error('waiver insert failed', wErr);
          toast.warning('Course saved, but the waiver did not attach — open the course to add it.');
        }
      }

      // draft and can't go live until the platform launches.
      if (isPrelaunch && !skipPublishGuards) {
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

      // Skip the listing-fee charge if one was already recorded for this course
      // (e.g. editing/republishing a previously-published course). Drafts have
      // no charge yet, so this only fires the first time.
      const { data: existingCharge } = await supabase
        .from('instructor_charges')
        .select('id')
        .eq('course_id', created.id)
        .eq('charge_type', 'listing_fee')
        .limit(1)
        .maybeSingle();

      let redeemedCreditId: string | null = null;
      if (!existingCharge && subActive && availableCredits > 0) {
        redeemedCreditId = await redeemFreeListingCredit(user.id, created.id);
      }

      if (!existingCharge) {
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
      }

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
      <PageHeader title={isEdit ? 'Edit Draft' : 'New Course'} back onBack={back} />
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
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
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-card border-border min-h-28" placeholder="Describe your course — what students will learn, gear required, prerequisites, drills, range type, instructor background…" />
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] leading-snug text-foreground/80">
                  <span className="font-bold text-primary">Pro tip:</span> The most-booked courses include curriculum, gear list, prerequisites, drills, and your credentials. More detail = more bookings and fewer questions.
                </p>
              </div>
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
            <Field label={`Course Gallery (${galleryCount}/8)`}>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { onPickGallery(e.target.files); if (e.target) e.target.value = ''; }}
              />
              {galleryCount > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {galleryUrls.map((url, i) => (
                    <div key={`u-${i}`} className="relative aspect-square rounded-md overflow-hidden border border-border">
                      <img src={url} alt={`Gallery ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                      <button type="button" onClick={() => removeGalleryUrl(i)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-destructive hover:text-destructive-foreground" aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {galleryFiles.map((_, i) => (
                    <div key={`f-${i}`} className="relative aspect-square rounded-md overflow-hidden border border-border">
                      <img src={galleryPreviews[i]} alt={`New ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                      <button type="button" onClick={() => removeGalleryFile(i)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-destructive hover:text-destructive-foreground" aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={galleryCount >= 8}
                className="w-full h-20 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary hover:text-primary transition flex flex-col items-center justify-center gap-1 text-muted-foreground disabled:opacity-50"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">+ Add course photos</span>
              </button>
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] leading-snug text-foreground/80">
                  <span className="font-bold text-primary">Show, don't tell:</span> Add up to 8 photos of the range, training bays, equipment students will use (rifles, mats, pistols, dummies), the parking area, your gear table, or past classes in action. The cover photo above is what students see first; gallery photos appear on the course page so they know what to expect.
                </p>
              </div>
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
            {/* Legal disclaimer banner — top of waiver step */}
            <div className="tactical-card border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2 mb-2">
                <Scale className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                  Not Legal Counsel
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                TacLink is <strong className="text-foreground">not a law firm</strong> and does not provide legal advice. AI-generated waivers are a <strong className="text-foreground">starting draft only</strong>. Liability rules vary by state and discipline — you must have your final waiver reviewed by a <strong className="text-foreground">licensed attorney in your state</strong> before relying on it. By using this generator, you accept that:
              </p>
              <ul className="mt-1.5 ml-4 text-[11px] text-muted-foreground list-disc space-y-0.5">
                <li>The waiver is between <strong className="text-foreground">you and the student</strong>; TacLink is only the record-keeper.</li>
                <li>TacLink <strong className="text-foreground">assumes no liability</strong> for the waiver's content, enforceability, or compliance with local law.</li>
                <li>You are solely responsible for the final published text.</li>
              </ul>
            </div>

            <Field label="Waiver Title">
              <Input
                value={waiverTitle}
                onChange={(e) => setWaiverTitle(e.target.value)}
                className="bg-card border-border h-11"
                placeholder="Liability Waiver & Assumption of Risk"
                disabled={skipWaiver}
              />
            </Field>

            {subActive ? (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Tailoring criteria — check what applies to this course
                  </Label>
                  <div className={cn("mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2", skipWaiver && "opacity-40 pointer-events-none")}>
                    {[
                      ['liveFire', 'Live fire (real ammunition)'],
                      ['forceOnForce', 'Force-on-force / Simunitions'],
                      ['combatives', 'Hands-on combatives / grappling'],
                      ['vehicleBased', 'Vehicle-based drills'],
                      ['lowLight', 'Low-light / night ops'],
                      ['medicalRisk', 'Realistic medical scenarios'],
                      ['minorsAllowed', 'Minors allowed (parental co-sign)'],
                      ['mediaRelease', 'Photo / video may be captured'],
                      ['offsiteTravel', 'Off-site travel during course'],
                      ['instructorGear', 'Instructor-provided firearms / gear'],
                      ['physicalExertion', 'High physical exertion'],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5 text-[12px] cursor-pointer hover:border-primary/50 transition"
                      >
                        <Checkbox
                          checked={!!waiverCriteria[key as keyof WaiverCriteria]}
                          onCheckedChange={() => toggleCriterion(key as keyof WaiverCriteria)}
                          className="mt-0.5"
                        />
                        <span className="leading-snug">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Field label="Anything else the waiver should mention? (optional)">
                  <Textarea
                    value={waiverNotes}
                    onChange={(e) => setWaiverNotes(e.target.value)}
                    placeholder="e.g. specific drills, range rules, prerequisites, alcohol/drug policy…"
                    className="bg-card border-border min-h-20"
                    disabled={skipWaiver}
                  />
                </Field>

                <Button
                  type="button"
                  onClick={generateWaiver}
                  disabled={waiverGenerating || skipWaiver}
                  className="w-full h-11 bg-primary text-primary-foreground font-bold"
                >
                  {waiverGenerating
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-4 w-4 mr-2" /> {waiverContent ? 'Regenerate with AI' : 'Generate waiver with AI'}</>}
                </Button>
              </>
            ) : (
              <div className="tactical-card p-0 overflow-hidden border-primary/50">
                {/* Pro hero */}
                <div className="relative bg-gradient-to-br from-primary/25 via-primary/10 to-card p-5 border-b border-primary/30">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-[0.18em]">
                    <Sparkles className="h-3 w-3" /> Pro Feature
                  </div>
                  <h3 className="mt-2 text-lg font-extrabold leading-tight text-foreground">
                    AI Waiver Generator
                  </h3>
                  <p className="text-[12px] leading-relaxed text-muted-foreground mt-1.5">
                    Auto-draft course-specific waivers tailored to <strong className="text-foreground">live-fire, force-on-force, combatives, vehicle drills, low-light</strong>, and more — in seconds, every time you create a course. Available exclusively on <strong className="text-foreground">TacLink Pro</strong>.
                  </p>
                  <Button
                    type="button"
                    onClick={() => nav('/instructor/subscription')}
                    className="w-full h-11 mt-3 bg-primary text-primary-foreground font-bold"
                  >
                    <Sparkles className="h-4 w-4 mr-2" /> Upgrade to Pro
                  </Button>
                </div>

                {/* Free plan responsibility */}
                <div className="p-4 space-y-3 bg-card">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-[12px] leading-relaxed text-foreground">
                      On the <strong>free plan</strong>, you are <strong>solely responsible for providing your own course waiver in person</strong> on the day of training. TacLink will not generate or supply a waiver, and students will not be required to e-sign one through the app for this course.
                    </div>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer p-3 rounded-md border border-amber-500/40 bg-amber-500/5">
                    <Checkbox
                      checked={freePlanWaiverAck}
                      onCheckedChange={(v) => setFreePlanWaiverAck(!!v)}
                      className="mt-0.5"
                    />
                    <span className="text-[11px] leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">I confirm</strong> that I will provide my own attorney-reviewed waiver to every student in person before training begins, and I accept full responsibility for its content, enforceability, and collection. TacLink is not a law firm and assumes no liability.
                    </span>
                  </label>

                  <p className="text-[11px] text-muted-foreground text-center">
                    Optional — you may also paste your waiver text below to keep a digital copy on file.
                  </p>
                </div>
              </div>
            )}

            {!skipWaiver && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {subActive ? 'Draft (edit freely — markdown)' : 'Paste your waiver text (markdown supported)'}
                  </Label>
                  {waiverContent && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setWaiverPreview((p) => !p)} className="h-7 text-[11px]">
                      <FileText className="h-3 w-3 mr-1" /> {waiverPreview ? 'Edit' : 'Preview'}
                    </Button>
                  )}
                </div>
                {waiverPreview && waiverContent ? (
                  <div className="prose prose-sm max-w-none border border-border rounded-md p-3 bg-card text-xs max-h-80 overflow-y-auto">
                    <h3>{waiverTitle}</h3>
                    <ReactMarkdown>{waiverContent}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    value={waiverContent}
                    onChange={(e) => setWaiverContent(e.target.value)}
                    placeholder={subActive ? '' : 'Paste your attorney-reviewed waiver here…'}
                    className="bg-card border-border font-mono text-xs min-h-72"
                  />
                )}

                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-md border border-amber-500/40 bg-amber-500/5">
                  <Checkbox checked={waiverLegalAck} onCheckedChange={(v) => setWaiverLegalAck(!!v)} className="mt-0.5" />
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">I confirm</strong> that I will have this waiver reviewed by a licensed attorney in my state before relying on it, and I accept that TacLink provides no legal advice and assumes no liability for the waiver's content or enforceability.
                  </span>
                </label>
              </>
            )}

            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-md border border-border bg-card">
              <Checkbox checked={skipWaiver} onCheckedChange={(v) => { setSkipWaiver(!!v); if (v) setWaiverLegalAck(false); }} className="mt-0.5" />
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                Skip waiver for this course — students will not be required to e-sign before booking. <span className="block text-amber-600 mt-0.5"><AlertTriangle className="inline h-3 w-3 mr-1" />Strongly discouraged for any live-fire or contact training.</span>
              </span>
            </label>
          </>
        )}

        {step === 4 && (
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
            {skipPublishGuards && (
              <div className="tactical-card border-primary/40 bg-primary/10 p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider font-bold text-primary">QA test account</div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  You're a fake QA test instructor — payment method, payout setup, listing-fee charge, and address geocoding are <strong className="text-foreground">not enforced</strong>. The cards below are shown so you can preview the live flow. Your course publishes immediately and is only visible to other fake QA test students and admins.
                </p>
              </div>
            )}
            {isPrelaunch && !skipPublishGuards ? (
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
                {(hasPM || pmHint) ? (
                  <div className="tactical-card border-success/40 bg-success/10 p-3 flex items-center gap-2 text-xs">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="text-foreground">
                      {pmHint && pmHint.method_type === 'card' && pmHint.last4
                        ? <>Payment method: <strong className="text-foreground">{pmHint.brand || 'Card'} •••• {pmHint.last4}</strong>. </>
                        : pmHint && pmHint.handle
                          ? <>Payment method: <strong className="text-foreground">{pmHint.method_type} · {pmHint.handle}</strong>. </>
                          : <>Payment method on file. </>}
                      <Link to={paymentMethodsPath} className="text-primary underline">Manage</Link>
                    </span>
                  </div>
                ) : (
                  <div className="tactical-card border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                    <div className="font-bold text-destructive">Required to publish:</div>
                    <Link to={paymentMethodsPath} className="block text-primary underline">Add a payment method →</Link>
                  </div>
                )}
                {connectActive ? (
                  <div className="tactical-card border-success/40 bg-success/10 p-3 flex items-center gap-2 text-xs">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="text-foreground">
                      {payoutHint
                        ? <>Payout method: <strong className="text-foreground capitalize">{payoutHint.method_type} · {payoutHint.handle}</strong> (preferred). </>
                        : <>Payout account connected. </>}
                      <Link to={payoutMethodsPath} className="text-primary underline">Change</Link>
                    </span>
                  </div>
                ) : (
                  <div className="tactical-card border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                    <div className="font-bold text-destructive">Required to publish:</div>
                    <Link to={payoutMethodsPath} className="block text-primary underline">Set up a payout method →</Link>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="flex gap-2 pt-4">
          {step > 0 && <Button variant="outline" onClick={back} disabled={saving} className="flex-1 h-12 bg-card border-border font-semibold">Back</Button>}
          <Button onClick={next} disabled={saving || (step === 4 && !isPrelaunch && !skipPublishGuards && !feeAck)} className="flex-1 h-12 bg-primary text-primary-foreground font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step < 4
              ? 'Continue'
              : (isPrelaunch && !skipPublishGuards)
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
