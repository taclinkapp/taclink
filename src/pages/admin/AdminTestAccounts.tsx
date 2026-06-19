import { useState } from "react";
import { AdminHeader } from "./AdminDashboard";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Copy,
  Check,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

type BackdoorCred = {
  role: "instructor" | "student";
  email: string;
  password: string;
};

type GeneratedCreds = {
  email: string;
  password: string;
  role: "instructor" | "student";
  generatedAt: number;
};

const STORAGE_KEY = "qa_signup_generated_creds";

function generateEmail(role: "instructor" | "student") {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  return `qa+${role}-signup-${stamp}@taclink.test`;
}

function generatePassword() {
  // Meets typical strength rules: upper, lower, digit, symbol, 14+ chars
  const base = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Qa!${base}A1`;
}

export default function AdminTestAccounts() {
  const [generated, setGenerated] = useState<GeneratedCreds[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as GeneratedCreds[]) : [];
    } catch {
      return [];
    }
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [backdoorCreds, setBackdoorCreds] = useState<BackdoorCred[]>([]);
  const [backdoorLoading, setBackdoorLoading] = useState(false);

  const provisionBackdoor = async () => {
    setBackdoorLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
        body: { action: "ensure_backdoor" },
      });
      if (error) throw error;
      const results = (data?.backdoor ?? data?.results ?? []) as BackdoorCred[];
      if (!results.length) throw new Error("No credentials returned");
      setBackdoorCreds(results);
      toast.success("Sign-in-ready test accounts are provisioned");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to provision backdoor accounts";
      toast.error(msg);
    } finally {
      setBackdoorLoading(false);
    }
  };

  const copyBackdoor = async (c: BackdoorCred) => {
    await navigator.clipboard.writeText(`${c.email} / ${c.password}`);
    setCopiedKey(`backdoor-${c.role}`);
    toast.success("Copied — paste into the sign-in form");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const persistGenerated = (next: GeneratedCreds[]) => {
    setGenerated(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const generate = (role: "instructor" | "student") => {
    const creds: GeneratedCreds = {
      email: generateEmail(role),
      password: generatePassword(),
      role,
      generatedAt: Date.now(),
    };
    persistGenerated([creds, ...generated].slice(0, 20));
    toast.success(`Generated ${role} signup credentials`);
  };

  const copyGenerated = async (g: GeneratedCreds) => {
    await navigator.clipboard.writeText(`${g.email} / ${g.password}`);
    const key = `${g.email}-${g.generatedAt}`;
    setCopiedKey(key);
    toast.success("Copied — paste into the signup form");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const removeGenerated = (g: GeneratedCreds) => {
    persistGenerated(generated.filter((x) => x.generatedAt !== g.generatedAt));
  };

  const clearGenerated = () => {
    if (!generated.length) return;
    if (!confirm("Clear all generated signup credentials from this list?")) return;
    persistGenerated([]);
  };

  return (
    <>
      <AdminHeader
        title="Test Accounts"
        subtitle="Ready-to-sign-in accounts for booking / check-in / check-out testing, plus a generator for fresh signup-flow QA"
      />
      <div className="p-4 sm:p-8 space-y-6">
        {/* ============================================================ */}
        {/* Ready-to-sign-in backdoor accounts                            */}
        {/* ============================================================ */}
        <div className="tactical-card p-4 sm:p-5 space-y-3 border-amber-500/40">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-amber-500 flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                Sign-in-ready test accounts
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                Two persistent accounts (one instructor, one student) that <strong>already exist</strong> and
                are pre-seeded with profiles, payout method, published courses, and 20 mock student bookings.
                Use them to test the <strong>booking → checkout → check-in</strong> flow without running
                signup again. The student bypasses Helcim with the amber “Simulate paid” button on checkout.
              </p>
            </div>
            <Button
              onClick={provisionBackdoor}
              disabled={backdoorLoading}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {backdoorLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {backdoorCreds.length ? "Re-fetch credentials" : "Provision & reveal credentials"}
            </Button>
          </div>

          {backdoorCreds.length > 0 && (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Role</th>
                    <th className="text-left px-3 py-2 font-bold">Email</th>
                    <th className="text-left px-3 py-2 font-bold">Password</th>
                    <th className="px-3 py-2 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {backdoorCreds.map((c) => {
                    const key = `backdoor-${c.role}`;
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="px-3 py-2 capitalize text-xs font-bold">{c.role}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.email}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.password}</td>
                        <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => copyBackdoor(c)}>
                            {copiedKey === key ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            Copy
                          </Button>
                          <Button size="sm" variant="secondary" asChild>
                            <Link to="/auth/signin" target="_blank" rel="noopener">
                              <LogIn className="h-3.5 w-3.5" />
                              Open sign-in
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="tactical-card p-4 sm:p-5 space-y-3 border-primary/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Signup credentials generator
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Generates a fresh email + password. <strong>No account is created yet</strong> —
                copy them and run through the real signup form to test onboarding end-to-end.
                Emails on the <code className="font-mono">qa+…@taclink.test</code> pattern are
                auto-confirmed (no inbox needed) and <strong>auto-added to the test-account
                allowlist on signup</strong>, so they bypass onboarding, credential upload,
                publishing gates, the booking week-out minimum, and Helcim checkout. Courses
                created by a QA instructor are only visible to QA students, never to real users.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/auth/instructor-signup" target="_blank" rel="noopener">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Instructor signup
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/auth/student-signup" target="_blank" rel="noopener">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Student signup
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => generate("instructor")}
              className="bg-primary text-primary-foreground"
            >
              <ShieldCheck className="h-4 w-4" />
              Generate Instructor credentials
            </Button>
            <Button onClick={() => generate("student")} variant="secondary">
              <GraduationCap className="h-4 w-4" />
              Generate Student credentials
            </Button>
            {generated.length > 0 && (
              <Button onClick={clearGenerated} variant="ghost" size="sm">
                Clear list
              </Button>
            )}
          </div>

          {generated.length > 0 && (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Role</th>
                    <th className="text-left px-3 py-2 font-bold">Email</th>
                    <th className="text-left px-3 py-2 font-bold">Password</th>
                    <th className="text-left px-3 py-2 font-bold">Generated</th>
                    <th className="px-3 py-2 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {generated.map((g) => {
                    const key = `${g.email}-${g.generatedAt}`;
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="px-3 py-2 capitalize text-xs">{g.role}</td>
                        <td className="px-3 py-2 font-mono text-xs">{g.email}</td>
                        <td className="px-3 py-2 font-mono text-xs">{g.password}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(g.generatedAt).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyGenerated(g)}
                          >
                            {copiedKey === key ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeGenerated(g)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
