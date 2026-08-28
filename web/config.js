// Supabase project connection details for the browser client.
//
// SUPABASE_ANON_KEY is a *publishable* key, not a secret: it identifies the
// project and the "anon" Postgres role, and it is meant to be shipped in
// client-side code (see https://supabase.com/docs/guides/api/api-keys).
// Everything it can do is governed by Row Level Security policies on the
// server, not by keeping this value hidden. It is the *service_role* key
// that must never appear here or anywhere client-side.
window.SUPABASE_CONFIG = {
  url: "https://wpiyspjsxsnzvxlyxvuv.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaXlzcGpzeHNuenZ4bHl4dnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzcyNDMsImV4cCI6MjEwMzUxMzI0M30.vF9ZU867dii6RgUWfe7eophTnIQbDPCVw54nca4XFfw",
};
