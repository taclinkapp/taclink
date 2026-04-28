import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Package, Star } from 'lucide-react';

const packs = [
  { name: 'Starter', credits: 3, price: 14.99, perCredit: 5.0 },
  { name: 'Pro', credits: 10, price: 39.99, perCredit: 4.0, popular: true },
  { name: 'Elite', credits: 25, price: 79.99, perCredit: 3.2 },
];

const ListingPacks = () => (
  <MobileShell withTabBar={false}>
    <PageHeader title="Listing Packs" back />
    <div className="px-4 py-4">
      <div className="tactical-card p-4 mb-4 flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Balance</div>
          <div className="text-xl font-black"><span className="text-primary">7</span> credits remaining</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Each credit lets you publish one course. Credits never expire.</p>

      <div className="space-y-3">
        {packs.map((p) => (
          <div key={p.name} className={`tactical-card p-5 relative ${p.popular ? 'border-primary/50 amber-glow' : ''}`}>
            {p.popular && (
              <div className="absolute -top-2 right-4 bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" /> Most Popular
              </div>
            )}
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{p.name} Pack</div>
                <div className="text-3xl font-black mt-1"><span className="text-primary">{p.credits}</span> courses</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black">${p.price}</div>
                <div className="text-[10px] text-muted-foreground">${p.perCredit.toFixed(2)}/credit</div>
              </div>
            </div>
            <Button className="w-full h-11 bg-primary text-primary-foreground font-bold">Buy Now</Button>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-6">Listing pack credits are non-refundable.</p>
    </div>
  </MobileShell>
);

export default ListingPacks;
