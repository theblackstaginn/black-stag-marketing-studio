-- =========================================================
-- BLACK STAG MARKETING STUDIO
-- schema.sql
-- v1
--
-- PostgreSQL / Supabase
--
-- Core database for:
-- - User profiles
-- - Brands
-- - Brand Brain
-- - Source of Truth
-- - Audiences
-- - Products & services
-- - Milestones
-- - Campaigns
-- - Content workflow
-- - Calendar
-- - Asset Vault
-- - Marketing Memory
-- - AI run history
-- - Connected accounts
-- - Row Level Security
--
-- =========================================================


-- =========================================================
-- EXTENSIONS
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
new.updated_at = now();
return new;
end;
$$;


-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.profiles (
id uuid primary key
references auth.users(id)
on delete cascade,

display_name text,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


-- =========================================================
-- BRANDS
-- =========================================================

create table if not exists public.brands (
id uuid primary key
default gen_random_uuid(),

owner_id uuid
not null
references auth.users(id)
on delete cascade,

slug text
not null,

official_name text
not null,

short_name text,

mark text,

domain text,

business_type text,

business_stage text
not null
default 'operating',

stage_label text,

primary_marketing_goal text,

campaign_phase text,

tagline text,

short_description text,

long_description text,

brand_story text,

mission text,

differentiator text,

brand_promise text,

opening_date date,

opening_date_confirmed boolean
not null
default false,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now(),

unique(owner_id, slug)
);


create index if not exists
brands_owner_id_idx
on public.brands(owner_id);


-- =========================================================
-- BRAND VOICE
-- =========================================================

create table if not exists public.brand_voice (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
unique
references public.brands(id)
on delete cascade,

adjectives text[]
not null
default '{}',

emotional_atmosphere text,

formality text,

humor_style text,

mystery_level text,

preferred_vocabulary text[]
not null
default '{}',

avoid_vocabulary text[]
not null
default '{}',

preferred_phrases text[]
not null
default '{}',

avoid_phrases text[]
not null
default '{}',

cliches_to_avoid text[]
not null
default '{}',

emoji_policy text,

profanity_policy text,

capitalization_style text,

cta_style text,

writing_notes text,

approved_examples text[]
not null
default '{}',

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
brand_voice_brand_id_idx
on public.brand_voice(brand_id);


-- =========================================================
-- BRAND AUDIENCES
-- =========================================================

create table if not exists public.brand_audiences (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

name text
not null,

audience_type text
not null
default 'primary',

description text,

geography text,

needs text[] default '{}',

objections text[] default '{}',

motivations text[] default '{}',

problems text[] default '{}',

vocabulary text[] default '{}',

purchase_triggers text[] default '{}',

budget_notes text,

knowledge_level text,

is_target boolean
not null
default true,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
brand_audiences_brand_id_idx
on public.brand_audiences(brand_id);


-- =========================================================
-- SOURCE OF TRUTH / BRAND KNOWLEDGE
--
-- This is one of the most important tables.
--
-- status examples:
-- verified
-- owner_approved
-- ai_suggested
-- needs_confirmation
-- archived
--
-- =========================================================

create table if not exists public.brand_facts (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

category text
not null,

fact_key text,

subject text,

value_text text,

value_jsonb jsonb,

status text
not null
default 'needs_confirmation'
check (
status in (
'verified',
'owner_approved',
'ai_suggested',
'needs_confirmation',
'archived'
)
),

source_type text,

source_url text,

source_note text,

last_verified_at timestamptz,

expires_at timestamptz,

ai_can_modify boolean
not null
default false,

is_sensitive boolean
not null
default false,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
brand_facts_brand_id_idx
on public.brand_facts(brand_id);


create index if not exists
brand_facts_status_idx
on public.brand_facts(status);


create index if not exists
brand_facts_category_idx
on public.brand_facts(category);


-- =========================================================
-- BRAND RULES / AI GUARDRAILS
-- =========================================================

create table if not exists public.brand_rules (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

rule_type text
not null
default 'general',

rule_text text
not null,

priority integer
not null
default 100,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
brand_rules_brand_id_idx
on public.brand_rules(brand_id);


-- =========================================================
-- PRODUCTS & SERVICES
-- =========================================================

create table if not exists public.products_services (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

item_type text
not null
default 'product'
check (
item_type in (
'product',
'service',
'menu_item',
'event_service',
'commission',
'other'
)
),

name text
not null,

category text,

description text,

price_text text,

availability_text text,

ingredients_materials text,

options_addons text,

url text,

seasonal boolean
not null
default false,

promotional_priority integer
not null
default 0,

differentiators text,

permitted_claims text[] default '{}',

immutable_copy text,

confirmed boolean
not null
default false,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
products_services_brand_id_idx
on public.products_services(brand_id);


-- =========================================================
-- MILESTONES
-- =========================================================

create table if not exists public.milestones (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

title text
not null,

description text,

status text
not null
default 'planned'
check (
status in (
'planned',
'in_progress',
'completed',
'cancelled'
)
),

milestone_date date,

completed_at timestamptz,

marketing_worthy boolean
not null
default true,

content_created boolean
not null
default false,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
milestones_brand_id_idx
on public.milestones(brand_id);


-- =========================================================
-- CAMPAIGNS
-- =========================================================

create table if not exists public.campaigns (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

name text
not null,

description text,

objective text,

status text
not null
default 'draft'
check (
status in (
'draft',
'active',
'completed',
'archived'
)
),

audience_notes text,

offer_text text,

budget_notes text,

channels text[] default '{}',

voice_notes text,

cta text,

starts_on date,

ends_on date,

results text,

lessons text,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
campaigns_brand_id_idx
on public.campaigns(brand_id);


create index if not exists
campaigns_status_idx
on public.campaigns(status);


-- =========================================================
-- CONTENT ITEMS
--
-- Workflow:
-- idea
-- draft
-- review
-- approved
-- scheduled
-- published
-- rejected
--
-- =========================================================

create table if not exists public.content_items (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

campaign_id uuid
references public.campaigns(id)
on delete set null,

content_type text
not null
check (
content_type in (
'social_post',
'story',
'reel_script',
'email',
'website_copy',
'promotional_graphic',
'campaign',
'other'
)
),

status text
not null
default 'draft'
check (
status in (
'idea',
'draft',
'review',
'approved',
'scheduled',
'published',
'rejected'
)
),

title text,

body text,

alternate_copy text,

visual_direction text,

cta text,

hashtags text[] default '{}',

platform text,

goal text,

original_request text,

ai_mode text,

ai_brief text,

rejection_reason text,

scheduled_for timestamptz,

published_at timestamptz,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
content_items_brand_id_idx
on public.content_items(brand_id);


create index if not exists
content_items_campaign_id_idx
on public.content_items(campaign_id);


create index if not exists
content_items_status_idx
on public.content_items(status);


create index if not exists
content_items_scheduled_for_idx
on public.content_items(scheduled_for);


-- =========================================================
-- CALENDAR ITEMS
--
-- Content scheduling itself lives on content_items.
--
-- This table handles non-content calendar context:
-- events
-- launches
-- closures
-- holidays
-- opportunities
-- special hours
-- deadlines
--
-- =========================================================

create table if not exists public.calendar_items (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

item_type text
not null
default 'event',

title text
not null,

description text,

starts_at timestamptz,

ends_at timestamptz,

all_day boolean
not null
default false,

recurring boolean
not null
default false,

recurrence_rule text,

marketing_relevant boolean
not null
default true,

source_type text,

confirmed boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
calendar_items_brand_id_idx
on public.calendar_items(brand_id);


create index if not exists
calendar_items_starts_at_idx
on public.calendar_items(starts_at);


-- =========================================================
-- ASSETS
-- =========================================================

create table if not exists public.assets (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

asset_type text
not null
check (
asset_type in (
'logo',
'photo',
'generated_artwork',
'brand_asset',
'document',
'other'
)
),

name text
not null,

description text,

storage_bucket text,

storage_path text,

external_url text,

mime_type text,

width integer,

height integer,

alt_text text,

tags text[] default '{}',

approved_for_ai boolean
not null
default true,

approved_for_marketing boolean
not null
default true,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
assets_brand_id_idx
on public.assets(brand_id);


create index if not exists
assets_asset_type_idx
on public.assets(asset_type);


-- =========================================================
-- MARKETING MEMORY
--
-- Stores useful feedback from the owner.
--
-- Example:
--
-- feedback:
-- "Too Halloween-like."
--
-- learned_rule:
-- "Mystical and folkloric is appropriate;
-- avoid Halloween clichés."
--
-- =========================================================

create table if not exists public.marketing_feedback (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

content_id uuid
references public.content_items(id)
on delete set null,

feedback_type text
not null
default 'general',

feedback_text text
not null,

learned_rule text,

apply_to_future boolean
not null
default true,

active boolean
not null
default true,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
marketing_feedback_brand_id_idx
on public.marketing_feedback(brand_id);


-- =========================================================
-- AI RUN HISTORY
--
-- Useful even in Manual ChatGPT mode.
--
-- Later this also allows us to track:
-- provider
-- model
-- prompt version
-- costs
-- token usage
-- debugging
--
-- =========================================================

create table if not exists public.ai_runs (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
references public.brands(id)
on delete cascade,

content_id uuid
references public.content_items(id)
on delete set null,

campaign_id uuid
references public.campaigns(id)
on delete set null,

provider text
not null
default 'manual_chatgpt',

model text,

prompt_version text,

user_instruction text,

input_snapshot jsonb,

generated_prompt text,

output_text text,

status text
not null
default 'created',

input_tokens integer,

output_tokens integer,

estimated_cost numeric(12,6),

created_at timestamptz
not null
default now()
);


create index if not exists
ai_runs_brand_id_idx
on public.ai_runs(brand_id);


create index if not exists
ai_runs_content_id_idx
on public.ai_runs(content_id);


-- =========================================================
-- CONNECTED ACCOUNTS
--
-- IMPORTANT:
-- Do not store raw social OAuth secrets in ordinary
-- browser-readable columns.
--
-- This table stores connection metadata.
-- Future tokens belong in a secure server-side system.
--
-- =========================================================

create table if not exists public.connected_accounts (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

provider text
not null,

account_name text,

external_account_id text,

status text
not null
default 'disconnected',

metadata jsonb,

connected_at timestamptz,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


create index if not exists
connected_accounts_brand_id_idx
on public.connected_accounts(brand_id);


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

drop trigger if exists
profiles_set_updated_at
on public.profiles;

create trigger
profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists
brands_set_updated_at
on public.brands;

create trigger
brands_set_updated_at
before update on public.brands
for each row
execute function public.set_updated_at();


drop trigger if exists
brand_voice_set_updated_at
on public.brand_voice;

create trigger
brand_voice_set_updated_at
before update on public.brand_voice
for each row
execute function public.set_updated_at();


drop trigger if exists
brand_audiences_set_updated_at
on public.brand_audiences;

create trigger
brand_audiences_set_updated_at
before update on public.brand_audiences
for each row
execute function public.set_updated_at();


drop trigger if exists
brand_facts_set_updated_at
on public.brand_facts;

create trigger
brand_facts_set_updated_at
before update on public.brand_facts
for each row
execute function public.set_updated_at();


drop trigger if exists
brand_rules_set_updated_at
on public.brand_rules;

create trigger
brand_rules_set_updated_at
before update on public.brand_rules
for each row
execute function public.set_updated_at();


drop trigger if exists
products_services_set_updated_at
on public.products_services;

create trigger
products_services_set_updated_at
before update on public.products_services
for each row
execute function public.set_updated_at();


drop trigger if exists
milestones_set_updated_at
on public.milestones;

create trigger
milestones_set_updated_at
before update on public.milestones
for each row
execute function public.set_updated_at();


drop trigger if exists
campaigns_set_updated_at
on public.campaigns;

create trigger
campaigns_set_updated_at
before update on public.campaigns
for each row
execute function public.set_updated_at();


drop trigger if exists
content_items_set_updated_at
on public.content_items;

create trigger
content_items_set_updated_at
before update on public.content_items
for each row
execute function public.set_updated_at();


drop trigger if exists
calendar_items_set_updated_at
on public.calendar_items;

create trigger
calendar_items_set_updated_at
before update on public.calendar_items
for each row
execute function public.set_updated_at();


drop trigger if exists
assets_set_updated_at
on public.assets;

create trigger
assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();


drop trigger if exists
marketing_feedback_set_updated_at
on public.marketing_feedback;

create trigger
marketing_feedback_set_updated_at
before update on public.marketing_feedback
for each row
execute function public.set_updated_at();


drop trigger if exists
connected_accounts_set_updated_at
on public.connected_accounts;

create trigger
connected_accounts_set_updated_at
before update on public.connected_accounts
for each row
execute function public.set_updated_at();


-- =========================================================
-- PROFILE CREATION
--
-- Automatically creates a profile when a Supabase
-- Auth user is created.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

insert into public.profiles (
id,
display_name
)
values (
new.id,
coalesce(
new.raw_user_meta_data ->> 'display_name',
new.email
)
)
on conflict (id)
do nothing;

return new;

end;
$$;


drop trigger if exists
on_auth_user_created
on auth.users;


create trigger
on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles
enable row level security;

alter table public.brands
enable row level security;

alter table public.brand_voice
enable row level security;

alter table public.brand_audiences
enable row level security;

alter table public.brand_facts
enable row level security;

alter table public.brand_rules
enable row level security;

alter table public.products_services
enable row level security;

alter table public.milestones
enable row level security;

alter table public.campaigns
enable row level security;

alter table public.content_items
enable row level security;

alter table public.calendar_items
enable row level security;

alter table public.assets
enable row level security;

alter table public.marketing_feedback
enable row level security;

alter table public.ai_runs
enable row level security;

alter table public.connected_accounts
enable row level security;


-- =========================================================
-- HELPER FUNCTION
--
-- Determines whether the authenticated user owns a brand.
-- =========================================================

create or replace function public.owns_brand(
requested_brand_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
select exists (
select 1
from public.brands
where
id = requested_brand_id
and owner_id = auth.uid()
);
$$;


revoke all
on function public.owns_brand(uuid)
from public;

grant execute
on function public.owns_brand(uuid)
to authenticated;


-- =========================================================
-- PROFILES POLICIES
-- =========================================================

drop policy if exists
"Users can view own profile"
on public.profiles;

create policy
"Users can view own profile"
on public.profiles
for select
to authenticated
using (
id = auth.uid()
);


drop policy if exists
"Users can update own profile"
on public.profiles;

create policy
"Users can update own profile"
on public.profiles
for update
to authenticated
using (
id = auth.uid()
)
with check (
id = auth.uid()
);


-- =========================================================
-- BRANDS POLICIES
-- =========================================================

drop policy if exists
"Users can view own brands"
on public.brands;

create policy
"Users can view own brands"
on public.brands
for select
to authenticated
using (
owner_id = auth.uid()
);


drop policy if exists
"Users can create own brands"
on public.brands;

create policy
"Users can create own brands"
on public.brands
for insert
to authenticated
with check (
owner_id = auth.uid()
);


drop policy if exists
"Users can update own brands"
on public.brands;

create policy
"Users can update own brands"
on public.brands
for update
to authenticated
using (
owner_id = auth.uid()
)
with check (
owner_id = auth.uid()
);


drop policy if exists
"Users can delete own brands"
on public.brands;

create policy
"Users can delete own brands"
on public.brands
for delete
to authenticated
using (
owner_id = auth.uid()
);


-- =========================================================
-- BRAND VOICE POLICIES
-- =========================================================

drop policy if exists
"Owners can manage brand voice"
on public.brand_voice;

create policy
"Owners can manage brand voice"
on public.brand_voice
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- BRAND AUDIENCE POLICIES
-- =========================================================

drop policy if exists
"Owners can manage brand audiences"
on public.brand_audiences;

create policy
"Owners can manage brand audiences"
on public.brand_audiences
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- BRAND FACT POLICIES
-- =========================================================

drop policy if exists
"Owners can manage brand facts"
on public.brand_facts;

create policy
"Owners can manage brand facts"
on public.brand_facts
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- BRAND RULE POLICIES
-- =========================================================

drop policy if exists
"Owners can manage brand rules"
on public.brand_rules;

create policy
"Owners can manage brand rules"
on public.brand_rules
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- PRODUCTS / SERVICES POLICIES
-- =========================================================

drop policy if exists
"Owners can manage products and services"
on public.products_services;

create policy
"Owners can manage products and services"
on public.products_services
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- MILESTONE POLICIES
-- =========================================================

drop policy if exists
"Owners can manage milestones"
on public.milestones;

create policy
"Owners can manage milestones"
on public.milestones
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- CAMPAIGN POLICIES
-- =========================================================

drop policy if exists
"Owners can manage campaigns"
on public.campaigns;

create policy
"Owners can manage campaigns"
on public.campaigns
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- CONTENT POLICIES
-- =========================================================

drop policy if exists
"Owners can manage content"
on public.content_items;

create policy
"Owners can manage content"
on public.content_items
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- CALENDAR POLICIES
-- =========================================================

drop policy if exists
"Owners can manage calendar"
on public.calendar_items;

create policy
"Owners can manage calendar"
on public.calendar_items
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- ASSET POLICIES
-- =========================================================

drop policy if exists
"Owners can manage assets"
on public.assets;

create policy
"Owners can manage assets"
on public.assets
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- MARKETING FEEDBACK POLICIES
-- =========================================================

drop policy if exists
"Owners can manage marketing feedback"
on public.marketing_feedback;

create policy
"Owners can manage marketing feedback"
on public.marketing_feedback
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- AI RUN POLICIES
-- =========================================================

drop policy if exists
"Owners can manage AI runs"
on public.ai_runs;

create policy
"Owners can manage AI runs"
on public.ai_runs
for all
to authenticated
using (
brand_id is null
or public.owns_brand(brand_id)
)
with check (
brand_id is null
or public.owns_brand(brand_id)
);


-- =========================================================
-- CONNECTED ACCOUNT POLICIES
-- =========================================================

drop policy if exists
"Owners can manage connected accounts"
on public.connected_accounts;

create policy
"Owners can manage connected accounts"
on public.connected_accounts
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- STORAGE BUCKET
--
-- Private Asset Vault.
--
-- The app will later generate signed URLs when an asset
-- needs to be displayed.
-- =========================================================

insert into storage.buckets (
id,
name,
public
)
values (
'brand-assets',
'brand-assets',
false
)
on conflict (id)
do update set
public = false;


-- =========================================================
-- STORAGE POLICIES
--
-- Storage path format:
--
-- USER_UUID / BRAND_UUID / filename.ext
--
-- This ensures each authenticated user can only operate
-- inside their own top-level folder.
-- =========================================================

drop policy if exists
"Users can view own brand assets"
on storage.objects;

create policy
"Users can view own brand assets"
on storage.objects
for select
to authenticated
using (
bucket_id = 'brand-assets'
and (storage.foldername(name))[1] = auth.uid()::text
);


drop policy if exists
"Users can upload own brand assets"
on storage.objects;

create policy
"Users can upload own brand assets"
on storage.objects
for insert
to authenticated
with check (
bucket_id = 'brand-assets'
and (storage.foldername(name))[1] = auth.uid()::text
);


drop policy if exists
"Users can update own brand assets"
on storage.objects;

create policy
"Users can update own brand assets"
on storage.objects
for update
to authenticated
using (
bucket_id = 'brand-assets'
and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
bucket_id = 'brand-assets'
and (storage.foldername(name))[1] = auth.uid()::text
);


drop policy if exists
"Users can delete own brand assets"
on storage.objects;

create policy
"Users can delete own brand assets"
on storage.objects
for delete
to authenticated
using (
bucket_id = 'brand-assets'
and (storage.foldername(name))[1] = auth.uid()::text
);



-- =========================================================
-- ASSET VAULT FOLDERS
--
-- Folder hierarchy used by the Asset Vault UI.
-- Safe to run against projects that already have these
-- additions because table/column/index creation is guarded.
-- =========================================================

create table if not exists public.asset_folders (
id uuid primary key
default gen_random_uuid(),

brand_id uuid
not null
references public.brands(id)
on delete cascade,

parent_folder_id uuid
references public.asset_folders(id)
on delete restrict,

name text
not null,

description text,

created_at timestamptz
not null
default now(),

updated_at timestamptz
not null
default now()
);


alter table public.assets
add column if not exists folder_id uuid;


do $
begin
if not exists (
select 1
from pg_constraint
where conname = 'assets_folder_id_fkey'
and conrelid = 'public.assets'::regclass
) then
alter table public.assets
add constraint assets_folder_id_fkey
foreign key (folder_id)
references public.asset_folders(id)
on delete set null;
end if;
end
$;


create index if not exists
asset_folders_brand_id_idx
on public.asset_folders(brand_id);

create index if not exists
asset_folders_parent_folder_id_idx
on public.asset_folders(parent_folder_id);

create index if not exists
assets_folder_id_idx
on public.assets(folder_id);


drop trigger if exists
asset_folders_set_updated_at
on public.asset_folders;

create trigger
asset_folders_set_updated_at
before update on public.asset_folders
for each row
execute function public.set_updated_at();


alter table public.asset_folders
enable row level security;


drop policy if exists
"Owners can manage asset folders"
on public.asset_folders;

create policy
"Owners can manage asset folders"
on public.asset_folders
for all
to authenticated
using (
public.owns_brand(brand_id)
)
with check (
public.owns_brand(brand_id)
);


-- =========================================================
-- AI RUN COMPATIBILITY COLUMNS
--
-- The current app writes these field names. Older ai_runs
-- fields remain intact for backward compatibility.
-- =========================================================

alter table public.ai_runs
add column if not exists mode text,
add column if not exists task_type text,
add column if not exists user_request text,
add column if not exists prompt_text text,
add column if not exists response_text text;

-- =========================================================
-- END
-- =========================================================