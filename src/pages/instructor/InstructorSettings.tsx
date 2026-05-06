import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, LogOut, Trash2, Bug, LifeBuoy, MessageSquare, Sparkles, Star, DollarSign, PlayCircle } from 'lucide-react';
import { ReportIssueDialog } from '@/components/ReportIssueDialog';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { CrashCourseTour } from '@/components/CrashCourseTour';
import { LegalAcceptanceCard } from '@/components/legal/LegalAcceptanceCard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const InstructorSettings = () => {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    nav('/', { replace: true });
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Settings" back />
      <div className="px-4 py-4 space-y-6">
        <Section title="Account">
          <Row label="Edit Profile" onClick={() => nav('/profile/edit')} />
          <button onClick={() => nav('/instructor/payouts')} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Deposit Payouts</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => nav('/instructor/reviews')} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><Star className="h-4 w-4 text-primary" />View My Reviews</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>
        <Section title="Notifications">
          <ToggleRow label="New bookings" defaultOn />
          <ToggleRow label="Check-ins" defaultOn />
          <ToggleRow label="Reviews" defaultOn />
          <ToggleRow label="Weekly demand digest" defaultOn />
        </Section>
        <Section title="Support">
          <button onClick={() => nav('/support')} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-primary" />Help Center</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => nav('/support/contact')} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Contact Support</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => setReportOpen(true)} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><Bug className="h-4 w-4 text-primary" />Report an Issue</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => setFeedbackOpen(true)} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Send Feedback</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>
        <Section title="Legal">
          <Row label="Privacy Policy" onClick={() => nav('/legal/privacy')} />
          <Row label="Terms of Service" onClick={() => nav('/legal/terms')} />
        </Section>
        <LegalAcceptanceCard />
        <div className="pt-4 space-y-2">
          <button onClick={() => setSignOutOpen(true)} className="w-full tactical-card p-4 flex items-center justify-center gap-2 text-destructive font-bold text-sm hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
          <button className="w-full tactical-card p-4 flex items-center justify-center gap-2 text-destructive/70 font-semibold text-xs hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete Account
          </button>
        </div>
      </div>
      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You'll need to sign in again to access your instructor dashboard, courses, and messages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sign Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

export default InstructorSettings;
