alter table public.stock_entries
  add column entry_type text not null default 'purchase'
  constraint stock_entries_entry_type_check check (entry_type in ('purchase', 'adjustment'));

alter table public.stock_entries drop constraint stock_entries_quantity_check;
alter table public.stock_entries add constraint stock_entries_movement_amounts_check check (
  (entry_type = 'purchase' and quantity > 0)
  or (entry_type = 'adjustment' and quantity = 0 and remaining_quantity is not null)
);

comment on column public.stock_entries.entry_type is
'purchase adds purchased quantity to the reported remaining balance; adjustment sets an absolute balance without a purchase.';
comment on column public.stock_entries.remaining_quantity is
'Balance before a purchase, or absolute stock balance at the reference timestamp for an adjustment.';

-- Existing RLS policies and column-scoped UPDATE grants remain unchanged.
-- In particular, anon cannot change entry_type on an existing movement.
