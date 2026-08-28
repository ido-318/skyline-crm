-- Private bucket for customer passport images, one folder per customer id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'passports',
  'passports',
  false,
  5242880, -- 5 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Unlike the public-schema tables (see 20260828185625_revoke_excess_grants.sql),
-- storage.objects is owned by supabase_storage_admin: our migration role has
-- no grant authority over the broad SELECT/INSERT/UPDATE/DELETE/... privileges
-- that role already granted anon/authenticated, so REVOKE ALL against them is
-- a documented no-op here, not a fix — Supabase's storage security model is
-- RLS-only by design, table grants stay broad. The two policies below are the
-- real (and only effective) gate: insert (upload) and select (read/preview),
-- with no update/delete policy, so those verbs match zero rows under RLS.
grant select, insert on storage.objects to anon, authenticated;

create policy "passports insert" on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'passports');

create policy "passports select" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'passports');
