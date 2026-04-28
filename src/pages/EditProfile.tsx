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
import { Loader2, User, Save, Camera, Trash2, CheckCircle2, Circle, AlertTriangle, RotateCw, X } from 'lucide-react';
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const requirements = isInstructor ? instructorRequirements : studentRequirements;
  const completed = useMemo(() => requirements.filter((r) => r.check(form)).length, [requirements, form]);
  const completeness = Math.round((completed / requirements.length) * 100);

  const update = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const uploadWithProgress = (file: File): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      if (!user?.id) return reject(new Error('Not signed in'));
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { data: signed, error: signErr } = await supabase.storage
        .from(PROFILE_BUCKET)
        .createSignedUploadUrl(path);
      if (signErr || !signed) return reject(new Error(signErr?.message || 'Could not prepare upload'));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('PUT', signed.signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data: pub } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
          update('photo_url', pub.publicUrl);
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => {
        xhrRef.current = null;
        reject(new Error('Network error during upload'));
      };
      xhr.onabort = () => {
        xhrRef.current = null;
        reject(new Error('Upload cancelled'));
      };
      xhr.send(file);
    });
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
    setLastFile(file);
    setUploadError(null);
    setUploadProgress(0);
    setUploading(true);
    try {
      await uploadWithProgress(file);
      setUploading(false);
      setUploadProgress(100);
      toast.success('Photo uploaded — remember to save');
    } catch (err: any) {
      setUploading(false);
      setUploadError(err?.message || 'Upload failed');
      toast.error('Photo upload failed', { description: err?.message });
    }
  };

  const retryUpload = () => {
    if (lastFile) handlePhotoFile(lastFile);
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
  };

  const removePhoto = () => {
    update('photo_url', '');
    setUploadError(null);
    setUploadProgress(0);
    setLastFile(null);
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
    const pct = Math.round(
      (requirements.filter((r) => r.check(parsed.data as any as FormState)).length /
        requirements.length) *
        100,
    );
    toast.success(`Profile saved · ${pct}% complete`);
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
            <CompletenessCard percent={completeness} requirements={requirements} form={form} />

            <div className="rounded-md border border-border bg-card p-4">
              <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                Profile photo
              </Label>
              <div className="mt-3 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-primary/40 bg-muted flex items-center justify-center shrink-0">
                  {form.photo_url ? (
                    <img src={form.photo_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-primary/40 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/20 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    {form.photo_url ? 'Replace photo' : 'Upload photo'}
                  </button>
                  {form.photo_url && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-muted-foreground text-xs font-bold uppercase tracking-wider hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    JPG, PNG or WEBP · max 5MB
                  </p>
                </div>
              </div>
            </div>

            <Field label="Display name" error={errors.display_name} required>
              <Input
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                maxLength={80}
                placeholder="Your name"
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

const CompletenessCard = ({
  percent,
  requirements,
  form,
}: {
  percent: number;
  requirements: Requirement[];
  form: FormState;
}) => {
  const tone =
    percent >= 100
      ? 'text-emerald-600'
      : percent >= 60
        ? 'text-primary'
        : 'text-amber-600';
  const barColor =
    percent >= 100 ? 'bg-emerald-500' : percent >= 60 ? 'bg-primary' : 'bg-amber-500';

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Profile completeness
          </div>
          <div className={cn('text-2xl font-black mt-0.5', tone)}>{percent}%</div>
        </div>
        {percent >= 100 ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border">
            {requirements.filter((r) => r.check(form)).length}/{requirements.length} done
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="space-y-1 pt-1">
        {requirements.map((r) => {
          const ok = r.check(form);
          return (
            <li
              key={r.key}
              className={cn(
                'flex items-center gap-2 text-xs',
                ok ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EditProfile;
