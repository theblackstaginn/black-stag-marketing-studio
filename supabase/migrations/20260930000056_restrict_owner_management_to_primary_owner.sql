drop policy if exists "Owners can view brand memberships" on public.brand_memberships;
drop policy if exists "Primary owner can view brand memberships" on public.brand_memberships;
create policy "Primary owner can view brand memberships"
on public.brand_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_memberships.brand_id
      and b.owner_id = (select auth.uid())
  )
  or user_id = (select auth.uid())
);

drop policy if exists "Owners can add brand memberships" on public.brand_memberships;
drop policy if exists "Primary owner can add brand memberships" on public.brand_memberships;
create policy "Primary owner can add brand memberships"
on public.brand_memberships
for insert
to authenticated
with check (
  exists (
    select 1
    from public.brands b
    where b.id = brand_memberships.brand_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can update brand memberships" on public.brand_memberships;
drop policy if exists "Primary owner can update brand memberships" on public.brand_memberships;
create policy "Primary owner can update brand memberships"
on public.brand_memberships
for update
to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_memberships.brand_id
      and b.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.brands b
    where b.id = brand_memberships.brand_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can delete brand memberships" on public.brand_memberships;
drop policy if exists "Primary owner can delete brand memberships" on public.brand_memberships;
create policy "Primary owner can delete brand memberships"
on public.brand_memberships
for delete
to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_memberships.brand_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can view brand owner invites" on public.brand_owner_invites;
drop policy if exists "Primary owner can view brand owner invites" on public.brand_owner_invites;
create policy "Primary owner can view brand owner invites"
on public.brand_owner_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_owner_invites.brand_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can create brand owner invites" on public.brand_owner_invites;
drop policy if exists "Primary owner can create brand owner invites" on public.brand_owner_invites;
create policy "Primary owner can create brand owner invites"
on public.brand_owner_invites
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and exists (
    select 1
    from public.brands b
    where b.id = brand_owner_invites.brand_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can update brand owner invites" on public.brand_owner_invites;
drop policy if exists "Primary owner can update brand owner invites" on public.brand_owner_invites;
create policy "Primary owner can update brand owner invites"
on public.brand_owner_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_owner_invites.brand_id
      and b.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.brands b
    where b.id = brand_owner_invites.brand_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can delete brand owner invites" on public.brand_owner_invites;
drop policy if exists "Primary owner can delete brand owner invites" on public.brand_owner_invites;
create policy "Primary owner can delete brand owner invites"
on public.brand_owner_invites
for delete
to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_owner_invites.brand_id
      and b.owner_id = (select auth.uid())
  )
);
