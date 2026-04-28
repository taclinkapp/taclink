import { useState } from 'react';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Card = { id: string; brand: string; last4: string; exp: string; name: string };

const STORAGE_KEY = 'student-payment-methods';

const loadCards = (): Card[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
};

const detectBrand = (num: string): string => {
  const n = num.replace(/\s+/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^6/.test(n)) return 'Discover';
  return 'Card';
};

const PaymentMethods = () => {
  const [cards, setCards] = useState<Card[]>(loadCards);
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const reset = () => { setNumber(''); setExp(''); setCvc(''); setName(''); setAdding(false); };

  const persist = (next: Card[]) => {
    setCards(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    const digits = number.replace(/\s+/g, '');
    if (digits.length < 13 || digits.length > 19) { toast.error('Enter a valid card number'); return; }
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(exp)) { toast.error('Expiry must be MM / YY'); return; }
    if (cvc.length < 3) { toast.error('Enter a valid CVC'); return; }
    if (name.trim().length < 2) { toast.error('Enter the cardholder name'); return; }
    const card: Card = {
      id: crypto.randomUUID(),
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      exp: exp.replace(/\s+/g, ''),
      name: name.trim(),
    };
    persist([...cards, card]);
    toast.success('Payment method added');
    reset();
  };

  const handleRemove = (id: string) => {
    persist(cards.filter((c) => c.id !== id));
    toast.success('Payment method removed');
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
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cardholder name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on card" className="bg-background border-border h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Card number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="4242 4242 4242 4242" inputMode="numeric" className="bg-background border-border h-11 mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Expiry</Label>
                <Input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM / YY" className="bg-background border-border h-11 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">CVC</Label>
                <Input value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="123" inputMode="numeric" className="bg-background border-border h-11 mt-1" />
              </div>
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

export default PaymentMethods;
