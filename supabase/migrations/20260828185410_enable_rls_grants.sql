alter table public.customers enable row level security;
alter table public.flights enable row level security;
alter table public.bookings enable row level security;

grant select on public.customers to anon, authenticated;
grant select on public.flights to anon, authenticated;
grant select, insert on public.bookings to anon, authenticated;

create policy "allow read customers" on public.customers
  for select
  to anon, authenticated
  using (true);

create policy "allow read flights" on public.flights
  for select
  to anon, authenticated
  using (true);

create policy "allow read bookings" on public.bookings
  for select
  to anon, authenticated
  using (true);

create policy "allow insert bookings" on public.bookings
  for insert
  to anon, authenticated
  with check (true);
