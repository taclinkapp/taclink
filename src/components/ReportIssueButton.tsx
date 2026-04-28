import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug } from 'lucide-react';
import { ReportIssueDialog } from './ReportIssueDialog';

/**
 * Floating "Report Issue" button shown on every non-admin page.
 * Sits above the bottom tab bar on mobile.
 */
export const ReportIssueButton = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Hide on admin pages (admin has its own panel) and on the splash to keep it clean.
  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        className="fixed z-40 right-4 bottom-24 md:bottom-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Bug className="h-5 w-5" />
      </button>
      <ReportIssueDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
