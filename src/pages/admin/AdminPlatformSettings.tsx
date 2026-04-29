import { useState } from 'react';
import { AdminHeader } from './AdminDashboard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformSettings, useUpdateSetting } from '@/hooks/useAdminData';
import { Loader2 } from 'lucide-react';

export const AdminPlatformSettings = () => {
  const { data: settings = [], isLoading } = usePlatformSettings();
  const update = useUpdateSetting();

  if (isLoading) {
    return (
      <>
        <AdminHeader title="Platform Settings" subtitle="Global configuration" />
        <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </>
    );
  }

  // Group by category
  const groups: Record<string, typeof settings> = {};
  settings.forEach((s) => {
    (groups[s.category] ??= []).push(s);
  });

  return (
    <>
      <AdminHeader title="Platform Settings" subtitle="Global configuration · live values" />
      <div className="p-8 space-y-6 max-w-3xl">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="tactical-card p-6">
            <h2 className="font-bold mb-4 capitalize">{cat}</h2>
            <div className="space-y-5">
              {items.map((s) => (
                <SettingRow
                  key={s.key}
                  setting={s}
                  onSave={(value) => update.mutate({ key: s.key, value, before: s.value })}
                  saving={update.isPending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

function SettingRow({ setting, onSave, saving }: { setting: any; onSave: (v: any) => void; saving: boolean }) {
  const [val, setVal] = useState<string>(JSON.stringify(setting.value));
  const isBool = typeof setting.value === 'boolean';
  const isNumber = typeof setting.value === 'number';
  const isString = typeof setting.value === 'string';
  const dirty = val !== JSON.stringify(setting.value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{setting.key}</Label>
          {setting.description && <p className="text-[11px] text-muted-foreground">{setting.description}</p>}
        </div>
        {isBool && (
          <Switch
            checked={JSON.parse(val) === true}
            onCheckedChange={(c) => onSave(c)}
            disabled={saving}
          />
        )}
      </div>
      {!isBool && (
        <div className="flex gap-2">
          {isNumber ? (
            <Input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="bg-background border-border h-10"
            />
          ) : isString ? (
            <Input
              value={JSON.parse(val)}
              onChange={(e) => setVal(JSON.stringify(e.target.value))}
              className="bg-background border-border h-10"
            />
          ) : (
            <Textarea
              value={val}
              onChange={(e) => setVal(e.target.value)}
              rows={2}
              className="bg-background border-border font-mono text-xs"
            />
          )}
          <Button
            disabled={!dirty || saving}
            onClick={() => {
              try {
                const parsed = isNumber ? Number(val) : JSON.parse(val);
                onSave(parsed);
              } catch {
                onSave(val);
              }
            }}
            className="h-10 bg-primary text-primary-foreground font-bold"
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
