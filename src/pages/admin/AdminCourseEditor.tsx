import { useEffect, useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Edit3, Loader2, Search } from 'lucide-react';
import { fmt } from '@/lib/fees';

type Course = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  status: string;
  instructor_id: string;
};

export const AdminCourseEditor = () => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: '', status: 'draft' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('courses').select('id, title, description, price_cents, status, instructor_id')
      .order('created_at', { ascending: false }).limit(50);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data } = await q;
    setResults((data ?? []) as Course[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openEditor = (c: Course) => {
    setPicked(c);
    setForm({
      title: c.title,
      description: c.description ?? '',
      price: (c.price_cents / 100).toFixed(2),
      status: c.status,
    });
    setReason('');
    setOpen(true);
  };

  const diff = picked && {
    ...(form.title !== picked.title && { title: form.title }),
    ...(form.description !== (picked.description ?? '') && { description: form.description }),
    ...(Math.round(parseFloat(form.price || '0') * 100) !== picked.price_cents && {
      price_cents: Math.round(parseFloat(form.price || '0') * 100),
    }),
    ...(form.status !== picked.status && { status: form.status }),
  };
  const hasChanges = diff && Object.keys(diff).length > 0;

  const save = async () => {
    if (!picked || !hasChanges) return;
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'Explain why you are force-editing this course.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const before = {
      title: picked.title,
      description: picked.description,
      price_cents: picked.price_cents,
      status: picked.status,
    };
    const { error } = await supabase.from('courses').update(diff!).eq('id', picked.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    await supabase.rpc('log_admin_action', {
      _action: 'force_edit_course',
      _target_type: 'course',
      _target_id: picked.id,
      _before: before as any,
      _after: diff as any,
      _reason: reason.trim(),
      _source: 'admin_ui',
    });
    toast({ title: 'Course updated' });
    setSaving(false);
    setConfirmOpen(false);
    setOpen(false);
    setPicked(null);
    load();
  };

  return (
    <>
      <AdminHeader title="Force-Edit Courses" subtitle="Override any course field · all changes logged" />
      <div className="p-8 space-y-4">
        <div className="flex gap-2 max-w-xl">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title…"
                 onKeyDown={(e) => e.key === 'Enter' && load()} />
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Price</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No courses.</td></tr>
              ) : results.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium truncate max-w-md">{c.title}</td>
                  <td className="px-3 py-2 text-xs uppercase">{c.status}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.price_cents)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEditor(c)}>
                      <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Force-edit course</DialogTitle>
            <DialogDescription>Changes are logged in the audit trail with your reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Price (USD)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason (required)</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Instructor confirmed price change via support ticket #1234" />
            </div>
            {hasChanges && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                <div className="font-bold mb-1">Pending changes:</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(diff, null, 2)}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!hasChanges || !reason.trim()} onClick={() => setConfirmOpen(true)}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm force-edit</AlertDialogTitle>
            <AlertDialogDescription>
              This will override the instructor's course. Audit log will record before/after and your reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); save(); }} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminCourseEditor;
