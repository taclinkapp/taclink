
drop policy if exists "Instructors can create their own courses" on public.courses;

create policy "Instructors can create their own courses"
  on public.courses
  for insert
  to authenticated
  with check (auth.uid() = instructor_id);
