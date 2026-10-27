-- Exercise the real public API role; no test rows survive this transaction.
begin;
set local role anon;
do $$
declare
  test_item uuid;
  movement uuid;
begin
  insert into public.items(name, unit, kind)
  values ('Stock adjustment QA ' || gen_random_uuid(), 'unidade', 'item')
  returning id into test_item;
  insert into public.stock_entries(item_id, quantity, remaining_quantity)
  values (test_item, 10, 2);
  if not exists (select 1 from public.stock_entries where item_id = test_item and entry_type = 'purchase') then
    raise exception 'Old purchases must default to purchase';
  end if;
  insert into public.stock_entries(item_id, entry_type, quantity, remaining_quantity, created_at)
  values (test_item, 'adjustment', 0, 0, '2030-01-01T02:59:00Z')
  returning id into movement;
  update public.stock_entries set remaining_quantity = 7 where id = movement;
  if not exists (select 1 from public.stock_entries where id = movement and remaining_quantity = 7 and quantity = 0) then
    raise exception 'Adjustment editing failed';
  end if;
  begin
    insert into public.stock_entries(item_id, entry_type, quantity, remaining_quantity) values (test_item, 'purchase', 0, 2);
    raise exception 'Zero purchases must fail';
  exception when check_violation then null;
  end;
  begin
    insert into public.stock_entries(item_id, entry_type, quantity, remaining_quantity) values (test_item, 'adjustment', 1, 2);
    raise exception 'Adjustments cannot contain purchased quantity';
  exception when check_violation then null;
  end;
  begin
    insert into public.stock_entries(item_id, entry_type, quantity, remaining_quantity) values (test_item, 'adjustment', 0, -1);
    raise exception 'Negative balance must fail';
  exception when check_violation then null;
  end;
  begin
    insert into public.stock_entries(item_id, entry_type, quantity, remaining_quantity) values (test_item, 'invalid', 1, 2);
    raise exception 'Unknown types must fail';
  exception when check_violation then null;
  end;
  begin
    update public.stock_entries set entry_type = 'purchase' where id = movement;
    raise exception 'Public callers must not convert movement types';
  exception when insufficient_privilege then null;
  end;
  delete from public.stock_entries where id = movement;
  if exists (select 1 from public.stock_entries where id = movement) then
    raise exception 'Adjustment deletion failed';
  end if;
end;
$$;
rollback;
