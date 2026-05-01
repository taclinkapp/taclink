import { useEffect, useState } from "react";
import { AdminHeader } from "./AdminDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Plus, Copy, Check, GraduationCap, ShieldCheck } from "lucide-react";
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

export default function AdminTestAccounts() {
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<null | "instructor" | "student">(null);
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
    setAccounts((prev) => [data.account, ...prev]);
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

  const copy = async (acc: TestAccount) => {
    await navigator.clipboard.writeText(`${acc.email} / ${acc.password}`);
    setCopiedId(acc.id);
    toast.success("Credentials copied");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = accounts.filter((a) => a.role === tab);

  return (
    <>
      <AdminHeader
        title="Fake Onboarding Testing Accounts"
        subtitle="Create reusable instructor & student accounts to QA the onboarding flow"
      />
      <div className="p-4 sm:p-8 space-y-6">
        <div className="tactical-card p-4 sm:p-5 space-y-3">
          <div className="text-xs uppercase tracking-wider font-bold text-primary">
            Create new fake account
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
              disabled={creating !== null}
              className="bg-primary text-primary-foreground"
            >
              {creating === "instructor" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              New Instructor
            </Button>
            <Button
              onClick={() => create("student")}
              disabled={creating !== null}
              variant="secondary"
            >
              {creating === "student" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
              New Student
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Accounts are auto-confirmed. Sign out, then sign in with the credentials below to
            re-test the onboarding flow as that role.
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
