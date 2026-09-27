# Black Stag Marketing Studio MCP Write Tools

Status: Design specification
Branch: `mcp-write-tools-spec`

## Purpose

Extend the existing proven read-only Marketing Studio MCP server with narrowly scoped, authenticated write tools.

The existing read tools remain unchanged:

- `list_brands`
- `get_brand_brain`
- `list_campaigns`
- `list_content`
- `list_calendar`
- `list_assets`

## Security invariants

1. Preserve the existing OAuth/authentication architecture.
2. Use the authenticated Supabase client for writes so existing RLS remains authoritative.
3. Never use a browser-exposed service-role or secret key.
4. Never bypass RLS to make a write tool work.
5. A write must only affect data belonging to a brand the authenticated user owns.
6. Patch-style tools update only explicitly supplied fields.
7. Destructive operations require an explicit user request.
8. Status-changing tools are separate from ordinary edits where the status change has workflow meaning.
9. Existing read-only tools must continue to behave exactly as before.

## Phase 1 — Brand Brain write tools

### `add_brand_fact`

Create a Brand Brain fact.

Input:

```json
{
  "brand_id": "uuid",
  "category": "string",
  "fact_key": "string | null",
  "subject": "string | null",
  "value_text": "string | null",
  "value_jsonb": "object | null",
  "ai_can_modify": false
}
```

Rules:

- `brand_id` and `category` are required.
- At least one of `value_text` or `value_jsonb` must be present.
- When Farmer explicitly instructs ChatGPT to save the fact, set `status = "owner_approved"`.
- Set `source_type` to an MCP/ChatGPT identifier chosen consistently by the server.
- Do not set `ai_can_modify = true` unless explicitly requested.
- Return the created row.

### `update_brand_fact`

Patch an existing fact.

Input:

```json
{
  "fact_id": "uuid",
  "value_text": "string | null",
  "value_jsonb": "object | null",
  "status": "verified | owner_approved | ai_suggested | needs_confirmation | archived | null",
  "ai_can_modify": "boolean | null"
}
```

Rules:

- `fact_id` is required.
- Update only supplied fields.
- Never change the owning brand.
- RLS must enforce ownership.

### `add_brand_rule`

Input:

```json
{
  "brand_id": "uuid",
  "rule_type": "string",
  "rule_text": "string",
  "priority": 100
}
```

Rules:

- `brand_id` and `rule_text` required.
- Default `rule_type = "general"`.
- Default `priority = 100`.
- Return the created row.

### `update_brand_voice`

Patch the existing `brand_voice` record for a brand.

Supported fields:

- `adjectives`
- `emotional_atmosphere`
- `formality`
- `humor_style`
- `mystery_level`
- `preferred_vocabulary`
- `avoid_vocabulary`
- `preferred_phrases`
- `avoid_phrases`
- `cliches_to_avoid`
- `emoji_policy`
- `profanity_policy`
- `capitalization_style`
- `cta_style`
- `writing_notes`
- `approved_examples`

Rules:

- Patch only supplied fields.
- Array fields must not be silently replaced when the intended operation is append/remove; if the MCP implementation cannot distinguish intent safely, expose explicit append/remove operations later rather than guessing.

### `add_brand_audience`

Create an audience row for a brand using the current `brand_audiences` schema.

### `add_product_service`

Create a row in `products_services`.

### `add_milestone`

Create a row in `milestones`.

## Phase 2 — Campaign tools

### `create_campaign`

Input fields map directly to the current `campaigns` table:

- `brand_id` required
- `name` required
- `description`
- `objective`
- `audience_notes`
- `offer_text`
- `budget_notes`
- `channels`
- `voice_notes`
- `cta`
- `starts_on`
- `ends_on`
- `status` default `draft`

Rule: campaigns created conversationally default to `draft` unless the user explicitly requests another status.

### `update_campaign`

Patch campaign fields only.

### `set_campaign_status`

Input:

```json
{
  "campaign_id": "uuid",
  "status": "draft | active | completed | archived"
}
```

## Phase 3 — Content tools

### `create_content`

Input fields map to `content_items`:

- `brand_id` required
- `campaign_id`
- `content_type` required
- `title`
- `body`
- `alternate_copy`
- `visual_direction`
- `cta`
- `hashtags`
- `platform`
- `goal`
- `original_request`
- `ai_mode`
- `ai_brief`
- `status` default `draft`

### `update_content`

Patch supplied fields only.

### `set_content_status`

Input:

```json
{
  "content_id": "uuid",
  "status": "idea | draft | review | approved | scheduled | published | rejected",
  "rejection_reason": "string | null"
}
```

Rules:

- `rejection_reason` should be accepted when status is `rejected`.
- Do not infer publication or scheduling from copy edits.

## Phase 4 — Calendar tools

### `create_calendar_item`

Map directly to `calendar_items`.

Defaults:

- `item_type = "event"`
- `all_day = false`
- `recurring = false`
- `marketing_relevant = true`
- `confirmed = true`

### `update_calendar_item`

Patch supplied fields only.

### `delete_calendar_item`

Destructive action.

Rule: execute only after an explicit user instruction to delete/remove that calendar item.

## Phase 5 — Asset tools

### `register_asset`

Register metadata for an already-accessible asset.

Map to `assets`:

- `brand_id` required
- `folder_id`
- `asset_type` required
- `name` required
- `description`
- `storage_bucket`
- `storage_path`
- `external_url`
- `mime_type`
- `width`
- `height`
- `alt_text`
- `tags`
- `approved_for_ai` default true
- `approved_for_marketing` default true

This tool does not upload binary data. Binary upload should be designed separately.

## Phase 6 — Aggregated context tools

### `get_marketing_context`

Input:

```json
{
  "brand_id": "uuid"
}
```

Return one compact working context containing:

- brand identity
- brand voice
- active verified/approved facts
- active brand rules
- audiences
- products/services
- milestones
- active campaigns
- recent content
- upcoming calendar items
- approved assets

This is a read tool and should not mutate anything.

### `get_daily_brief`

Input:

```json
{
  "brand_id": "uuid | null"
}
```

Return:

- today's calendar
- next 7 days
- active campaigns
- draft/review content
- overdue items
- upcoming milestones
- recently changed Brand Brain facts
- factual focus areas that may need attention

This tool must not perform autonomous writes.

## Implementation order

1. `add_brand_fact`
2. `add_brand_rule`
3. `update_brand_voice`
4. `create_campaign`
5. `create_content`
6. `set_content_status`
7. `create_calendar_item`
8. `register_asset`
9. `get_marketing_context`
10. `get_daily_brief`

## First implementation checkpoint

When the current MCP server source is available on Farmer's laptop:

1. Locate the existing tool registry and call dispatcher.
2. Add only `add_brand_fact`.
3. Reuse the same authenticated Supabase client used by existing read tools.
4. Do not modify existing read handlers.
5. Test `tools/list`.
6. Call `add_brand_fact` against a Farmer-owned test brand.
7. Read the Brand Brain back using the existing `get_brand_brain` tool.
8. Confirm a non-owned brand cannot be modified.
9. Only after this passes, move to `add_brand_rule`.

That establishes the write pattern for every later tool.
