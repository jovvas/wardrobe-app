-- ============================================================
-- Wardrobe App — Supabase Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

create table if not exists wardrobe_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,   -- Tops | Bottoms | Dresses | Outerwear | Shoes | Accessories | Bags
  colour      text not null,
  photo_url   text,
  created_at  timestamptz default now()
);

create table if not exists outfit_logs (
  id          uuid primary key default gen_random_uuid(),
  item_ids    uuid[] not null,
  context     text,
  worn_on     date default current_date,
  created_at  timestamptz default now()
);

-- ── Row-Level Security ────────────────────────────────────────
-- v1 has no user accounts, so we disable RLS to allow the
-- anon key to read and write freely. Re-enable when you add auth.

alter table wardrobe_items disable row level security;
alter table outfit_logs    disable row level security;

-- ── Storage bucket for item photos ───────────────────────────
-- Creates a public bucket. If you get a "bucket already exists"
-- error just skip this block — it means you already have it.

insert into storage.buckets (id, name, public)
values ('wardrobe-photos', 'wardrobe-photos', true)
on conflict (id) do nothing;

-- Allow anyone to read photos (public bucket)
drop policy if exists "Public read wardrobe-photos" on storage.objects;
create policy "Public read wardrobe-photos"
  on storage.objects for select
  using (bucket_id = 'wardrobe-photos');

-- Allow anyone to upload photos (no auth in v1)
drop policy if exists "Anon upload wardrobe-photos" on storage.objects;
create policy "Anon upload wardrobe-photos"
  on storage.objects for insert
  with check (bucket_id = 'wardrobe-photos');

-- Allow anyone to delete photos (for item deletion)
drop policy if exists "Anon delete wardrobe-photos" on storage.objects;
create policy "Anon delete wardrobe-photos"
  on storage.objects for delete
  using (bucket_id = 'wardrobe-photos');
