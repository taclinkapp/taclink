
ALTER TABLE public.waiver_signatures
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_full_name text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text,
  ADD COLUMN IF NOT EXISTS guardian_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_date_of_birth date,
  ADD COLUMN IF NOT EXISTS esign_consent_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS esign_disclosure_version text,
  ADD COLUMN IF NOT EXISTS esign_consent_initials text;

-- Validation: if marked minor, guardian fields must be present.
CREATE OR REPLACE FUNCTION public.validate_waiver_signature_guardian()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_minor = true THEN
    IF NEW.guardian_full_name IS NULL OR length(trim(NEW.guardian_full_name)) < 3 THEN
      RAISE EXCEPTION 'Guardian full name is required for minors';
    END IF;
    IF NEW.guardian_relationship IS NULL OR length(trim(NEW.guardian_relationship)) < 2 THEN
      RAISE EXCEPTION 'Guardian relationship is required for minors';
    END IF;
    IF NEW.guardian_signed_at IS NULL THEN
      NEW.guardian_signed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_waiver_signature_guardian ON public.waiver_signatures;
CREATE TRIGGER trg_validate_waiver_signature_guardian
BEFORE INSERT OR UPDATE ON public.waiver_signatures
FOR EACH ROW EXECUTE FUNCTION public.validate_waiver_signature_guardian();
