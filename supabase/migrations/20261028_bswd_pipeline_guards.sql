-- Apply AFTER 20261028_bswd_prospect_pipeline.sql. Not deployed.
-- Guard lifecycle integrity even when callers bypass the browser.
create or replace function public.bswd_prospect_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.stage not in ('discovered','researched','qualified','draft_ready','do_not_contact') then
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
  from public.bswd_prospects where id=new.prospect_id and owner_id=new.owner_id;
  if not found then raise exception 'Prospect unavailable'; end if;
  if target_suppressed is not null or target_stage = 'do_not_contact' then
    raise exception 'Cannot prepare or approve outreach to suppressed prospect';
  end if;
  if tg_op = 'UPDATE' then
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
revoke update,delete on public.bswd_prospect_events from authenticated;
-- Outreach never needs browser DELETE. Suppression audit should remain.
revoke delete on public.bswd_outreach from authenticated;
