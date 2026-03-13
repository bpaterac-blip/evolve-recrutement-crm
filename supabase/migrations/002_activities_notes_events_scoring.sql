-- Table activities : trace des changements de stade/maturité
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  activity_type text not null,
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

-- Table notes : notes par profil
create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  content text,
  created_at timestamptz default now()
);

-- Table events : événements clés (RDV, etc.)
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  event_type text not null,
  event_date text,
  description text,
  created_at timestamptz default now()
);

-- Table scoring_feedback : corrections de score
create table if not exists scoring_feedback (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  previous_score int,
  new_score int not null,
  feedback_note text,
  created_at timestamptz default now()
);

alter table activities enable row level security;
alter table notes enable row level security;
alter table events enable row level security;
alter table scoring_feedback enable row level security;

create policy "Allow all on activities" on activities for all using (true) with check (true);
create policy "Allow all on notes" on notes for all using (true) with check (true);
create policy "Allow all on events" on events for all using (true) with check (true);
create policy "Allow all on scoring_feedback" on scoring_feedback for all using (true) with check (true);
