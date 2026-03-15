-- Table user_roles : rôles des utilisateurs (admin / user)
create table if not exists user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  role text default 'user',
  created_at timestamptz default now()
);

alter table user_roles enable row level security;

create policy "Allow all" on user_roles for all using (true) with check (true);

-- Créer automatiquement une entrée user_roles à chaque nouvel utilisateur
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger sur auth.users (nécessite les droits sur le schéma auth)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
