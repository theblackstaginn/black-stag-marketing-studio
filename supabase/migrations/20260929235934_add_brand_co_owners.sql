create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create table if not exists public.brand_memberships (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);

alter table public.brand_memberships enable row level security;

revoke all on table public.brand_memberships from anon, authenticated;
grant select, insert, update, delete
  on table public.brand_memberships
  to authenticated;

create table if not exists public.brand_owner_invites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null check (length(trim(email)) > 3),
  role text not null default 'owner'
    check (role in ('owner')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists brand_owner_invites_pending_unique
  on public.brand_owner_invites (brand_id, lower(email))
  where accepted_at is null;

alter table public.brand_owner_invites enable row level security;

revoke all on table public.brand_owner_invites from anon, authenticated;
grant select, insert, update, delete
  on table public.brand_owner_invites
  to authenticated;

create or replace function private.has_brand_owner_access(
  requested_brand_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.brands b
      where b.id = requested_brand_id
        and b.owner_id = (select auth.uid())
    )
    or
    exists (
      select 1
      from public.brand_memberships bm
      where bm.brand_id = requested_brand_id
        and bm.user_id = (select auth.uid())
        and bm.role = 'owner'
    );
$$;

revoke all on function private.has_brand_owner_access(uuid) from public;
revoke all on function private.has_brand_owner_access(uuid) from anon;
grant execute on function private.has_brand_owner_access(uuid) to authenticated;

create or replace function public.owns_brand(
  requested_brand_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_brand_owner_access(requested_brand_id);
$$;

revoke all on function public.owns_brand(uuid) from public;
revoke all on function public.owns_brand(uuid) from anon;
grant execute on function public.owns_brand(uuid) to authenticated;

drop policy if exists "Users can view own brands" on public.brands;
drop policy if exists "Owners can view brands" on public.brands;

create policy "Owners can view brands"
on public.brands
for select
to authenticated
using (
  public.owns_brand(id)
);

drop policy if exists "Users can update own brands" on public.brands;
drop policy if exists "Owners can update brands" on public.brands;

create policy "Owners can update brands"
on public.brands
for update
to authenticated
using (
  public.owns_brand(id)
)
with check (
  public.owns_brand(id)
);

drop policy if exists "Owners can view brand memberships" on public.brand_memberships;
create policy "Owners can view brand memberships"
on public.brand_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.owns_brand(brand_id)
);

drop policy if exists "Owners can add brand memberships" on public.brand_memberships;
create policy "Owners can add brand memberships"
on public.brand_memberships
for insert
to authenticated
with check (
  public.owns_brand(brand_id)
);

drop policy if exists "Owners can update brand memberships" on public.brand_memberships;
create policy "Owners can update brand memberships"
on public.brand_memberships
for update
to authenticated
using (
  public.owns_brand(brand_id)
)
with check (
  public.owns_brand(brand_id)
);

drop policy if exists "Owners can delete brand memberships" on public.brand_memberships;
create policy "Owners can delete brand memberships"
on public.brand_memberships
for delete
to authenticated
using (
  public.owns_brand(brand_id)
);

drop policy if exists "Owners can view brand owner invites" on public.brand_owner_invites;
create policy "Owners can view brand owner invites"
on public.brand_owner_invites
for select
to authenticated
using (
  public.owns_brand(brand_id)
);

drop policy if exists "Owners can create brand owner invites" on public.brand_owner_invites;
create policy "Owners can create brand owner invites"
on public.brand_owner_invites
for insert
to authenticated
with check (
  public.owns_brand(brand_id)
  and invited_by = (select auth.uid())
);

drop policy if exists "Owners can update brand owner invites" on public.brand_owner_invites;
create policy "Owners can update brand owner invites"
on public.brand_owner_invites
for update
to authenticated
using (
  public.owns_brand(brand_id)
)
with check (
  public.owns_brand(brand_id)
);

drop policy if exists "Owners can delete brand owner invites" on public.brand_owner_invites;
create policy "Owners can delete brand owner invites"
on public.brand_owner_invites
for delete
to authenticated
using (
  public.owns_brand(brand_id)
);

create or replace function private.apply_owner_invites_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.brand_memberships (
    brand_id,
    user_id,
    role,
    invited_by
  )
  select
    i.brand_id,
    new.id,
    i.role,
    i.invited_by
  from public.brand_owner_invites i
  where i.accepted_at is null
    and lower(i.email) = lower(new.email)
  on conflict (brand_id, user_id)
  do update set
    role = excluded.role,
    invited_by = excluded.invited_by;

  update public.brand_owner_invites i
  set
    accepted_by = new.id,
    accepted_at = now()
  where i.accepted_at is null
    and lower(i.email) = lower(new.email);

  return new;
end;
$$;

revoke all on function private.apply_owner_invites_for_user() from public;
revoke all on function private.apply_owner_invites_for_user() from anon;
revoke all on function private.apply_owner_invites_for_user() from authenticated;

drop trigger if exists on_auth_user_apply_brand_owner_invites on auth.users;
create trigger on_auth_user_apply_brand_owner_invites
after insert on auth.users
for each row
execute function private.apply_owner_invites_for_user();

create or replace function private.apply_existing_user_for_owner_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_user_id uuid;
begin
  select u.id
  into existing_user_id
  from auth.users u
  where lower(u.email) = lower(new.email)
  order by u.created_at asc
  limit 1;

  if existing_user_id is null then
    return new;
  end if;

  insert into public.brand_memberships (
    brand_id,
    user_id,
    role,
    invited_by
  )
  values (
    new.brand_id,
    existing_user_id,
    new.role,
    new.invited_by
  )
  on conflict (brand_id, user_id)
  do update set
    role = excluded.role,
    invited_by = excluded.invited_by;

  update public.brand_owner_invites
  set
    accepted_by = existing_user_id,
    accepted_at = now()
  where id = new.id;

  return new;
end;
$$;

revoke all on function private.apply_existing_user_for_owner_invite() from public;
revoke all on function private.apply_existing_user_for_owner_invite() from anon;
revoke all on function private.apply_existing_user_for_owner_invite() from authenticated;

drop trigger if exists brand_owner_invites_apply_existing_user on public.brand_owner_invites;
create trigger brand_owner_invites_apply_existing_user
after insert on public.brand_owner_invites
for each row
execute function private.apply_existing_user_for_owner_invite();

drop policy if exists "Users can view own brand assets" on storage.objects;
create policy "Users can view own brand assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'brand-assets'
  and exists (
    select 1
    from public.brands b
    where b.id::text = (storage.foldername(name))[2]
      and public.owns_brand(b.id)
  )
);

drop policy if exists "Users can upload own brand assets" on storage.objects;
create policy "Users can upload own brand assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'brand-assets'
  and exists (
    select 1
    from public.brands b
    where b.id::text = (storage.foldername(name))[2]
      and public.owns_brand(b.id)
  )
);

drop policy if exists "Users can update own brand assets" on storage.objects;
create policy "Users can update own brand assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'brand-assets'
  and exists (
    select 1
    from public.brands b
    where b.id::text = (storage.foldername(name))[2]
      and public.owns_brand(b.id)
  )
)
with check (
  bucket_id = 'brand-assets'
  and exists (
    select 1
    from public.brands b
    where b.id::text = (storage.foldername(name))[2]
      and public.owns_brand(b.id)
  )
);

drop policy if exists "Users can delete own brand assets" on storage.objects;
create policy "Users can delete own brand assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'brand-assets'
  and exists (
    select 1
    from public.brands b
    where b.id::text = (storage.foldername(name))[2]
      and public.owns_brand(b.id)
  )
);
