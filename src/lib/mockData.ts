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

export const mockBookings: Booking[] = [];

export type Review = {
  id: string;
  studentName: string;
  studentPhoto: string;
  rating: number;
  comment: string;
  date: string;
};

export const mockReviews: Review[] = [];

export type RosterStudent = {
  id: string;
  name: string;
  photo: string;
  bookedAt: string;
  paymentStatus: 'paid' | 'pending';
  checkedIn: boolean;
};

export const mockRoster: RosterStudent[] = [];

export const mockWaitlist: { id: string; name: string; position: number; joinedAt: string }[] = [];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

export const CATEGORIES = ['All', 'Pistol', 'Rifle', 'Shotgun', 'Combatives', 'Medical', 'Other'] as const;
