import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePrelaunch } from "@/hooks/usePrelaunch";
import { Link } from "react-router-dom";
import { US_STATES, CATEGORIES } from "@/lib/mockData";
import { toast } from "sonner";
import { Sparkles, MapPin, TrendingUp, Loader2, Calendar, Clock, RefreshCw, Lock } from "lucide-react";

const TEACHABLE = CATEGORIES.filter((c) => c !== "All");

type Insight = {
  summary: string;
  per_category: Array<{
    category: string;
    projected_monthly_students: number;
    demand_level: "low" | "moderate" | "high" | "very_high";
    best_post_day: string;
    best_post_time_local: string;
    rationale: string;
  }>;
  real_signal: Record<string, number>;
  state: string;
  city: string;
};

const demandColor = (level: string) =>
  level === "very_high"
    ? "bg-primary text-primary-foreground"
    : level === "high"
      ? "bg-emerald-500 text-white"
      : level === "moderate"
        ? "bg-amber-500 text-white"
        : "bg-muted text-muted-foreground";

export const InstructorInsights = () => {
  const { user } = useAuth();
  const { isActive } = useSubscription();
  const { data: prelaunch } = usePrelaunch();
  const isPrelaunch = !!prelaunch?.enabled;
  const [serviceState, setServiceState] = useState("");
  const [serviceCity, setServiceCity] = useState("");
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [savingArea, setSavingArea] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);

  useEffect(() => {
    if (!user || !isActive) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("service_state, service_city, service_categories")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setServiceState(data.service_state ?? "");
        setServiceCity(data.service_city ?? "");
        setServiceCategories((data.service_categories as string[]) ?? []);
      }
    })();
  }, [user, isActive]);

  if (!isActive) {
    if (isPrelaunch) return null;
    return (
      <div className="tactical-card border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Local Demand & AI Projections
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              City-level demand insights and posting-time recommendations. Available with Pro.
            </p>
            <Link to="/instructor/subscription" className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline">
              Upgrade to unlock →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const saveArea = async () => {
    if (!user) return;
    setSavingArea(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        service_state: serviceState || null,
        service_city: serviceCity || null,
        service_categories: serviceCategories,
      })
      .eq("id", user.id);
    setSavingArea(false);
    if (error) toast.error(error.message);
    else toast.success("Service area saved");
  };

  const runInsights = async () => {
    if (!serviceState || serviceCategories.length === 0) {
      toast.error("Set your state and at least one category first");
      return;
    }
    setLoading(true);
    setInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("instructor-insights", {
        body: {
          state: serviceState,
          city: serviceCity,
          categories: serviceCategories,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setInsight(data as Insight);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  const toggleCat = (c: string) => {
    setServiceCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  return (
    <div className="tactical-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Local Demand & AI Projections</h3>
      </div>

      {/* Service area editor */}
      <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Your service area
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">State</Label>
            <Select value={serviceState} onValueChange={setServiceState}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">City (optional)</Label>
            <Input
              value={serviceCity}
              onChange={(e) => setServiceCity(e.target.value)}
              placeholder="Houston"
              className="h-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Categories you teach</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {TEACHABLE.map((c) => {
              const on = serviceCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <Button size="sm" onClick={saveArea} disabled={savingArea} className="w-full">
          {savingArea ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save service area"}
        </Button>
      </div>

      <Button
        variant="default"
        onClick={runInsights}
        disabled={loading || !serviceState || serviceCategories.length === 0}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing local demand…
          </>
        ) : insight ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh insights
          </>
        ) : (
          <>
            <TrendingUp className="h-4 w-4 mr-2" /> Generate AI insights
          </>
        )}
      </Button>

      {insight && (
        <div className="space-y-3">
          {insight.summary && (
            <p className="text-sm text-muted-foreground italic">{insight.summary}</p>
          )}
          {insight.per_category.map((p) => {
            const real = insight.real_signal?.[p.category] ?? 0;
            return (
              <div key={p.category} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{p.category}</span>
                    <Badge className={demandColor(p.demand_level)}>{p.demand_level.replace("_", " ")}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-primary">~{p.projected_monthly_students}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">students/mo</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Best day: <span className="font-bold text-foreground">{p.best_post_day}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {p.best_post_time_local}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.rationale}</p>
                {real > 0 && (
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
                    Confirmed: {real} platform booking{real === 1 ? "" : "s"} in last 30d
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground text-center">
            Projections combine real platform data with AI estimates for your region.
          </p>
        </div>
      )}
    </div>
  );
};
