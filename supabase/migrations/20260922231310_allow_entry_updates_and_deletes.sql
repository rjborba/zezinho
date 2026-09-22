grant update (item_id, quantity, remaining_quantity)
on table public.stock_entries to anon;

grant delete on table public.stock_entries to anon;

create policy "Public stock entries can be updated"
on public.stock_entries for update
to anon
using (true)
with check (remaining_quantity is not null);

create policy "Public stock entries can be deleted"
on public.stock_entries for delete
to anon
using (true);
