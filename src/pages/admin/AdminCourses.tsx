import { AdminHeader } from './AdminDashboard';
import { mockCourses } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const AdminCourses = () => (
  <>
    <AdminHeader title="Courses" subtitle={`${mockCourses.length} listings`} />
    <div className="p-8">
      <div className="tactical-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Title</th>
              <th className="text-left px-4 py-3 font-bold">Instructor</th>
              <th className="text-left px-4 py-3 font-bold">Date</th>
              <th className="text-left px-4 py-3 font-bold">Enrolled</th>
              <th className="text-left px-4 py-3 font-bold">Status</th>
              <th className="text-left px-4 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockCourses.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold">{c.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.instructorName}</td>
                <td className="px-4 py-3">{new Date(c.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{c.maxStudents - c.spotsRemaining}/{c.maxStudents}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${c.status === 'active' ? 'text-success' : c.status === 'full' ? 'text-primary' : 'text-muted-foreground'}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 space-x-3">
                  <button className="text-xs text-primary font-bold hover:underline">View</button>
                  <button className="text-xs text-destructive font-bold hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

const waitlist = [
  { email: 'eager.beaver@example.com', role: 'student', date: '2026-04-25', notified: false },
  { email: 'ready.to.train@example.com', role: 'student', date: '2026-04-24', notified: false },
  { email: 'pro.instructor@example.com', role: 'instructor', date: '2026-04-22', notified: true },
  { email: 'cant.wait@example.com', role: 'student', date: '2026-04-21', notified: true },
];

export const AdminWaitlist = () => (
  <>
    <AdminHeader title="Pre-Launch Waitlist" subtitle={`${waitlist.length} signups`} action={
      <Button className="h-10 bg-primary text-primary-foreground font-bold">Notify All Waitlist</Button>
    } />
    <div className="p-8">
      <div className="tactical-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Email</th>
              <th className="text-left px-4 py-3 font-bold">Role</th>
              <th className="text-left px-4 py-3 font-bold">Signed Up</th>
              <th className="text-left px-4 py-3 font-bold">Notified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {waitlist.map((w) => (
              <tr key={w.email} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold">{w.email}</td>
                <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider font-bold text-primary">{w.role}</span></td>
                <td className="px-4 py-3">{w.date}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${w.notified ? 'text-success' : 'text-muted-foreground'}`}>{w.notified ? 'Sent' : 'Pending'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

export const AdminActivity = () => {
  const log = [
    { admin: 'admin@taclink.app', action: 'approve_credential', target: 'Sarah Chen', time: '2 min ago' },
    { admin: 'admin@taclink.app', action: 'suspend_user', target: 'spam_account_47', time: '1 hour ago' },
    { admin: 'admin@taclink.app', action: 'broadcast', target: 'all_users', time: '3 hours ago' },
    { admin: 'admin@taclink.app', action: 'reject_credential', target: 'unverified_user_12', time: '5 hours ago' },
    { admin: 'admin@taclink.app', action: 'change_launch_date', target: '2026-06-01', time: '1 day ago' },
    { admin: 'admin@taclink.app', action: 'remove_listing', target: 'course_192', time: '2 days ago' },
  ];
  return (
    <>
      <AdminHeader title="Activity Log" subtitle="All admin actions" />
      <div className="p-8">
        <div className="tactical-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Time</th>
                <th className="text-left px-4 py-3 font-bold">Admin</th>
                <th className="text-left px-4 py-3 font-bold">Action</th>
                <th className="text-left px-4 py-3 font-bold">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {log.map((l, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{l.time}</td>
                  <td className="px-4 py-3 font-semibold">{l.admin}</td>
                  <td className="px-4 py-3"><code className="text-xs text-primary font-bold">{l.action}</code></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export const AdminSettings = () => (
  <>
    <AdminHeader title="Settings" subtitle="Platform configuration" />
    <div className="p-8 max-w-2xl space-y-6">
      <div className="tactical-card p-6">
        <h2 className="font-bold mb-4">Launch Configuration</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Launch Date</Label>
            <Input type="date" defaultValue="2026-06-01" className="bg-background border-border h-11 mt-1.5 max-w-xs" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-semibold">App Status</div>
              <div className="text-xs text-muted-foreground">Toggle between pre-launch waitlist and live mode</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Pre-Launch</span>
              <Switch />
              <span className="text-xs uppercase tracking-wider text-primary font-bold">Live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="tactical-card p-6">
        <h2 className="font-bold mb-4">Broadcast Notification</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input className="bg-background border-border h-11 mt-1.5" placeholder="Notification title" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body</Label>
            <Textarea className="bg-background border-border min-h-24 mt-1.5" placeholder="Message…" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Send to</Label>
            <select className="w-full bg-background border border-border h-11 mt-1.5 rounded-md px-3 text-sm">
              <option>All Users</option>
              <option>Students Only</option>
              <option>Instructors Only</option>
            </select>
          </div>
          <Button className="bg-primary text-primary-foreground font-bold">Send Broadcast</Button>
        </div>
      </div>
    </div>
  </>
);
