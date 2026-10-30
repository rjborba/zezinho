-- Run after all migrations. Only temporary test data is written, then rolled back.
begin;
set local role anon;

do $$
declare
  test_id uuid;
  original_medication jsonb := '{"dosage":{"components":[{"amount":25,"unit":"mg"}]},"stockPerDose":1,"posology":{"type":"daily","timesPerDay":1,"times":["20:00"],"notes":""},"period":{"type":"indefinite"},"administrationRoute":"oral","customRoute":""}';
  original_history_count integer;
begin
  insert into public.items(name, kind, unit, medication, requires_special_control)
  values ('Special control test ' || gen_random_uuid(), 'medicamento', 'unidade', original_medication, true)
  returning id into test_id;

  insert into public.stock_entries(item_id, entry_type, quantity, remaining_quantity)
  values (test_id, 'adjustment', 0, 20);
  select count(*) into original_history_count from public.medication_schedule_history where item_id = test_id;

  if not (select requires_special_control from public.items where id = test_id) then
    raise exception 'Creating a flagged medication failed';
  end if;
  update public.items set requires_special_control = false where id = test_id;
  if (select requires_special_control from public.items where id = test_id) then
    raise exception 'Clearing special control failed';
  end if;
  update public.items set requires_special_control = true where id = test_id;
  if not (select requires_special_control from public.items where id = test_id) then
    raise exception 'Setting special control failed';
  end if;
  if (select medication from public.items where id = test_id) is distinct from original_medication
    or (select count(*) from public.medication_schedule_history where item_id = test_id) <> original_history_count
    or (select remaining_quantity from public.stock_entries where item_id = test_id) <> 20 then
    raise exception 'Changing special control modified medication, schedule history, or stock';
  end if;
end;
$$;

rollback;
