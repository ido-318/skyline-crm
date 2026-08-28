-- Narrow the passports bucket to exactly the three image types the app
-- accepts (the original migration also allowed HEIC/HEIF, which the app's
-- upload UI never offered). Enforced at the bucket level, so this holds even
-- if a caller bypasses the client-side check.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'passports';
