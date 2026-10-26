-- Accept legacy strengths during rollout. Editing a record saves components;
-- existing medication and stock data do not need to be rewritten.
CREATE FUNCTION public.is_valid_medication_dosage(dosage jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  components jsonb;
  component jsonb;
  component_count integer;
  amount numeric;
BEGIN
  IF jsonb_typeof(dosage) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  IF dosage ? 'components' THEN
    -- A dosage has exactly one representation, never a competing scalar value.
    IF dosage ? 'amount' OR dosage ? 'unit'
      OR jsonb_typeof(dosage->'components') IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;
    components := dosage->'components';
  ELSE
    components := jsonb_build_array(dosage);
  END IF;

  component_count := jsonb_array_length(components);
  IF component_count NOT BETWEEN 1 AND 10 THEN
    RETURN false;
  END IF;

  FOR component IN SELECT value FROM jsonb_array_elements(components) LOOP
    IF jsonb_typeof(component) IS DISTINCT FROM 'object'
      OR jsonb_typeof(component->'amount') IS DISTINCT FROM 'number'
      OR jsonb_typeof(component->'unit') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    amount := (component->>'amount')::numeric;
    IF amount <= 0 OR amount > 999999999 OR amount <> round(amount, 3)
      OR length(btrim(component->>'unit')) NOT BETWEEN 1 AND 32 THEN
      RETURN false;
    END IF;

    IF component_count > 1 OR component ? 'ingredient' THEN
      IF jsonb_typeof(component->'ingredient') IS DISTINCT FROM 'string'
        OR length(btrim(component->>'ingredient')) NOT BETWEEN 1 AND 80 THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.is_valid_medication_dosage(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_medication_dosage(jsonb) TO anon, authenticated, service_role;

-- Preserve all existing medication rules; only the dosage shape changes.
ALTER TABLE public.items
  DROP CONSTRAINT items_medication_check,
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
      AND public.is_valid_medication_dosage(medication->'dosage')
  END) IS TRUE);
