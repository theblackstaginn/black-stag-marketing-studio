create index if not exists brand_memberships_user_id_idx
  on public.brand_memberships(user_id);

create index if not exists brand_memberships_invited_by_idx
  on public.brand_memberships(invited_by);

create index if not exists brand_owner_invites_invited_by_idx
  on public.brand_owner_invites(invited_by);

create index if not exists brand_owner_invites_accepted_by_idx
  on public.brand_owner_invites(accepted_by);

drop policy if exists "Authenticated users can create asset folders" on public.asset_folders;
drop policy if exists "Authenticated users can delete asset folders" on public.asset_folders;
drop policy if exists "Authenticated users can update asset folders" on public.asset_folders;
drop policy if exists "Authenticated users can view asset folders" on public.asset_folders;
drop policy if exists asset_folders_delete_authenticated on public.asset_folders;
drop policy if exists asset_folders_insert_authenticated on public.asset_folders;
drop policy if exists asset_folders_select_authenticated on public.asset_folders;
drop policy if exists asset_folders_update_authenticated on public.asset_folders;

drop policy if exists "Owners can manage asset folders" on public.asset_folders;
create policy "Owners can manage asset folders"
on public.asset_folders
for all
to authenticated
using (public.owns_brand(brand_id))
with check (public.owns_brand(brand_id));

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon;
    revoke all on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;
