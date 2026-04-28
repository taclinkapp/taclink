import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, LogOut, Trash2, Bug } from 'lucide-react';
import { ReportIssueDialog } from '@/components/ReportIssueDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const StudentSettings = () => {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    nav('/auth/signin', { replace: true });
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Settings" back />
      <div className="px-4 py-4 space-y-6">
        <Section title="Account">
          <Row label="Edit Profile" />
          <Row label="Payment Methods" />
        </Section>

        <Section title="Notifications">
          <ToggleRow label="Booking confirmations" defaultOn />
          <ToggleRow label="Waitlist updates" defaultOn />
          <ToggleRow label="New courses nearby" />
        </Section>

        <Section title="Support">
          <button onClick={() => setReportOpen(true)} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><Bug className="h-4 w-4 text-primary" />Report an Issue</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>

        <Section title="Legal">
          <Row label="Privacy Policy" onClick={() => nav('/legal/privacy')} />
          <Row label="Terms of Service" onClick={() => nav('/legal/terms')} />
        </Section>

        <div className="pt-4 space-y-2">
          <button onClick={handleSignOut} className="w-full tactical-card p-4 flex items-center justify-center gap-2 text-destructive font-bold text-sm hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
          <button className="w-full tactical-card p-4 flex items-center justify-center gap-2 text-destructive/70 font-semibold text-xs hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete Account
          </button>
        </div>
      </div>
      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} />
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 px-1">{title}</h3>
    <div className="tactical-card divide-y divide-border">{children}</div>
  </div>
);
const Row = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button onClick={onClick} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
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

export default StudentSettings;
