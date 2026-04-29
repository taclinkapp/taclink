// Mock data for TacLink visual prototype

export type Course = {
  id: string;
  title: string;
  category: 'Pistol' | 'Rifle' | 'Shotgun' | 'Combatives' | 'Medical' | 'Other';
  instructorId: string;
  instructorName: string;
  instructorPhoto: string;
  instructorVerified: boolean;
  instructorRating: number;
  heroImage: string;
  city: string;
  state: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  bookingFee: number;
  maxStudents: number;
  spotsRemaining: number;
  description: string;
  whatYoullLearn: string[];
  prerequisites: string;
  equipment: string;
  status: 'active' | 'draft' | 'full' | 'past';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  lat: number;
  lng: number;
};

export const mockCourses: Course[] = [];

export type Booking = {
  id: string;
  courseId: string;
  course: Course;
  bookedAt: string;
  status: 'upcoming' | 'past';
  reviewed: boolean;
};

export const mockBookings: Booking[] = [
  { id: 'b1', courseId: 'c1', course: mockCourses[0], bookedAt: '2026-04-20', status: 'upcoming', reviewed: false },
  { id: 'b2', courseId: 'c4', course: mockCourses[3], bookedAt: '2026-04-22', status: 'upcoming', reviewed: false },
  {
    id: 'b3',
    courseId: 'c3',
    course: { ...mockCourses[2], date: '2026-03-15' },
    bookedAt: '2026-02-28',
    status: 'past',
    reviewed: true,
  },
  {
    id: 'b4',
    courseId: 'c2',
    course: { ...mockCourses[1], date: '2026-02-10' },
    bookedAt: '2026-01-15',
    status: 'past',
    reviewed: false,
  },
];

export type Review = {
  id: string;
  studentName: string;
  studentPhoto: string;
  rating: number;
  comment: string;
  date: string;
};

export const mockReviews: Review[] = [
  { id: 'r1', studentName: 'James K.', studentPhoto: 'https://i.pravatar.cc/100?img=14', rating: 5, comment: 'Marcus is the real deal. Walked away with skills I\'ll use forever.', date: '2 weeks ago' },
  { id: 'r2', studentName: 'Priya S.', studentPhoto: 'https://i.pravatar.cc/100?img=24', rating: 5, comment: 'Best class I\'ve taken. Patient with newer shooters, pushes the experienced ones.', date: '1 month ago' },
  { id: 'r3', studentName: 'Tom R.', studentPhoto: 'https://i.pravatar.cc/100?img=53', rating: 4, comment: 'Excellent instruction, range was a bit cramped but the content was top tier.', date: '2 months ago' },
];

export type RosterStudent = {
  id: string;
  name: string;
  photo: string;
  bookedAt: string;
  paymentStatus: 'paid' | 'pending';
  checkedIn: boolean;
};

export const mockRoster: RosterStudent[] = [
  { id: 's1', name: 'James Kowalski', photo: 'https://i.pravatar.cc/100?img=14', bookedAt: '2026-04-20', paymentStatus: 'paid', checkedIn: true },
  { id: 's2', name: 'Priya Sharma', photo: 'https://i.pravatar.cc/100?img=24', bookedAt: '2026-04-21', paymentStatus: 'paid', checkedIn: true },
  { id: 's3', name: 'Tom Reynolds', photo: 'https://i.pravatar.cc/100?img=53', bookedAt: '2026-04-22', paymentStatus: 'paid', checkedIn: false },
  { id: 's4', name: 'Maya Lopez', photo: 'https://i.pravatar.cc/100?img=29', bookedAt: '2026-04-23', paymentStatus: 'paid', checkedIn: false },
  { id: 's5', name: 'Chris Walker', photo: 'https://i.pravatar.cc/100?img=8', bookedAt: '2026-04-24', paymentStatus: 'pending', checkedIn: false },
];

export const mockWaitlist = [
  { id: 'w1', name: 'Aaron Diaz', position: 1, joinedAt: '2026-04-25' },
  { id: 'w2', name: 'Beth Tanaka', position: 2, joinedAt: '2026-04-26' },
  { id: 'w3', name: 'Carlos Brun', position: 3, joinedAt: '2026-04-27' },
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

export const CATEGORIES = ['All', 'Pistol', 'Rifle', 'Shotgun', 'Combatives', 'Medical', 'Other'] as const;
