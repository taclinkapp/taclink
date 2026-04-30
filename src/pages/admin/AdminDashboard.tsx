import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Shield,
  BookOpen,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  Bell,
  Calendar,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { fmt } from '@/lib/fees';

export const AdminHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="border-b border-border px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between bg-surface gap-3">
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-black truncate">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);

type StatKey =
  | 'users'
  | 'instructors'
  | 'courses'
  | 'bookings'
  | 'revenue'
  | 'pending';

type StatTotals = {
  users: number;
  newUsers7d: number;
  studentsCount: number;
  instructors: number;
  pendingInstructors: number;
  approvedInstructors: number;
  courses: number;
  publishedCourses: number;
  draftCourses: number;
  bookings: number;
  bookingsLast30: number;
  attendedBookings: number;
  revenueCentsMonth: number;
  revenueCentsAll: number;
  refundCentsMonth: number;
  pendingReviews: number;
  pendingCredentials: number;
  pendingModeration: number;
};

const emptyTotals: StatTotals = {
  users: 0,
  newUsers7d: 0,
  studentsCount: 0,
  instructors: 0,
  pendingInstructors: 0,
  approvedInstructors: 0,
  courses: 0,
  publishedCourses: 0,
  draftCourses: 0,
  bookings: 0,
  bookingsLast30: 0,
  attendedBookings: 0,
  revenueCentsMonth: 0,
  revenueCentsAll: 0,
  refundCentsMonth: 0,
  pendingReviews: 0,
  pendingCredentials: 0,
  pendingModeration: 0,
};

const AdminDashboard = () => {
  const [totals, setTotals] = useState<StatTotals>(emptyTotals);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<StatKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthIso = startOfMonth.toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

      const head = { count: 'exact' as const, head: true };

      const [
        usersAll,
        usersNew7,
        instructorsRows,
        credPending,
        credApproved,
        coursesAll,
        coursesPub,
        coursesDraft,
        bookingsAll,
        bookings30,
        bookingsAttended,
        feesMonth,
        feesAll,
        refundsMonth,
        flagsPending,
        credPendingReview,
      ] = await Promise.all([
        supabase.from('profiles').select('id', head),
        supabase.from('profiles').select('id', head).gte('created_at', sevenDaysAgo),
        supabase.from('user_roles').select('user_id', head).eq('role', 'instructor'),
        supabase.from('instructor_credentials').select('id', head).eq('status', 'pending'),
        supabase.from('instructor_credentials').select('id', head).eq('status', 'approved'),
        supabase.from('courses').select('id', head),
        supabase.from('courses').select('id', head).eq('status', 'published'),
        supabase.from('courses').select('id', head).eq('status', 'draft'),
        supabase.from('bookings').select('id', head),
        supabase.from('bookings').select('id', head).gte('created_at', thirtyDaysAgo),
        supabase.from('bookings').select('id', head).not('attended_at', 'is', null),
        supabase
          .from('booking_fees')
          .select('platform_fee_cents, instructor_deposit_cents, online_total_cents, created_at')
          .gte('created_at', monthIso),
        supabase
          .from('booking_fees')
          .select('platform_fee_cents'),
        supabase
          .from('refunds')
          .select('amount_cents, created_at, status')
          .gte('created_at', monthIso)
          .eq('status', 'issued'),
        supabase.from('flagged_content').select('id', head).eq('status', 'pending'),
        supabase.from('instructor_credentials').select('id', head).eq('status', 'pending'),
      ]);

      const sumCol = (rows: any[] | null | undefined, key: string) =>
        (rows ?? []).reduce((s, r) => s + (r[key] ?? 0), 0);

      const revenueMonth =
        sumCol(feesMonth.data as any[], 'platform_fee_cents');
      const revenueAll = sumCol(feesAll.data as any[], 'platform_fee_cents');
      const refundsMonthCents = sumCol(refundsMonth.data as any[], 'amount_cents');

      if (cancelled) return;
      const instructorsCount = instructorsRows.count ?? 0;
      const usersCount = usersAll.count ?? 0;

      setTotals({
        users: usersCount,
        newUsers7d: usersNew7.count ?? 0,
        studentsCount: Math.max(0, usersCount - instructorsCount),
        instructors: instructorsCount,
        pendingInstructors: credPending.count ?? 0,
        approvedInstructors: credApproved.count ?? 0,
        courses: coursesAll.count ?? 0,
        publishedCourses: coursesPub.count ?? 0,
        draftCourses: coursesDraft.count ?? 0,
        bookings: bookingsAll.count ?? 0,
        bookingsLast30: bookings30.count ?? 0,
        attendedBookings: bookingsAttended.count ?? 0,
        revenueCentsMonth: revenueMonth,
        revenueCentsAll: revenueAll,
        refundCentsMonth: refundsMonthCents,
        pendingReviews:
          (flagsPending.count ?? 0) + (credPendingReview.count ?? 0),
        pendingCredentials: credPendingReview.count ?? 0,
        pendingModeration: flagsPending.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards: {
    key: StatKey;
    label: string;
    value: string;
    icon: any;
    primary?: boolean;
    alert?: boolean;
  }[] = [
    { key: 'users', label: 'Total Users', value: loading ? '—' : totals.users.toLocaleString(), icon: Users },
    { key: 'instructors', label: 'Instructors', value: loading ? '—' : totals.instructors.toLocaleString(), icon: Shield },
    { key: 'courses', label: 'Total Courses', value: loading ? '—' : totals.courses.toLocaleString(), icon: BookOpen },
    { key: 'bookings', label: 'Bookings', value: loading ? '—' : totals.bookings.toLocaleString(), icon: CalendarCheck },
    { key: 'revenue', label: 'Revenue (Mo)', value: loading ? '—' : fmt(totals.revenueCentsMonth), icon: DollarSign, primary: true },
    { key: 'pending', label: 'Pending Reviews', value: loading ? '—' : String(totals.pendingReviews), icon: AlertTriangle, alert: (totals.pendingReviews ?? 0) > 0 },
  ];

  return (
    <>
      <AdminHeader title="Dashboard" subtitle="Platform overview — click any card for details" />
      <div className="p-4 sm:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {cards.map((s) => (
            <button
              key={s.key}
              onClick={() => setOpenKey(s.key)}
              className={`tactical-card p-4 sm:p-5 text-left transition hover:border-primary/60 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 ${s.primary ? 'border-primary/40' : ''}`}
              aria-label={`View details for ${s.label}`}
            >
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`h-5 w-5 ${s.primary ? 'text-primary' : s.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={`text-2xl sm:text-3xl font-black break-words ${s.primary ? 'text-primary' : ''}`}>
                {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : s.value}
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link to="/admin/users">
            <Button variant="outline" className="h-14 sm:h-16 w-full bg-card border-border font-semibold justify-start gap-3">
              <AlertTriangle className="text-destructive" />Suspend User
            </Button>
          </Link>
          <Link to="/admin/conversations">
            <Button variant="outline" className="h-14 sm:h-16 w-full bg-card border-border font-semibold justify-start gap-3">
              <Bell className="text-primary" />Broadcast Notification
            </Button>
          </Link>
          <Link to="/admin/settings">
            <Button variant="outline" className="h-14 sm:h-16 w-full bg-card border-border font-semibold justify-start gap-3">
              <Calendar className="text-primary" />Change Launch Date
            </Button>
          </Link>
        </div>
      </div>

      <DetailSheet
        openKey={openKey}
        onClose={() => setOpenKey(null)}
        totals={totals}
      />
    </>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold">{value}</span>
  </div>
);

const DetailSheet = ({
  openKey,
  onClose,
  totals,
}: {
  openKey: StatKey | null;
  onClose: () => void;
  totals: StatTotals;
}) => {
  const config: Record<StatKey, { title: string; description: string; link: string; rows: { label: string; value: React.ReactNode }[] }> = {
    users: {
      title: 'Users',
      description: 'Everyone with an account.',
      link: '/admin/users',
      rows: [
        { label: 'Total users', value: totals.users.toLocaleString() },
        { label: 'New in last 7 days', value: totals.newUsers7d.toLocaleString() },
        { label: 'Students (no instructor role)', value: totals.studentsCount.toLocaleString() },
        { label: 'Instructors', value: totals.instructors.toLocaleString() },
      ],
    },
    instructors: {
      title: 'Instructors',
      description: 'Coaches with the instructor role.',
      link: '/admin/instructors',
      rows: [
        { label: 'Total instructors', value: totals.instructors.toLocaleString() },
        { label: 'Pending credential review', value: totals.pendingInstructors.toLocaleString() },
        { label: 'Approved credentials', value: totals.approvedInstructors.toLocaleString() },
      ],
    },
    courses: {
      title: 'Courses',
      description: 'All courses across the platform.',
      link: '/admin/courses',
      rows: [
        { label: 'Total courses', value: totals.courses.toLocaleString() },
        { label: 'Published', value: totals.publishedCourses.toLocaleString() },
        { label: 'Draft', value: totals.draftCourses.toLocaleString() },
      ],
    },
    bookings: {
      title: 'Bookings',
      description: 'Student reservations on courses.',
      link: '/admin/financials',
      rows: [
        { label: 'Total bookings', value: totals.bookings.toLocaleString() },
        { label: 'Last 30 days', value: totals.bookingsLast30.toLocaleString() },
        { label: 'Attended (checked in)', value: totals.attendedBookings.toLocaleString() },
      ],
    },
    revenue: {
      title: 'Revenue',
      description: 'Platform fees collected from bookings ($25 student platform fee + 10% deposit accounting). All refunds are in-app credit.',
      link: '/admin/financials',
      rows: [
        { label: 'Platform fees this month', value: fmt(totals.revenueCentsMonth) },
        { label: 'Platform fees all-time', value: fmt(totals.revenueCentsAll) },
        { label: 'Refund credits issued (mo)', value: fmt(totals.refundCentsMonth) },
        { label: 'Net (mo)', value: fmt(Math.max(0, totals.revenueCentsMonth - totals.refundCentsMonth)) },
      ],
    },
    pending: {
      title: 'Pending Reviews',
      description: 'Items waiting on admin action.',
      link: '/admin/moderation',
      rows: [
        { label: 'Flagged content (moderation)', value: totals.pendingModeration.toLocaleString() },
        { label: 'Credential reviews', value: totals.pendingCredentials.toLocaleString() },
        { label: 'Total pending', value: totals.pendingReviews.toLocaleString() },
      ],
    },
  };

  const cfg = openKey ? config[openKey] : null;

  return (
    <Sheet open={!!openKey} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {cfg && (
          <>
            <SheetHeader>
              <SheetTitle>{cfg.title}</SheetTitle>
              <SheetDescription>{cfg.description}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-1">
              {cfg.rows.map((r) => (
                <Row key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
            <div className="mt-6">
              <Link to={cfg.link} onClick={onClose}>
                <Button className="w-full">
                  Open full page <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AdminDashboard;
