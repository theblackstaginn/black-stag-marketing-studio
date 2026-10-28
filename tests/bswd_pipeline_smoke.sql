-- Integration smoke test. Run ONLY after both BSWD migrations in a test database.
-- Rolls back every test record. Requires an existing BSWD owner in public.brands.
begin;
do $test$
declare
  v_owner uuid;
  v_prospect uuid;
  v_draft uuid;
  v_blocked boolean;
begin
  select owner_id into v_owner from public.brands
    where id = 'd51c76c3-a4a6-4109-99c2-5a4b3cff226b';
  if v_owner is null then raise exception 'BSWD owner not found'; end if;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';

  insert into public.bswd_prospects
    (owner_id,business_name,location,source_url,opportunity_evidence,prospect_key,stage)
  values
    (v_owner,'Pipeline QA Only','Test City','https://example.org/qa',
     'Synthetic test record, never contact','pipeline-qa-only-'||txid_current()::text,'researched')
  returning id into v_prospect;

  insert into public.bswd_outreach(owner_id,prospect_id,channel,subject,draft_body)
  values(v_owner,v_prospect,'email','QA draft','This is a synthetic test. Never send.')
  returning id into v_draft;

  update public.bswd_outreach
    set state='approved',approved_at=now()
    where id=v_draft;
  if not found then raise exception 'Draft approval failed'; end if;

  v_blocked:=false;
  begin
    update public.bswd_outreach set state='sent',sent_at=now() where id=v_draft;
  exception when others then v_blocked:=true; end;
  if not v_blocked then raise exception 'FAIL: browser can claim sent'; end if;

  v_blocked:=false;
  begin
    update public.bswd_prospects set stage='won' where id=v_prospect;
  exception when others then v_blocked:=true; end;
  if not v_blocked then raise exception 'FAIL: browser can claim won'; end if;

  update public.bswd_prospects
    set stage='do_not_contact',suppressed_at=now()
    where id=v_prospect;

  v_blocked:=false;
  begin
    insert into public.bswd_outreach(owner_id,prospect_id,channel,draft_body)
    values(v_owner,v_prospect,'email','Forbidden after suppression');
  exception when others then v_blocked:=true; end;
  if not v_blocked then raise exception 'FAIL: suppressed contact accepts draft'; end if;

  v_blocked:=false;
  begin
    update public.bswd_prospects set stage='researched',suppressed_at=null
    where id=v_prospect;
  exception when others then v_blocked:=true; end;
  if not v_blocked then raise exception 'FAIL: suppressed prospect reopened'; end if;

  raise notice 'PASS: draft approval, no fake sends, no fake wins, suppression';
end
$test$;
rollback;
