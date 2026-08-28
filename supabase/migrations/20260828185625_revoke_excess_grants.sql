-- Supabase's default privileges auto-grant ALL table privileges to anon/authenticated
-- on new public tables, which included UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES.
-- Strip those back down to exactly what this demo needs.
revoke all on public.customers from anon, authenticated;
revoke all on public.flights from anon, authenticated;
revoke all on public.bookings from anon, authenticated;

grant select on public.customers to anon, authenticated;
grant select on public.flights to anon, authenticated;
grant select, insert on public.bookings to anon, authenticated;
