alter table public.items
add column archived_at timestamptz;

create index items_archived_at_idx on public.items (archived_at);

grant update (archived_at) on table public.items to anon;

create policy "Public inventory items can be archived"
on public.items for update
to anon
using (true)
with check (true);
