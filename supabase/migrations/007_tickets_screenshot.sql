-- Colonne URL de la capture d'écran
alter table public.tickets add column if not exists screenshot_url text;

-- Créer le bucket tickets-screenshots (public) puis exécuter les policies ci-dessous.
-- Si le bucket existe déjà, créer manuellement dans Dashboard > Storage : "tickets-screenshots", public.

-- Policy : les utilisateurs connectés peuvent uploader dans leur dossier user_id
drop policy if exists "Users can upload own ticket screenshots" on storage.objects;
create policy "Users can upload own ticket screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'tickets-screenshots'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public read ticket screenshots" on storage.objects;
create policy "Public read ticket screenshots"
  on storage.objects for select
  using (bucket_id = 'tickets-screenshots');
