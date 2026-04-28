import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Target, Plus, Trash2, CheckCircle2, Calendar, Loader2, Flag, Pencil, History, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useTrainingGoals,
  type GoalType,
  type GoalWithProgress,
  type TrainingGoal,
} from '@/hooks/useTrainingGoals';
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

type GoalFormValues = {
  title: string;
  description: string | null;
  goal_type: GoalType;
  target_count: number;
  category: string | null;
  deadline: string | null;
};

export const TrainingGoalsSection = () => {
  const { goals, isLoading, createGoal, deleteGoal, updateGoal, toggleManualComplete } = useTrainingGoals();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TrainingGoal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TrainingGoal | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          <h2 className="font-stencil text-sm font-bold uppercase tracking-wider">
            Training Goals
          </h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-card border-border h-8 gap-1"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">New</span>
        </Button>
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
            onClick={() => setCreating(true)}
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
              onEdit={() => setEditing(g)}
              onDelete={() => setConfirmDelete(g)}
              onToggleManual={async () => {
                try {
                  await toggleManualComplete.mutateAsync({
                    goal: g,
                    next: !g.completed_manually,
                  });
                } catch (e: any) {
                  toast.error(e?.message ?? 'Failed to update');
                }
              }}
            />
          ))}
        </ul>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <GoalFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          saving={createGoal.isPending}
          onSubmit={async (input) => {
            try {
              await createGoal.mutateAsync(input);
              toast.success('Goal added');
              setCreating(false);
            } catch (e: any) {
              toast.error(e?.message ?? 'Failed to create goal');
            }
          }}
        />
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <GoalFormDialog
            mode="edit"
            initial={editing}
            onClose={() => setEditing(null)}
            saving={updateGoal.isPending}
            onSubmit={async (input) => {
              try {
                await updateGoal.mutateAsync({ id: editing.id, ...input });
                toast.success('Goal updated');
                setEditing(null);
              } catch (e: any) {
                toast.error(e?.message ?? 'Failed to update goal');
              }
            }}
          />
        )}
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.title
                ? `"${confirmDelete.title}" will be permanently removed.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-card border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await deleteGoal.mutateAsync(confirmDelete.id);
                  toast.success('Goal deleted');
                } catch (e: any) {
                  toast.error(e?.message ?? 'Failed to delete');
                } finally {
                  setConfirmDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const GoalCard = ({
  goal,
  onEdit,
  onDelete,
  onToggleManual,
}: {
  goal: GoalWithProgress;
  onEdit: () => void;
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
        <div
          className={cn(
            'mt-0.5 h-7 w-7 rounded-full flex items-center justify-center border flex-shrink-0',
            goal.isComplete
              ? 'bg-primary/20 border-primary text-primary'
              : 'border-border text-muted-foreground',
          )}
          aria-hidden="true"
        >
          {goal.isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-3.5 w-3.5" />}
        </div>
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

          {/* Manual completion checkbox — works for any goal type */}
          <div className="mt-2.5">
            <label
              htmlFor={`goal-complete-${goal.id}`}
              className="flex items-center gap-2 cursor-pointer select-none group"
            >
              <Checkbox
                id={`goal-complete-${goal.id}`}
                checked={goal.completed_manually}
                onCheckedChange={() => onToggleManual()}
                className="h-4 w-4"
              />
              <span
                className={cn(
                  'text-[11px] uppercase tracking-wider font-bold transition-colors',
                  goal.completed_manually
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              >
                {goal.completed_manually ? 'Marked complete' : 'Mark complete'}
              </span>
            </label>

            <GoalHistory goal={goal} />
          </div>
        </div>
        <div className="flex flex-col gap-1 -mt-1 -mr-1">
          <button
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-card/80 transition-colors"
            aria-label="Edit goal"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-card/80 transition-colors"
            aria-label="Delete goal"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
};

const GoalFormDialog = ({
  mode,
  initial,
  onClose,
  onSubmit,
  saving,
}: {
  mode: 'create' | 'edit';
  initial?: TrainingGoal;
  onClose: () => void;
  onSubmit: (values: GoalFormValues) => Promise<void>;
  saving: boolean;
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [goalType, setGoalType] = useState<GoalType>(initial?.goal_type ?? 'course_count');
  const [target, setTarget] = useState(initial?.target_count ?? 5);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');

  // Re-sync when the editing target changes
  useEffect(() => {
    if (mode === 'edit' && initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? '');
      setGoalType(initial.goal_type);
      setTarget(initial.target_count);
      setCategory(initial.category ?? '');
      setDeadline(initial.deadline ?? '');
    }
  }, [initial, mode]);

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
    onSubmit({
      title: title.trim(),
      description: description?.trim() || null,
      goal_type: goalType,
      target_count: goalType === 'specific_category' ? 1 : Math.max(1, target),
      category: category?.trim() || null,
      deadline: deadline || null,
    });
  };

  return (
    <DialogContent className="bg-surface border-border max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-base">
          {mode === 'edit' ? 'Edit Training Goal' : 'New Training Goal'}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {mode === 'create' && (
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
        )}

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
              value={category ?? ''}
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
            value={deadline ?? ''}
            onChange={(e) => setDeadline(e.target.value)}
            className="bg-card border-border mt-1"
          />
        </div>

        <div>
          <Label htmlFor="goal-desc" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Notes (optional)</Label>
          <Textarea
            id="goal-desc"
            value={description ?? ''}
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'edit' ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};
