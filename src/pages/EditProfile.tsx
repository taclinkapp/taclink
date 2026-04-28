import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, User, Save, Camera, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROFILE_BUCKET = 'profile-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type RequirementKey =
  | 'display_name'
  | 'photo_url'
  | 'phone'
  | 'bio'
  | 'state'
  | 'service_city'
  | 'service_state';

type Requirement = { key: RequirementKey; label: string; check: (f: FormState) => boolean };

const studentRequirements: Requirement[] = [
  { key: 'display_name', label: 'Display name', check: (f) => f.display_name.trim().length >= 2 },
  { key: 'photo_url', label: 'Profile photo', check: (f) => !!f.photo_url.trim() },
  { key: 'state', label: 'Home state', check: (f) => !!f.state.trim() },
  { key: 'bio', label: 'Short about you', check: (f) => f.bio.trim().length >= 10 },
];

const instructorRequirements: Requirement[] = [
  { key: 'display_name', label: 'Display name', check: (f) => f.display_name.trim().length >= 2 },
  { key: 'photo_url', label: 'Profile photo', check: (f) => !!f.photo_url.trim() },
  { key: 'phone', label: 'Phone number', check: (f) => f.phone.trim().length >= 7 },
  { key: 'bio', label: 'Bio (20+ chars)', check: (f) => f.bio.trim().length >= 20 },
  { key: 'service_city', label: 'Service city', check: (f) => !!f.service_city.trim() },
  { key: 'service_state', label: 'Service state', check: (f) => !!f.service_state.trim() },
];

const baseSchema = {
  display_name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be 80 characters or less'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone must be 20 characters or less')
    .regex(/^[+\d\s().-]*$/, 'Phone can only contain digits and + ( ) - .')
    .optional()
    .or(z.literal('')),
  state: z
    .string()
    .trim()
    .max(40, 'State must be 40 characters or less')
    .optional()
    .or(z.literal('')),
  photo_url: z
    .string()
    .trim()
    .url('Photo URL must be a valid link')
    .max(500, 'Photo URL too long')
    .optional()
    .or(z.literal('')),
};

const studentSchema = z.object({
  ...baseSchema,
  bio: z.string().trim().max(280, 'Bio must be 280 characters or less').optional().or(z.literal('')),
});

const instructorSchema = z.object({
  ...baseSchema,
  bio: z
    .string()
    .trim()
    .min(20, 'Add at least 20 characters so students know your background')
    .max(1000, 'Bio must be 1000 characters or less'),
  service_state: z
    .string()
    .trim()
    .max(40, 'State must be 40 characters or less')
    .optional()
    .or(z.literal('')),
  service_city: z
    .string()
    .trim()
    .max(80, 'City must be 80 characters or less')
    .optional()
    .or(z.literal('')),
});

type FormState = {
  display_name: string;
  phone: string;
  state: string;
  photo_url: string;
  bio: string;
  service_state: string;
  service_city: string;
};

const EditProfile = () => {
  const nav = useNavigate();
  const { user, primaryRole, refreshProfile } = useAuth();
  const isInstructor = primaryRole === 'instructor';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>({
    display_name: '',
    phone: '',
    state: '',
    photo_url: '',
    bio: '',
    service_state: '',
    service_city: '',
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('display_name, phone, state, photo_url, bio, service_state, service_city')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data) {
        setForm({
          display_name: data.display_name ?? '',
          phone: data.phone ?? '',
          state: data.state ?? '',
          photo_url: data.photo_url ?? '',
          bio: data.bio ?? '',
          service_state: (data as any).service_state ?? '',
          service_city: (data as any).service_city ?? '',
        });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const requirements = isInstructor ? instructorRequirements : studentRequirements;
  const completed = useMemo(() => requirements.filter((r) => r.check(form)).length, [requirements, form]);
  const completeness = Math.round((completed / requirements.length) * 100);

  const update = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handlePhotoFile = async (file: File) => {
    if (!user?.id) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error('Photo must be JPG, PNG, or WEBP');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Photo must be 5MB or smaller');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) {
      setUploading(false);
      toast.error('Could not upload photo', { description: error.message });
      return;
    }
    const { data: pub } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    setUploading(false);
    update('photo_url', pub.publicUrl);
    toast.success('Photo uploaded — remember to save');
  };

  const removePhoto = () => {
    update('photo_url', '');
    toast.message('Photo removed — remember to save');
  };

  const submit = async () => {
    if (!user?.id) return;
    const schema = isInstructor ? instructorSchema : studentSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: any = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof FormState;
        if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    const payload: any = {
      display_name: parsed.data.display_name,
      phone: (parsed.data as any).phone || null,
      state: (parsed.data as any).state || null,
      photo_url: (parsed.data as any).photo_url || null,
      bio: (parsed.data as any).bio || null,
    };
    if (isInstructor) {
      payload.service_state = (parsed.data as any).service_state || null;
      payload.service_city = (parsed.data as any).service_city || null;
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error('Could not save profile', { description: error.message });
      return;
    }
    await refreshProfile();
    toast.success('Profile updated');
    nav(isInstructor ? '/instructor/profile' : '/student/profile');
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Edit Profile" back />
      <div className="px-4 py-4 pb-24 space-y-4">
        <div className="rounded-md border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold">
              {isInstructor ? 'Instructor profile' : 'Student profile'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isInstructor
                ? 'Visible publicly to students browsing your courses.'
                : 'Visible to instructors when you book a course.'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1.5" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Display name" error={errors.display_name} required>
              <Input
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                maxLength={80}
                placeholder="Your name"
              />
            </Field>

            <Field label="Photo URL" error={errors.photo_url} hint="Direct link to a square image (optional)">
              <Input
                value={form.photo_url}
                onChange={(e) => update('photo_url', e.target.value)}
                maxLength={500}
                placeholder="https://…"
                inputMode="url"
              />
            </Field>

            <Field label="Phone" error={errors.phone} hint="Used only for booking confirmations">
              <Input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                maxLength={20}
                placeholder="+1 555 123 4567"
                inputMode="tel"
              />
            </Field>

            <Field label="Home state" error={errors.state}>
              <Input
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                maxLength={40}
                placeholder="TX"
              />
            </Field>

            <Field
              label={isInstructor ? 'Bio' : 'About you'}
              error={errors.bio}
              required={isInstructor}
              hint={
                isInstructor
                  ? 'Background, certifications style, what students should expect (20-1000 chars).'
                  : 'Optional. Up to 280 characters.'
              }
            >
              <Textarea
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                maxLength={isInstructor ? 1000 : 280}
                rows={isInstructor ? 5 : 3}
                placeholder={
                  isInstructor
                    ? 'Former Marine. NRA-certified pistol & rifle instructor with 12 years experience…'
                    : 'A bit about your training goals'
                }
              />
              <div className="text-[10px] text-muted-foreground text-right mt-1">
                {form.bio.length}/{isInstructor ? 1000 : 280}
              </div>
            </Field>

            {isInstructor && (
              <>
                <Field label="Service city" error={errors.service_city} hint="Where you primarily teach">
                  <Input
                    value={form.service_city}
                    onChange={(e) => update('service_city', e.target.value)}
                    maxLength={80}
                    placeholder="Austin"
                  />
                </Field>
                <Field label="Service state" error={errors.service_state}>
                  <Input
                    value={form.service_state}
                    onChange={(e) => update('service_state', e.target.value)}
                    maxLength={40}
                    placeholder="TX"
                  />
                </Field>
              </>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-md bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  );
};

const Field = ({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
      {label}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
    {children}
    {error ? (
      <p className="text-[11px] text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

export default EditProfile;
