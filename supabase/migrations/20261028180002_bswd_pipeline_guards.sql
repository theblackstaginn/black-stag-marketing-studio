-- Apply AFTER 20261028175959_bswd_prospect_pipeline.sql. Not deployed.
-- Guard lifecycle integrity even when callers bypass the browser.
create or replace function public.bswd_prospect_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  canonical_key text;
begin
  canonical_key := lower(regexp_replace(trim(normalize(new.business_name, NFKC)), '\s+', ' ', 'g'))
    || '|' || lower(regexp_replace(trim(normalize(coalesce(new.location,''), NFKC)), '\s+', ' ', 'g'));
  if tg_op = 'INSERT' then
    new.prospect_key := canonical_key;
    if new.last_contacted_at is not null then
      raise exception 'New prospect cannot claim verified contact time';
    end if;
  elsif canonical_key is distinct from old.prospect_key then
    raise exception 'Business identity is immutable; deduplication cannot be bypassed';
  end if;
  if tg_op = 'INSERT'  and new.stage not in ('discovered','researched','qualified','draft_ready','do_not_contact') then
    raise exception 'New prospect cannot claim outreach or sales activity';
  end if;
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id
       or new.prospect_key is distinct from old.prospect_key
       or new.last_contacted_at is distinct from old.last_contacted_at then
      raise exception 'Ownership, dedupe key and verified contact time are immutable in browser workflow';
    end if;
    if old.suppressed_at is not null and
       (new.suppressed_at is null or new.stage <> 'do_not_contact') then
      raise exception 'Suppressed prospect cannot be reopened by the client';
    end if;
    if old.stage = 'do_not_contact' and new.stage <> 'do_not_contact' then
      raise exception 'Do not contact is terminal';
    end if;
    if new.stage in ('approved','contacted','replied','meeting','quoted','won')
       and new.stage is distinct from old.stage then
      raise exception 'Verified stage transitions require a dedicated audited workflow';
    end if;
  end if;
  if new.suppressed_at is not null then new.stage := 'do_not_contact'; end if;
  if new.stage = 'do_not_contact' and new.suppressed_at is null then
    new.suppressed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists bswd_prospect_guard_trigger on public.bswd_prospects;
create trigger bswd_prospect_guard_trigger
before insert or update on public.bswd_prospects
for each row execute function public.bswd_prospect_guard();

create or replace function public.bswd_outreach_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  target_suppressed timestamptz;
  target_stage text;
begin
  select suppressed_at,stage into target_suppressed,target_stage
  from public.bswd_prospects where id=new.prospect_id and owner_id=new.owner_id for update;
  if not found then raise exception 'Prospect unavailable'; end if;
  if target_suppressed is not null or target_stage = 'do_not_contact' then
    raise exception 'Cannot prepare or approve outreach to suppressed prospect';
  end if;
  if tg_op = 'UPDATE' then
    if old.state='draft' and new.state='approved' then new.approved_at := now(); end if;
    if new.approved_at is distinct from old.approved_at
       and not (old.state='draft' and new.state='approved' and old.approved_at is null and new.approved_at is not null) then
      raise exception 'Approval timestamp cannot be modified';
    end if;
    if new.sent_at is distinct from old.sent_at or new.external_message_id is distinct from old.external_message_id then
      raise exception 'Browser cannot assert sent messages';
    end if;
    if new.owner_id is distinct from old.owner_id
       or new.prospect_id is distinct from old.prospect_id
       or new.draft_body is distinct from old.draft_body
       or new.channel is distinct from old.channel
       or new.subject is distinct from old.subject then
      raise exception 'Draft content and ownership immutable; create a new draft';
    end if;
    if old.state <> 'draft' and new.state <> old.state then
      raise exception 'Approved drafts cannot be advanced from browser API';
    end if;
    if new.state not in ('draft','approved','cancelled') then
      raise exception 'Sending and reply states require audited server workflow';
    end if;
    if old.state='draft' and new.state='approved' and new.approved_at is null then
      raise exception 'Approval timestamp required';
    end if;
  elsif new.state <> 'draft' or new.approved_at is not null or new.sent_at is not null or new.external_message_id is not null then
    raise exception 'New outreach must be an unsent, unapproved draft';
  end if;
  return new;
end;
$$;
drop trigger if exists bswd_outreach_guard_trigger on public.bswd_outreach;
create trigger bswd_outreach_guard_trigger
before insert or update on public.bswd_outreach
for each row execute function public.bswd_outreach_guard();

-- Event log is append-only to browser clients.
revoke insert,update,delete on public.bswd_prospect_events from authenticated;
-- Audit events must originate from a trusted, separately authenticated backend.
-- Outreach never needs browser DELETE. Suppression audit should remain.
revoke delete on public.bswd_outreach from authenticated;

-- Prevent cascading deletion of suppression and audit history by the browser.
revoke delete on public.bswd_prospects from authenticated;

-- Trusted trigger only: no callable browser audit-writing endpoint.
create schema if not exists private;
create or replace function private.bswd_record_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  kind text;
  payload jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from new.owner_id or not exists (
    select 1 from public.brands where id='d51c76c3-a4a6-4109-99c2-5a4b3cff226b' and owner_id=auth.uid()
  ) then raise exception 'Audit actor must be the BSWD owner'; end if;
  if tg_table_name='bswd_prospects' then
    if tg_op='INSERT' then kind := 'prospect_created';
    elsif new.stage is distinct from old.stage then
      kind := case when new.stage='do_not_contact' then 'prospect_suppressed' else 'stage_changed' end;
      payload := jsonb_build_object('from',old.stage,'to',new.stage);
    else return new; end if;
    insert into public.bswd_prospect_events(owner_id,prospect_id,event_type,details)
    values(new.owner_id,new.id,kind,payload);
  else
    if tg_op='INSERT' then kind := 'draft_created';
    elsif new.state is distinct from old.state then kind := 'draft_' || new.state;
    else return new; end if;
    insert into public.bswd_prospect_events(owner_id,prospect_id,event_type,details)
    values(new.owner_id,new.prospect_id,kind,jsonb_build_object('outreach_id',new.id));
  end if;
  return new;
end;
$$;
revoke all on function private.bswd_record_event() from public, anon, authenticated;
create trigger bswd_prospect_audit after insert or update on public.bswd_prospects
for each row execute function private.bswd_record_event();
create trigger bswd_outreach_audit after insert or update on public.bswd_outreach
for each row execute function private.bswd_record_event();
