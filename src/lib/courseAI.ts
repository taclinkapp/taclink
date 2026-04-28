import { supabase } from '@/integrations/supabase/client';

export type CourseAIField = 'title' | 'description' | 'capacity' | 'price';

export interface CourseAIContext {
  title?: string;
  category?: string;
  description?: string;
  duration_minutes?: number;
  city?: string;
  state?: string;
  capacity?: number | string;
  price?: number | string;
}

export async function suggestCourseField(field: CourseAIField, course: CourseAIContext): Promise<string> {
  const { data, error } = await supabase.functions.invoke('course-ai', {
    body: { action: 'suggest_field', field, course },
  });
  if (error) throw new Error(error.message || 'AI suggestion failed');
  if (data?.error) throw new Error(data.error);
  return (data?.result ?? '').toString().trim();
}

export async function generateCourseWaiver(course: CourseAIContext): Promise<string> {
  const { data, error } = await supabase.functions.invoke('course-ai', {
    body: { action: 'generate_waiver', course },
  });
  if (error) throw new Error(error.message || 'AI generation failed');
  if (data?.error) throw new Error(data.error);
  return (data?.result ?? '').toString().trim();
}
