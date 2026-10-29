-- Optional owner birthday; existing profile RLS continues to control access.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_birthday_valid
  CHECK (birthday IS NULL OR (birthday >= DATE '1900-01-01' AND birthday <= CURRENT_DATE));
GRANT UPDATE (birthday) ON TABLE public.profiles TO authenticated;
COMMENT ON COLUMN public.profiles.birthday IS 'Optional customer birthday.';
