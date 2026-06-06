import { useEffect, useState } from "react";
import { Plus, Trash2, KeyRound, Loader2, Save, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Rail = {
  id: string;
  provider_key: string;
  display_label: string;
  environment: "sandbox" | "live";
  status: "standby" | "active" | "disabled";
  credential_keys: string[];
  notes: string | null;
  updated_at: string;
};

type Draft = {
  provider_key: string;
  display_label: string;
  environment: "sandbox" | "live";
  status: Rail["status"];
  credentialKeysText: string; // comma / newline separated secret NAMES (not values)
  notes: string;
};

const blankDraft: Draft = {
  provider_key: "authorize_net",
  display_label: "Authorize.Net",
  environment: "sandbox",
  status: "standby",
  credentialKeysText: "AUTHNET_API_LOGIN_ID, AUTHNET_TRANSACTION_KEY, AUTHNET_SIGNATURE_KEY",
  notes: "",
};

function parseKeys(text: string): string[] {
  return Array.from(
    new Set(
      text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    ),
  );
}

export function BackupRailsCard() {
  const [rails, setRails] = useState<Rail[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("backup_payment_rails")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load backup rails");
    setRails((data as Rail[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => { setDraft(blankDraft); setEditingId(null); };

  const startEdit = (r: Rail) => {
    setEditingId(r.id);
    setDraft({
      provider_key: r.provider_key,
      display_label: r.display_label,
      environment: r.environment,
      status: r.status,
      credentialsText: JSON.stringify(r.credentials ?? {}, null, 2),
      notes: r.notes ?? "",
    });
  };

  const save = async () => {
    let creds: Record<string, string>;
    try {
      creds = JSON.parse(draft.credentialsText || "{}");
      if (typeof creds !== "object" || Array.isArray(creds)) throw new Error("not object");
    } catch {
      toast.error("Credentials must be valid JSON, e.g. { \"api_key\": \"...\" }");
      return;
    }
    if (!draft.provider_key.trim() || !draft.display_label.trim()) {
      toast.error("Provider key and label are required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        provider_key: draft.provider_key.trim(),
        display_label: draft.display_label.trim(),
        environment: draft.environment,
        status: draft.status,
        credentials: creds,
        notes: draft.notes || null,
      };
      const q = editingId
        ? (supabase as any).from("backup_payment_rails").update(payload).eq("id", editingId)
        : (supabase as any).from("backup_payment_rails").insert(payload);
      const { error } = await q;
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(editingId ? "Backup rail updated" : "Backup rail saved");
      reset();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any)
      .from("backup_payment_rails").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Backup rail removed");
    if (editingId === id) reset();
    await load();
  };

  const setStatus = async (r: Rail, status: Rail["status"]) => {
    const { error } = await (supabase as any)
      .from("backup_payment_rails").update({ status }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${r.display_label} as ${status}`);
    await load();
  };

  return (
    <section className="tactical-card p-5 space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold">
        <KeyRound className="h-4 w-4 text-primary" /> Backup Payment Rails — Stand-By Vault
      </div>
      <p className="text-xs text-muted-foreground">
        Register alternate processors (Authorize.Net, NMI, etc.) with their API
        keys and tokens here. They stay <strong>dormant</strong> until you mark
        one as <strong>active</strong>. Credentials are stored encrypted at the
        database layer and only readable by admins.
      </p>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Configured rails
        </Label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rails.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            No backup rails configured yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {rails.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-background/50 p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{r.display_label}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {r.provider_key}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {r.environment}
                    </Badge>
                    <Badge
                      className="text-[10px] uppercase"
                      variant={r.status === "active" ? "default" : "secondary"}
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Keys: {Object.keys(r.credentials ?? {}).join(", ") || "none"}
                  </div>
                  {r.notes && (
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {r.notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]"
                    onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  {r.status !== "active" ? (
                    <Button size="sm" variant="default" className="h-7 text-[11px]"
                      onClick={() => setStatus(r, "active")}>
                      <Power className="h-3 w-3 mr-1" /> Deploy
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="h-7 text-[11px]"
                      onClick={() => setStatus(r, "standby")}>
                      Stand down
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this backup rail?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes <strong>{r.display_label}</strong> ({r.environment})
                          and its stored credentials. You can re-add it later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(r.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          {editingId ? "Edit rail" : "Add new rail"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Provider key
            </Label>
            <Input
              value={draft.provider_key}
              onChange={(e) => setDraft({ ...draft, provider_key: e.target.value })}
              placeholder="authorize_net"
              className="h-10 mt-1.5 bg-background border-border font-mono"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Display label
            </Label>
            <Input
              value={draft.display_label}
              onChange={(e) => setDraft({ ...draft, display_label: e.target.value })}
              placeholder="Authorize.Net"
              className="h-10 mt-1.5 bg-background border-border"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Environment
            </Label>
            <Select
              value={draft.environment}
              onValueChange={(v) => setDraft({ ...draft, environment: v as any })}
            >
              <SelectTrigger className="h-10 mt-1.5 bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft({ ...draft, status: v as any })}
            >
              <SelectTrigger className="h-10 mt-1.5 bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standby">Standby</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Credentials (JSON: keys / tokens)
          </Label>
          <Textarea
            rows={6}
            value={draft.credentialsText}
            onChange={(e) => setDraft({ ...draft, credentialsText: e.target.value })}
            className="mt-1.5 bg-background border-border font-mono text-xs"
            placeholder='{ "api_login_id": "...", "transaction_key": "..." }'
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Notes (optional)
          </Label>
          <Textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="mt-1.5 bg-background border-border text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy} className="h-10 font-bold">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : editingId ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {editingId ? "Save changes" : "Add backup rail"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={reset} className="h-10">Cancel</Button>
          )}
        </div>
      </div>
    </section>
  );
}
