grant select, insert, delete on table public.work_items to service_role;

comment on table public.work_items is
'Persistent BSMS work queue. Service-role write access is required for trusted server-side intake functions that create and clean up follow-up tasks.';
