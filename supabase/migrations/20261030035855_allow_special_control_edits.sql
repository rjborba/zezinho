-- Follow the existing shared inventory RLS policies and column-scoped grants.
grant update (requires_special_control) on table public.items to anon;
