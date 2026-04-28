import { Link } from 'react-router-dom';
import { Course } from '@/lib/mockData';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Calendar, Star, Heart } from 'lucide-react';

export const CourseCard = ({ course }: { course: Course }) => {
  const isFull = course.spotsRemaining === 0;
  return (
    <Link to={`/student/course/${course.id}`} className="block">
      <article className="tactical-card overflow-hidden hover:border-primary/40 transition group">
        {/* Hero image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-surface">
          <img
            src={course.heroImage}
            alt={course.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            aria-label="Save course"
            className="absolute top-3 right-3 h-9 w-9 rounded-md bg-background/70 backdrop-blur border border-border/60 flex items-center justify-center text-foreground/80 hover:text-primary"
          >
            <Heart className="h-4 w-4" />
          </button>
          {isFull && (
            <span className="absolute top-3 left-3 px-2 py-1 rounded-sm bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-widest">
              Full
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-stencil text-xl font-bold uppercase leading-tight text-foreground">
              {course.title}
            </h3>
            {course.skillLevel && (
              <span className="shrink-0 mt-1 inline-flex items-center px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                {course.skillLevel === 'all_levels' ? 'All Levels' : course.skillLevel}
              </span>
            )}
          </div>

          <div className="mt-2 text-sm text-muted-foreground flex items-center flex-wrap gap-x-1.5 gap-y-1">
            <span>Instructor:</span>
            <span className="text-foreground font-semibold">{course.instructorName}</span>
            {course.instructorVerified && <VerifiedBadge />}
          </div>

          <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
            <div className="text-muted-foreground truncate">
              <span className="opacity-70">Location: </span>
              <span className="text-foreground font-semibold">{course.city}, {course.state}</span>
            </div>
            <div className="text-muted-foreground">
              <span className="opacity-70">Price: </span>
              <span className="text-primary font-bold">${course.bookingFee}</span>
            </div>
            <div className="flex items-center gap-1 text-foreground font-semibold">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {course.instructorRating.toFixed(1)}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            disabled={isFull}
            className={isFull ? 'btn-pill mt-4 opacity-50 cursor-not-allowed' : 'btn-pill mt-4'}
          >
            {isFull ? 'Sold Out' : 'Reserve Spot'} <Calendar className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    </Link>
  );
};
