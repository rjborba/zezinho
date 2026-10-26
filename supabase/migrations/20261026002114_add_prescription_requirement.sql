ALTER TABLE public.items
  ADD COLUMN requires_prescription boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.items.requires_prescription IS
  'Manually reviewed prescription requirement for dispensing in Brazil. Does not distinguish special control or prescription retention.';

-- Backfill only the active medications reviewed in October 2026.
-- Do not infer requirements for archived records or future registrations.
UPDATE public.items
SET requires_prescription = true
WHERE kind = 'medicamento'
  AND archived_at IS NULL
  AND name IN (
    'Aciclovir',
    'Alopurinol',
    'Bisoprolol',
    'Clopidogrel',
    'Dapagliflozina',
    'Mirtazapina',
    'Ondansetrona',
    'Pantoprazol',
    'Quetiapina',
    'Rosuvastatina',
    'Sulfametoxazol + trimetoprima'
  );
