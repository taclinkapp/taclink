import { Users, Shield, BookOpen, CalendarCheck, DollarSign, AlertTriangle, Bell, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AdminHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="border-b border-border px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between bg-surface gap-3">
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-black truncate">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);

const AdminDashboard = () => {
  const stats = [
    { label: 'Total Users', value: '1,248', icon: Users, change: '+12%' },
    { label: 'Instructors', value: '89', icon: Shield, change: '+5%' },
    { label: 'Total Courses', value: '342', icon: BookOpen, change: '+18%' },
    { label: 'Bookings', value: '2,184', icon: CalendarCheck, change: '+24%' },
    { label: 'Revenue (Mo)', value: '$48.2K', icon: DollarSign, change: '+31%', primary: true },
    { label: 'Pending Reviews', value: '7', icon: AlertTriangle, change: '', alert: true },
  ];
  return (
    <>
      <AdminHeader title="Dashboard" subtitle="Platform overview" />
      <div className="p-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className={`tactical-card p-5 ${s.primary ? 'border-primary/40' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`h-5 w-5 ${s.primary ? 'text-primary' : s.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
                {s.change && <span className="text-xs font-bold text-success">{s.change}</span>}
              </div>
              <div className={`text-3xl font-black ${s.primary ? 'text-primary' : ''}`}>{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Button variant="outline" className="h-16 bg-card border-border font-semibold justify-start gap-3"><AlertTriangle className="text-destructive" />Suspend User</Button>
          <Button variant="outline" className="h-16 bg-card border-border font-semibold justify-start gap-3"><Bell className="text-primary" />Broadcast Notification</Button>
          <Button variant="outline" className="h-16 bg-card border-border font-semibold justify-start gap-3"><Calendar className="text-primary" />Change Launch Date</Button>
        </div>

        <div className="mt-8 tactical-card p-6">
          <h2 className="font-bold mb-4">Recent Activity</h2>
          <div className="space-y-3 text-sm">
            {[
              { who: 'admin@taclink.app', what: 'approved credentials for', target: 'Sarah Chen', when: '2 min ago' },
              { who: 'admin@taclink.app', what: 'suspended user', target: 'spam_account_47', when: '1 hour ago' },
              { who: 'admin@taclink.app', what: 'broadcast notification to', target: 'all users', when: '3 hours ago' },
              { who: 'admin@taclink.app', what: 'rejected credential from', target: 'unverified_user_12', when: '5 hours ago' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground"><span className="text-foreground font-semibold">{a.who}</span> {a.what} <span className="text-primary font-semibold">{a.target}</span></span>
                <span className="ml-auto text-xs text-muted-foreground">{a.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
