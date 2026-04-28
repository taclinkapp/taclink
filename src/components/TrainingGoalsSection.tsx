import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Target, Plus, Trash2, CheckCircle2, Calendar, Loader2, Flag } from 'lucide-react';
import { useTrainingGoals, type GoalType, type GoalWithProgress } from '@/hooks/useTrainingGoals';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRESETS: Array<{
  label: string;
  title: string;
  goal_type: GoalType;
  target_count: number;
  category?: string;
  description?: string;
}> = [
  { label: 'Attend 5 courses this year', title: 'Attend 5 courses this year', goal_type: 'course_count', target_count: 5 },
  { label: 'Complete a Pistol course', title: 'Complete a Pistol course', goal_type: 'specific_category', target_count: 1, category: 'Pistol' },
  { label: 'Complete a Rifle course', title: 'Complete a Rifle course', goal_type: 'specific_category', target_count: 1, category: 'Rifle' },
  { label: '3 CCW courses this year', title: 'Complete 3 CCW courses', goal_type: 'category_count', target_count: 3, category: 'CCW' },
  { label: 'Attend 10 total courses', title: 'Attend 10 total courses', goal_type: 'course_count', target_count: 10 },
];

export const TrainingGoalsSection = () => {
  const { goals, isLoading, createGoal, deleteGoal, updateGoal } = useTrainingGoals();
  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          <h2 className="font-stencil text-sm font-bold uppercase tracking-wider">
            Training Goals
          </h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="bg-card border-border h-8 gap-1">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">New</span>
            </Button>
          </DialogTrigger>
          <NewGoalDialog
            onClose={() => setOpen(false)}
            onCreate={async (input) => {
              try {
                await createGoal.mutateAsync(input);
                toast.success('Goal added');
                setOpen(false);
              } catch (e: any) {
                toast.error(e?.message ?? 'Failed to create goal');
              }
            }}
            saving={createGoal.isPending}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-6">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="tactical-card p-6 text-center">
          <Target className="h-9 w-9 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Set a training goal to stay focused — like attending 5 courses this year, or completing a pistol course.
          </p>
          <Button
            onClick={() => setOpen(true)}
            className="bg-primary text-primary-foreground font-bold"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Set Your First Goal
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onDelete={async () => {
                if (!confirm('Delete this goal?')) return;
                try {
                  await deleteGoal.mutateAsync(g.id);
                  toast.success('Goal deleted');
                } catch (e: any) {
                  toast.error(e?.message ?? 'Failed to delete');
                }
              }}
              onToggleManual={async () => {
                if (g.goal_type !== 'custom') return;
                await updateGoal.mutateAsync({
                  id: g.id,
                  completed_manually: !g.completed_manually,
                  completed_at: !g.completed_manually ? new Date().toISOString() : null,
                });
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const GoalCard = ({
  goal,
  onDelete,
  onToggleManual,
}: {
  goal: GoalWithProgress;
  onDelete: () => void;
  onToggleManual: () => void;
}) => {
  const overdue = goal.deadline && !goal.isComplete && new Date(goal.deadline) < new Date();
  return (
    <li
      className={cn(
        'tactical-card p-3',
        goal.isComplete && 'border-primary/50',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleManual}
          disabled={goal.goal_type !== 'custom'}
          className={cn(
            'mt-0.5 h-7 w-7 rounded-full flex items-center justify-center border flex-shrink-0',
            goal.isComplete
              ? 'bg-primary/20 border-primary text-primary'
              : 'border-border text-muted-foreground',
            goal.goal_type === 'custom' && 'cursor-pointer hover:border-primary',
          )}
          aria-label={goal.isComplete ? 'Completed' : 'In progress'}
        >
          {goal.isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={cn('font-bold text-sm', goal.isComplete && 'text-primary')}>
            {goal.title}
          </div>
          {goal.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{goal.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {goal.category && (
              <span className="uppercase tracking-wider">{goal.category}</span>
            )}
            {goal.deadline && (
              <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
                <Calendar className="h-3 w-3" />
                {new Date(goal.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
          {goal.goal_type !== 'custom' && (
            <div className="mt-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">
                  {goal.current} / {goal.target_count}
                </span>
                <span className="text-[11px] font-bold text-primary">{goal.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className={cn('h-full transition-all', goal.isComplete ? 'bg-primary' : 'bg-primary/70')}
                  style={{ width: `${goal.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive p-1 -mt-1 -mr-1"
          aria-label="Delete goal"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
};

const NewGoalDialog = ({
  onClose,
  onCreate,
  saving,
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description: string | null;
    goal_type: GoalType;
    target_count: number;
    category: string | null;
    deadline: string | null;
  }) => Promise<void>;
  saving: boolean;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('course_count');
  const [target, setTarget] = useState(5);
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState('');

  const applyPreset = (p: typeof PRESETS[number]) => {
    setTitle(p.title);
    setGoalType(p.goal_type);
    setTarget(p.target_count);
    setCategory(p.category ?? '');
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error('Give your goal a title');
      return;
    }
    if ((goalType === 'category_count' || goalType === 'specific_category') && !category.trim()) {
      toast.error('Pick a category');
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || null,
      goal_type: goalType,
      target_count: goalType === 'specific_category' ? 1 : Math.max(1, target),
      category: category.trim() || null,
      deadline: deadline || null,
    });
  };

  return (
    <DialogContent className="bg-surface border-border max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-base">New Training Goal</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Quick Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="text-[11px] px-2.5 py-1.5 rounded-full bg-card border border-border hover:border-primary/60 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="goal-title" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Title</Label>
          <Input
            id="goal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Complete a pistol course"
            className="bg-card border-border mt-1"
          />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Goal Type</Label>
          <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
            <SelectTrigger className="bg-card border-border mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="course_count">Total courses attended</SelectItem>
              <SelectItem value="category_count">Courses in a category</SelectItem>
              <SelectItem value="specific_category">Complete any course in a category</SelectItem>
              <SelectItem value="custom">Custom (mark complete manually)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(goalType === 'category_count' || goalType === 'specific_category') && (
          <div>
            <Label htmlFor="goal-category" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Category</Label>
            <Input
              id="goal-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Pistol, Rifle, CCW"
              className="bg-card border-border mt-1"
            />
          </div>
        )}

        {goalType !== 'specific_category' && goalType !== 'custom' && (
          <div>
            <Label htmlFor="goal-target" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Target Count</Label>
            <Input
              id="goal-target"
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value) || 1)}
              className="bg-card border-border mt-1"
            />
          </div>
        )}

        <div>
          <Label htmlFor="goal-deadline" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Deadline (optional)</Label>
          <Input
            id="goal-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-card border-border mt-1"
          />
        </div>

        <div>
          <Label htmlFor="goal-desc" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Notes (optional)</Label>
          <Textarea
            id="goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why is this goal important to you?"
            className="bg-card border-border mt-1 min-h-20"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onClose} variant="outline" className="flex-1 bg-card border-border">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground font-bold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Goal'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};
