-- Run this once in Supabase SQL Editor to enable music, ebooks, and other downloads.
alter table public.apps
  add column if not exists content_type text not null default 'app',
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists file_content_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'apps_content_type_check'
      and conrelid = 'public.apps'::regclass
  ) then
    alter table public.apps
      add constraint apps_content_type_check
      check (content_type in ('app','music','ebook','document','video','other'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'apps_file_size_bytes_check'
      and conrelid = 'public.apps'::regclass
  ) then
    alter table public.apps
      add constraint apps_file_size_bytes_check
      check (file_size_bytes is null or file_size_bytes > 0);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'downloads',
  'downloads',
  true,
  52428800,
  array[
    'application/vnd.android.package-archive','application/octet-stream',
    'audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/flac','audio/webm',
    'application/pdf','application/epub+zip','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4','video/webm','video/quicktime','application/zip'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
