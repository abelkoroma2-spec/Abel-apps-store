do $$
begin
  if not exists (select 1 from storage.buckets where id = 'downloads') then
    raise exception 'The downloads storage bucket does not exist. Apply the downloads bucket setup before this migration.';
  end if;

  update storage.buckets as b
  set allowed_mime_types = (
    select array_agg(mime_type order by mime_type)
    from (
      select distinct mime_type
      from unnest(
        coalesce(b.allowed_mime_types, array[]::text[])
        || array[
          'application/vnd.android.package-archive','application/octet-stream',
          'audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/flac','audio/webm',
          'application/pdf','application/epub+zip','text/plain','text/csv',
          'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'video/mp4','video/webm','video/quicktime','application/zip'
        ]::text[]
      ) as allowed_types(mime_type)
      where mime_type is not null
    ) as merged_types
  )
  where b.id = 'downloads';
end
$$;
