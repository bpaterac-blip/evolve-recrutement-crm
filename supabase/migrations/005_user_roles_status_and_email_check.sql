-- Colonne statut dans user_roles : 'active' | 'suspended'
alter table public.user_roles
  add column if not exists status text default 'active';

-- Vérifier qu'un email a le droit d'accès (existe dans user_roles via auth.users)
create or replace function public.email_has_access(check_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = check_email limit 1;
  if uid is null then
    return false;
  end if;
  return exists (
    select 1 from public.user_roles
    where user_id = uid and (status is null or status != 'suspended')
  );
end;
$$;
