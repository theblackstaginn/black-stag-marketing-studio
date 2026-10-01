alter table private.calendar_feed_subscriptions
  add column if not exists timezone text not null default 'America/New_York';
