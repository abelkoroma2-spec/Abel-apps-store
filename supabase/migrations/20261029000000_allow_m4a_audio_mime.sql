do $$
begin
  if not exists (select 1 from storage.buckets where id = 'downloads') then
    raise exception 'The downloads storage bucket does not exist. Apply the downloads bucket setup before this migration.';
  end if;

  update storage.buckets
  set allowed_mime_types = array_append(
    coalesce(allowed_mime_types, array[]::text[]),
    'audio/x-m4a'
  )
  where id = 'downloads'
    and not ('audio/x-m4a' = any(coalesce(allowed_mime_types, array[]::text[])));
end
$$;
