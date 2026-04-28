import { useMemo, useState } from 'react';
import { z } from 'zod';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Lock, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Card = { id: string; brand: string; last4: string; exp: string; name: string };

const STORAGE_KEY = 'student-payment-methods';

const loadCards = (): Card[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
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

// Luhn checksum
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
  const now = new Date();
  const fullYear = 2000 + yy;
  const endOfMonth = new Date(fullYear, mm, 0, 23, 59, 59);
  return endOfMonth.getTime() >= now.getTime();
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
        message: `${brand} ending in ${last4} is already saved on this device`,
      });
    }
  });

const PaymentMethods = () => {
  const [cards, setCards] = useState<Card[]>(loadCards);
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const digitsOnly = number.replace(/\D/g, '');
  const brand = useMemo<Brand>(() => detectBrand(digitsOnly), [digitsOnly]);

  const reset = () => {
    setNumber(''); setExp(''); setCvc(''); setName('');
    setErrors({}); setAdding(false);
  };

  const persist = (next: Card[]) => {
    setCards(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    const schema = buildSchema(brand, cards);
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
    const card: Card = {
      id: crypto.randomUUID(),
      brand,
      last4,
      exp: data.exp,
      name: data.name,
    };
    persist([...cards, card]);
    toast.success('Payment method added');
    reset();
  };

  const handleRemove = (id: string) => {
    persist(cards.filter((c) => c.id !== id));
    toast.success('Payment method removed');
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
        {cards.length === 0 && !adding && (
          <div className="tactical-card p-6 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No payment methods yet.</p>
            <p className="text-xs text-muted-foreground/80">Add one to speed up checkout.</p>
          </div>
        )}

        {cards.map((c) => (
          <div key={c.id} className="tactical-card p-4 flex items-center gap-3">
            <div className="h-10 w-14 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{c.brand} •••• {c.last4}</div>
              <div className="text-[11px] text-muted-foreground">{c.name} · Exp {c.exp}</div>
            </div>
            <button onClick={() => handleRemove(c.id)} className="text-muted-foreground hover:text-destructive p-2" aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="tactical-card p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lock className="h-3 w-3" /> Add Card
              {brand !== 'Card' && (
                <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">{brand}</span>
              )}
            </div>

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

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={reset} className="flex-1">Cancel</Button>
              <Button onClick={handleAdd} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">Save Card</Button>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Cards are stored locally on this device for demo. Real charges are processed securely at checkout.</p>
          </div>
        ) : (
          <Button onClick={() => setAdding(true)} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            <Plus className="h-4 w-4 mr-1" /> Add Payment Method
          </Button>
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
