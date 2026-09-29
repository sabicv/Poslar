-- =====================================================================
-- X-Files · 0003 storage
--
-- job-files (private): photos, documents, signatures, module backups.
--   Path: {tenant_id}/{job_id|asset_id}/...   Priced documents under
--   {tenant_id}/owner/... are readable by the owner only.
-- branding (public): workshop logos. Path: {tenant_id}/logo_*.png
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-files', 'job-files', false, 26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/octet-stream', 'text/csv']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- job-files: first folder is the workshop; "owner" as second folder is owner-only.
drop policy if exists "job_files_select" on storage.objects;
create policy "job_files_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and ((storage.foldername(name))[2] is distinct from 'owner' or public.is_owner())
  );

drop policy if exists "job_files_insert" on storage.objects;
create policy "job_files_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and ((storage.foldername(name))[2] is distinct from 'owner' or public.is_owner())
  );

drop policy if exists "job_files_update" on storage.objects;
create policy "job_files_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and ((storage.foldername(name))[2] is distinct from 'owner' or public.is_owner())
  )
  with check (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and ((storage.foldername(name))[2] is distinct from 'owner' or public.is_owner())
  );

drop policy if exists "job_files_delete" on storage.objects;
create policy "job_files_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and ((storage.foldername(name))[2] is distinct from 'owner' or public.is_owner())
  );

-- branding: public read (bucket flag), writes by the workshop owner only.
drop policy if exists "branding_insert" on storage.objects;
create policy "branding_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = public.auth_tenant_id()::text and public.is_owner());

drop policy if exists "branding_update" on storage.objects;
create policy "branding_update" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = public.auth_tenant_id()::text and public.is_owner())
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = public.auth_tenant_id()::text and public.is_owner());

drop policy if exists "branding_delete" on storage.objects;
create policy "branding_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = public.auth_tenant_id()::text and public.is_owner());
