-- Arrival window is assigned by scheduling. It is not customer input and
-- must not be required to insert a booking.
ALTER TABLE public.appointments
  ALTER COLUMN appointment_time DROP NOT NULL;

COMMENT ON COLUMN public.appointments.appointment_time IS
  'Route arrival window label assigned by scheduling. Null when a window has not been generated. A null window must not block or roll back a booking.';

COMMENT ON COLUMN public.pets.rabies_status IS
  'Optional rabies status. Not required to create a pet profile or complete a booking. Certificate upload is also optional.';
