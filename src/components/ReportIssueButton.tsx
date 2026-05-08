import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, Lightbulb } from 'lucide-react';
import { ReportIssueDialog } from './ReportIssueDialog';
import { FeedbackDialog } from './FeedbackDialog';

/**
 * Floating action buttons shown on every non-admin page:
 *  - Report an issue (bug)
 *  - Suggest a feature / share feedback (lightbulb)
 */
export const ReportIssueButton = () => {
  const [bugOpen, setBugOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      <div className="fixed z-40 right-4 bottom-24 md:bottom-6 flex flex-col gap-3">
        <button
          onClick={() => setFeedbackOpen(true)}
          aria-label="Suggest a feature or share feedback"
          className="h-12 w-12 rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 flex items-center justify-center hover:scale-105 active:scale-95 transition border border-border"
        >
          <Lightbulb className="h-5 w-5" />
        </button>
        <button
          onClick={() => setBugOpen(true)}
          aria-label="Report an issue"
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition"
        >
          <Bug className="h-5 w-5" />
        </button>
      </div>
      <ReportIssueDialog open={bugOpen} onOpenChange={setBugOpen} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
};
