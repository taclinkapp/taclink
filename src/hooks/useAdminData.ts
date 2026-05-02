import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

// ---------- Settings ----------
export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_settings').select('*').order('category').order('key');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ key, value, before }: { key: string; value: any; before?: any }) => {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value, updated_by: user?.id })
        .eq('key', key);
      if (error) throw error;
      await supabase.rpc('log_admin_action', {
        _action: 'update_setting',
        _target_type: 'setting',
        _target_id: key,
        _before: before ?? null,
        _after: value,
        _reason: null,
        _source: 'admin_ui',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform_settings'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
      toast({ title: 'Setting saved' });
    },
    onError: (e: any) => toast({ title: 'Failed to save', description: e.message, variant: 'destructive' }),
  });
}

// ---------- Feature flags ----------
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature_flags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_flags').select('*').order('key');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateFlag() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ key, patch, before }: { key: string; patch: any; before?: any }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({ ...patch, updated_by: user?.id })
        .eq('key', key);
      if (error) throw error;
      await supabase.rpc('log_admin_action', {
        _action: 'toggle_flag',
        _target_type: 'flag',
        _target_id: key,
        _before: before ?? null,
        _after: patch,
        _reason: null,
        _source: 'admin_ui',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature_flags'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
      toast({ title: 'Flag updated' });
    },
    onError: (e: any) => toast({ title: 'Failed to update flag', description: e.message, variant: 'destructive' }),
  });
}

// ---------- Audit log ----------
export function useAuditLog(limit = 100) {
  return useQuery({
    queryKey: ['admin_audit_log', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- Users ----------
export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: ['admin_users', search ?? ''],
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
      if (search) q = q.ilike('display_name', `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;

      const ids = (data ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', ids);
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (data ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });
}

export function useAdminUserAction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      action: 'suspend' | 'reactivate' | 'reset_strikes' | 'grant_admin' | 'revoke_admin';
      userId: string;
      reason?: string;
    }) => {
      const { action, userId, reason } = args;
      let before: any = null;
      let after: any = null;

      if (action === 'suspend' || action === 'reactivate') {
        const { data: prev } = await supabase.from('profiles').select('account_status').eq('id', userId).maybeSingle();
        before = prev;
        const newStatus = action === 'suspend' ? 'suspended' : 'active';
        const { error } = await supabase.from('profiles').update({ account_status: newStatus }).eq('id', userId);
        if (error) throw error;
        after = { account_status: newStatus };
      } else if (action === 'reset_strikes') {
        const { data: prev } = await supabase.from('profiles').select('strike_points,account_status').eq('id', userId).maybeSingle();
        before = prev;
        const { error } = await supabase
          .from('profiles')
          .update({ strike_points: 0, account_status: 'active', final_warning_sent_at: null })
          .eq('id', userId);
        if (error) throw error;
        after = { strike_points: 0, account_status: 'active' };
      } else if (action === 'grant_admin') {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' as any });
        if (error && !`${error.message}`.includes('duplicate')) throw error;
        after = { role: 'admin' };
      } else if (action === 'revoke_admin') {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin' as any);
        if (error) throw error;
        before = { role: 'admin' };
      }

      await supabase.rpc('log_admin_action', {
        _action: action,
        _target_type: 'user',
        _target_id: userId,
        _before: before,
        _after: after,
        _reason: reason ?? null,
        _source: 'admin_ui',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_users'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
      toast({ title: 'User updated' });
    },
    onError: (e: any) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  });
}

// ---------- Courses ----------
export function useAdminCourses(filter?: string) {
  return useQuery({
    queryKey: ['admin_courses', filter ?? ''],
    queryFn: async () => {
      let q = supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(200);
      if (filter) q = q.ilike('title', `%${filter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminCourseAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      action: 'publish' | 'unpublish' | 'approve_moderation' | 'reject_moderation';
      courseId: string;
      reason?: string;
    }) => {
      const { action, courseId, reason } = args;
      const { data: prev } = await supabase.from('courses').select('status, moderation_status').eq('id', courseId).maybeSingle();
      const patch: any = {};
      if (action === 'publish') patch.status = 'published';
      if (action === 'unpublish') patch.status = 'draft';
      if (action === 'approve_moderation') patch.moderation_status = 'approved';
      if (action === 'reject_moderation') {
        patch.moderation_status = 'rejected';
        patch.status = 'draft';
      }
      const { error } = await supabase.from('courses').update(patch).eq('id', courseId);
      if (error) throw error;
      await supabase.rpc('log_admin_action', {
        _action: action,
        _target_type: 'course',
        _target_id: courseId,
        _before: prev as any,
        _after: patch,
        _reason: reason ?? null,
        _source: 'admin_ui',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_courses'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
      toast({ title: 'Course updated' });
    },
    onError: (e: any) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  });
}

// ---------- Featured placements ----------
export function useFeaturedPlacements() {
  return useQuery({
    queryKey: ['featured_placements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_featured_placements')
        .select('*, courses(id,title,instructor_id,cover_image_url)')
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFeatureCourse() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ courseId, action, sortOrder }: { courseId: string; action: 'add' | 'remove'; sortOrder?: number }) => {
      if (action === 'add') {
        const { error } = await supabase
          .from('course_featured_placements')
          .insert({ course_id: courseId, sort_order: sortOrder ?? 0, created_by: user?.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_featured_placements').delete().eq('course_id', courseId);
        if (error) throw error;
      }
      await supabase.rpc('log_admin_action', {
        _action: action === 'add' ? 'feature_course' : 'unfeature_course',
        _target_type: 'course',
        _target_id: courseId,
        _before: null,
        _after: { sort_order: sortOrder },
        _reason: null,
        _source: 'admin_ui',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['featured_placements'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
    },
  });
}

// ---------- Financial ----------
export function useAdminBookings() {
  return useQuery({
    queryKey: ['admin_bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Credit system was removed in favor of Stripe cash refunds. This hook is
// kept as a stub so legacy callers compile; it surfaces a toast explaining
// the change instead of touching the dropped tables.
export function useGrantCredit() {
  return useMutation({
    mutationFn: async (_args: {
      userType: 'student' | 'instructor';
      userId: string;
      note?: string;
    }) => {
      throw new Error('In-app credits were removed. Issue a cash refund to the original card instead.');
    },
    onError: (e: any) =>
      toast({ title: 'Credits removed', description: e.message, variant: 'destructive' }),
  });
}

export function useIssueRefund() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      bookingId: string;
      studentId: string;
      amountCents: number;
      reason: string;
      refundType: 'full' | 'partial' | 'platform_fee' | 'goodwill';
      notes?: string;
    }) => {
      const { error } = await supabase.from('refunds').insert({
        booking_id: args.bookingId,
        student_id: args.studentId,
        amount_cents: args.amountCents,
        reason: args.reason,
        refund_type: args.refundType,
        refund_method: 'stripe_cash',
        notes: args.notes,
        issued_by: user?.id,
      });
      if (error) throw error;
      await supabase.rpc('log_admin_action', {
        _action: 'issue_refund',
        _target_type: 'booking',
        _target_id: args.bookingId,
        _before: null,
        _after: { amount_cents: args.amountCents, type: args.refundType, method: 'stripe_cash' },
        _reason: args.reason,
        _source: 'admin_ui',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_bookings'] });
      qc.invalidateQueries({ queryKey: ['admin_audit_log'] });
      toast({ title: 'Cash refund issued' });
    },
    onError: (e: any) => toast({ title: 'Could not issue refund', description: e.message, variant: 'destructive' }),
  });
}

// ---------- Diagnostics (read-only platform health snapshot) ----------
export function usePlatformDiagnostics() {
  return useQuery({
    queryKey: ['platform_diagnostics'],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [users, courses, bookings, stuck, pendingMod, openTickets, openReports] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('deposit_status', 'awaiting_confirmation')
          .lt('deposit_expires_at', new Date().toISOString()),
        supabase.from('flagged_content').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('issue_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return {
        totalUsers: users.count ?? 0,
        publishedCourses: courses.count ?? 0,
        bookingsLast7d: bookings.count ?? 0,
        stuckDeposits: stuck.count ?? 0,
        pendingModeration: pendingMod.count ?? 0,
        openSupportTickets: openTickets.count ?? 0,
        openIssueReports: openReports.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}
