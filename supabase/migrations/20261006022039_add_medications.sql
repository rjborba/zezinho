-- Existing items remain ordinary items; stock entries are not modified.
ALTER TABLE public.items
  ADD COLUMN kind text NOT NULL DEFAULT 'item',
  ADD COLUMN medication jsonb;

ALTER TABLE public.items
  ADD CONSTRAINT items_kind_check CHECK (kind IN ('item', 'medicamento')),
  DROP CONSTRAINT items_unit_check,
  ADD CONSTRAINT items_unit_check CHECK (
    (kind = 'item' AND unit IN ('unidade', 'ml', 'kg'))
    OR (kind = 'medicamento' AND unit IN ('unidade', 'ml', 'mg', 'g', 'gotas'))
  ),
  ADD CONSTRAINT items_medication_check CHECK ((CASE
    WHEN kind = 'item' THEN medication IS NULL
    ELSE
      jsonb_typeof(medication) = 'object'
      AND jsonb_typeof(medication->'posology') = 'object'
      AND CASE medication->'posology'->>'type'
        WHEN 'daily' THEN
          jsonb_typeof(medication->'posology'->'timesPerDay') = 'number'
          AND medication->'posology'->>'timesPerDay' ~ '^[1-9][0-9]?$'
          AND jsonb_typeof(medication->'posology'->'notes') = 'string'
          AND length(medication->'posology'->>'notes') <= 1000
        WHEN 'weekly' THEN
          jsonb_typeof(medication->'posology'->'timesPerDay') = 'number'
          AND medication->'posology'->>'timesPerDay' ~ '^[1-9][0-9]?$'
          AND jsonb_typeof(medication->'posology'->'notes') = 'string'
          AND length(medication->'posology'->>'notes') <= 1000
          AND jsonb_typeof(medication->'posology'->'daysOfWeek') = 'array'
          AND jsonb_array_length(medication->'posology'->'daysOfWeek') BETWEEN 1 AND 7
          AND medication->'posology'->'daysOfWeek' <@ '[0,1,2,3,4,5,6]'::jsonb
        WHEN 'free' THEN
          jsonb_typeof(medication->'posology'->'instructions') = 'string'
          AND length(btrim(medication->'posology'->>'instructions')) BETWEEN 1 AND 1000
        ELSE false
      END
      AND medication->>'administrationRoute' IN
        ('oral', 'orodispersivel', 'sublingual', 'topica', 'inalatoria', 'injetavel', 'retal', 'outra')
      AND jsonb_typeof(medication->'customRoute') = 'string'
      AND CASE WHEN medication->>'administrationRoute' = 'outra'
        THEN length(btrim(medication->>'customRoute')) BETWEEN 1 AND 120
        ELSE medication->>'customRoute' = ''
      END
      AND jsonb_typeof(medication->'period') = 'object'
      AND CASE medication->'period'->>'type'
        WHEN 'indefinite' THEN true
        WHEN 'range' THEN
          jsonb_typeof(medication->'period'->'startDate') = 'string'
          AND jsonb_typeof(medication->'period'->'endDate') = 'string'
          AND medication->'period'->>'startDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND medication->'period'->>'endDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND (medication->'period'->>'startDate')::date <= (medication->'period'->>'endDate')::date
        ELSE false
      END
      AND jsonb_typeof(medication->'dosage') = 'object'
      AND jsonb_typeof(medication->'dosage'->'amount') = 'number'
      AND (medication->'dosage'->>'amount')::numeric > 0
      AND (medication->'dosage'->>'amount')::numeric <= 999999999
      AND (medication->'dosage'->>'amount')::numeric = round((medication->'dosage'->>'amount')::numeric, 3)
      AND jsonb_typeof(medication->'dosage'->'unit') = 'string'
      AND length(btrim(medication->'dosage'->>'unit')) BETWEEN 1 AND 32
  END) IS TRUE);

-- Retain the shared-inventory RLS model and limit edits to catalog fields.
GRANT UPDATE (kind, medication) ON public.items TO anon;

CREATE OR REPLACE FUNCTION public.validate_stock_entry_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  item_unit text;
BEGIN
  SELECT unit INTO item_unit FROM public.items WHERE id = NEW.item_id;
  IF item_unit IN ('unidade', 'gotas') AND (
    NEW.quantity <> trunc(NEW.quantity)
    OR NEW.remaining_quantity <> trunc(NEW.remaining_quantity)
  ) THEN
    RAISE EXCEPTION 'Unit and drop quantities must be whole numbers';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_stock_entry_quantity() FROM PUBLIC, anon, authenticated;
