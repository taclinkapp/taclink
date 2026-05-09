/**
 * Draft store for the deferred instructor signup flow.
 *
 * The auth account is NOT created until the user completes every onboarding
 * step (plan → credential → policy). To let users resume after a refresh or
 * accidental navigation, we persist all serializable fields to localStorage.
 *
 * File objects (profile photo, credential document) cannot be serialized,
 * so they live in module-level memory. If the page reloads, the user will
 * be asked to re-attach those files — but every text field, the chosen
 * plan, credential type, and policy ack are restored automatically.
 */

const STORAGE_KEY = 'taclink_instructor_signup_draft_v1';

export type InstructorSignupDraft = {
  // Account
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  state: string;
  bio: string;
  referralCode?: string;
  influencerSlug?: string;
  photo?: File;
  // Plan
  plan?: 'free' | 'pro';
  // Credential
  credentialType?: string;
  credentialDisplayName?: string;
  credentialFile?: File;
  // Policy
  policyAcknowledged?: boolean;
  // Email verification
  authAccountCreated?: boolean;
};

// Files are kept separately because they aren't serializable.
type FileSlots = {
  photo?: File;
  credentialFile?: File;
};

let fileSlots: FileSlots = {};

const isBrowser = () => typeof window !== 'undefined';

const readPersisted = (): Omit<InstructorSignupDraft, 'photo' | 'credentialFile'> | null => {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writePersisted = (draft: InstructorSignupDraft) => {
  if (!isBrowser()) return;
  try {
    // Strip non-serializable File fields before persisting.
    const { photo, credentialFile, ...rest } = draft;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {}
};

export const setInstructorDraft = (next: InstructorSignupDraft) => {
  fileSlots = { photo: next.photo, credentialFile: next.credentialFile };
  writePersisted(next);
};

export const updateInstructorDraft = (patch: Partial<InstructorSignupDraft>) => {
  const current = getInstructorDraft();
  if (!current) return;
  if ('photo' in patch) fileSlots.photo = patch.photo;
  if ('credentialFile' in patch) fileSlots.credentialFile = patch.credentialFile;
  const merged = { ...current, ...patch };
  writePersisted(merged);
};

export const getInstructorDraft = (): InstructorSignupDraft | null => {
  const persisted = readPersisted();
  if (!persisted) return null;
  return {
    ...persisted,
    photo: fileSlots.photo,
    credentialFile: fileSlots.credentialFile,
  };
};

export const clearInstructorDraft = () => {
  fileSlots = {};
  if (isBrowser()) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
};

export const hasInstructorDraft = () => readPersisted() !== null;

/** True if file attachments were lost (e.g. after a page refresh). */
export const draftFilesMissing = (): { photo: boolean; credential: boolean } => {
  const persisted = readPersisted();
  return {
    photo: !!persisted && !fileSlots.photo,
    credential: !!persisted?.credentialType && !fileSlots.credentialFile,
  };
};
