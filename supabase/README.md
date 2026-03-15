# Configuration Supabase

## Dépannage : erreur à l'ajout de profil

Ouvrez la **console du navigateur** (F12 → Console) pour voir l'erreur exacte :
- `[Supabase] Erreur add profile:` — détail complet
- `column "xxx" does not exist` → la table a une structure différente, exécutez la migration
- `permission denied` / `row-level security` → vérifiez les policies RLS
- `relation "profiles" does not exist` → exécutez `001_create_profiles.sql`

## 1. Créer la table `profiles`

Dans le SQL Editor de votre projet Supabase, exécutez le contenu du fichier `migrations/001_create_profiles.sql`.

Ou copiez-collez ce SQL :

```sql
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

## 4. Edge Function Netrows (enrichissement LinkedIn)

Pour l'enrichissement via Netrows (évite CORS) :

1. Déployer la fonction : `supabase functions deploy netrows-enrich`
2. Configurer le secret : `supabase secrets set NETROWS_API_KEY=votre_cle_netrows`
