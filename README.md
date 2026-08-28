# Skyline CRM

A classroom demo CRM for a fictional airline, built on Supabase (Postgres + Row-Level
Security + Storage) with a plain HTML/CSS/JavaScript frontend — no framework, no
build step, no `supabase-js` dependency.

## What it does

- Lists **customers**, **flights**, and **bookings** (bookings joined with customer
  name and flight destination).
- Lets you create a new **booking** from a form.
- Lets you upload a **passport photo** per customer and shows a small preview.

## Architecture

The browser talks directly to Supabase's auto-generated APIs over `fetch()`:

- **PostgREST** (`/rest/v1/...`) for all CRUD on `customers`, `flights`, `bookings`.
  Joins (e.g. bookings → customer name + flight destination) use PostgREST's
  resource embedding (`select=id,customers(name),flights(destination)`), which
  follows the foreign keys server-side — no manual joins in JS.
- **Storage API** (`/storage/v1/...`) for passport photo uploads and previews.

There is no backend server: `web/` is static HTML/CSS/JS you can open with any
static file server. All authorization is enforced by Postgres **Row-Level
Security (RLS)** and **Storage RLS policies**, not by hiding anything client-side.

### Database schema

```
customers(id, name, email)
flights(id, destination, depart_at)
bookings(id, customer_id → customers, flight_id → flights)
```

### Access model

The app runs fully unauthenticated (classroom demo — no login), using only
Supabase's `anon` publishable API key. That key is **not a secret**: Supabase
documents it as safe to ship in client-side code. It is meaningless without the
RLS policies below, which are the actual security boundary:

| Resource | anon / authenticated can... | Cannot |
|---|---|---|
| `customers`, `flights` | `SELECT` | INSERT / UPDATE / DELETE |
| `bookings` | `SELECT`, `INSERT` | UPDATE / DELETE |
| Storage bucket `passports` | `INSERT`, `SELECT` (scoped to this bucket only) | UPDATE / DELETE, any other bucket |

Table-level `GRANT`s are pruned to match this exactly (Supabase grants broader
default privileges on new tables; the migrations explicitly `REVOKE` the excess).
Storage's own table (`storage.objects`) keeps Supabase's broader default grants
(that table isn't owned by this project), but since no `UPDATE`/`DELETE` policy
exists for the `passports` bucket, those operations are denied by RLS regardless.

### Passport photos

- Private Storage bucket named `passports` — no public URLs.
- Upload restricted to `image/jpeg`, `image/png`, `image/webp`, 5 MiB max
  (enforced by the bucket itself, not just the client).
- Each upload is stored at `passports/<customer_id>/<timestamp>-<filename>` — a
  fresh object every time, never an overwrite, so only an `INSERT` policy is
  ever needed.
- Previews use a short-lived **signed URL** (`/storage/v1/object/sign/...`),
  since the bucket is private. Creating one requires the same `SELECT` RLS
  policy as any other read.

## Project layout

```
supabase/
  config.toml               Supabase CLI project config
  migrations/                Schema, RLS policies, and Storage bucket setup, in order
  seed.sql                   Synthetic demo data (5 customers, 5 flights, 6 bookings)

web/
  index.html                 Page structure: customers / flights / bookings panels + booking form
  styles.css                 Plain CSS, no framework
  config.js                  Supabase project URL + anon/publishable key (safe client-side)
  app.js                     All app logic: REST + Storage calls, rendering, upload handling
```

## Running it locally

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and log in.
2. Link this project to your own Supabase project:
   ```
   supabase link --project-ref <your-project-ref>
   ```
3. Push the schema and seed data:
   ```
   supabase db push
   supabase db push --include-seed
   ```
4. Update `web/config.js` with your project's URL and anon/publishable key
   (find it in the Supabase dashboard under Project Settings → API).
5. Serve the `web/` folder with any static server, e.g.:
   ```
   cd web && python3 -m http.server 8765
   ```
6. Open `http://localhost:8765/index.html`.

## Security notes

- The only credential this app ever uses is the `anon` **publishable** key —
  never the `service_role` key, a database password, or an access token.
- Because this is an unauthenticated classroom demo, every row and every
  storage object in this project is readable by anyone holding that key.
  **Do not use this schema or access model for real customer/PII data** —
  the passport-photo feature in particular is meant to illustrate Storage RLS
  mechanics, not to be a template for handling real identity documents.
