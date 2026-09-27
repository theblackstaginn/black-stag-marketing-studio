# Brand Brain Hygiene Review — 2026-09-27

## Current state

- 75 active facts.
- 60 owner_approved.
- 15 verified.
- 0 active facts in needs_confirmation.
- 0 duplicate active fact_key values within a brand.

## Repeated subjects reviewed

Repeated subjects exist for:
- Stag & Stone: Coffee Cart
- Stag & Stone: Mobile Tavern
- Stag & Stone: Custom Bakes
- Black Stag Web Design: Portfolio project

These are not duplicate fact_key records. They represent related facts with different scope/detail. No automatic merge or deletion was performed.

## Hygiene rules

- fact_key is the stable machine identity; subject is human-readable and may repeat.
- Prefer one fact per independently verifiable claim.
- Keep broad offering facts separate from detailed restrictions/terms.
- Never merge records merely because subjects match.
- Archive superseded facts instead of deleting historical truth when provenance matters.
- ai_can_modify remains false unless the owner explicitly grants AI edit authority.
- Sensitive facts must never enter outward-facing marketing context.
- planned, verified, and currently available are distinct concepts.

## Future maintenance

get_marketing_context and get_daily_brief should consume only active, non-sensitive facts with approved statuses appropriate to the task.
