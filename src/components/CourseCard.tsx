import { Link } from 'react-router-dom';
import { Course } from '@/lib/mockData';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { CategoryPill } from '@/components/CategoryPill';
import { MapPin, Calendar, Users } from 'lucide-react';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const CourseCard = ({ course }: { course: Course }) => {
  const lowSpots = course.spotsRemaining > 0 && course.spotsRemaining <= 5;
  return (
    <Link to={`/student/course/${course.id}`} className="block">
      <div className="tactical-card p-4 hover:border-primary/40 transition group">
        <div className="flex items-start gap-3">
          <img src={course.instructorPhoto} alt={course.instructorName} className="h-12 w-12 rounded-full object-cover border border-border shrink-0" />
          <div className="flex-1 min-w-0">
            <CategoryPill category={course.category} className="mb-1.5" />
            <h3 className="font-bold text-base leading-tight group-hover:text-primary transition truncate">{course.title}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <span className="truncate">{course.instructorName}</span>
              {course.instructorVerified && <VerifiedBadge />}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-black text-primary">${course.bookingFee}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(course.date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{course.city}, {course.state}</span>
          </div>
          <div className={`flex items-center gap-1.5 justify-end font-semibold ${course.spotsRemaining === 0 ? 'text-destructive' : lowSpots ? 'text-primary' : 'text-muted-foreground'}`}>
            <Users className="h-3.5 w-3.5" />
            {course.spotsRemaining === 0 ? 'Full' : `${course.spotsRemaining} left`}
          </div>
        </div>
      </div>
    </Link>
  );
};
