-- Trigger/RLS integration checks. All fixtures are rolled back.
begin;
set local role anon;
do $$
declare
  test_item uuid;
  first_schedule jsonb;
  first_timestamp timestamptz;
  med jsonb := '{"dosage":{"amount":400,"unit":"mg"},"stockPerDose":1,"administrationRoute":"oral","customRoute":"","posology":{"type":"daily","timesPerDay":2,"times":["10:00","21:00"],"notes":""},"period":{"type":"indefinite"}}'::jsonb;
begin
  insert into public.items(name,unit,kind,medication)
    values ('Schedule history QA ' || gen_random_uuid(),'unidade','medicamento',med)
    returning id into test_item;
  if (select count(*) from public.medication_schedule_history where item_id=test_item) <> 1 then
    raise exception 'Initial schedule was not captured';
  end if;
  select medication,effective_at into first_schedule,first_timestamp
    from public.medication_schedule_history where item_id=test_item;
  update public.items set medication=jsonb_set(med,'{stockPerDose}','2') where id=test_item;
  if (select count(*) from public.medication_schedule_history where item_id=test_item) <> 2 then
    raise exception 'Changed dose was not versioned';
  end if;
  if not exists (select 1 from public.medication_schedule_history where item_id=test_item and medication=first_schedule and effective_at=first_timestamp) then
    raise exception 'Original schedule was modified';
  end if;
  update public.items set medication=medication where id=test_item;
  if (select count(*) from public.medication_schedule_history where item_id=test_item) <> 2 then
    raise exception 'No-op update created a redundant version';
  end if;
  begin
    insert into public.medication_schedule_history(item_id,medication,unit) values (test_item,med,'unidade');
    raise exception 'Anonymous callers must not forge schedule history';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.medication_schedule_history set medication=null where item_id=test_item;
    raise exception 'Anonymous callers must not rewrite schedule history';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.medication_schedule_history where item_id=test_item;
    raise exception 'Anonymous callers must not delete schedule history';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
