import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { StudentTabBar } from '@/components/StudentTabBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Map as MapIcon, List, Gift, X, MapPin, ChevronDown } from 'lucide-react';
import { usePublishedCourses } from '@/hooks/useCourses';
import { CourseCard } from '@/components/CourseCard';
import { CourseMap } from '@/components/CourseMap';

import { NotificationsBell } from '@/components/NotificationsBell';
import { DisciplineBrowser } from '@/components/DisciplineBrowser';
import { InviteFriendsSheet } from '@/components/InviteFriendsSheet';
import { cn } from '@/lib/utils';

type LevelFilter = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
const LEVEL_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'Any Level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'All Levels' },
];

type LocationOption = {
  key: string;
  label: string;
  city: string;
  state: string;
  count: number;
  lat: number;
  lng: number;
};

const STORAGE_KEY = 'student-discover-prefs-v1';

type PersistedPrefs = {
  view?: 'list' | 'map';
  level?: LevelFilter;
  selectedLocation?: LocationOption | null;
};

const loadPrefs = (): PersistedPrefs => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as PersistedPrefs;
  } catch {
    return {};
  }
};

const Discover = () => {
  const nav = useNavigate();
  const initialPrefs = loadPrefs();
  const [view, setView] = useState<'list' | 'map'>(initialPrefs.view ?? 'list');
  const [discipline, setDiscipline] = useState<string>('All');
  const [level, setLevel] = useState<LevelFilter>(initialPrefs.level ?? 'all');
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  // Location lookup state
  const [locationQuery, setLocationQuery] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(
    initialPrefs.selectedLocation ?? null,
  );
  const [geocoding, setGeocoding] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const locationListRef = useRef<HTMLDivElement>(null);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('invite-banner-dismissed') === '1',
  );
  const dismissBanner = () => {
    sessionStorage.setItem('invite-banner-dismissed', '1');
    setBannerDismissed(true);
  };
  const { data: courses = [], isLoading } = usePublishedCourses();
  const { token: mapboxToken } = useMapboxToken();

  // Persist user preferences across navigation/refresh.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ view, level, selectedLocation } satisfies PersistedPrefs),
      );
    } catch {
      // ignore quota errors
    }
  }, [view, level, selectedLocation]);

  // Aggregate available locations (city, state) from published courses.
  const locationOptions: LocationOption[] = useMemo(() => {
    const map = new Map<string, LocationOption>();
    for (const c of courses) {
      const city = (c.city || '').trim();
      const state = (c.state || '').trim();
      if (!city && !state) continue;
      const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          label: [city, state].filter(Boolean).join(', '),
          city,
          state,
          count: 1,
          lat: c.lat,
          lng: c.lng,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [courses]);

  const locationSuggestions = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    const list = q
      ? locationOptions.filter((o) => o.label.toLowerCase().includes(q))
      : locationOptions;
    return showAllLocations || q ? list : list.slice(0, 8);
  }, [locationOptions, locationQuery, showAllLocations]);

  // Reset highlighted suggestion whenever the visible list changes.
  useEffect(() => {
    setActiveLocationIndex(0);
  }, [locationQuery, locationOpen, showAllLocations]);

  // Scroll the active suggestion into view as the user navigates with the keyboard.
  useEffect(() => {
    if (!locationOpen) return;
    const el = locationListRef.current?.querySelector<HTMLButtonElement>(
      `[data-loc-index="${activeLocationIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeLocationIndex, locationOpen]);

  const matchesSelectedLocation = (c: { city: string; state: string }) => {
    if (!selectedLocation) return true;
    return (
      c.city.toLowerCase() === selectedLocation.city.toLowerCase() &&
      c.state.toLowerCase() === selectedLocation.state.toLowerCase()
    );
  };

  const filtered = courses.filter((c) => {
    const d = discipline.toLowerCase();
    const matchesDisc =
      discipline === 'All' ||
      c.category?.toLowerCase().includes(d) ||
      c.title.toLowerCase().includes(d);
    const q = query.toLowerCase();
    const matchesQuery = !q || c.title.toLowerCase().includes(q) || c.instructorName.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
    const matchesLevel = level === 'all' || c.skillLevel === level;
    return matchesDisc && matchesQuery && matchesLevel && matchesSelectedLocation(c);
  });

  const pickLocation = (loc: LocationOption) => {
    setSelectedLocation(loc);
    setLocationQuery('');
    setLocationOpen(false);
    setShowAllLocations(false);
    setView('map');
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    setView('list');
  };

  const toggleAllLocations = () => {
    const next = !(locationOpen && showAllLocations);
    setShowAllLocations(next);
    setLocationOpen(next);
    if (next) {
      setLocationQuery('');
      setTimeout(() => locationInputRef.current?.focus(), 0);
    }
  };

  const handleLocationKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLocationOpen(true);
      setActiveLocationIndex((i) => Math.min(i + 1, Math.max(locationSuggestions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveLocationIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (locationOpen && locationSuggestions[activeLocationIndex]) {
        e.preventDefault();
        pickLocation(locationSuggestions[activeLocationIndex]);
      }
    } else if (e.key === 'Escape') {
      setLocationOpen(false);
      setShowAllLocations(false);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveLocationIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveLocationIndex(Math.max(locationSuggestions.length - 1, 0));
    }
  };

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <PageHeader
          brand
          right={
            <NotificationsBell className="h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:text-primary" />
          }
        />
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

        {/* Location lookup */}
        <div className="px-4 pb-3">
          {selectedLocation ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 h-12">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Training near</div>
                <div className="text-sm font-semibold truncate">{selectedLocation.label}</div>
              </div>
              <button
                onClick={clearLocation}
                aria-label="Clear location"
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative neu-inset flex items-center pr-1">
                <MapPin className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  ref={locationInputRef}
                  value={locationQuery}
                  onChange={(e) => { setLocationQuery(e.target.value); setLocationOpen(true); setShowAllLocations(false); }}
                  onFocus={() => setLocationOpen(true)}
                  onBlur={() => setTimeout(() => { setLocationOpen(false); setShowAllLocations(false); }, 150)}
                  onKeyDown={handleLocationKeyDown}
                  placeholder="Where do you want to train?"
                  role="combobox"
                  aria-expanded={locationOpen}
                  aria-controls="location-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    locationOpen && locationSuggestions[activeLocationIndex]
                      ? `loc-opt-${activeLocationIndex}`
                      : undefined
                  }
                  className="bg-transparent border-0 pl-10 pr-2 h-12 rounded-2xl shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleAllLocations}
                  aria-label={
                    locationOpen && showAllLocations
                      ? 'Close all locations'
                      : `Show all ${locationOptions.length} locations`
                  }
                  className="shrink-0 mr-1 h-9 px-2 rounded-md flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"
                >
                  All
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      locationOpen && showAllLocations && 'rotate-180',
                    )}
                  />
                </button>
              </div>
              {locationOpen && locationSuggestions.length > 0 && (
                <div
                  ref={locationListRef}
                  id="location-listbox"
                  role="listbox"
                  className="absolute z-40 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-lg"
                >
                  {showAllLocations && (
                    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                      All locations · {locationSuggestions.length}
                    </div>
                  )}
                  {locationSuggestions.map((loc, idx) => {
                    const active = idx === activeLocationIndex;
                    return (
                      <button
                        key={loc.key}
                        id={`loc-opt-${idx}`}
                        data-loc-index={idx}
                        role="option"
                        aria-selected={active}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveLocationIndex(idx)}
                        onClick={() => pickLocation(loc)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 text-left',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{loc.label}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {loc.count} course{loc.count === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {locationOpen && locationQuery && locationSuggestions.length === 0 && (
                <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg p-3 text-xs text-muted-foreground">
                  No courses found for that location yet.
                </div>
              )}
              {locationOpen && !locationQuery && locationSuggestions.length === 0 && (
                <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg p-3 text-xs text-muted-foreground">
                  No locations available yet.
                </div>
              )}
            </div>
          )}
        </div>

        <DisciplineBrowser selected={discipline} onSelect={setDiscipline} />
        <div className="px-4 pb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLevel(opt.value)}
              className={cn(
                'shrink-0 px-3 h-7 rounded-full text-[11px] font-bold uppercase tracking-wider border transition',
                level === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-primary hover:border-primary/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {(discipline !== 'All' || level !== 'all') && (
          <div className="px-4 pb-3">
            <button
              onClick={() => { setDiscipline('All'); setLevel('all'); }}
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              ✕ Clear filters
            </button>
          </div>
        )}
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} course{filtered.length === 1 ? '' : 's'}
            {selectedLocation ? ` in ${selectedLocation.label}` : ' nearby'}
          </span>
          <div className="flex bg-card border border-border rounded-sm">
            <button onClick={() => setView('list')} className={cn('px-3 h-8 flex items-center gap-1.5 text-xs font-semibold', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button onClick={() => setView('map')} className={cn('px-3 h-8 flex items-center gap-1.5 text-xs font-semibold', view === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <MapIcon className="h-3.5 w-3.5" /> Map
            </button>
          </div>
        </div>
      </header>

      {!bannerDismissed && (
        <div className="px-4 pt-3">
          <div className="tactical-card p-3 flex items-center gap-3 border-primary/40">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <Gift className="h-4 w-4" />
            </div>
            <button onClick={() => setInviteOpen(true)} className="flex-1 text-left min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider">Invite a friend, get a free booking</div>
              <div className="text-[11px] text-muted-foreground">Share your QR code — when they book, you score.</div>
            </button>
            <button
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <div className="px-4 py-4 space-y-3">
          {selectedLocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('map')}
              className="w-full"
            >
              <MapIcon className="h-3.5 w-3.5" /> Show map for {selectedLocation.label}
            </Button>
          )}
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-12">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              {selectedLocation
                ? `No courses in ${selectedLocation.label} yet.`
                : 'No courses available yet.'}
            </div>
          ) : (
            filtered.map((c) => <CourseCard key={c.id} course={c} />)
          )}
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('list')}
            className="w-full"
          >
            <List className="h-3.5 w-3.5" /> Show list of courses
            {selectedLocation ? ` in ${selectedLocation.label}` : ''}
          </Button>
          <div className="relative h-[60vh] tactical-card overflow-hidden">
            <CourseMap
              courses={filtered}
              className="h-full w-full"
              onSelect={(c) => nav(`/student/course/${c.id}`)}
              center={selectedLocation ? [selectedLocation.lng, selectedLocation.lat] : undefined}
              zoom={selectedLocation ? 11 : undefined}
            />
          </div>
          <div className="space-y-3">
            {filtered.slice(0, 2).map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </div>
      )}

      <StudentTabBar />
      <InviteFriendsSheet open={inviteOpen} onOpenChange={setInviteOpen} rewardLabel="1 free booking" />
    </MobileShell>
  );
};

export default Discover;
