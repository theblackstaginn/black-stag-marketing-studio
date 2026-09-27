# Asset Vault Taxonomy

## Top-level folders

### Stag & Stone
- Brand Identity
- Campaign Creative
- Social & Content
- Products & Menu
- Mobile Services

Existing Event night banners and logos/emblems folders remain untouched until a deliberate migration is approved.

### Black Stag Web Design
- Brand Identity
- Portfolio
- Campaign Creative
- Social & Content

### Lace & Leather
- Brand Identity
- Digital Textures
- Fantasy Maps
- Campaign Creative
- Social & Content

## Naming

Use human-readable names. Avoid opaque upload IDs as display names when a descriptive name is known.

Recommended pattern for campaign creative:
`<campaign> - <subject> - <format> - <variant>`

Examples:
- Pre-Opening - Book Club - Social Landscape - v1
- Pre-Opening - Book Club - Mobile - v1

## Tags

Tags supplement folders; they do not replace them.

Useful tag dimensions:
- subject: book-club, dnd, mtg, coffee-cart
- format: landscape, portrait, square, mobile
- use: social, web, print, reference
- state: draft, approved, archived
- material/style when useful: leather, mahogany, bronze

Do not create tags for facts already represented by brand ownership or asset type.

## Approval flags

approved_for_ai:
AI may inspect/use the asset as creative/reference material.

approved_for_marketing:
Asset is cleared for outward-facing marketing use.

These flags are independent. Never infer approval from folder placement.

## Registration vs upload

register_asset creates/updates metadata for an asset that already exists at an accessible storage path or URL.
Binary upload is a separate capability and requires its own security/storage design.
