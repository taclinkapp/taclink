import { useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { useFeaturedPlacements, useFeatureCourse, useAdminCourses } from '@/hooks/useAdminData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Star, Trash2 } from 'lucide-react';

export const AdminFeaturedCourses = () => {
  const { data: featured = [], isLoading } = useFeaturedPlacements();
  const [search, setSearch] = useState('');
  const { data: courses = [] } = useAdminCourses(search);
  const feature = useFeatureCourse();

  const featuredIds = new Set(featured.map((f: any) => f.course_id));

  return (
    <>
      <AdminHeader title="Featured Courses" subtitle="Pin courses to the Discover spotlight" />
      <div className="p-8 grid grid-cols-2 gap-6">
        <div className="tactical-card p-6 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Currently featured</h2>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : featured.length === 0 ? (
            <div className="text-sm text-muted-foreground">No featured courses yet.</div>
          ) : (
            <ul className="space-y-2">
              {featured.map((p: any) => (
                <li key={p.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                  {p.courses?.cover_image_url && (
                    <img src={p.courses.cover_image_url} alt="" className="h-10 w-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.courses?.title ?? 'Course'}</div>
                    <div className="text-[11px] text-muted-foreground">order: {p.sort_order}</div>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => feature.mutate({ courseId: p.course_id, action: 'remove' })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tactical-card p-6 space-y-3">
          <h2 className="font-bold">Add a course</h2>
          <div className="space-y-1">
            <Label className="text-xs">Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Course title…" />
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-border border border-border rounded-md">
            {courses.slice(0, 30).map((c: any) => {
              const isFeat = featuredIds.has(c.id);
              return (
                <li key={c.id} className="flex items-center gap-2 p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">{c.status}</div>
                  </div>
                  <Button
                    size="sm" variant={isFeat ? 'ghost' : 'default'} disabled={isFeat}
                    onClick={() => feature.mutate({ courseId: c.id, action: 'add', sortOrder: featured.length })}
                  >
                    {isFeat ? 'Featured' : 'Feature'}
                  </Button>
                </li>
              );
            })}
            {courses.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">No courses found.</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
};

export default AdminFeaturedCourses;
