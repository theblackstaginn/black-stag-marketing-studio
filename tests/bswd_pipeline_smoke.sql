-- Isolated database only. Every data mutation below rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.expect_rejection(statement text, expected text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm !~ expected then raise exception 'Unexpected rejection: % (wanted %)',sqlerrm,expected; end if;
    return;
  end;
  raise exception 'FAIL: allowed forbidden operation: %',statement;
end;
$$;
do $test$
declare
  v_owner uuid;
  v_other uuid;
  v_prospect uuid;
  v_draft uuid;
  n integer;
  state_name text;
begin
  select owner_id into strict v_owner from public.brands where id='d51c76c3-a4a6-4109-99c2-5a4b3cff226b';
  select id into strict v_other from auth.users where email='bswd-outsider@example.test';
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if current_user <> 'authenticated' then raise exception 'RLS test role not active'; end if;
  insert into public.bswd_prospects(owner_id,business_name,location,source_url,opportunity_evidence,prospect_key,stage)
  values(v_owner,'Pipeline QA Only','Test City','https://example.test/qa','Synthetic test, never contact','caller-key','researched') returning id into v_prospect;
  if not exists(select 1 from public.bswd_prospects where id=v_prospect and prospect_key='pipeline qa only|test city') then raise exception 'Canonical dedupe key missing'; end if;
  perform pg_temp.expect_rejection(format('insert into public.bswd_prospects(owner_id,business_name,location,source_url,prospect_key) values(%L,''  PIPELINE   QA ONLY  '',''Test City'',''https://example.test/qa'',''bypass-key'')',v_owner),'duplicate key');
  perform pg_temp.expect_rejection(format('update public.bswd_prospects set owner_id=%L where id=%L',v_other,v_prospect),'immutable');
  perform pg_temp.expect_rejection(format('update public.bswd_prospects set prospect_key=''changed'' where id=%L',v_prospect),'immutable');
  perform pg_temp.expect_rejection(format('update public.bswd_prospects set business_name=''New identity'' where id=%L',v_prospect),'identity is immutable');
  perform pg_temp.expect_rejection(format('update public.bswd_prospects set last_contacted_at=now() where id=%L',v_prospect),'immutable');
  foreach state_name in array array['approved','contacted','replied','meeting','quoted','won'] loop
    perform pg_temp.expect_rejection(format('update public.bswd_prospects set stage=%L where id=%L',state_name,v_prospect),'Verified stage transitions');
    perform pg_temp.expect_rejection(format('insert into public.bswd_prospects(owner_id,business_name,source_url,prospect_key,stage) values(%L,''Forbidden activity'',''https://example.test'',''forbidden'',%L)',v_owner,state_name),'cannot claim outreach or sales');
  end loop;
  perform pg_temp.expect_rejection(format('insert into public.bswd_prospects(owner_id,business_name,source_url,prospect_key,last_contacted_at) values(%L,''Forbidden timestamp'',''https://example.test'',''forbidden'',now())',v_owner),'cannot claim verified contact');
  insert into public.bswd_outreach(owner_id,prospect_id,channel,subject,draft_body)
  values(v_owner,v_prospect,'email','Synthetic QA','Never send this synthetic draft') returning id into v_draft;
  perform pg_temp.expect_rejection(format('insert into public.bswd_outreach(owner_id,prospect_id,channel,draft_body,state,approved_at) values(%L,%L,''email'',''forbidden'',''approved'',now())',v_owner,v_prospect),'unsent, unapproved draft');
  update public.bswd_outreach set state='approved',approved_at=now() where id=v_draft;
  if not found then raise exception 'Draft approval failed'; end if;
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set draft_body=''tampered'' where id=%L',v_draft),'immutable');
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set subject=''tampered'' where id=%L',v_draft),'immutable');
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set sent_at=now() where id=%L',v_draft),'cannot assert sent');
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set external_message_id=''fake'' where id=%L',v_draft),'cannot assert sent');
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set state=''sent'' where id=%L',v_draft),'cannot be advanced|audited server');
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set state=''replied'' where id=%L',v_draft),'cannot be advanced|audited server');
  update public.bswd_prospects set stage='do_not_contact' where id=v_prospect;
  if not exists(select 1 from public.bswd_prospects where id=v_prospect and suppressed_at is not null) then raise exception 'Missing suppression timestamp'; end if;
  perform pg_temp.expect_rejection(format('insert into public.bswd_outreach(owner_id,prospect_id,channel,draft_body) values(%L,%L,''email'',''forbidden'')',v_owner,v_prospect),'suppressed prospect');
  perform pg_temp.expect_rejection(format('update public.bswd_outreach set state=''cancelled'' where id=%L',v_draft),'suppressed prospect');
  perform pg_temp.expect_rejection(format('update public.bswd_prospects set suppressed_at=null,stage=''researched'' where id=%L',v_prospect),'cannot be reopened|terminal');
  perform pg_temp.expect_rejection('truncate public.bswd_prospects cascade','permission denied');
  perform pg_temp.expect_rejection(format('delete from public.bswd_prospects where id=%L',v_prospect),'permission denied');
  perform pg_temp.expect_rejection(format('delete from public.bswd_outreach where id=%L',v_draft),'permission denied');
  perform pg_temp.expect_rejection(format('insert into public.bswd_prospect_events(owner_id,prospect_id,event_type) values(%L,%L,''fake_sent'')',v_owner,v_prospect),'permission denied');
  perform pg_temp.expect_rejection(format('update public.bswd_prospect_events set event_type=''fake_sent'' where prospect_id=%L',v_prospect),'permission denied');
  perform pg_temp.expect_rejection(format('delete from public.bswd_prospect_events where prospect_id=%L',v_prospect),'permission denied');
  select count(*) into n from public.bswd_prospect_events where prospect_id=v_prospect;
  if n<>4 then raise exception 'Expected 4 real audit events, got %',n; end if;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  if exists(select 1 from public.bswd_prospects) or exists(select 1 from public.bswd_outreach) or exists(select 1 from public.bswd_prospect_events) then raise exception 'Cross-user read leak'; end if;
  update public.bswd_prospects set stage='lost' where id=v_prospect;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Cross-user update leak'; end if;
  perform pg_temp.expect_rejection(format('insert into public.bswd_prospects(owner_id,business_name,source_url,prospect_key) values(%L,''Other user'',''https://example.test'',''other'')',v_other),'row-level security');
  perform pg_temp.expect_rejection(format('insert into public.bswd_outreach(owner_id,prospect_id,channel,draft_body) values(%L,%L,''email'',''foreign'')',v_other,v_prospect),'Prospect unavailable|row-level security');
  execute 'reset role';
  execute 'set local role anon';
  perform pg_temp.expect_rejection('select * from public.bswd_prospects','permission denied');
  perform pg_temp.expect_rejection('select * from public.bswd_outreach','permission denied');
  perform pg_temp.expect_rejection('select * from public.bswd_prospect_events','permission denied');
  raise notice 'PASS: owner access, dedupe, lifecycle integrity, suppression, immutable audit, outsider and anon isolation';
end
$test$;
rollback;
-- Caller also compares all three row counts before/after to verify cleanup.
