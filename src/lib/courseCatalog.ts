// TacLink official course catalog — categories and the course types
// instructors can pick from when creating a course. Students browse by the
// same category keys via the DisciplineBrowser.
//
// Keep `key` short and stable — it's stored on courses.category in the DB.
// `label` is what users see. `types` are predefined course titles that
// instructors can pick from to prefill their listing.

import {
  Target, Crosshair, Shield, Layers, Scale, PersonStanding,
  Building2, Plus, UserCheck, Siren, Mountain, Users, Sparkles,
  type LucideIcon,
} from 'lucide-react';

export type CourseCategory = {
  key: string;
  label: string;
  icon: LucideIcon;
  types: string[];
};

export const COURSE_CATALOG: CourseCategory[] = [
  {
    key: 'Pistol',
    label: 'Firearms — Pistol',
    icon: Target,
    types: [
      'Pistol Fundamentals (Beginner)',
      'Concealed Carry / CCW Qualification',
      'Defensive Pistol',
      'Pistol Marksmanship & Accuracy',
      'Low-Light / Nighttime Pistol',
      'One-Handed Pistol Techniques',
      'Pistol Malfunction Clearance',
      'Competition Pistol (USPSA / IDPA Prep)',
      'Draw Stroke & Holster Work',
      'Force-on-Force Pistol (Simunitions)',
    ],
  },
  {
    key: 'Rifle',
    label: 'Firearms — Rifle',
    icon: Crosshair,
    types: [
      'AR-15 / Carbine Fundamentals',
      'Patrol Rifle Operator',
      'Long-Range Precision Rifle',
      'Designated Marksman (DMR)',
      'Low-Light / Night Vision Rifle',
      'Rifle Malfunction Clearance',
      'Home Defense Rifle',
      'Competition Rifle (3-Gun Prep)',
      'Suppressor Operations',
      'Vehicle-Based Rifle Tactics',
    ],
  },
  {
    key: 'Shotgun',
    label: 'Firearms — Shotgun',
    icon: Shield,
    types: [
      'Shotgun Fundamentals',
      'Defensive Shotgun',
      'Tactical Shotgun Operations',
      'Breaching Fundamentals (Shotgun)',
      'Competition Shotgun (3-Gun Prep)',
    ],
  },
  {
    key: 'Multi-Platform',
    label: 'Firearms — Multi-Platform',
    icon: Layers,
    types: [
      'Pistol + Carbine Transition',
      '3-Gun Fundamentals',
      'Low-Light Multi-Platform',
      'Vehicle CQB (Pistol + Rifle)',
    ],
  },
  {
    key: 'Concealed Carry & Legal',
    label: 'Concealed Carry & Legal',
    icon: Scale,
    types: [
      'CCW / CHL / LTC Qualification (state-specific)',
      'Concealed Carry Renewal',
      'Legal Use of Force',
      'Aftermath of a Defensive Shooting',
      'Traveling Armed (state laws & reciprocity)',
      'Workplace Carry Policies',
    ],
  },
  {
    key: 'Combatives',
    label: 'Combatives & Hand-to-Hand',
    icon: PersonStanding,
    types: [
      'Combatives Level 1 (Army FM 21-150 based)',
      'Combatives Level 2',
      'Ground Fighting & Grappling',
      'Knife Defense',
      'Edged Weapon Offense',
      'Combatives + Pistol Integration',
      "Women's Self-Defense",
      'Active Threat / Ambush Defense',
    ],
  },
  {
    key: 'Tactical',
    label: 'Tactical & Operator Skills',
    icon: Building2,
    types: [
      'Close Quarters Battle (CQB) — Room Clearing',
      'Building Clearing (Solo & Team)',
      'Vehicle Tactics (Entering, Exiting, Fighting)',
      'Hostage Rescue Fundamentals',
      'Surveillance Detection & Counter-Surveillance',
      'Tracking & Counter-Tracking',
      'Urban Survival & Evasion',
      'Team Movement & Communication',
    ],
  },
  {
    key: 'Medical',
    label: 'Medical & Trauma',
    icon: Plus,
    types: [
      'Tactical Combat Casualty Care (TCCC)',
      'Stop the Bleed',
      'Tourniquet Application & Wound Packing',
      'Mass Casualty Response',
      'Tactical Emergency Casualty Care (TECC)',
      'Wilderness First Aid for Operators',
      'Medical Under Fire',
    ],
  },
  {
    key: 'Security & EP',
    label: 'Security & Executive Protection',
    icon: UserCheck,
    types: [
      'Executive Protection Fundamentals',
      'Advance Team Operations',
      'Protective Detail Driving',
      'Threat Assessment & Recognition',
      'Dignitary Protection',
      'Armed Security Officer Certification',
    ],
  },
  {
    key: 'Law Enforcement',
    label: 'Law Enforcement Specific',
    icon: Siren,
    types: [
      'Active Shooter Response (LE)',
      'De-escalation & Use of Force',
      'Patrol Tactics',
      'Traffic Stop Safety',
      'K-9 Handler Support',
      'Interview & Interrogation Techniques',
    ],
  },
  {
    key: 'Hunting & Field',
    label: 'Hunting & Field Skills',
    icon: Mountain,
    types: [
      'Long-Range Hunting (Precision Rifle)',
      'Backcountry Survival',
      'Land Navigation (Map & Compass / GPS)',
      'Hunting Safety Certification',
      'Bowhunting Fundamentals',
    ],
  },
  {
    key: 'Youth & Family',
    label: 'Youth & Family',
    icon: Users,
    types: [
      'Youth Firearms Safety (NRA Eddie Eagle)',
      'Parent & Child Pistol Fundamentals',
      'Teen Self-Defense',
      'Family Home Defense Planning',
    ],
  },
  {
    key: 'Specialty',
    label: 'Specialty & Advanced',
    icon: Sparkles,
    types: [
      'Sniper / Precision Rifle Advanced',
      'Breaching (Mechanical, Ballistic)',
      'Explosive Ordnance Awareness',
      'SERE (Survival, Evasion, Resistance, Escape) Fundamentals',
      'Drone Awareness & Counter-UAS',
      'Cyber & Physical Security Integration',
    ],
  },
];

export const COURSE_CATEGORY_KEYS = COURSE_CATALOG.map((c) => c.key);

export const getCategoryTypes = (categoryKey: string): string[] =>
  COURSE_CATALOG.find((c) => c.key === categoryKey)?.types ?? [];
