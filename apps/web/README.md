# web — planazo.me landing page

Next.js (App Router) marketing site for the Planazo mobile app, plus the private
owner workspace. Marketing routes are statically prerendered; `/admin` is
server-rendered against the authenticated Planazo session.

```bash
pnpm --filter web dev      # http://localhost:3100
pnpm --filter web build
```

Port 3100 is deliberate — it stays clear of the Expo/Metro ports the mobile app
uses, so both can run at once.

## Where things live

| Path                          | What                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `app/page.tsx`                | The whole page. Static sections, server-rendered.                |
| `components/PlanDemo.tsx`     | The three interactive plan cards on the landing page.            |
| `lib/copy.ts`                 | All user-facing strings (`es` + `en`) and the demo fixtures.     |
| `lib/links.ts`                | Store URLs and contact address.                                  |
| `app/globals.css`             | Design tokens (colour, elevation, shell width) and base styles.  |
| `app/admin/feedback`          | Private owner feedback inbox and its server actions.             |

## Language

The site renders in Spanish. Every string already exists in English too — flip
`LANG` in `lib/copy.ts` to switch, or promote it to a `[lang]` route segment to
serve both. The design's language toggle was plumbed but never given UI, so
there isn't one here either.

## Responsive behaviour

The design sheds content as the viewport narrows rather than stacking it, and
that's reproduced with media queries (the original used a JS `resize` listener,
which would have cost a hydration mismatch):

- **< 712px** — flexible-date card only
- **712–1043px** — fixed + flexible cards
- **≥ 1044px** — all three
- Circles show 2 / 3 / 4 cards at `< 780` / `< 1000` / `≥ 1000`

## Before launch

- `lib/links.ts` points the App Store URL at TestFlight until launch. Set
  `NEXT_PUBLIC_APP_STORE_URL`, or edit it.
- Privacy and Terms are `href="#"` placeholders. Both need real pages — the App
  Store requires a reachable privacy policy URL.
- No OG image yet; `opengraph-image.tsx` in `app/` would generate one.

## Deploying

On Vercel, set the project root to the repo root and:

- Build command: `pnpm turbo build --filter=web`
- Output directory: `apps/web/.next`
- Install command: `pnpm install`

Turbo skips the build entirely when a commit only touches `apps/mobile`.

## Private feedback inbox

The owner inbox lives at `/admin/feedback`. It uses the existing Planazo
Supabase session and checks the authenticated user against `public.app_admins`
on every request.

The deployed web app requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `LINEAR_API_KEY`, scoped to a Linear account that can read the `PLA` team and
  its labels, upload files, and create issues

The PLA-97 migration grants the existing `devinci.maker@gmail.com` auth user by
immutable UUID. If the production auth user does not exist when the migration
runs, insert that UUID into `public.app_admins` after the account has been
created.
