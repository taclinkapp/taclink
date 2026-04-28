import { useQuery } from "@tanstack/react-query";
import {
  fetchPublishedCourses,
  fetchCourseById,
  fetchInstructorCourses,
} from "@/lib/courses";

export const usePublishedCourses = () =>
  useQuery({ queryKey: ["courses", "published"], queryFn: fetchPublishedCourses });

export const useCourse = (id: string | undefined) =>
  useQuery({
    queryKey: ["courses", id],
    queryFn: () => fetchCourseById(id as string),
    enabled: !!id,
  });

export const useInstructorCourses = (instructorId: string | undefined) =>
  useQuery({
    queryKey: ["courses", "instructor", instructorId],
    queryFn: () => fetchInstructorCourses(instructorId as string),
    enabled: !!instructorId,
  });
