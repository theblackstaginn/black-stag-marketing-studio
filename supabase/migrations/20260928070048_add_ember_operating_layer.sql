-- Ember operating layer: persistent work and decision queues for Marketing Studio.

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  description text,
  work_type text not null default 'task'
    check (work_type in ('task','content','campaign','asset','research','follow_up','admin','other')),
  status text not null default 'open'
    check (status in ('open','in_progress','blocked','waiting','done','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  owner_type text not null default 'shared'
    check (owner_type in ('owner','ember','shared')),
  due_at timestamptz,
  related_type text,
  related_id uuid,
  blocked_reason text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_items_brand_status_idx on public.work_items(brand_id, status);
create index work_items_brand_due_at_idx on public.work_items(brand_id, due_at);
create index work_items_priority_idx on public.work_items(priority);

create table public.decision_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  context text,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  ember_recommendation text,
  status text not null default 'pending'
    check (status in ('pending','answered','deferred','dismissed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  related_type text,
  related_id uuid,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index decision_requests_brand_status_idx on public.decision_requests(brand_id, status);
create index decision_requests_brand_due_at_idx on public.decision_requests(brand_id, due_at);

create trigger work_items_set_updated_at
before update on public.work_items
for each row execute function public.set_updated_at();

create trigger decision_requests_set_updated_at
before update on public.decision_requests
for each row execute function public.set_updated_at();

alter table public.work_items enable row level security;
alter table public.decision_requests enable row level security;

create policy "Owners can manage work items"
on public.work_items
for all
to authenticated
using (public.owns_brand(brand_id))
with check (public.owns_brand(brand_id));

create policy "Owners can manage decision requests"
on public.decision_requests
for all
to authenticated
using (public.owns_brand(brand_id))
with check (public.owns_brand(brand_id));

revoke all on public.work_items from anon;
revoke all on public.decision_requests from anon;

grant select, insert, update, delete on public.work_items to authenticated;
grant select, insert, update, delete on public.decision_requests to authenticated;
