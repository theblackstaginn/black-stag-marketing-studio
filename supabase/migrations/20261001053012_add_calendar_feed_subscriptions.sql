create table if not exists private.calendar_feed_subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  feed_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

revoke all on table private.calendar_feed_subscriptions from public, anon, authenticated;
