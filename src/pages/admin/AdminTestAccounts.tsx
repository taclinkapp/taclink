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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TestAccount = {
  id: string;
  user_id: string;
  email: string;
  password: string;
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
    await navigator.clipboard.writeText(`${acc.email} / ${acc.password}`);
    setCopiedId(acc.id);
    toast.success("Credentials copied");
    setTimeout(() => setCopiedId(null), 1500);
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
                          <td className="px-4 py-3 font-mono text-xs">{a.password}</td>
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
