import { describe, it, expect } from 'vitest';

// Pure copy of the lock-resolution rule used by ConversationView so we can
// validate it in isolation without rendering Supabase.
type CourseRow = { id: string; status: string };
type BookingRow = { status: string; course_id: string };
type Lock = null | 'student' | 'instructor';

function resolveLock(
  conversationCourseId: string | null,
  courses: CourseRow[],
  bookings: BookingRow[],
): Lock {
  if (courses.length === 0) return null;
  const scoped = conversationCourseId
    ? courses.filter((c) => c.id === conversationCourseId)
    : courses;
  if (scoped.length === 0) return null;

  if (conversationCourseId && scoped[0]?.status === 'cancelled') return 'instructor';

  if (bookings.length === 0) return null;
  const allCancelled = bookings.every((b) => b.status === 'cancelled');
  if (!allCancelled) return null;

  const map = new Map(scoped.map((c) => [c.id, c.status]));
  const instructorCancelled = bookings.some((b) => map.get(b.course_id) === 'cancelled');
  return instructorCancelled ? 'instructor' : 'student';
}

describe('cancellation messaging lock', () => {
  it('returns null when nothing is cancelled', () => {
    expect(
      resolveLock('c1', [{ id: 'c1', status: 'published' }], [{ status: 'reserved', course_id: 'c1' }]),
    ).toBeNull();
  });

  it('locks as instructor when the conversation course was cancelled', () => {
    expect(
      resolveLock('c1', [{ id: 'c1', status: 'cancelled' }], []),
    ).toBe('instructor');
  });

  it('locks as student when bookings are cancelled but course is still active', () => {
    expect(
      resolveLock(null,
        [{ id: 'c1', status: 'published' }],
        [{ status: 'cancelled', course_id: 'c1' }],
      ),
    ).toBe('student');
  });

  it('locks as instructor when any related course is cancelled', () => {
    expect(
      resolveLock(null,
        [{ id: 'c1', status: 'cancelled' }, { id: 'c2', status: 'published' }],
        [{ status: 'cancelled', course_id: 'c1' }],
      ),
    ).toBe('instructor');
  });

  it('does not lock if any booking is still active', () => {
    expect(
      resolveLock(null,
        [{ id: 'c1', status: 'published' }, { id: 'c2', status: 'published' }],
        [
          { status: 'cancelled', course_id: 'c1' },
          { status: 'reserved', course_id: 'c2' },
        ],
      ),
    ).toBeNull();
  });
});
