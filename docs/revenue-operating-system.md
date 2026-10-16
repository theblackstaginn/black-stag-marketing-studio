# Black Stag Marketing Studio: Revenue Operating System

Status: Phase 1 implemented on a feature branch. The aim is repeatable, measurable profit, not a promise of guaranteed income.

## Current foundations

- Black Stag Web Design Website Checkup submits consented requests into public.black_stag_leads and creates linked work_items. The database uses Row Level Security.
- Black Stag's Meta Pixel and privacy notice are deployed. The paid campaign is still a draft. This project has not launched any ads.
- Three Black Stag lead-generation ad drafts and 4:5 creatives are saved in Studio and await owner approval for marketing.
- As of October 16, 2026, three Website Checkup submissions have status "new". They appear to be tests, not evidence of qualified leads, revenue or advertising return.
- Lace & Leather and Stag & Stone have distinct income models. Never confuse potential, gross orders, collected cash and actual profit.

## The revenue loop

Attention → Qualified visit → Consent-based inquiry → Prompt contact → Discovery → Quote → Close → Collect → Deliver → Review/referral/retention.

Each transition needs an owner, timestamp, consent boundary and reliable measurement. Each brand keeps its own funnel; executive reporting should aggregate only real comparable data.

## Phase 1: Lead to Revenue Desk

- [x] Dedicated phone-friendly lead desk linked inside Black Stag Marketing Studio when Black Stag Web Design is active.
- [x] Customer data access gated by Supabase authentication, existing lead RLS and a primary-owner check.
- [x] Recent leads, funnel stages, priority queue and age-based follow-up suggestions.
- [x] Manual email/call/text actions respect the originally chosen contact preference. No automatic messages.
- [x] Explicit Save stage for new, contacted, qualified, quoted, won, lost, spam/test.
- [x] Won is a manually entered pipeline status, not a confirmed payment.
- [x] Synthetic browser tests for desktop/mobile, updates, filters, non-owner denial and secret checks.
- [ ] Owner reviews apparent test submissions and explicitly classifies them. Never delete data silently.
- [ ] Sync lead stage changes and related Studio work item statuses atomically on the server; currently they are separate.

## Phase 2: Quote to cash

Build a quote and proposal flow with scope, estimated hours, direct costs, target gross margin, acceptance date, invoice reference, cash collected and delivered status. Revenue numbers must originate from approved quotes, invoices or connected verified payment records.

Metrics: qualified inquiries, time to first response, qualification rate, quotes sent, accepted quotes, sales-cycle duration, actual cash collected (net of refunds), contribution margin after direct costs, cost per qualified lead, cost per won client, and repeat/referral revenue.

Until these sources are connected and verified, show missing metrics as "not tracked", never fabricate results.

## Phase 3: Follow-up and referrals

- Draft first-contact replies, follow-ups, estimates, quotes and handoff messages with owner approval.
- Honor the prospect's preferred contact method and consent, and require approval before messages leave the system.
- Set realistic response targets based on the owner's work schedule.
- Develop optional project-completion check-ins, recurring maintenance options, and referral requests for past clients, never unsolicited bulk mail.
- Treat age-based suggestions as suggestions, not guaranteed alerts.

## Phase 4: Advertising ROI

- Verify the correct Meta business account and pixel, and establish approved write access before launching.
- Proposed initial Facebook test: $49 total across three ad variants over seven days. A daily budget alone is not an enforceable lifetime spending cap.
- Track approved spend, UTM attribution, consented inquiries, qualified leads, quotes, wins and actual payment.
- Compare quality and gross contribution, not only clicks and impressions.
- Never publish or spend without the owner's explicit approval.

## Phase 5: Expand by brand

- Lace & Leather: verified Stripe, Etsy and itch orders/refunds and digital product economics.
- Stag & Stone: pre-opening engagement is not restaurant revenue. After opening, connect approved Square, menu costing, waste and labor metrics.
- Black Stag Web Design: measure service package pricing, delivered hours, scope changes, costs, gross margin and referrals.

## Rules of the engine

1. Keep secrets and customer data private.
2. Never fabricate sales, costs, testimonials, conversion counts or ad results.
3. Require explicit approval for paid ads, outbound contact, invoices and refunds.
4. Honor consent and visitor privacy requirements.
5. Protect live payments and storefronts with staged and tested changes.
6. Prefer measurable revenue and time savings over cosmetic dashboards.
