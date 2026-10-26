-- Run after all migrations on a test database. All writes are rolled back.
BEGIN;
SET LOCAL ROLE anon;

DO $test$
DECLARE
  dosage jsonb;
  test_medication jsonb := '{"posology":{"type":"daily","timesPerDay":1,"times":["08:00"],"notes":""},"administrationRoute":"oral","customRoute":"","period":{"type":"indefinite"}}';
  combination jsonb := '{"components":[{"ingredient":"Sulfametoxazol","amount":400,"unit":"mg"},{"ingredient":"Trimetoprim","amount":80,"unit":"mg"}]}';
  item_id uuid;
  saved jsonb;
BEGIN
  IF public.is_valid_medication_dosage(NULL) THEN
    RAISE EXCEPTION 'SQL NULL dosage accepted';
  END IF;

  FOR dosage IN SELECT value FROM jsonb_array_elements('[
    {"amount":500,"unit":"mg"},
    {"components":[{"amount":0.125,"unit":"mg/dose"}]},
    {"components":[{"ingredient":"A","amount":1,"unit":"mg"},{"ingredient":"B","amount":25,"unit":"mcg"}]}
  ]') LOOP
    INSERT INTO public.items (name, kind, unit, medication)
    VALUES ('Dosage SQL test ' || gen_random_uuid(), 'medicamento', 'unidade', test_medication || jsonb_build_object('dosage', dosage));
  END LOOP;

  INSERT INTO public.items (name, kind, unit, medication)
  VALUES ('Combination SQL test ' || gen_random_uuid(), 'medicamento', 'unidade', test_medication || jsonb_build_object('dosage', combination, 'stockPerDose', 1))
  RETURNING id INTO item_id;
  SELECT items.medication->'dosage' INTO saved FROM public.items WHERE id = item_id;
  IF saved IS DISTINCT FROM combination THEN
    RAISE EXCEPTION 'Combination dosage did not round-trip';
  END IF;
  UPDATE public.items SET medication = medication || jsonb_build_object('dosage', '{"components":[{"amount":4,"unit":"mg"}]}'::jsonb) WHERE id = item_id;

  FOR dosage IN SELECT value FROM jsonb_array_elements('[
    null, {}, [], 1, {"amount":500}, {"unit":"mg"},
    {"components":null}, {"components":{}}, {"components":[]},
    {"components":[null]}, {"components":[{}]},
    {"components":[{"amount":"400","unit":"mg"}]},
    {"components":[{"amount":0,"unit":"mg"}]},
    {"components":[{"amount":-1,"unit":"mg"}]},
    {"components":[{"amount":0.0001,"unit":"mg"}]},
    {"components":[{"amount":1000000000,"unit":"mg"}]},
    {"components":[{"amount":1,"unit":null}]},
    {"components":[{"amount":1,"unit":" "}]},
    {"components":[{"ingredient":null,"amount":1,"unit":"mg"}]},
    {"components":[{"ingredient":" ","amount":1,"unit":"mg"}]},
    {"components":[{"amount":400,"unit":"mg"},{"ingredient":"B","amount":80,"unit":"mg"}]},
    {"amount":400,"unit":"mg","components":[{"amount":80,"unit":"mg"}]}
  ]') LOOP
    BEGIN
      INSERT INTO public.items (name, kind, unit, medication)
      VALUES ('Invalid dosage ' || gen_random_uuid(), 'medicamento', 'unidade', test_medication || jsonb_build_object('dosage', dosage));
      RAISE EXCEPTION 'Invalid dosage accepted: %', dosage;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;

  SELECT jsonb_build_object('components', jsonb_agg(jsonb_build_object('ingredient', 'A', 'amount', 1, 'unit', 'mg')))
  INTO dosage FROM generate_series(1, 11);
  IF public.is_valid_medication_dosage(dosage) THEN RAISE EXCEPTION 'More than 10 components accepted'; END IF;
  IF NOT public.is_valid_medication_dosage(jsonb_set(dosage, '{components}', (dosage->'components') - 10)) THEN RAISE EXCEPTION '10 components rejected'; END IF;
  IF public.is_valid_medication_dosage(jsonb_build_object('components', jsonb_build_array(jsonb_build_object('ingredient', repeat('x', 81), 'amount', 1, 'unit', 'mg')))) THEN RAISE EXCEPTION 'Long ingredient accepted'; END IF;
  IF public.is_valid_medication_dosage(jsonb_build_object('components', jsonb_build_array(jsonb_build_object('amount', 1, 'unit', repeat('x', 33))))) THEN RAISE EXCEPTION 'Long unit accepted'; END IF;

  BEGIN
    INSERT INTO public.items (name, kind, unit, medication)
    VALUES ('Invalid schedule ' || gen_random_uuid(), 'medicamento', 'unidade', jsonb_set(test_medication || jsonb_build_object('dosage', combination), '{posology,timesPerDay}', '0'));
    RAISE EXCEPTION 'Existing schedule validation lost';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$test$;
ROLLBACK;
