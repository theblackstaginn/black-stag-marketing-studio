create table if not exists public.pinterest_traffic_daily (
 brand_id uuid not null references public.brands(id) on delete cascade,
 day date not null,
 profile_handle text not null default 'laceandleather65',
 metricool_brand_id bigint not null default 7141063,
 impressions bigint check (impressions is null or impressions>=0),
 pin_clicks bigint check (pin_clicks is null or pin_clicks>=0),
 outbound_clicks bigint check (outbound_clicks is null or outbound_clicks>=0),
 saves bigint check (saves is null or saves>=0),
 source text not null default 'metricool_mcp',
 synced_at timestamptz not null default now(),
 primary key (brand_id, day)
);
alter table public.pinterest_traffic_daily enable row level security;
revoke all on public.pinterest_traffic_daily from public,anon,authenticated;
grant select on public.pinterest_traffic_daily to authenticated;
grant select,insert,update,delete on public.pinterest_traffic_daily to service_role;
drop policy if exists "Pinterest traffic available to owning brand members" on public.pinterest_traffic_daily;
create policy "Pinterest traffic available to owning brand members"
 on public.pinterest_traffic_daily for select to authenticated
 using (public.owns_brand(brand_id));
comment on table public.pinterest_traffic_daily is 'Owner-only read-only Pinterest traffic snapshots fetched through the user-connected Metricool MCP; no login credentials or customer data.';
