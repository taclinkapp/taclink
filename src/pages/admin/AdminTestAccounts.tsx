import { useEffect, useState } from "react";
import { AdminHeader } from "./AdminDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Trash2,
  Copy,
  Check,
  GraduationCap,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type TestAccount = {
  id: string;
  user_id: string;
  email: string;
  // Password is only available immediately after creation (returned from the
  // edge function). It is never persisted to the database.
  password?: string;
  role: "instructor" | "student";
  label: string | null;
  created_at: string;
};

type Limits = {
  per_role_per_day: number;
  today: { instructor: number; student: number };
};

export default function AdminTestAccounts() {
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<null | "instructor" | "student">(null);
  const [rotating, setRotating] = useState(false);
  const [label, setLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"instructor" | "student">("instructor");
  const [backdoor, setBackdoor] = useState<
    Array<{ role: string; email: string; password: string }> | null
  >(null);
  const [backdoorBusy, setBackdoorBusy] = useState(false);
  const [backdoorCopied, setBackdoorCopied] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCreds[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as GeneratedCreds[]) : [];
    } catch {
      return [];
    }
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
      body: { action: "list" },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed to load");
      return;
    }
    setAccounts(data.accounts ?? []);
    setLimits(data.limits ?? null);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (role: "instructor" | "student") => {
    setCreating(role);
    const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
      body: { action: "create", role, label: label.trim() || undefined },
    });
    setCreating(null);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed to create");
      return;
    }
    setLabel("");
    toast.success(`Created fake ${role} account`);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this fake test account? The auth user will be removed.")) return;
    const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
      body: { action: "delete", id },
    });
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed to delete");
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Deleted");
  };

  const rotate = async () => {
    if (
      !confirm(
        "Rotate ALL fake test accounts? Every existing account will be deleted and re-created with fresh emails and passwords. Anyone signed in to an old account will be logged out.",
      )
    )
      return;
    setRotating(true);
    const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
      body: { action: "rotate" },
    });
    setRotating(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Rotate failed");
      return;
    }
    toast.success(
      `Rotated test accounts: ${data.deleted ?? 0} removed, ${data.created ?? 0} re-created`,
    );
    await load();
  };

  const copy = async (acc: TestAccount) => {
    if (!acc.password) {
      toast.error("Password is only available right after creation. Rotate this account to get a new one.");
      return;
    }
    await navigator.clipboard.writeText(`${acc.email} / ${acc.password}`);
    setCopiedId(acc.id);
    toast.success("Credentials copied");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const ensureBackdoor = async () => {
    setBackdoorBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
      body: { action: "ensure_backdoor" },
    });
    setBackdoorBusy(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed to create backdoor accounts");
      return;
    }
    setBackdoor(data.backdoor ?? []);
    toast.success("Backdoor accounts ready");
    await load();
  };

  const copyBackdoor = async (b: { email: string; password: string }) => {
    await navigator.clipboard.writeText(`${b.email} / ${b.password}`);
    setBackdoorCopied(b.email);
    toast.success("Copied");
    setTimeout(() => setBackdoorCopied(null), 1500);
  };

  const seedMockData = async () => {
    if (
      !confirm(
        "Seed mock data into the two backdoor accounts? This deletes any existing courses, bookings, reviews, XP and credentials on those accounts, then re-creates a polished baseline (instructor profile, 3 courses, credential, student bookings + reviews) for screenshots / advertising.",
      )
    )
      return;
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("manage-test-accounts", {
      body: { action: "seed_mock_data" },
    });
    setSeeding(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Seed failed");
      return;
    }
    toast.success(
      `Mock data seeded — ${data.courses_created ?? 0} courses, profiles + reviews ready`,
    );
  };



  const filtered = accounts.filter((a) => a.role === tab);
  const cap = limits?.per_role_per_day ?? 10;
  const usedInstructor = limits?.today.instructor ?? 0;
  const usedStudent = limits?.today.student ?? 0;
  const instructorBlocked = usedInstructor >= cap;
  const studentBlocked = usedStudent >= cap;

  return (
    <>
      <AdminHeader
        title="Fake Onboarding Testing Accounts"
        subtitle="Create reusable instructor & student accounts to QA the onboarding flow"
      />
      <div className="p-4 sm:p-8 space-y-6">
        {/* Admin View-As — jump straight into student/instructor UIs while staying signed in as admin */}
        <div className="tactical-card p-4 sm:p-5 space-y-3 border-primary/40">
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              View as student / instructor
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Open the student or instructor app in your admin session to validate every step of
              the flow. A banner at the top of those views lets you jump back to the admin panel.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild className="bg-primary text-primary-foreground">
              <Link to="/student">
                <GraduationCap className="h-4 w-4" />
                Open Student app
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/instructor">
                <ShieldCheck className="h-4 w-4" />
                Open Instructor app
              </Link>
            </Button>
          </div>
        </div>

        {/* Backdoor accounts — fixed credentials, fully onboarded, persistent */}
        <div className="tactical-card p-4 sm:p-5 space-y-3 border-primary/60">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                Backdoor accounts (fixed credentials)
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Two persistent accounts — one instructor, one student — with the
                same email/password every time. They skip onboarding (subscription,
                credential upload, policy ack) and drop you straight into the role.
                Click <strong>Create / reset backdoor</strong> to provision or rotate
                the password back to the known value.
              </p>
            </div>
            <Button
              onClick={ensureBackdoor}
              disabled={backdoorBusy}
              className="bg-primary text-primary-foreground"
            >
              {backdoorBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Create / reset backdoor
            </Button>
          </div>

          {backdoor && backdoor.length > 0 && (
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
                  {backdoor.map((b) => (
                    <tr key={b.email} className="hover:bg-muted/30">
                      <td className="px-3 py-2 capitalize text-xs">{b.role}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.email}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.password}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => copyBackdoor(b)}>
                          {backdoorCopied === b.email ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!backdoor && (
            <p className="text-xs text-muted-foreground">
              No credentials shown yet — click the button above. The password is
              the same every time (it&apos;s a backdoor, not a one-time secret).
            </p>
          )}
        </div>


        {/* Signup credentials generator — does NOT create an auth user.
            Use these to walk through the real signup form yourself. */}
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
                auto-confirmed (no inbox needed) and auto-tagged as test accounts, so you can run
                full checkout: courses created by the fake instructor are only visible to fake
                students, never to real users.
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

        <div className="tactical-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wider font-bold text-primary">
              Create new fake account
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={rotate}
              disabled={rotating || accounts.length === 0}
              title="Delete all existing fake accounts and re-create them with fresh credentials"
            >
              {rotating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Rotate all ({accounts.length})
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label (e.g. 'Tier page test')"
              className="bg-card border-border"
            />
            <Button
              onClick={() => create("instructor")}
              disabled={creating !== null || instructorBlocked}
              className="bg-primary text-primary-foreground"
              title={
                instructorBlocked
                  ? `Daily limit reached (${cap}/day). Resets 00:00 UTC.`
                  : undefined
              }
            >
              {creating === "instructor" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              New Instructor ({usedInstructor}/{cap})
            </Button>
            <Button
              onClick={() => create("student")}
              disabled={creating !== null || studentBlocked}
              variant="secondary"
              title={
                studentBlocked
                  ? `Daily limit reached (${cap}/day). Resets 00:00 UTC.`
                  : undefined
              }
            >
              {creating === "student" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
              New Student ({usedStudent}/{cap})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Accounts are auto-confirmed. Limit: <strong>{cap} per role per day</strong> (per
            admin, resets at 00:00 UTC). Use <strong>Rotate all</strong> to wipe and refresh
            every fake account in one click for a clean test run.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "instructor" | "student")}>
          <TabsList>
            <TabsTrigger value="instructor">
              Instructor ({accounts.filter((a) => a.role === "instructor").length})
            </TabsTrigger>
            <TabsTrigger value="student">
              Student ({accounts.filter((a) => a.role === "student").length})
            </TabsTrigger>
          </TabsList>

          {(["instructor", "student"] as const).map((r) => (
            <TabsContent key={r} value={r} className="mt-4">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : filtered.length === 0 ? (
                <div className="tactical-card p-6 text-sm text-muted-foreground text-center">
                  No fake {r} accounts yet. Create one above.
                </div>
              ) : (
                <div className="tactical-card overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Email</th>
                        <th className="text-left px-4 py-3 font-bold">Password</th>
                        <th className="text-left px-4 py-3 font-bold">Label</th>
                        <th className="text-left px-4 py-3 font-bold">Created</th>
                        <th className="px-4 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{a.email}</td>
                          <td className="px-4 py-3 font-mono text-xs">{a.password ?? <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3">{a.label ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                            <Button size="sm" variant="outline" onClick={() => copy(a)}>
                              {copiedId === a.id ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => remove(a.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}
