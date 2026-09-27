# Daily Brief Contract

## Goal

Answer: "What are we working on?" with a compact, factual operational brief.

## Input

- brand_id optional
- as_of timestamp supplied by server/runtime
- lookahead_days default 7

If brand_id is omitted, return data across brands owned by the authenticated user.

## Sections

1. Today
   - confirmed calendar items occurring today
   - scheduled content due today

2. Next 7 Days
   - confirmed calendar items
   - scheduled content
   - dated milestones

3. Campaigns
   - active campaigns
   - optionally draft campaigns under "Needs Decision"; never call them active

4. Content Attention
   - draft/review items
   - scheduled items whose scheduled_for is past and published_at is null
   - rejected items only when recently changed or explicitly requested

5. Milestones
   - dated upcoming milestones
   - undated in-progress/planned marketing-worthy milestones in a separate "Undated" section

6. Brand Brain Changes
   - facts updated recently, limited to verified/owner_approved and non-sensitive

7. Focus Areas
   - deterministic observations only, e.g. "3 drafts await review"
   - no invented priority, deadline, urgency, or business fact

## Never infer

- opening dates
- operating hours from planned hours
- event dates from undated milestones
- campaign activation
- content approval
- publication
- current product availability
- scarcity or urgency

## Query behavior

All tables must be scoped through authenticated ownership/RLS.

Recommended server-side flow:
1. Resolve owned brands.
2. Query calendar_items for [today, today + lookahead].
3. Query content_items for attention states and schedule window.
4. Query campaigns for active plus optional drafts.
5. Query milestones for dated window plus undated planned/in_progress.
6. Query recently updated non-sensitive approved facts.
7. Aggregate and sort; perform no writes.

## Response shape

Return structured JSON plus a short generated summary. Keep source record IDs in the JSON so follow-up MCP actions can target exact records.
