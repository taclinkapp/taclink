import { AdminHeader } from './AdminDashboard';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFeatureFlags, useUpdateFlag } from '@/hooks/useAdminData';
import { Loader2 } from 'lucide-react';

export const AdminFeatureFlags = () => {
  const { data: flags = [], isLoading } = useFeatureFlags();
  const update = useUpdateFlag();

  return (
    <>
      <AdminHeader title="Feature Flags" subtitle="Toggle features for users" />
      <div className="p-8 max-w-3xl">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="tactical-card divide-y divide-border">
            {flags.map((f) => (
              <div key={f.key} className="p-5 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-bold">{f.key}</div>
                  {f.description && <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>}
                  <div className="flex items-center gap-3 mt-2">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Audience</Label>
                    <select
                      value={f.audience}
                      onChange={(e) => update.mutate({ key: f.key, patch: { audience: e.target.value }, before: f })}
                      className="bg-background border border-border rounded h-8 px-2 text-xs"
                    >
                      <option value="all">All</option>
                      <option value="students">Students</option>
                      <option value="instructors">Instructors</option>
                      <option value="admins">Admins</option>
                    </select>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rollout %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={f.rollout_pct}
                      onBlur={(e) => {
                        const n = Math.max(0, Math.min(100, Number(e.target.value)));
                        if (n !== f.rollout_pct) update.mutate({ key: f.key, patch: { rollout_pct: n }, before: f });
                      }}
                      className="bg-background border-border h-8 w-20 text-xs"
                    />
                  </div>
                </div>
                <Switch
                  checked={f.enabled}
                  onCheckedChange={(c) => update.mutate({ key: f.key, patch: { enabled: c }, before: f })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
