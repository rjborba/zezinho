-- Shared, no-login inventory for the first app version.
-- Add Supabase Auth and owner columns before storing sensitive data.

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  unit text not null check (unit in ('unidade', 'ml', 'kg')),
  created_at timestamptz not null default now()
);

create unique index items_name_unique_ci on public.items (lower(trim(name)));

create table public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index stock_entries_item_id_idx on public.stock_entries (item_id);
create index stock_entries_created_at_idx on public.stock_entries (created_at desc);

create function public.validate_stock_entry_quantity()
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

  if item_unit = 'unidade' and new.quantity <> trunc(new.quantity) then
    raise exception 'Unit quantities must be whole numbers';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_stock_entry_quantity() from public, anon, authenticated;

create trigger validate_stock_entry_quantity_before_write
before insert or update on public.stock_entries
for each row execute function public.validate_stock_entry_quantity();

alter table public.items enable row level security;
alter table public.stock_entries enable row level security;

revoke all on table public.items from anon, authenticated;
revoke all on table public.stock_entries from anon, authenticated;

grant select, insert on table public.items to anon;
grant select, insert on table public.stock_entries to anon;

create policy "Public inventory items can be read"
on public.items for select
to anon
using (true);

create policy "Public inventory items can be created"
on public.items for insert
to anon
with check (true);

create policy "Public stock entries can be read"
on public.stock_entries for select
to anon
using (true);

create policy "Public stock entries can be created"
on public.stock_entries for insert
to anon
with check (true);
