import { useEffect, useState } from "react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  DollarSign,
  Loader2,
  Mail,
  Plus,
  Smartphone,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { HowPaymentsWorkCard } from "@/components/HowPaymentsWorkCard";
import {
  PAYOUT_META,
  type PayoutHandle,
  type PayoutMethod,
} from "@/lib/payouts";

const METHOD_ICON: Record<PayoutMethod, typeof Smartphone> = {
  cashapp: DollarSign,
  venmo: Smartphone,
  paypal: Mail,
  zelle: Mail,
};

const PayoutMethods = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<PayoutHandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<PayoutMethod>("cashapp");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: e } = await supabase
      .from("instructor_payout_methods")
      .select("id, instructor_id, method_type, handle, is_preferred, created_at")
      .eq("instructor_id", user.id)
      .order("is_preferred", { ascending: false })
      .order("created_at", { ascending: true });
    if (e) toast.error(e.message);
    setRows((data as PayoutHandle[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const reset = () => {
    setAdding(false);
    setType("cashapp");
    setHandle("");
    setError(null);
  };

  const handleAdd = async () => {
    if (!user) return;
    const meta = PAYOUT_META[type];
    const v = handle.trim();
    const err = meta.validate(v);
    if (err) {
      setError(err);
      return;
    }
    if (
      rows.some(
        (r) =>
          r.method_type === type &&
          r.handle.toLowerCase() === v.toLowerCase(),
      )
    ) {
      setError(`That ${meta.label} handle is already saved`);
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.from("instructor_payout_methods").insert({
      instructor_id: user.id,
      method_type: type,
      handle: v,
      is_preferred: rows.length === 0, // first one becomes preferred
    });
    setSaving(false);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success(`${meta.label} added`);
    reset();
    reload();
  };

  const handleRemove = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const { error: e } = await supabase
      .from("instructor_payout_methods")
      .delete()
      .eq("id", id);
    if (e) {
      setRows(prev);
      toast.error(e.message);
    } else {
      toast.success("Removed");
    }
  };

  const setPreferred = async (id: string) => {
    if (!user) return;
    const prev = rows;
    setRows((r) => r.map((x) => ({ ...x, is_preferred: x.id === id })));
    // Two-step: clear all, then set the one
    const { error: clearErr } = await supabase
      .from("instructor_payout_methods")
      .update({ is_preferred: false })
      .eq("instructor_id", user.id);
    if (!clearErr) {
      await supabase
        .from("instructor_payout_methods")
        .update({ is_preferred: true })
        .eq("id", id);
    }
    if (clearErr) {
      setRows(prev);
      toast.error(clearErr.message);
    } else {
      toast.success("Preferred method updated");
    }
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Deposit Payouts" back />
      <div className="px-4 py-4 space-y-4">
        <HowPaymentsWorkCard audience="instructor" />
        <div className="tactical-card p-4 border-primary/30 bg-primary/5">
          <div className="text-xs uppercase tracking-wider text-primary font-bold mb-1">
            Where students send your 10% deposit
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Students pay TacLink the $25 booking fee, then send the 10% deposit
            <strong className="text-foreground"> directly to you</strong> via
            Cash App, Venmo, PayPal, or Zelle. Add at least one handle so
            bookings can be confirmed.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : (
          <>
            {rows.length === 0 && !adding && (
              <div className="tactical-card p-6 text-center">
                <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  No payout methods yet.
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Add one to start receiving deposits.
                </p>
              </div>
            )}

            {rows.map((r) => {
              const meta = PAYOUT_META[r.method_type];
              const Icon = METHOD_ICON[r.method_type];
              return (
                <div key={r.id} className="tactical-card p-4 flex items-center gap-3">
                  <div className="h-10 w-14 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold truncate">
                        {meta.label}
                      </div>
                      {r.is_preferred && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wider">
                          <Star className="h-2.5 w-2.5 fill-current" /> Preferred
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate font-mono">
                      {meta.normalizeForDisplay(r.handle)}
                    </div>
                  </div>
                  {!r.is_preferred && (
                    <button
                      onClick={() => setPreferred(r.id)}
                      className="text-muted-foreground hover:text-primary p-2"
                      aria-label="Set preferred"
                      title="Set as preferred"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(r.id)}
                    className="text-muted-foreground hover:text-destructive p-2"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {adding ? (
              <div className="tactical-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Add Payout Method
                  <button
                    onClick={reset}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    {(["cashapp", "venmo", "paypal", "zelle"] as PayoutMethod[]).map(
                      (t) => {
                        const Icon = METHOD_ICON[t];
                        const active = type === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setType(t);
                              setError(null);
                            }}
                            className={`h-14 rounded-md border text-[10px] font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition ${
                              active
                                ? "bg-primary/15 border-primary text-primary"
                                : "bg-background border-border text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {PAYOUT_META[t].label.split(" ")[0]}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    {PAYOUT_META[type].hint}
                  </Label>
                  <Input
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={PAYOUT_META[type].placeholder}
                    maxLength={120}
                    className="bg-background border-border h-11 mt-1"
                  />
                  {error && (
                    <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {error}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={reset}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={saving}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setAdding(true)}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Payout Method
              </Button>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
};

export default PayoutMethods;
