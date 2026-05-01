import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// --- Mocks ---------------------------------------------------------------
const signUpMock = vi.fn();
const getSessionMock = vi.fn();
const signOutMock = vi.fn();
const invokeMock = vi.fn().mockResolvedValue({ data: null, error: null });
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...a: any[]) => getSessionMock(...a),
      signOut: (...a: any[]) => signOutMock(...a),
      signUp: (...a: any[]) => signUpMock(...a),
    },
    functions: { invoke: (...a: any[]) => invokeMock(...a) },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...a: any[]) => toastSuccess(...a),
    error: (...a: any[]) => toastError(...a),
  },
}));

vi.mock('@/lib/influencer', () => ({ readInfluencerSlug: () => null }));
vi.mock('@/lib/contactRedaction', () => ({ detectContactInfo: () => [] }));
vi.mock('@/lib/bypassLogging', () => ({ logBypassAttempt: vi.fn() }));
vi.mock('@/lib/passwordRules', () => ({
  validatePassword: () => ({ valid: true, failed: [] }),
}));
vi.mock('@/components/PasswordRequirements', () => ({
  PasswordRequirements: () => null,
}));
vi.mock('@/components/ContactInfoWarning', () => ({
  ContactInfoWarning: () => null,
}));
vi.mock('@/components/MobileShell', () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock('@/components/Logo', () => ({ Logo: () => <div>Logo</div> }));

import StudentSignUp from './StudentSignUp';
import InstructorSignUp from './InstructorSignUp';

const Landing = ({ label }: { label: string }) => <div>LANDED:{label}</div>;

const renderWith = (Page: React.ComponentType, useStrict = false) => {
  const tree = (
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Page />} />
        <Route path="/student" element={<Landing label="student" />} />
        <Route
          path="/instructor/subscription"
          element={<Landing label="instructor-sub" />}
        />
      </Routes>
    </MemoryRouter>
  );
  return render(useStrict ? <StrictMode>{tree}</StrictMode> : tree);
};

const fillCommon = () => {
  fireEvent.change(screen.getAllByDisplayValue('')[0], { target: { value: 'A' } }); // first
  fireEvent.change(screen.getAllByDisplayValue('')[0], { target: { value: 'B' } }); // last
  // email + passwords by type
  const inputs = document.querySelectorAll('input');
  const byType = (t: string) =>
    Array.from(inputs).filter((i) => (i as HTMLInputElement).type === t) as HTMLInputElement[];
  fireEvent.change(byType('email')[0], { target: { value: 'x@y.com' } });
  const pws = byType('password');
  fireEvent.change(pws[0], { target: { value: 'GoodPass1!' } });
  fireEvent.change(pws[1], { target: { value: 'GoodPass1!' } });
  // age checkbox
  const cb = document.getElementById('age') as HTMLInputElement;
  fireEvent.click(cb);
};

beforeEach(() => {
  cleanup();
  signUpMock.mockReset();
  signUpMock.mockResolvedValue({ data: {}, error: null });
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  invokeMock.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  sessionStorage.clear();
});

describe('Signup redirects', () => {
  it('Student signup redirects to /student', async () => {
    renderWith(StudentSignUp);
    fillCommon();
    fireEvent.click(screen.getByRole('button', { name: /Create Student Account/i }));
    await waitFor(() => screen.getByText('LANDED:student'));
    expect(signUpMock).toHaveBeenCalled();
    expect(signUpMock.mock.calls[0][0].options.data.role).toBe('student');
    expect(signUpMock.mock.calls[0][0].options.emailRedirectTo).toContain('/student');
    const log = JSON.parse(sessionStorage.getItem('taclink:signupRedirectLog') || '[]');
    expect(log.some((e: any) => e.role === 'student' && e.status === 'redirected')).toBe(true);
  });

  it('Student signup redirects correctly under StrictMode (double-mount safe)', async () => {
    renderWith(StudentSignUp, true);
    fillCommon();
    fireEvent.click(screen.getByRole('button', { name: /Create Student Account/i }));
    await waitFor(() => screen.getByText('LANDED:student'));
    expect(signUpMock).toHaveBeenCalled();
  });

  it('Instructor signup redirects to /instructor/subscription', async () => {
    renderWith(InstructorSignUp);
    fillCommon();
    // state select + bio are optional; submit straight away
    fireEvent.click(screen.getByRole('button', { name: /Apply as Instructor/i }));
    await waitFor(() => screen.getByText('LANDED:instructor-sub'));
    expect(signUpMock.mock.calls[0][0].options.data.role).toBe('instructor');
    expect(signUpMock.mock.calls[0][0].options.emailRedirectTo).toContain('/instructor/subscription?onboarding=1');
    const log = JSON.parse(sessionStorage.getItem('taclink:signupRedirectLog') || '[]');
    expect(log.some((e: any) => e.role === 'instructor' && e.status === 'redirected')).toBe(true);
  });

  it('Instructor signup first clears an existing student session before creating the account', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { user: { id: 'student-session' } } }, error: null });
    renderWith(InstructorSignUp);
    fillCommon();
    fireEvent.click(screen.getByRole('button', { name: /Apply as Instructor/i }));
    await waitFor(() => screen.getByText('LANDED:instructor-sub'));
    expect(signOutMock).toHaveBeenCalled();
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(signUpMock.mock.invocationCallOrder[0]);
  });

  it('Instructor signup redirects correctly under StrictMode', async () => {
    renderWith(InstructorSignUp, true);
    fillCommon();
    fireEvent.click(screen.getByRole('button', { name: /Apply as Instructor/i }));
    await waitFor(() => screen.getByText('LANDED:instructor-sub'));
    expect(signUpMock).toHaveBeenCalled();
  });
});
