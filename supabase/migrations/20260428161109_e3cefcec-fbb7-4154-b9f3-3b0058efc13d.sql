-- Courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  capacity INTEGER,
  location_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX idx_courses_status ON public.courses(status);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Anyone can view published courses
CREATE POLICY "Published courses are viewable by everyone"
ON public.courses FOR SELECT
USING (status = 'published' OR auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'));

-- Instructors can create their own courses
CREATE POLICY "Instructors can create their own courses"
ON public.courses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = instructor_id AND public.has_role(auth.uid(), 'instructor'));

-- Instructors can update their own courses
CREATE POLICY "Instructors can update their own courses"
ON public.courses FOR UPDATE
TO authenticated
USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'));

-- Instructors can delete their own courses
CREATE POLICY "Instructors can delete their own courses"
ON public.courses FOR DELETE
TO authenticated
USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER courses_set_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();