-- Run this whole file in Supabase > SQL Editor.
create table admins (user_id uuid primary key references auth.users on delete cascade);
create or replace function is_admin() returns boolean language sql security definer stable
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create table apps (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, short_desc text not null,
  description text not null default '', features text[] not null default '{}',
  category text not null, icon_url text, screenshots text[] not null default '{}',
  min_android text not null default '5.0', featured boolean not null default false,
  published boolean not null default false, downloads integer not null default 0,
  created_at timestamptz not null default now());
create table versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps on delete cascade,
  version text not null, apk_path text not null, size_bytes bigint not null,
  notes text not null default '', released_at timestamptz not null default now());

alter table admins enable row level security;
alter table apps enable row level security;
alter table versions enable row level security;
create policy "admin reads self" on admins for select using (user_id = auth.uid());
create policy "public reads published" on apps for select using (published or is_admin());
create policy "admin writes apps" on apps for all using (is_admin()) with check (is_admin());
create policy "public reads versions" on versions for select using (
  is_admin() or exists (select 1 from apps a where a.id = app_id and a.published));
create policy "admin writes versions" on versions for all using (is_admin()) with check (is_admin());

-- Visitors can only bump the counter through this function.
create or replace function record_download(p_app uuid) returns void language sql security definer
as $$ update apps set downloads = downloads + 1 where id = p_app and published $$;
grant execute on function record_download(uuid) to anon, authenticated;

-- Storage: server-side size/type limits (free plan max is 50 MB per file).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('apks','apks',true,52428800,array['application/vnd.android.package-archive','application/octet-stream']),
 ('images','images',true,5242880,array['image/png','image/jpeg','image/webp']);
create policy "admin uploads" on storage.objects for insert to authenticated with check (is_admin());
create policy "admin updates" on storage.objects for update to authenticated using (is_admin());
create policy "admin deletes" on storage.objects for delete to authenticated using (is_admin());

-- First listing: no APK is invented. Upload the real APK in the admin dashboard.
insert into apps (slug,name,short_desc,description,features,category,min_android,published)
values ('dlbc-bible-puzzle','DLBC Bible Puzzle','A Bible puzzle game.',
 'DLBC Bible Puzzle. Edit this description in the admin dashboard.',
 array['Bible-themed puzzles'],'Games','5.0',false);
