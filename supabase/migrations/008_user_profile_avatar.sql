-- Perfil de usuario: foto de avatar.
-- El bucket de Storage "avatars" (publico, 2MB max, solo imagenes) ya se
-- creo directamente via la API de Storage.

alter table public.users add column if not exists avatar_url text;

-- Cualquiera puede ver los avatares (son publicos, se muestran en toda la app)
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Cada usuario solo puede subir/actualizar/borrar su propio avatar,
-- guardado como avatars/{user_id}/...
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
