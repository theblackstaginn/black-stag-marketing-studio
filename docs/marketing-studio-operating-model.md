# Marketing Studio Operating Model

## Core principle

Marketing Studio separates verified business truth from creative marketing work.

Brand Brain is the source of truth. Campaigns organize objectives. Content is produced within campaigns. Calendar controls timing. Asset Vault supplies approved visual material. MCP provides conversational access to the same system.

## Content workflow

idea -> draft -> review -> approved -> scheduled -> published

A rejected item may move to rejected with a rejection reason.

Rules:
- New AI-created content defaults to draft.
- Editing copy never implies approval, scheduling, or publication.
- Approval is an explicit workflow action.
- Scheduling requires a real date/time.
- Published means publication is confirmed, not merely intended.

## Campaign workflow

draft -> active -> completed -> archived

Rules:
- Conversationally created campaigns default to draft.
- Activating a campaign is explicit.
- Completion and archival are explicit state changes.

## Calendar

Calendar items represent confirmed or intentionally planned moments.

Rules:
- Never invent dates.
- A planned milestone with no confirmed date remains undated.
- Deletion requires an explicit user instruction.
- Marketing relevance is separate from operational importance.

## Assets

Assets are registered separately from binary upload.

Rules:
- Asset metadata should include brand, type, name, description, tags, accessibility text where appropriate, and approval flags.
- approved_for_ai controls whether AI may use the asset as creative/reference material.
- approved_for_marketing controls whether the asset is cleared for outward-facing marketing.
- Binary upload is a separate capability from metadata registration.

## Daily Brief

The Daily Brief should answer: "What are we working on?"

It should return:
1. Today's confirmed calendar items.
2. The next seven days.
3. Active campaigns.
4. Draft/review content requiring attention.
5. Overdue scheduled work.
6. Upcoming milestones.
7. Recently changed Brand Brain facts.
8. Factual focus areas needing attention.

It must not:
- invent deadlines,
- turn planned milestones into dated events,
- activate campaigns,
- approve content,
- schedule or publish content,
- mutate Brand Brain.

## Marketing Context

get_marketing_context should provide one compact brand working set:
- identity and business stage,
- voice,
- verified/owner-approved facts,
- active rules,
- audiences,
- products/services,
- milestones,
- active campaigns,
- recent content,
- upcoming calendar,
- approved assets.

This is a read-only orientation tool intended to reduce repeated MCP round trips.

## Phone-first principle

Any operation exposed through MCP should be usable conversationally from ChatGPT without requiring Stag UI. Stag UI remains the visual workspace; MCP is the operational interface.
