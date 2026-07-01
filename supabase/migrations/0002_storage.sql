-- ============================================================================
-- Storage: private bucket for asset versions and brief attachments.
-- Path convention: {studio_id}/{project_id}/...  so the first path segment is
-- always the owning studio, letting RLS scope object access by membership.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Read
create policy "assets_read_studio_members"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assets'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );

-- Upload
create policy "assets_insert_studio_members"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );

-- Update (e.g. replace)
create policy "assets_update_studio_members"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'assets'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );

-- Delete
create policy "assets_delete_studio_members"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assets'
    and public.is_studio_member(((storage.foldername(name))[1])::uuid)
  );
