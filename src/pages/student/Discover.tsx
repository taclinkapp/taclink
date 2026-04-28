import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/MobileShell';
import { StudentTabBar } from '@/components/StudentTabBar';
import { Input } from '@/components/ui/input';
import { Search, Map, List, SlidersHorizontal } from 'lucide-react';
import { CATEGORIES, mockCourses } from '@/lib/mockData';
import { CourseCard } from '@/components/CourseCard';
import { CourseMap } from '@/components/CourseMap';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const Discover = () => {
  const nav = useNavigate();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');

  const filtered = mockCourses.filter((c) => {
    const matchesCat = category === 'All' || c.category === category;
    const q = query.toLowerCase();
    const matchesQuery = !q || c.title.toLowerCase().includes(q) || c.instructorName.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary" aria-label="Compass">
            <Logo size="sm" />
          </button>
          <h1 className="font-stencil text-xl font-bold uppercase tracking-[0.12em] text-center text-foreground">
            Discover Courses
          </h1>
          <button className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary" aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative neu-inset">
            <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses, instructors, locations…"
              className="bg-transparent border-0 pl-10 h-12 rounded-2xl shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'px-3 h-8 rounded-sm text-xs font-bold uppercase tracking-wider whitespace-nowrap transition border',
                category === c
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} course{filtered.length === 1 ? '' : 's'} nearby</span>
          <div className="flex bg-card border border-border rounded-sm">
            <button onClick={() => setView('list')} className={cn('px-3 h-8 flex items-center gap-1.5 text-xs font-semibold', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button onClick={() => setView('map')} className={cn('px-3 h-8 flex items-center gap-1.5 text-xs font-semibold', view === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <Map className="h-3.5 w-3.5" /> Map
            </button>
          </div>
        </div>
      </header>

      {view === 'list' ? (
        <div className="px-4 py-4 space-y-3">
          {filtered.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="relative h-[60vh] tactical-card overflow-hidden">
            <CourseMap
              courses={filtered}
              className="h-full w-full"
              onSelect={(c) => nav(`/student/course/${c.id}`)}
            />
          </div>
          <div className="mt-4 space-y-3">
            {filtered.slice(0, 2).map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </div>
      )}

      <StudentTabBar />
    </MobileShell>
  );
};

export default Discover;
