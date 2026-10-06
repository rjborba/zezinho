-- Do not invent times for existing medications. Once times are supplied,
-- require one valid HH:mm value per dose for daily and weekly schedules.
ALTER TABLE public.items
  ADD CONSTRAINT items_medication_dose_times_check CHECK ((
    CASE
      WHEN kind = 'item' THEN true
      WHEN medication#>>'{posology,type}' NOT IN ('daily', 'weekly')
        OR NOT (medication->'posology' ? 'times') THEN true
      WHEN jsonb_typeof(medication#>'{posology,times}') = 'array' THEN
        jsonb_array_length(medication#>'{posology,times}') = (medication#>>'{posology,timesPerDay}')::integer
        AND NOT jsonb_path_exists(
          medication#>'{posology,times}',
          'strict $[*] ? (@.type() != "string" || !(@ like_regex "^([01][0-9]|2[0-3]):[0-5][0-9]$"))'
        )
      ELSE false
    END
  ) IS TRUE);
