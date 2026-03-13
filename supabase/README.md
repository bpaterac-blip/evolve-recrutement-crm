# Configuration Supabase

## 1. Créer la table `profiles`

Dans le SQL Editor de votre projet Supabase, exécutez le contenu du fichier `migrations/001_create_profiles.sql`.

Ou copiez-collez ce SQL :

```sql
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

alter table profiles enable row level security;
create policy "Allow all operations on profiles" on profiles for all using (true) with check (true);
alter publication supabase_realtime add table profiles;
```

## 2. Activer Realtime (si la commande SQL échoue)

Dashboard Supabase → Database → Replication → cochez la table `profiles` pour `supabase_realtime`.

## 3. Variables d'environnement

Remplissez `.env.local` avec vos clés Supabase :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
