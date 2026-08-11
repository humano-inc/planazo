---
version: 1
slug: "apps-web-app-admin-feedback-page-tsx"
primary_target: "apps/web/app/admin/feedback/page.tsx"
related_targets: ["apps/web/app/admin/feedback/[id]/page.tsx"]
---

## Scope and mode

Private Operate surface at `/admin/feedback` and `/admin/feedback/[id]` for the sole Planazo owner.

## Job

Scan unresolved user feedback, open one item as complete evidence, then either create a linked Linear issue or mark the item as not doing. The dashboard must show the message, private screenshot, sender, app version, device, and submission time without requiring Supabase.

## Direction

A correspondence desk inside Planazo's established warm visual world. The queue is a compact left-hand index; the selected feedback is one generous evidence sheet on the right. Status is visible through words and small color cues. The memorable moment is the screenshot and message sitting together as one report, followed immediately by the two decisions.

## Constraints

Server-verified Planazo auth and UUID allowlist; no service-role or Linear credentials in the browser; screenshot copied into Linear only after explicit confirmation. Narrow layouts move from queue to a dedicated detail page. Feedback only for PLA-97, with the admin shell reusable for moderation later.

## Unresolved decisions

None.
