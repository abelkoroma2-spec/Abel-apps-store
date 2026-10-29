do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'The public.is_admin() function is missing. Apply the base Supabase schema before this migration.';
  end if;

  if not exists (select 1 from storage.buckets where id = 'downloads') then
    raise exception 'The downloads storage bucket does not exist. Apply the downloads bucket setup before this migration.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admin uploads downloads'
  ) then
    create policy "admin uploads downloads"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'downloads' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'apps'
      and policyname = 'admin writes apps'
  ) then
    create policy "admin writes apps"
      on public.apps
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end
$$;
