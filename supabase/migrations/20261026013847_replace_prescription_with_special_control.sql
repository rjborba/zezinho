-- Replace the broad prescription flag with the narrower special-control flag.
-- Keep the old migration intact; the column is renamed rather than duplicated.
ALTER TABLE public.items
  RENAME COLUMN requires_prescription TO requires_special_control;

COMMENT ON COLUMN public.items.requires_special_control IS
  'Manually reviewed special-control classification under Portaria SVS/MS 344/98 in Brazil. Not a general prescription requirement or antibiotic prescription-retention flag.';

-- Only the two active C1 medications reviewed for this inventory remain marked.
UPDATE public.items
SET requires_special_control = (name IN ('Quetiapina', 'Mirtazapina'))
WHERE kind = 'medicamento'
  AND archived_at IS NULL
  AND requires_special_control IS DISTINCT FROM (name IN ('Quetiapina', 'Mirtazapina'));
