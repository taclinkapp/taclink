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

export const mockCourses: Course[] = [
  {
    id: 'c1',
    title: 'Defensive Pistol Fundamentals',
    category: 'Pistol',
    instructorId: 'i1',
    instructorName: 'Marcus Reyes',
    instructorPhoto: 'https://i.pravatar.cc/150?img=12',
    instructorVerified: true,
    instructorRating: 4.9,
    heroImage: 'https://images.unsplash.com/photo-1584282765846-2cb8b194a83a?auto=format&fit=crop&w=1200&q=70',
    city: 'Austin',
    state: 'TX',
    address: '4500 Range Rd',
    date: '2026-05-12',
    startTime: '09:00',
    endTime: '15:00',
    duration: '6 hours',
    bookingFee: 185,
    maxStudents: 12,
    spotsRemaining: 3,
    description: 'A full-day immersion in defensive pistol shooting. Drills, scenario work, and live-fire under stress. Built for civilians serious about carry.',
    whatYoullLearn: [
      'Draw stroke from concealment',
      'Sight alignment under stress',
      'Movement and shooting positions',
      'Malfunction clearance',
      'Engagement decision-making',
    ],
    prerequisites: 'Must own a reliable pistol and 300 rounds of ammunition.',
    equipment: 'Pistol, 3 magazines, holster (OWB or IWB), eye + ear pro',
    status: 'active',
    lat: 30.2672, lng: -97.7431,
  },
  {
    id: 'c2',
    title: 'Carbine Operator Course',
    category: 'Rifle',
    instructorId: 'i2',
    instructorName: 'Sarah Chen',
    instructorPhoto: 'https://i.pravatar.cc/150?img=47',
    instructorVerified: true,
    instructorRating: 4.8,
    heroImage: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?auto=format&fit=crop&w=1200&q=70',
    city: 'Phoenix',
    state: 'AZ',
    address: '1200 Tactical Ln',
    date: '2026-05-18',
    startTime: '08:00',
    endTime: '17:00',
    duration: '9 hours',
    bookingFee: 295,
    maxStudents: 10,
    spotsRemaining: 7,
    description: 'AR-platform fundamentals through transitional drills. Zero, hold-overs, transitions, and movement.',
    whatYoullLearn: ['Zeroing your carbine', 'Position shooting', 'Shooting on the move', 'Pistol transitions', 'Reload techniques'],
    prerequisites: 'AR-15 or similar carbine, sling, optic.',
    equipment: 'Carbine, 6 magazines, 500 rounds, sling',
    status: 'active',
    lat: 33.4484, lng: -112.0740,
  },
  {
    id: 'c3',
    title: 'Tactical Combatives Level 1',
    category: 'Combatives',
    instructorId: 'i3',
    instructorName: 'Derek Holloway',
    instructorPhoto: 'https://i.pravatar.cc/150?img=33',
    instructorVerified: true,
    instructorRating: 4.7,
    heroImage: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1200&q=70',
    city: 'Denver',
    state: 'CO',
    address: '88 Warrior Way',
    date: '2026-05-22',
    startTime: '10:00',
    endTime: '14:00',
    duration: '4 hours',
    bookingFee: 120,
    maxStudents: 16,
    spotsRemaining: 12,
    description: 'Empty-hand fundamentals for civilians. Striking, clinch, takedown defense. No experience required.',
    whatYoullLearn: ['Stance and footwork', 'Basic strikes', 'Clinch fighting', 'Takedown defense', 'Disengaging safely'],
    prerequisites: 'None — beginner friendly.',
    equipment: 'Athletic clothes, mouthguard recommended',
    status: 'active',
    lat: 39.7392, lng: -104.9903,
  },
  {
    id: 'c4',
    title: 'Stop the Bleed: Tactical Medical',
    category: 'Medical',
    instructorId: 'i4',
    instructorName: 'Dr. Elena Martinez',
    instructorPhoto: 'https://i.pravatar.cc/150?img=44',
    instructorVerified: true,
    instructorRating: 5.0,
    heroImage: 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=1200&q=70',
    city: 'Miami',
    state: 'FL',
    address: '2200 Medic St',
    date: '2026-05-28',
    startTime: '13:00',
    endTime: '17:00',
    duration: '4 hours',
    bookingFee: 95,
    maxStudents: 20,
    spotsRemaining: 5,
    description: 'Practical hemorrhage control and trauma care for everyday carry medical kits.',
    whatYoullLearn: ['Tourniquet application', 'Wound packing', 'Chest seals', 'Patient assessment', 'Scene safety'],
    prerequisites: 'None.',
    equipment: 'Provided',
    status: 'active',
    lat: 25.7617, lng: -80.1918,
  },
  {
    id: 'c5',
    title: 'Home Defense Shotgun',
    category: 'Shotgun',
    instructorId: 'i1',
    instructorName: 'Marcus Reyes',
    instructorPhoto: 'https://i.pravatar.cc/150?img=12',
    instructorVerified: true,
    instructorRating: 4.9,
    heroImage: 'https://images.unsplash.com/photo-1567598508481-65985588e295?auto=format&fit=crop&w=1200&q=70',
    city: 'Austin',
    state: 'TX',
    address: '4500 Range Rd',
    date: '2026-06-04',
    startTime: '09:00',
    endTime: '13:00',
    duration: '4 hours',
    bookingFee: 145,
    maxStudents: 8,
    spotsRemaining: 0,
    description: 'Defensive shotgun work for the home. Patterning, loading techniques, transitions.',
    whatYoullLearn: ['Patterning your shotgun', 'Combat reloads', 'Slug select drills', 'Movement inside structures', 'Family communication'],
    prerequisites: 'Pump or semi-auto shotgun.',
    equipment: 'Shotgun, 50 birdshot, 25 buckshot, 10 slugs',
    status: 'full',
    lat: 30.3072, lng: -97.7531,
  },
];

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
