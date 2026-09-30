create or replace function private.protect_primary_brand_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and (select auth.uid()) is distinct from old.owner_id then
    raise exception 'Only the primary owner can transfer primary ownership.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_primary_brand_owner() from public;
revoke all on function private.protect_primary_brand_owner() from anon;
revoke all on function private.protect_primary_brand_owner() from authenticated;

drop trigger if exists brands_protect_primary_owner on public.brands;
create trigger brands_protect_primary_owner
before update of owner_id on public.brands
for each row
execute function private.protect_primary_brand_owner();
