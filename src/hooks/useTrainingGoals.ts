import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProgress } from '@/hooks/useMyProgress';

export type GoalType = 'course_count' | 'category_count' | 'specific_category' | 'custom';

export interface TrainingGoal {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  goal_type: GoalType;
  target_count: number;
  category: string | null;
  deadline: string | null;
  completed_manually: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalEvent {
  id: string;
  goal_id: string;
  student_id: string;
  event_type: 'marked_complete' | 'marked_incomplete';
  created_at: string;
}

export interface GoalWithProgress extends TrainingGoal {
  current: number;
  isComplete: boolean;
  percent: number;
  events: GoalEvent[];
  lastEvent: GoalEvent | null;
}

export const useTrainingGoals = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: bookings = [] } = useMyProgress();

  const goalsQuery = useQuery({
    queryKey: ['training-goals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_goals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingGoal[];
    },
  });

  const attended = bookings.filter((b) => b.status === 'attended');

  const compute = (g: TrainingGoal): GoalWithProgress => {
    let current = 0;
    let isComplete = false;
    const inWindow = (date?: string | null) => {
      if (!g.deadline) return true;
      if (!date) return false;
      return new Date(date) <= new Date(g.deadline);
    };

    if (g.goal_type === 'course_count') {
      current = attended.filter((b) => inWindow(b.attended_at)).length;
      isComplete = current >= g.target_count;
    } else if (g.goal_type === 'category_count' || g.goal_type === 'specific_category') {
      const cat = g.category?.toLowerCase();
      current = attended.filter(
        (b) => b.course?.category?.toLowerCase() === cat && inWindow(b.attended_at),
      ).length;
      isComplete = current >= g.target_count;
    } else {
      current = g.completed_manually ? g.target_count : 0;
      isComplete = g.completed_manually;
    }

    // Manual checkbox override — applies to any goal type.
    if (g.completed_manually) {
      isComplete = true;
      current = Math.max(current, g.target_count);
    }

    const percent = Math.min(100, Math.round((current / g.target_count) * 100));
    return { ...g, current, isComplete, percent };
  };

  const goals: GoalWithProgress[] = (goalsQuery.data ?? []).map(compute);

  const createGoal = useMutation({
    mutationFn: async (input: Omit<TrainingGoal, 'id' | 'student_id' | 'created_at' | 'updated_at' | 'completed_manually' | 'completed_at'> & { completed_manually?: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('training_goals').insert({
        ...input,
        student_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-goals'] }),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TrainingGoal> & { id: string }) => {
      const { error } = await supabase.from('training_goals').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-goals'] }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-goals'] }),
  });

  return { goals, isLoading: goalsQuery.isLoading, createGoal, updateGoal, deleteGoal };
};
