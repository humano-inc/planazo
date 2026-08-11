# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Planazo's primary users are friends coordinating casual plans without relying on scattered chat replies. The private web admin surface has one initial operator: Planazo's owner, signing in with the existing Planazo account `devinci.maker@gmail.com`.

## Product Purpose

Planazo gives a group one shared place to propose fixed or flexible plans, collect answers, and see what is settled. The private feedback inbox lets the owner review what users deliberately send, understand the context attached to it, decide whether to act, and deliberately turn selected submissions into Linear issues without turning every submission into backlog work.

## Positioning

Planazo replaces an unresolved group-chat thread with a lightweight shared decision. Its feedback workflow preserves the same distinction: raw feedback is evidence, while a Linear issue is an explicit product decision made after review.

## Operating Context

- Users submit feedback from the mobile app as `broken`, `idea`, or `other`, with an optional message and screenshot.
- Each submission records the sender, app version, device model, and creation time.
- Screenshots live in the private `feedback-screenshots` Supabase bucket.
- Feedback is currently write-only for mobile users and readable only with elevated server access.
- The owner reviews product work in the Planazo Linear team under `PLA` issues.

## Capabilities and Constraints

- The admin inbox is a private route inside the existing Next.js app in `apps/web`.
- Authentication uses the owner's existing Planazo account. Authorization is restricted to that account and enforced on the server.
- Supabase service-role credentials must never reach the browser.
- PLA-97 covers user feedback only. The information architecture should allow moderation reports to become a separate inbox later.
- Each item stays unresolved until the owner either creates a Linear issue or marks it as something Planazo will not address.
- Linear issue creation requires confirmation, records the resulting issue on the feedback row, and automatically copies any attached screenshot into Linear.
- The Linear credential and screenshot transfer run only on the server.
- The existing mobile feedback submission experience remains intact.

## Brand Commitments

Planazo is warm, social, direct, and practical. Orange is the primary action color, supported by warm sand surfaces, dark ink, pink accents, and sage for settled states. Administrative surfaces should retain this identity while prioritizing dense, calm operation over marketing expression.

## Evidence on Hand

- Product context: `../../docs/planazo-design-context.md`
- Web visual tokens and typography: `app/globals.css` and `app/layout.tsx`
- Mobile feedback submission: `../mobile/app/(app)/feedback.tsx`
- Feedback schema and privacy rules: `../../supabase/migrations/20260729000003_feedback.sql`
- Generated database types: `../../packages/shared/src/database.types.ts`
- Linear work item: PLA-97

## Product Principles

- Keep raw customer evidence separate from committed product work until the owner explicitly confirms issue creation.
- Make the next unreviewed item obvious.
- Preserve enough sender and device context to investigate without another round trip.
- Keep private user content private throughout review and issue drafting.
- Extend to adjacent operational inboxes without mixing their workflows.

## Accessibility & Inclusion

The inbox must be fully keyboard operable, expose clear focus states and semantic statuses, preserve readable contrast, and remain usable on a narrow laptop viewport without hiding core actions.
