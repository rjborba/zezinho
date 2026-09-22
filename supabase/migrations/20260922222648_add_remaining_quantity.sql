alter table public.stock_entries
add column remaining_quantity numeric(12, 3);

alter table public.stock_entries
add constraint stock_entries_remaining_quantity_non_negative
check (remaining_quantity >= 0);

comment on column public.stock_entries.remaining_quantity is
'Quantity still available immediately before the new purchase is stored.';

create or replace function public.validate_stock_entry_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item_unit text;
begin
  select unit into item_unit
  from public.items
  where id = new.item_id;

  if item_unit = 'unidade' and (
    new.quantity <> trunc(new.quantity)
    or new.remaining_quantity <> trunc(new.remaining_quantity)
  ) then
    raise exception 'Unit quantities must be whole numbers';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_stock_entry_quantity() from public, anon, authenticated;

drop policy "Public stock entries can be created" on public.stock_entries;

create policy "Public stock entries can be created"
on public.stock_entries for insert
to anon
with check (remaining_quantity is not null);
