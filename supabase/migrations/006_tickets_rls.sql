-- Table tickets (création si elle n'existe pas déjà)
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  titre text not null,
  description text,
  statut text default 'Ouvert',
  priorite text default 'Normale',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tickets enable row level security;

-- Utilisateurs : voir et créer uniquement leurs propres tickets
create policy "Users can view own tickets"
  on public.tickets for select
  using (auth.uid() = user_id);

create policy "Users can insert own tickets"
  on public.tickets for insert
  with check (auth.uid() = user_id);

-- Admins utilisent le client service_role (bypass RLS) pour tout voir/modifier
-- Aucune policy supplémentaire nécessaire pour l'admin
