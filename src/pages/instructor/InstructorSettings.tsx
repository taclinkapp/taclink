import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, LogOut, Trash2, Package } from 'lucide-react';

const InstructorSettings = () => {
  const nav = useNavigate();
  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Settings" back />
      <div className="px-4 py-4 space-y-6">
        <Section title="Account">
          <Row label="Edit Profile" />
          <Row label="Payout Settings (Stripe Connect)" />
          <button onClick={() => nav('/instructor/listing-packs')} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Listing Packs</span>
            <span className="text-xs text-primary font-bold">7 credits</span>
          </button>
        </Section>
        <Section title="Notifications">
          <ToggleRow label="New bookings" defaultOn />
          <ToggleRow label="Check-ins" defaultOn />
          <ToggleRow label="Reviews" defaultOn />
          <ToggleRow label="Weekly demand digest" defaultOn />
        </Section>
        <Section title="Legal">
          <Row label="Privacy Policy" />
          <Row label="Terms of Service" />
        </Section>
        <div className="pt-4 space-y-2">
          <button onClick={() => nav('/')} className="w-full tactical-card p-4 flex items-center justify-center gap-2 text-destructive font-bold text-sm hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
          <button className="w-full tactical-card p-4 flex items-center justify-center gap-2 text-destructive/70 font-semibold text-xs hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete Account
          </button>
        </div>
      </div>
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 px-1">{title}</h3>
    <div className="tactical-card divide-y divide-border">{children}</div>
  </div>
);
const Row = ({ label }: { label: string }) => (
  <button className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
    <span className="text-sm font-medium">{label}</span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </button>
);
const ToggleRow = ({ label, defaultOn }: { label: string; defaultOn?: boolean }) => (
  <div className="px-4 py-3.5 flex items-center justify-between">
    <span className="text-sm font-medium">{label}</span>
    <Switch defaultChecked={defaultOn} />
  </div>
);

export default InstructorSettings;
