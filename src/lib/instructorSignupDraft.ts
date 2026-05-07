/**
 * In-memory draft for the deferred instructor signup flow.
 *
 * The auth account is NOT created until the user completes every onboarding
 * step (plan → credential → policy). We hold form data, the profile photo,
 * and the credential document in module-level memory so they survive
 * navigation between onboarding screens. A page refresh or tab close
 * intentionally clears the draft — the user must restart from scratch.
 */

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
};

let draft: InstructorSignupDraft | null = null;

export const setInstructorDraft = (next: InstructorSignupDraft) => {
  draft = next;
};

export const updateInstructorDraft = (patch: Partial<InstructorSignupDraft>) => {
  if (!draft) return;
  draft = { ...draft, ...patch };
};

export const getInstructorDraft = (): InstructorSignupDraft | null => draft;

export const clearInstructorDraft = () => {
  draft = null;
};

export const hasInstructorDraft = () => draft !== null;
