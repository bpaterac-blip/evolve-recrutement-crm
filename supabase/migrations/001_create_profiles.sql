-- Table profiles pour Evolve Recruiter CRM
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  fn text,
  ln text,
  co text,
  ti text,
  city text,
  src text default 'Chasse LinkedIn',
  sc int default 0,
  stg text default 'R0',
  mat text default 'Froid',
  integ text default '—',
  dt text,
  mail text,
  li text,
  notes text default '',
  acts jsonb default '[]',
  created_at timestamptz default now()
);

-- Activer Row Level Security (ajustez les policies selon votre auth)
alter table profiles enable row level security;

-- Policy permissive pour développement (à restreindre en prod)
create policy "Allow all operations on profiles" on profiles
  for all using (true) with check (true);

-- Activer Realtime pour la synchronisation en temps réel
alter publication supabase_realtime add table profiles;
