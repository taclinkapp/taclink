import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Lock, Trash2, AlertCircle, Loader2, Pencil, X, Save, Smartphone, Mail, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALT_PAYOUT_META,
  validatePayoutHandle,
  normalizePayoutHandle,
  type AltPayoutType,
} from '@/lib/payoutHandleValidation';

type AltType = AltPayoutType;
type MethodType = 'card' | AltType;

type Card = {
  id: string;
  method_type: MethodType;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  handle: string | null;
};

const ALT_ICON: Record<AltType, typeof Smartphone> = {
  cashapp: DollarSign,
  venmo: Smartphone,
  paypal: Mail,
  zelle: Mail,
};

const ALT_META: Record<AltType, { label: string; placeholder: string; icon: typeof Smartphone; hint: string; validate: (v: string) => string | null }> = {
  cashapp: { ...ALT_PAYOUT_META.cashapp, icon: ALT_ICON.cashapp },
  venmo: { ...ALT_PAYOUT_META.venmo, icon: ALT_ICON.venmo },
  paypal: { ...ALT_PAYOUT_META.paypal, icon: ALT_ICON.paypal },
  zelle: { ...ALT_PAYOUT_META.zelle, icon: ALT_ICON.zelle },
};

type Brand = 'Visa' | 'Mastercard' | 'Amex' | 'Discover' | 'Card';

const detectBrand = (digits: string): Brand => {
  if (/^4\d{0,}$/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])\d{0,}$/.test(digits)) return 'Mastercard';
  if (/^3[47]\d{0,}$/.test(digits)) return 'Amex';
  if (/^(6011|65|64[4-9])\d{0,}$/.test(digits)) return 'Discover';
  return 'Card';
};

const brandLengths: Record<Brand, number[]> = {
  Visa: [13, 16, 19],
  Mastercard: [16],
  Amex: [15],
  Discover: [16, 19],
  Card: [13, 14, 15, 16, 17, 18, 19],
};

const brandCvcLength = (brand: Brand) => (brand === 'Amex' ? 4 : 3);

const luhnValid = (digits: string): boolean => {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0 && digits.length > 0;
};

const formatNumber = (raw: string, brand: Brand): string => {
  const d = raw.replace(/\D/g, '').slice(0, brand === 'Amex' ? 15 : 19);
  if (brand === 'Amex') return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*$/, (_, a, b, c) =>
    [a, b, c].filter(Boolean).join(' '));
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const formatExp = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

const expNotInPast = (mm: number, yy: number): boolean => {
  if (mm < 1 || mm > 12) return false;
  const fullYear = 2000 + yy;
  const endOfMonth = new Date(fullYear, mm, 0, 23, 59, 59);
  return endOfMonth.getTime() >= Date.now();
};

const buildSchema = (brand: Brand, existing: Card[]) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Cardholder name is too short')
      .max(80, 'Cardholder name is too long')
      .regex(/^[A-Za-zÀ-ÿ'’.\- ]+$/, 'Use letters, spaces, hyphens, apostrophes only'),
    number: z
      .string()
      .transform((s) => s.replace(/\s+/g, ''))
      .refine((d) => /^\d+$/.test(d), 'Card number must be digits only')
      .refine((d) => brandLengths[brand].includes(d.length), `Invalid length for ${brand}`)
      .refine((d) => luhnValid(d), 'Card number failed checksum'),
    exp: z
      .string()
      .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be MM/YY')
      .refine((v) => {
        const [mm, yy] = v.split('/').map(Number);
        return expNotInPast(mm, yy);
      }, 'Card is expired'),
    cvc: z
      .string()
      .regex(/^\d+$/, 'CVC must be digits')
      .refine((v) => v.length === brandCvcLength(brand), `CVC must be ${brandCvcLength(brand)} digits`),
  }).superRefine((val, ctx) => {
    const last4 = val.number.replace(/\s+/g, '').slice(-4);
    if (existing.some((c) => c.brand === brand && c.last4 === last4)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['number'],
        message: `${brand} ending in ${last4} is already saved on your account`,
      });
    }
  });

const PaymentMethods = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addType, setAddType] = useState<MethodType>('card');
  const [altHandle, setAltHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit-row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editExp, setEditExp] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  const digitsOnly = number.replace(/\D/g, '');
  const brand = useMemo<Brand>(() => detectBrand(digitsOnly), [digitsOnly]);
  const cardsOnly = useMemo(() => cards.filter((c) => c.method_type === 'card') as (Card & { brand: string; last4: string })[], [cards]);

  const reload = async () => {
    if (!user) { setCards([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, method_type, brand, last4, exp_month, exp_year, cardholder_name, handle')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setCards((data as Card[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id]);

  const reset = () => {
    setNumber(''); setExp(''); setCvc(''); setName('');
    setAltHandle(''); setAddType('card');
    setErrors({}); setAdding(false);
  };

  const handleAdd = async () => {
    if (!user) { toast.error('Please sign in'); return; }

    if (addType !== 'card') {
      const meta = ALT_META[addType];
      const raw = altHandle.trim();
      const err = meta.validate(raw);
      if (err) { setErrors({ handle: err }); toast.error(err); return; }
      const handleVal = normalizePayoutHandle(addType, raw);
      const dup = cards.some((c) => c.method_type === addType && (c.handle ?? '').toLowerCase() === handleVal.toLowerCase());
      if (dup) {
        const msg = `That ${meta.label} account is already saved`;
        setErrors({ handle: msg }); toast.error(msg); return;
      }
      setSaving(true);
      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        method_type: addType,
        handle: handleVal,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`${meta.label} added`);
      reset();
      reload();
      return;
    }

    const schema = buildSchema(brand, cardsOnly);
    const parsed = schema.safeParse({ name, number, exp, cvc });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as string) ?? 'form';
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? 'Please fix the errors');
      return;
    }
    const data = parsed.data;
    const last4 = data.number.slice(-4);
    const [mm, yy] = data.exp.split('/').map(Number);

    setSaving(true);
    const { error } = await supabase.from('payment_methods').insert({
      user_id: user.id,
      method_type: 'card',
      brand,
      last4,
      exp_month: mm,
      exp_year: yy,
      cardholder_name: data.name,
    });
    setSaving(false);

    if (error) {
      if ((error as any).code === '23505') {
        setErrors({ number: `${brand} ending in ${last4} is already saved on your account` });
        toast.error('Duplicate card — already saved on your account');
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success('Payment method added');
    reset();
    reload();
  };

  const handleRemove = async (id: string) => {
    const prev = cards;
    setCards(prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) {
      setCards(prev);
      toast.error(error.message);
      return;
    }
    toast.success('Payment method removed');
  };

  const startEdit = (c: Card) => {
    setEditingId(c.id);
    setEditErrors({});
    if (c.method_type === 'card') {
      setEditName(c.cardholder_name ?? '');
      setEditExp(`${String(c.exp_month ?? 0).padStart(2, '0')}/${String(c.exp_year ?? 0).padStart(2, '0')}`);
      setEditHandle('');
    } else {
      setEditHandle(c.handle ?? '');
      setEditName(''); setEditExp('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditErrors({});
  };

  const handleSaveEdit = async (id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const fieldErrors: Record<string, string> = {};

    if (card.method_type !== 'card') {
      const meta = ALT_META[card.method_type as AltType];
      const raw = editHandle.trim();
      const err = meta.validate(raw);
      if (err) { setEditErrors({ handle: err }); return; }
      const v = normalizePayoutHandle(card.method_type as AltType, raw);
      const dup = cards.some((c) => c.id !== id && c.method_type === card.method_type && (c.handle ?? '').toLowerCase() === v.toLowerCase());
      if (dup) { setEditErrors({ handle: `That ${meta.label} account is already saved` }); return; }
      setEditSaving(true);
      const { error } = await supabase.from('payment_methods').update({ handle: v }).eq('id', id);
      setEditSaving(false);
      if (error) { toast.error(error.message); return; }
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, handle: v } : c));
      toast.success('Payment method updated');
      cancelEdit();
      return;
    }

    const trimmedName = editName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      fieldErrors.name = 'Cardholder name must be 2–80 characters';
    } else if (!/^[A-Za-zÀ-ÿ'’.\- ]+$/.test(trimmedName)) {
      fieldErrors.name = 'Use letters, spaces, hyphens, apostrophes only';
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(editExp)) {
      fieldErrors.exp = 'Expiry must be MM/YY';
    } else {
      const [mm, yy] = editExp.split('/').map(Number);
      if (!expNotInPast(mm, yy)) fieldErrors.exp = 'Card is expired';
    }
    if (Object.keys(fieldErrors).length) {
      setEditErrors(fieldErrors);
      return;
    }
    const [mm, yy] = editExp.split('/').map(Number);
    setEditSaving(true);
    const { error } = await supabase
      .from('payment_methods')
      .update({ cardholder_name: trimmedName, exp_month: mm, exp_year: yy })
      .eq('id', id);
    setEditSaving(false);
    if (error) { toast.error(error.message); return; }
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, cardholder_name: trimmedName, exp_month: mm, exp_year: yy } : c));
    toast.success('Payment method updated');
    cancelEdit();
  };

  const onNumberChange = (v: string) => {
    const newDigits = v.replace(/\D/g, '');
    const newBrand = detectBrand(newDigits);
    setNumber(formatNumber(v, newBrand));
    if (errors.number) setErrors((e) => ({ ...e, number: '' }));
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Payment Methods" back />
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : (
          <>
            {cards.length === 0 && !adding && (
              <div className="tactical-card p-6 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">No payment methods yet.</p>
                <p className="text-xs text-muted-foreground/80">Add one to speed up checkout.</p>
              </div>
            )}

            {cards.map((c) => {
              const isCard = c.method_type === 'card';
              const altMeta = !isCard ? ALT_META[c.method_type as AltType] : null;
              const Icon = altMeta?.icon ?? CreditCard;
              if (editingId === c.id) {
                return (
                  <div key={c.id} className="tactical-card p-4 space-y-3 border-primary/40">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <div className="text-sm font-bold">
                        {isCard ? `${c.brand} •••• ${c.last4}` : altMeta!.label}
                      </div>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Editing</span>
                    </div>

                    {isCard ? (
                      <>
                        <Field label="Cardholder name" error={editErrors.name}>
                          <Input
                            value={editName}
                            onChange={(e) => { setEditName(e.target.value); if (editErrors.name) setEditErrors((x) => ({ ...x, name: '' })); }}
                            placeholder="Name on card"
                            maxLength={80}
                            autoComplete="cc-name"
                            className="bg-background border-border h-11"
                          />
                        </Field>
                        <Field label="Expiry" error={editErrors.exp}>
                          <Input
                            value={editExp}
                            onChange={(e) => { setEditExp(formatExp(e.target.value)); if (editErrors.exp) setEditErrors((x) => ({ ...x, exp: '' })); }}
                            placeholder="MM/YY"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            maxLength={5}
                            className="bg-background border-border h-11 font-mono"
                          />
                        </Field>
                        <p className="text-[10px] text-muted-foreground italic">Card brand and last 4 digits cannot be changed. To use a different card, remove this one and add a new one.</p>
                      </>
                    ) : (
                      <Field label={altMeta!.hint} error={editErrors.handle}>
                        <Input
                          value={editHandle}
                          onChange={(e) => { setEditHandle(e.target.value); if (editErrors.handle) setEditErrors((x) => ({ ...x, handle: '' })); }}
                          placeholder={altMeta!.placeholder}
                          maxLength={120}
                          className="bg-background border-border h-11"
                        />
                      </Field>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={cancelEdit} disabled={editSaving} className="flex-1">
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                      <Button onClick={() => handleSaveEdit(c.id)} disabled={editSaving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                        {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                        Save
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={c.id} className="tactical-card p-4 flex items-center gap-3">
                  <div className="h-10 w-14 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      {isCard ? `${c.brand} •••• ${c.last4}` : `${altMeta!.label} · ${c.handle}`}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {isCard
                        ? `${c.cardholder_name} · Exp ${String(c.exp_month).padStart(2, '0')}/${String(c.exp_year).padStart(2, '0')}`
                        : 'Alternate payment method'}
                    </div>
                  </div>
                  <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-primary p-2" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleRemove(c.id)} className="text-muted-foreground hover:text-destructive p-2" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {adding ? (
              <div className="tactical-card p-4 space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Add Payment Method
                  {addType === 'card' && brand !== 'Card' && (
                    <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">{brand}</span>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <div className="mt-1 grid grid-cols-5 gap-1.5">
                    {(['card', 'cashapp', 'venmo', 'paypal', 'zelle'] as MethodType[]).map((t) => {
                      const active = addType === t;
                      const Icon = t === 'card' ? CreditCard : ALT_META[t as AltType].icon;
                      const label = t === 'card' ? 'Card' : ALT_META[t as AltType].label.split(' ')[0];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setAddType(t); setErrors({}); }}
                          className={`h-14 rounded-md border text-[10px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition ${active ? 'bg-primary/15 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/40'}`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {addType === 'card' ? (
                  <>
                    <Field label="Cardholder name" error={errors.name}>
                      <Input
                        value={name}
                        onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: '' })); }}
                        placeholder="Name on card"
                        maxLength={80}
                        autoComplete="cc-name"
                        className="bg-background border-border h-11"
                      />
                    </Field>

                    <Field label="Card number" error={errors.number}>
                      <Input
                        value={number}
                        onChange={(e) => onNumberChange(e.target.value)}
                        placeholder={brand === 'Amex' ? '3782 822463 10005' : '4242 4242 4242 4242'}
                        inputMode="numeric"
                        autoComplete="cc-number"
                        className="bg-background border-border h-11 font-mono tracking-wider"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Expiry" error={errors.exp}>
                        <Input
                          value={exp}
                          onChange={(e) => { setExp(formatExp(e.target.value)); if (errors.exp) setErrors((x) => ({ ...x, exp: '' })); }}
                          placeholder="MM/YY"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          maxLength={5}
                          className="bg-background border-border h-11 font-mono"
                        />
                      </Field>
                      <Field label={`CVC (${brandCvcLength(brand)} digits)`} error={errors.cvc}>
                        <Input
                          value={cvc}
                          onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, '').slice(0, brandCvcLength(brand));
                            setCvc(d);
                            if (errors.cvc) setErrors((x) => ({ ...x, cvc: '' }));
                          }}
                          placeholder={brand === 'Amex' ? '1234' : '123'}
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          maxLength={4}
                          className="bg-background border-border h-11 font-mono"
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <Field label={ALT_META[addType as AltType].hint} error={errors.handle}>
                    <Input
                      value={altHandle}
                      onChange={(e) => { setAltHandle(e.target.value); if (errors.handle) setErrors((x) => ({ ...x, handle: '' })); }}
                      placeholder={ALT_META[addType as AltType].placeholder}
                      maxLength={120}
                      className="bg-background border-border h-11"
                    />
                  </Field>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={reset} disabled={saving} className="flex-1">Cancel</Button>
                  <Button onClick={handleAdd} disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  {addType === 'card'
                    ? 'Cards are saved to your account. Real charges are processed securely at checkout.'
                    : `Your ${ALT_META[addType as AltType].label} info is saved as a payout/contact reference. Off-platform transfers happen between you and the instructor.`}
                </p>
              </div>
            ) : (
              <Button onClick={() => setAdding(true)} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                <Plus className="h-4 w-4 mr-1" /> Add Payment Method
              </Button>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="mt-1">{children}</div>
    {error && (
      <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> {error}
      </p>
    )}
  </div>
);

export default PaymentMethods;
