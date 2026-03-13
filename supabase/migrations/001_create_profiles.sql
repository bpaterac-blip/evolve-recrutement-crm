-- Table profiles pour Evolve Recruiter CRM
-- Colonnes: first_name, last_name, company, title, city, email, linkedin_url,
--           source, score, stage, maturity, sequence_lemlist, integration_date
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  first_name text,
  last_name text,
  company text,
  title text,
  city text,
  email text,
  linkedin_url text,
  source text default 'Chasse LinkedIn',
  score int default 0,
  stage text default 'R0',
  maturity text default 'Froid',
  sequence_lemlist text,
  integration_date text default '—',
  created_at timestamptz default now()
);

-- Activer Row Level Security (ajustez les policies selon votre auth)
alter table profiles enable row level security;

-- Policy permissive pour développement (à restreindre en prod)
create policy "Allow all operations on profiles" on profiles
  for all using (true) with check (true);

-- Activer Realtime pour la synchronisation en temps réel
alter publication supabase_realtime add table profiles;
