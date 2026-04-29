import { AdminHeader } from './AdminDashboard';
import { Input } from '@/components/ui/input';
import { Search, MoreVertical } from 'lucide-react';

const users = [
  { name: 'James Kowalski', email: 'james.k@example.com', role: 'student', status: 'active', joined: '2026-04-12' },
  { name: 'Marcus Reyes', email: 'marcus@reyestactical.com', role: 'instructor', status: 'active', joined: '2025-11-03' },
  { name: 'Priya Sharma', email: 'priya.s@example.com', role: 'student', status: 'active', joined: '2026-03-22' },
  { name: 'Sarah Chen', email: 'schen@example.com', role: 'instructor', status: 'active', joined: '2025-09-14' },
  { name: 'Spam Account', email: 'spam@bad.com', role: 'student', status: 'suspended', joined: '2026-04-22' },
  { name: 'Tom Reynolds', email: 'tom.r@example.com', role: 'student', status: 'active', joined: '2026-02-08' },
];

export const AdminUsers = () => (
  <>
    <AdminHeader title="Users" subtitle={`${users.length} total`} />
    <div className="p-8">
      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users by name or email…" className="bg-card border-border pl-9 h-11 max-w-md" />
      </div>
      <div className="tactical-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Name</th>
              <th className="text-left px-4 py-3 font-bold">Email</th>
              <th className="text-left px-4 py-3 font-bold">Role</th>
              <th className="text-left px-4 py-3 font-bold">Status</th>
              <th className="text-left px-4 py-3 font-bold">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider font-bold text-primary">{u.role}</span></td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${u.status === 'active' ? 'text-success' : 'text-destructive'}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.joined}</td>
                <td className="px-4 py-3"><button className="p-1 text-muted-foreground hover:text-foreground"><MoreVertical className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

const instructors = [
  { name: 'Marcus Reyes', email: 'marcus@reyestactical.com', verified: 'approved', courses: 12, revenue: '$8,420' },
  { name: 'Sarah Chen', email: 'schen@example.com', verified: 'approved', courses: 8, revenue: '$5,210' },
  { name: 'Derek Holloway', email: 'derek@combatives.io', verified: 'approved', courses: 5, revenue: '$2,140' },
  { name: 'New Applicant', email: 'newguy@example.com', verified: 'pending', courses: 0, revenue: '$0' },
  { name: 'Rejected Apply', email: 'rejected@example.com', verified: 'rejected', courses: 0, revenue: '$0' },
];

export const AdminInstructors = () => (
  <>
    <AdminHeader title="Instructors" subtitle={`${instructors.length} total · 1 pending review`} />
    <div className="p-8">
      <div className="tactical-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Name</th>
              <th className="text-left px-4 py-3 font-bold">Email</th>
              <th className="text-left px-4 py-3 font-bold">Verification</th>
              <th className="text-left px-4 py-3 font-bold">Courses</th>
              <th className="text-left px-4 py-3 font-bold">Revenue</th>
              <th className="text-left px-4 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {instructors.map((i) => (
              <tr key={i.email} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold">{i.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{i.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${i.verified === 'approved' ? 'text-success' : i.verified === 'pending' ? 'text-primary' : 'text-destructive'}`}>{i.verified}</span>
                </td>
                <td className="px-4 py-3">{i.courses}</td>
                <td className="px-4 py-3 font-semibold text-primary">{i.revenue}</td>
                <td className="px-4 py-3">
                  {i.verified === 'pending' ? (
                    <div className="flex gap-2">
                      <button className="text-xs font-bold text-success hover:underline">Approve</button>
                      <button className="text-xs font-bold text-destructive hover:underline">Reject</button>
                    </div>
                  ) : (
                    <button className="text-xs text-primary font-bold hover:underline">View</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);
