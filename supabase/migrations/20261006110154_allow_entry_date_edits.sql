-- Keep the existing shared-inventory RLS policies and column-level permissions.
-- The entry timestamp is the user-selected date and time of the purchase.
grant update (created_at) on table public.stock_entries to anon;
