# Planazo — App Store and Play Store submission

Everything needed for the 1.0 submission. §1–§6 are the iOS App Store, §7 is
Google Play, and the two share the listing copy, the demo account and the legal
URLs — change one and check the other.

Assets in this folder are generated — `pnpm assets:brand` and
`pnpm assets:screenshots` rebuild them from the design system, so never
hand-edit the PNGs.

---

## 1. Before you build

| Item | State | Where |
| --- | --- | --- |
| App icon, 1024², no alpha | done | `apps/mobile/assets/icon.png` |
| Splash on paper `#FCF8F4` | done | `apps/mobile/assets/splash-icon.png`, `app.json` |
| 6.9″ screenshots, 1290×2796 | done | `store-assets/screenshots/ios-6.9/` |
| Privacy policy URL | done | `https://planazo.me/privacy` |
| Terms of use URL | done | `https://planazo.me/terms` |
| Support URL | done | `https://planazo.me/support` |
| In-app account deletion | done | Profile → Delete my account |
| In-app privacy policy link | done | Profile → Privacy policy (5.1.1(i)) |
| Report content, block users | done | plan sheet, group → Manage (1.2) |
| Objectionable-content filter at posting | done | `lib/moderation.ts`, every shared free-text field (1.2) |
| Terms with an objectionable-content clause | done | `https://planazo.me/terms` |
| Production Supabase in release builds | done | `eas.json` → `preview` / `production` env |
| iPhone-only (`supportsTablet: false`) | done | `app.json` |
| `ITSAppUsesNonExemptEncryption: false` | done | `app.json` |
| Deploy planazo.me with the new pages | **you** | `/privacy`, `/terms` and `/support` must all be live before submitting — the app links to each of them |
| `planazo://reset-password` on the prod allow-list | **you** | Supabase → Auth → URL Configuration |
| APNs key attached to the Expo project | **you** | `eas credentials` |
| Demo account for App Review | **you** | see §5 |

### Build and submit

```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios --latest
```

`appVersionSource: remote` with `autoIncrement` means EAS owns the build
number. Bump the marketing version in `app.json` (`expo.version`) for each
release; leave the build number alone.

---

## 2. App Store Connect metadata

**Name** (30) — `Planazo`

**Subtitle** (30) — `Plans that actually happen`

**Keywords** (100, no spaces after commas)

```
plans,friends,group,rsvp,meetup,poll,dates,availability,hangout,invite,organise,social
```

**Promotional text** (170)

> Put up a plan, set the number of people it needs, and let everyone answer in
> one place. When enough are in, it's on. No more chasing a group chat.

**Description**

> Some plans die in the group chat. Planazo is where they don't.
>
> Put up a plan (a barbecue, five-a-side, a weekend away) and say how many
> people it needs to happen. Everyone answers in one place: in, or can't make
> it. When the minimum is met, the plan is on and everybody knows.
>
> NO DATE YET? NO PROBLEM
> Post the idea without a date and let people tick the days they can do. The
> day the most people can make wins. No forty-message thread to read back.
>
> EVERY PLAN HAS A NUMBER
> Five-a-side needs ten. Dinner needs four. Set the minimum, and optionally a
> cap, and Planazo tracks it for you, so nobody has to count the yeses.
>
> YOUR GROUPS, NOT A FEED
> Planazo is only the people you invited. There is no discovery, no follower
> count, no algorithm. Groups are private and invite-only.
>
> QUIET BY DEFAULT
> One notification when a plan needs you, and one when it's confirmed. That's
> it.
>
> No ads. No tracking. No selling your data. Read the policy at
> planazo.me/privacy.

**Support URL** — `https://planazo.me/support`
**Marketing URL** — `https://planazo.me`
**Privacy Policy URL** — `https://planazo.me/privacy`

**Category** — Primary: Social Networking. Secondary: Productivity.

**Copyright** — `2026 Planazo`

---

## 3. Privacy nutrition labels

Answer the App Privacy questionnaire like this. Every row is checked against
`supabase/migrations`, `apps/mobile/lib/push.ts` and `apps/mobile/lib/sentry.ts`
— if the app starts storing something else, this section changes with it.

**Used to track you: No.** No ad identifiers, no third-party analytics SDKs, no
data shared with data brokers.

| Data type | Collected | Linked to identity | Purpose |
| --- | --- | --- | --- |
| Contact Info → Email Address | Yes | Yes | App Functionality |
| Contact Info → Name | Yes | Yes | App Functionality |
| User Content → Photos or Videos | Yes | Yes | App Functionality |
| User Content → Other User Content | Yes | Yes | App Functionality |
| User Content → Customer Support | Yes | Yes | App Functionality |
| Identifiers → User ID | Yes | Yes | App Functionality |
| Identifiers → Device ID | Yes | Yes | App Functionality |
| Diagnostics → Crash Data | Yes | Yes | App Functionality |
| Diagnostics → Other Diagnostic Data | Yes | Yes | App Functionality |

Notes for each, if asked:

- **Email** — the sign-in identifier. Never used for marketing.
- **Name** — `profiles.display_name`, the name other members of your groups see.
  Chosen at sign-up, editable at any time.
- **Photos** — only the profile photo you choose, and screenshots you attach to
  feedback. The library is read only at the moment you pick something.
- **Other User Content** — group names, plan titles, descriptions, locations
  you type.
- **Customer Support** — feedback messages you send us, and the reason and note
  on any content you report.
- **User ID** — the account id (`auth.users.id`).
- **Device ID** — the Expo push token, one per device where you turned
  notifications on. Expo's own documentation describes it as identifying the
  recipient device, so it is declared here rather than folded into User ID.
  Cleared when you turn notifications off, and on sign-out.
- **Crash Data** — Sentry crash reports, sent automatically when a release
  build crashes (`initSentry()` runs at module scope in `app/_layout.tsx`, and
  both EAS profiles carry a live DSN). A report is the stack trace, app
  version, device model and OS version, plus the account id (`setSentryUser`),
  which is what makes it Linked. Never email, display name or user content:
  `sendDefaultPii` is off, `beforeSend` strips the user object to the id, and
  `beforeBreadcrumb` drops console lines and query strings
  (`apps/mobile/lib/sentry.ts`).
- **Other Diagnostic Data** — app version and device model, attached only to
  feedback you deliberately send.

---

## 4. Age rating

Answer the questionnaire with all "None" — the app has no violence, no mature
themes, no gambling, no unrestricted web access. That lands at **4+**.

One judgement call: Planazo carries user-generated text (plan titles,
descriptions, group names) visible to the invited members of a private group.
Answer **yes** to the UGC question if asked — the moderation in §6 is what
backs that up.

---

## 5. App Review notes

Reviewers cannot get past the sign-in screen without an account, so this field
is not optional.

```
Planazo is invite-only: everything happens inside a private group, so a fresh
account sees an empty state. The demo account below is already in two groups
with live plans.

Demo account
  Email:    review@planazo.me
  Password: <set this before submitting>

What to try
  1. Sign in. The first tab lists the plans waiting on an answer.
  2. Open "…" and tap "I'm in" — the slot bar fills and the status updates.
  3. Open the flexible plan and tick a few dates, then "Send my dates".
  4. Account deletion: tap the avatar (top right) → "Delete my account".
     Please use a throwaway account for this — it is immediate and final.

Moderation (Guideline 1.2)
  - Posting is filtered: slurs and explicit terms are refused in any field
    other members see — plan titles and descriptions, locations, group
    names, display names.
  - Report a plan: open any plan, scroll to the bottom, "Report this plan".
  - Report a group: open a group, Manage, "Report this group".
  - Block someone: open a group, Manage, "Block" beside any member. Their
    plans disappear from your feed immediately. Tap again to undo.
  - The rules are published at planazo.me/terms.

Account deletion is at Profile → Delete my account, per 5.1.1(v).
The privacy policy is reachable in-app at Profile → Privacy policy, per
5.1.1(i).
Planazo signs in with email and password only. There is no third-party or
social login, so Sign in with Apple is not required under 4.8.
```

**Create `review@planazo.me` against production and seed it with two groups and
a few plans before you submit.** Reviewers reject on an empty app.

---

## 6. Known risks

**Guideline 1.2 — user-generated content.** Covered, and worth walking the
reviewer through it. Apple asks a UGC app for four specific things — a
filtering method, a reporting mechanism, a way to block, and published
contact details — and all four exist, plus the terms that back them:

| Apple asks for | Where it is |
| --- | --- |
| A method for filtering objectionable material from being posted | `lib/moderation.ts` (`contentViolation`): every free-text field other members see — plan titles, descriptions, locations, group names, display names — is checked at posting time and refused with a message pointing at the terms. The word list is normalised against lookalike characters (F4GG0T is still caught) and matched on word boundaries, so Scunthorpe keeps its name |
| A mechanism to report offensive content | "Report this plan" on the plan sheet; "Report this group" in group → Manage |
| The ability to block abusive users | group → Manage → **Block** beside any member, and a "Block them too" toggle on the report screen |
| Published contact details | `planazo.me/support` and `hola@planazo.me` |
| Published terms with no tolerance for objectionable content | `planazo.me/terms`, "What you agree not to post" |

Blocking is enforced in the database, not in the client, and it points at the
blocked person: block someone and your plans and photos stop existing for
them — in the feed, in the group and by direct link alike, because
`is_blocked_by()` is part of the SELECT policies and it is the row that
disappears, not a filter a client could forget. They can no longer find you
in people search (a server-side RPC, so their device never learns who blocked
them), a friend request or group invite from them dies silently with a
success-shaped answer, blocking dissolves any friendship and pulls them out
of your upcoming plans (freed seats promote the next person on the waiting
list through the normal machinery), and every plan notification honours the
same direction — new plan, plan confirmed, called off, back on, promoted —
because a push about a plan the database refuses to show would announce the
block. You keep seeing them exactly as before, so blocking never costs the
blocker their own group life. It is one-way and silent — the blocked party is
never told, cannot read the block row, and the member list stays intact, which
is precisely what keeps the Block button reachable if they want to block back.
Unblocking restores sight but never what the block dissolved. The block list
lives at Profile → Blocked people.
Reports are insert-only for the reporter, so nobody can discover who reported
them. Triage happens off the service role.

Two deliberate limits, in case Review asks:
- Blocking does not eject anybody from a group. Removing a member is an
  admin's decision; blocking is a personal one, and a personal choice should
  not silently reshape the group for everyone else.
- The filter is a word list — slurs and explicit terms — not machine-learning
  moderation. Content here is only ever visible to the invited members of a
  private group — no discovery, no public feed, no strangers — so beyond the
  filter, moderation is report-driven, with a committed 24-hour response
  written into the terms.

**Guideline 5.1.1(i) — privacy policy in the app.** Covered: Profile → Privacy
policy, next to Terms of use and Help & support, all three opening
`planazo.me`. The store-listing URL alone is not enough.

**Guideline 5.1.1(v) — account deletion.** Covered. Deleting is immediate and
hands groups over rather than destroying them; the behaviour is written out in
the privacy policy so the reviewer can check the claim.

**Screenshots must match the shipping build.** The gallery is composed from the
real components with the app's real copy, but if any of that changes before
submission, re-run `pnpm assets:screenshots`.

---

## 7. Google Play

The app is a managed Expo prebuild — `apps/mobile/.gitignore` ignores both
`/ios` and `/android`, so EAS generates the Android project and there is no
native folder to maintain. Expo SDK 54 targets API 35, which is current for
Play's target-API requirement.

### 7.1 Before you build

| Item | State | Where |
| --- | --- | --- |
| Adaptive icon on `#F2542D` | done | `apps/mobile/assets/adaptive-icon.png`, `app.json` |
| Notification icon, white on transparent | done | `apps/mobile/assets/notification-icon.png`, `app.json` → `expo-notifications` |
| `default` notification channel | done | `lib/push.ts`, matched by `channelId` in `supabase/functions/send-push` |
| Listing icon, 512² | done | `store-assets/play/icon-512.png` |
| Feature graphic, 1024×500 | done | `store-assets/play/feature-graphic.png` |
| Phone screenshots, 1290×2580 | done | `store-assets/screenshots/android-phone/` |
| Package `com.planazo.app` | done | `app.json` |
| Edge-to-edge (API 35) | done | `app.json` → `edgeToEdgeEnabled` |
| Privacy / terms / support URLs | done | same three as §1 |
| Play Console account, as the **organisation** | **you** | needs the company D-U-N-S; an org account is exempt from the closed-testing gate that personal accounts must clear |
| `google-services.json` | **you** | Firebase → download → commit to `apps/mobile/google-services.json`. `app.json` already points at it, so an Android build fails until it lands |
| FCM V1 service account key | **you** | see §7.2 — without it every Android push silently fails |
| Demo account for review | **you** | the same `review@planazo.me` as §5 |

### 7.2 Firebase and FCM

Two different files, and mixing them up is the usual way this goes wrong:

- **`google-services.json`** — client config. Ships inside the APK, so it is
  not a secret and is committed to the repo. From Firebase → Project settings →
  Your apps → Android app with package `com.planazo.app`.
- **The FCM V1 service account key** — a private key. Never commit it. From
  Firebase → Project settings → Service accounts → Generate new private key,
  then upload it to Expo once:

```bash
cd apps/mobile
eas credentials --platform android    # → FCM V1 → upload the JSON
```

Expo's push service holds the key and signs the sends; `send-push` keeps
talking to `exp.host` exactly as it does for iOS, so no server change is needed
beyond the `channelId` already there.

### 7.3 Build and submit

```bash
cd apps/mobile
eas build --platform android --profile production
```

**The first release has to be uploaded by hand.** The Google Play Developer API
cannot create an app that does not exist yet, so `eas submit` has nothing to
target until the listing exists and has taken one AAB through the console.
Download the AAB from the EAS build page and upload it in Play Console →
Production → Create new release. Afterwards:

```bash
eas submit --platform android --latest
```

As on iOS, `appVersionSource: remote` with `autoIncrement` means EAS owns the
version code. Bump `expo.version` in `app.json` per release and leave it alone.

### 7.4 Listing metadata

Play's fields are shorter than Apple's and do not map one-to-one.

**App name** (30) — `Planazo`

**Short description** (80)

> Put up a plan, set how many it needs, and let everyone answer in one place.

**Full description** (4000) — the same body as §2, unchanged.

**Category** — Social. **Tags** — Friends, Events, Messaging.

**Contact details** — `hola@planazo.me`, `https://planazo.me/support`,
`https://planazo.me`.

**App access** — Play's equivalent of §5's review notes. Give the same demo
account and the same walkthrough; reviewers hit the same sign-in wall.

**Ads** — no ads. **In-app purchases** — none.

### 7.5 Data safety

Play's form is not Apple's questionnaire and is graded against the privacy
policy, so it has to agree with `planazo.me/privacy` line for line.

| Data type | Collected | Shared | Required | Purpose |
| --- | --- | --- | --- | --- |
| Personal info → Email address | Yes | No | Yes | App functionality, Account management |
| Personal info → Name | Yes | No | Yes | App functionality |
| Photos and videos → Photos | Yes | No | No | App functionality |
| Messages → Other in-app messages | Yes | No | No | App functionality |
| App activity → Other user-generated content | Yes | No | No | App functionality |
| App info and performance → Crash logs | Yes | No | No | Analytics |
| App info and performance → Diagnostics | Yes | No | No | Analytics |
| Device or other IDs → Device or other IDs | Yes | No | No | App functionality |

Security practices, all answerable yes: data is encrypted in transit; users can
request deletion (Profile → Delete my account); data collection is not required
for the app's core purpose beyond the account itself.

**Crash logs and Diagnostics are Sentry, not the feedback form.** `initSentry()`
runs before anything else in `app/_layout.tsx` and the production DSN is live in
`eas.json`, so crashes are reported automatically in release builds. The
feedback form's app version and device model are the smaller, separate half of
those two rows.

### 7.6 Content rating

The IARC questionnaire, answered honestly:

- Violence, sexuality, language, controlled substances, gambling — none.
- **Users interact** — yes. Planazo is user-to-user inside private groups.
- **Users share content** — yes: plan titles, descriptions, locations, group
  names, photos.
- **Shares location** — no. `plans.location` is free text a user types, not a
  device location; the app requests no location permission.
- **Digital purchases** — no.

That lands around PEGI 3 / ESRB Everyone with an interactive-elements notice.
The moderation stack in §6 is what backs the interaction answers, and Play asks
for the same four things Apple does.

### 7.7 Play-specific risks

**The first upload is manual.** Covered in §7.3, and it is the single most
common way a first Play release stalls — `eas submit` fails with a confusing
"app not found" until the console has seen one AAB.

**Data safety must match the privacy policy.** Play rejects on disagreement
between the two, and unlike Apple it re-checks on later releases.

**No Android device has ever run this build.** Every Android code path here is
reasoned from the source, not observed. Push in particular cannot be verified on
an emulator at all: `registerPushToken` returns early on `!Device.isDevice`.

---

## 8. Not done, on purpose

- **Localisation.** The app is English; planazo.me still renders Spanish
  (`LANG` in `apps/web/lib/copy.ts`), and the legal pages follow it. Both store
  listings above are English. Worth deciding before launch.
