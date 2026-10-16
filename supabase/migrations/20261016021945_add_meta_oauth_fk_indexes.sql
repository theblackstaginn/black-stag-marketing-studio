create index if not exists meta_oauth_attempts_brand_id_idx
on public.meta_oauth_attempts(brand_id);

create index if not exists meta_oauth_attempts_initiated_by_idx
on public.meta_oauth_attempts(initiated_by);

create index if not exists meta_account_credentials_authorized_by_idx
on public.meta_account_credentials(authorized_by);
