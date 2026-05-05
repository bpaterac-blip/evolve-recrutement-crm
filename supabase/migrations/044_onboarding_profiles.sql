-- ── Table onboarding_profiles ─────────────────────────────────────────────────
-- Stocke l'état d'avancement de chaque CGP dans le process d'onboarding.
-- profile_id est la PK (= id du profil dans la table profiles).

create table if not exists onboarding_profiles (
  profile_id   uuid primary key references profiles(id) on delete cascade,
  fn           text        not null default '',
  ln           text        not null default '',
  co           text                 default '',
  email        text                 default '',
  phone        text                 default '',
  siren        text                 default '',
  owner        text                 default '',
  current_step int         not null default 1,
  start_date   date        not null default current_date,
  session      text                 default '',
  done         jsonb       not null default '{}',
  step_notes   jsonb       not null default '{}',
  task_notes   jsonb       not null default '{}',
  is_completed boolean     not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Mise à jour automatique de updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists onboarding_profiles_updated_at on onboarding_profiles;
create trigger onboarding_profiles_updated_at
  before update on onboarding_profiles
  for each row execute procedure set_updated_at();

-- RLS
alter table onboarding_profiles enable row level security;

create policy "onboarding_select" on onboarding_profiles
  for select using (auth.role() = 'authenticated');

create policy "onboarding_insert" on onboarding_profiles
  for insert with check (auth.role() = 'authenticated');

create policy "onboarding_update" on onboarding_profiles
  for update using (auth.role() = 'authenticated');

create policy "onboarding_delete" on onboarding_profiles
  for delete using (auth.role() = 'authenticated');
