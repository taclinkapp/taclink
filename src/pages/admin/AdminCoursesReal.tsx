import { useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Star, StarOff } from 'lucide-react';
import { useAdminCourses, useAdminCourseAction, useFeaturedPlacements, useFeatureCourse } from '@/hooks/useAdminData';
import { Button } from '@/components/ui/button';

export const AdminCoursesReal = () => {
  const [q, setQ] = useState('');
  const { data: courses = [], isLoading } = useAdminCourses(q);
  const action = useAdminCourseAction();
  const { data: featured = [] } = useFeaturedPlacements();
  const featureMut = useFeatureCourse();
  const featuredIds = new Set((featured ?? []).map((f: any) => f.course_id));

  return (
    <>
      <AdminHeader title="Courses" subtitle={`${courses.length} loaded · ${featured.length} featured`} />
      <div className="p-8">
        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="bg-card border-border pl-9 h-11 max-w-md" />
        </div>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="tactical-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Title</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Moderation</th>
                  <th className="text-left px-4 py-3 font-bold">Price</th>
                  <th className="text-left px-4 py-3 font-bold">Starts</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((c: any) => {
                  const isFeatured = featuredIds.has(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold">{c.title}<div className="text-[10px] text-muted-foreground font-mono">{c.id.slice(0, 8)}</div></td>
                      <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-wider font-bold ${c.status === 'published' ? 'text-success' : 'text-muted-foreground'}`}>{c.status}</span></td>
                      <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-wider font-bold ${c.moderation_status === 'approved' ? 'text-success' : c.moderation_status === 'pending' ? 'text-orange-400' : 'text-destructive'}`}>{c.moderation_status}</span></td>
                      <td className="px-4 py-3">${(c.price_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.starts_at ? new Date(c.starts_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {c.status === 'published' ? (
                          <button onClick={() => action.mutate({ action: 'unpublish', courseId: c.id })} className="text-xs font-bold text-destructive hover:underline">Unpublish</button>
                        ) : (
                          <button onClick={() => action.mutate({ action: 'publish', courseId: c.id })} className="text-xs font-bold text-success hover:underline">Publish</button>
                        )}
                        {c.moderation_status !== 'approved' && (
                          <button onClick={() => action.mutate({ action: 'approve_moderation', courseId: c.id })} className="text-xs font-bold text-primary hover:underline">Approve</button>
                        )}
                        <button
                          onClick={() => featureMut.mutate({ courseId: c.id, action: isFeatured ? 'remove' : 'add' })}
                          className={`text-xs font-bold inline-flex items-center gap-1 hover:underline ${isFeatured ? 'text-orange-400' : 'text-muted-foreground'}`}
                        >
                          {isFeatured ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
                          {isFeatured ? 'Featured' : 'Feature'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {courses.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No courses.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
