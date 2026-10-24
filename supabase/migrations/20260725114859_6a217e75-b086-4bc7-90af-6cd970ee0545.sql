
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_device_fp text;

CREATE UNIQUE INDEX IF NOT EXISTS user_access_trial_device_fp_unique
  ON public.user_access (trial_device_fp)
  WHERE trial_device_fp IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_access_is_trial_idx
  ON public.user_access (is_trial) WHERE is_trial = true;
