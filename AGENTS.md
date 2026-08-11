# Planazo — agent instructions

Canonical for every agent (Claude Code, Codex, …). `CLAUDE.md` just points here.

## A question is not an instruction

When the user asks a question — "did we run X?", "does this handle Y?", "how
hard would Z be?" — answer it and stop. A question is never permission to act
on its subject: "did we run the simplify pass?" is answered with *no*, not by
running the simplify pass.

Start work only when the user actually tells you to: an explicit request
("run it", "fix that", "add the column"), a slash command, or a plan they have
agreed. If the answer makes a next step obvious, name it and offer it; taking
it is the user's move, not yours.

**Never use an em dash (`—`) in product copy or interfaces.** It reads as
machine-written, and Planazo's voice is a person talking. This covers every
string a user can see: app screens, toasts, alerts, placeholders, push
notification text, share sheets, the landing page and legal pages
(`apps/web/lib/copy.ts`, `apps/web/lib/legal.ts`, both languages), and the App
Store listing in `store-assets/APP-STORE.md`.

Rewrite rather than substitute a different dash. The replacement depends on the
job the dash was doing:

| The dash was… | Use instead |
| --- | --- |
| joining two full sentences | a full stop, and capitalise the second |
| introducing a list or a definition | a colon |
| tacking on an aside | a comma |
| bracketing a parenthetical (a pair of dashes) | parentheses |
| labelling something optional | `(optional)` |

Splitting into two shorter sentences is almost always the best answer. If the
result reads worse than the original, the sentence wanted restructuring anyway.

Two things this rule does **not** cover:

- **Code comments and test names.** Prose for developers, not users. Leave them.
- **The `—` empty-value glyph** (`{cap ?? '—'}`), which is typography standing
  in for "no value", not a sentence. Leave it.

Hyphens in compound words (`five-a-side`, `invite-only`) are unaffected.

**`pnpm turbo lint` enforces this**, both carve-outs included, so a slip fails CI
rather than reaching a reviewer. See `eslint.config.mjs`. Markdown is outside
ESLint's reach, so `store-assets/APP-STORE.md` is still read by eye.

## Explain in fewer words

Lead with the answer. Then add only the reasoning that changes what the user
does next, and stop.

Cut in this order: restating the question, previewing what you are about to
say, recapping what you just said, the second and third example, the caveat
that changes nothing. A heading with one sentence under it did not need to be
a heading.

Length is earned by the question, not by the work behind it. "How does X work
today?" is a paragraph. A design trade-off may genuinely need a page. When in
doubt answer short and offer to go deeper: asking for more costs the user one
line, wading through too much costs them the whole reply.

## Commit where you already are

**If the work is on `main`, commit it on `main` and push it from `main`.** When
the user says "commit that" or "push that", they mean the change in front of
them, in the checkout they are looking at. Do not invent a branch for it, do not
open a PR for it, and do not ask whether they would prefer one.

Branches exist here for a reason, and the reason is worktrees: a Linear issue
gets a branch because `pnpm wt:new` needs one, and `/start` creates it before any
code is written. A branch is decided at the *start* of a piece of work, never
retrofitted onto a change that is already sitting in main's working tree. Moving
a finished change onto a fresh branch adds a PR, a CI run and a merge to
something the user asked to be done with.

This overrides any general "never commit to main" habit. It is a solo repo with
a solo reviewer, and the user's own instruction is the gate.

## One function, one purpose

Whenever possible, write functions that do one thing and do it well. A function
that fetches *and* transforms *and* renders is three functions wearing one name:
harder to name honestly, harder to reuse, and impossible to test without
standing up everything it touches. If the name needs an "and" to be accurate,
split it.

Small single-purpose functions are what make the next rule cheap to follow:
**every function with logic in it gets thorough unit tests.** Cover the happy
path, the edges (empty, zero, boundary, unexpected order), and the failure
modes, not just one example input. This is where the tests live in this repo:
pure logic belongs in `packages/shared` or a screen's `lib/` (vitest/jest, no
database, run anywhere), which is exactly why extracting it out of components
and RPC call sites pays off. Glue with no logic of its own does not earn a
test; the moment it grows a branch, it does.

## Forms take the keyboard from `FormScreen`

**Every screen with a text input renders `components/ui/FormScreen`.** Not a
hand-rolled `SafeAreaView > KeyboardAvoidingView > ScrollView`, and not a
neighbour copied because it was nearest.

One input is not behind it yet: `JoinByCodeField` on the groups tab's empty
state, which is centred in a non-scrolling view. It is a tab rather than a form
screen, so it needs restructuring rather than wrapping, and nobody has yet
looked at it with a keyboard up to see whether it needs anything at all
(PLA-92).

```tsx
<FormScreen
  header={header}            // the screen's own Cancel / title / Save row
  footer={<Button label={ctaLabel} onPress={post} />}
  testID="create"
>
  {/* fields */}
</FormScreen>
```

`header` is whatever JSX that screen already had above its scroll, hoisted into
a `const`. There is no shared header component yet, and twelve screens hand-roll
the same row.

It owns four things so no screen has to: the safe area, a scroll that insets
itself by the real keyboard height and scrolls the focused field into view, a
footer that rides up and sits on top of the keyboard, and the home-indicator
padding — once, by whichever of the footer or the content is last on screen.

Three rules follow from that, and they are the ones worth remembering:

- **The primary action goes in `footer`, never at the end of the scroll.** A
  first-time user on TestFlight never found "Make your account" because it sat
  at the bottom of a `ScrollView` that the keyboard pushed below the fold, and
  signed in instead of signing up (PLA-69). An action inside the scroll is an
  action you are betting the user will scroll for.
- **Nothing else pads for the home indicator.** `FormScreen` takes the `top`
  safe-area edge and no other, on purpose, and there is no prop to change it.
  Two things padding for the same indicator is how you get a strip of
  background floating above a raised keyboard.
- **No constant makes room for the keyboard.** A `paddingBottom: 140` is a
  guess at a number `FormScreen` measures, and twelve screens carried one tuned
  by eye on whichever phone the author had (PLA-74). This is about what the
  number is *for*, not about the property: `marginTop: 'auto'` pushing a
  privacy line to the bottom of a short screen is fine, and several screens
  still do it.

`react-native-keyboard-controller` is the engine underneath, and
`KeyboardProvider` sits in `app/_layout.tsx` above the router because `(auth)`
and `(app)` have separate layouts. Adding it required a native rebuild, so a
fresh checkout needs one too: `npx expo run:ios --device "$IOS_SIMULATOR"
--no-bundler`.

Check form work on an **SE-class simulator with the keyboard up**, not just the
reviewer's phone. A 16 Pro has ~180pt of slack that hides exactly the class of
bug this section exists to prevent.

## Lint

`eslint.config.mjs` at the root covers every package. It does two jobs, and a new
rule belongs to one of them:

- **Catching bugs**, with off-the-shelf rules from `typescript-eslint` and
  `eslint-plugin-react-hooks`.
- **Enforcing the conventions in this file**, with rules written here because the
  convention is ours: the em dash ban, and a 400-line cap on real code
  (blanks and comments do not count, so commenting well is never penalised).

Rules that are **off** carry the reason next to them. Keep that up: a rule that
is off because it is wrong for this codebase is a decision worth reading, and one
that is off because it got noisy and nobody looked is rot.

Suppressions come in two kinds, and they are not the same thing:

- `/* eslint-disable max-lines -- ... */` at the top of a file is **debt**, and
  points at the issue that removes it (PLA-58, PLA-59, PLA-60).
- An inline `eslint-disable-next-line` with a comment explaining the pattern is a
  **documented exception**, and is meant to stay.

## Dead code

ESLint reads one file at a time, so a file nothing imports and an export nobody
reads both look fine to it. `pnpm knip` resolves the whole import graph and
answers what ESLint structurally cannot: is anything still reaching this?

```bash
pnpm knip       # exactly what CI gates on
pnpm knip:all   # plus the unused-export backlog PLA-64 is clearing
```

CI runs `pnpm knip`, which covers dead files, imports of undeclared packages,
and dependencies nothing uses. Unused *exports* are deliberately not gated yet:
most of them sit in the screens PLA-58/59/60 are splitting up, so the gate
widens once that work lands.

`knip.jsonc` carries every exclusion **with its reason**, on the same principle
as a switched-off lint rule. Most of them are things knip cannot see rather than
things we are choosing to ignore: a Deno edge function whose caller is a
Postgres trigger, a dependency an EAS build shells out to, a test renderer
loaded at runtime. Before adding an exclusion, check it is one of those and not
a real finding.

## Blocking: the shield rule

Every blocking decision in Planazo follows one rule, settled in PLA-44:

> A block erases you from the blocked person's life, not them from yours. The
> person you block stops seeing what you create, cannot find or contact you,
> and no longer attends your plans. You keep seeing them exactly as before. A
> block is never announced. It never touches what belongs to the group, and
> unblocking restores sight but never what it dissolved.

Consequences that follow from it, for any surface touching blocks:

- One `blocked_users` row is one arrow. Symmetry is never imposed; if both
  people block each other there are two rows, and each unblock undoes only
  its own side.
- **If you can see a plan, you see its full list and its real count.** Counts
  are never doctored per viewer; they change only via real joins and
  withdrawals.
- Member lists are load-bearing untouched: the member row is where the Block
  button lives, which is what guarantees the blocked person can always block
  back.
- Blocking dissolves the friendship, pending invites between the pair, and
  the blocked person's participation in the blocker's not-yet-past plans
  (`dissolve_block_ties()`); past plans are history and stay.
- Contact attempts from the blocked person get a success-shaped lie
  (announcing a block is the one thing a block must not do); contact attempts
  *by* the blocker toward someone they blocked get an honest
  `you_blocked_them`.
- People search runs server-side (`search_people`) because the exclusion
  list — who blocked *me* — is exactly what RLS must keep a client from
  reading.

A personal mute ("their plans stop showing up for me") is what the pre-PLA-44
block was. If it returns, it returns as its own feature, never by bending
this rule.

## Linear Integration

- **Workspace**: fioris
- **Team**: Planazo
- **Project URL**: https://linear.app/fioris/team/PLA/all
- **Issue Identifier**: PLA

## Worktrees

Work can happen in the main checkout **or** in an isolated worktree. Both are
first-class — main is deliberately *not* managed by the `wt:*` tooling, so it
stays the simple single-threaded path.

```bash
pnpm wt:new pla-17          # new worktree, shares main's local DB (UI/JS work)
pnpm wt:new pla-17 --db     # ...with its own hosted Supabase branch database
pnpm wt:new pla-17 --no-sim # ...with no simulator, for work with no screen
pnpm wt:setup --db          # give an existing worktree its own DB, mid-work
pnpm wt:setup --sim         # give it a simulator, once the diff says it needs one
pnpm wt:start               # boot its simulator + Metro, connect the app
pnpm wt:list                # every worktree's slot, plus orphaned branch DBs
pnpm wt:rm pla-17           # delete branch DB + simulator + worktree
```

Worktrees live in `../planazo-worktrees/<slug>`. Each owns exactly three things,
recorded in its gitignored `.env.worktree`: a **Metro port**, a **simulator**
(`PLANAZO_SIM_MODE` = `device` or `none`), and a **database**
(`PLANAZO_DB_MODE` = `shared` or `branch`).

### Asked to make a worktree for a Linear issue

`/start PLA-20` runs this whole sequence (issue → In Progress → routed worktree →
inside it → plan together). The steps below are what it executes, and what to
follow when doing it by hand.

When the user says something like *"create a worktree for PLA-20"*:

1. **Read the issue first** (`mcp__linear__get_issue`). You need its title, body
   and labels to choose the database mode — do not guess from the number.
2. **Pick the mode.** Use `--db` when the issue implies a **schema change**:
   migrations, RLS or policies, RPCs, triggers, new tables/columns/indexes,
   `SECURITY DEFINER`, or anything the DB enforces. Otherwise use the default
   shared mode: UI, copy, styling, navigation, state, loading/error states,
   tests, config.
   **When it is genuinely ambiguous, choose shared** — it is free and instant,
   and `pnpm wt:setup --db` upgrades in place the moment you discover you need
   a real database. Guessing "shared" wrongly costs one command; guessing
   "--db" wrongly costs money and minutes.
3. **Name the branch off the issue**, matching the existing convention:
   `fix/pla-20-<short-slug>` or `feat/pla-20-<short-slug>`.
4. **Run it**, then say which mode you chose and why:
   ```bash
   pnpm wt:new fix/pla-20-enforce-plan-cap          # shared
   pnpm wt:new feat/pla-31-group-roles --db         # own database
   ```
5. `cd` into the worktree and `pnpm wt:start` to bring up its simulator and Metro.

**Rules for any session working inside a worktree:**

- Read `.env.worktree` and `apps/mobile/.env` to learn *your* simulator, Metro
  port, and database. Never assume main's.
- **Never touch another worktree's simulator, Metro port, or branch database**,
  and never kill a Metro you did not start. Check `pnpm wt:list` first.
- **Do not run `supabase start` / `db reset` from a worktree.** `config.toml` is
  tracked with a fixed `project_id`, so a worktree attaches to *main's* stack —
  a reset there wipes main's data and every other shared-mode worktree's.
- If `PLANAZO_DB_MODE=shared`, your database **is main's**. Editing
  `supabase/migrations/` changes main's schema. Run `pnpm wt:setup --db` first.
- Integration tests run from **any checkout** against that checkout's own
  database — see **Testing & databases** below.
- No native rebuild is needed for JS-only work: the Dev Client is a generic
  shell and `EXPO_PUBLIC_*` is inlined by Metro at bundle time. Rebuild only
  when `app.json` or the native dependency set changes.

## Testing & databases

One rule: **your database is whatever your checkout's root `.env` says.**
`wt:setup` writes it — main's local stack in shared mode, the branch's own
hosted database with `--db` — and main's `.env` points at its local stack.
Never export another environment's values over it; the suite reads `.env`
itself.

- **Unit/component tests** (jest in `apps/mobile`, vitest in `packages/shared`):
  no database at all. Run them anywhere, always.
- **Integration tests**: `pnpm test:integration` from any checkout. On a
  loopback stack a full run is ~2s; against a worktree's branch database ~55s.
  Tests create their own UUID-namespaced users and groups and delete exactly
  what they created, so concurrent runs from different worktrees never collide
  and nothing needs resetting between runs. The suite never calls the
  rate-limited sign-in endpoint — actors' tokens are minted locally from the
  stack's JWT secret (PLA-84) — so runs cannot be throttled, from any number
  of worktrees at once.
- The suite **refuses to run rather than lie**, with the fix in the message:
  - against a database this checkout doesn't own — only loopback or the
    worktree's own `PLANAZO_BRANCH_REF` are accepted, so production is
    unreachable by construction;
  - from a shared-mode worktree whose branch adds migration files (the verdict
    would be about main's schema, not yours — `pnpm wt:setup --db` first);
  - when the checkout has migrations the target database hasn't applied.
    Fix: `supabase migration up` (loopback) or
    `supabase db push --db-url "$SUPABASE_DB_URL"` (branch DB).
- **Migrations flow one way**: your branch → its branch DB (at `wt:setup`, or
  by hand while iterating) → CI's throwaway stack (every PR) → production (the
  `deploy` CI job pushes on merge to main, after tests pass — never by hand) →
  every other checkout pulls and applies (`supabase migration up` on main after
  a schema PR lands). Nothing ever rolls back on a shared database; a botched
  branch-DB experiment is discarded with `wt:rm` and rebuilt.
- **Merged migrations are immutable.** `db push` matches migrations by version
  timestamp and silently skips edited content, so CI rejects any change — PR or
  direct push — that modifies, deletes or renames a migration that already
  existed. Fix forward with a new migration; only your branch's own new
  migrations are editable.
- **Editing your own applied migration needs a re-apply.** The same version
  matching means `db push` skips an already-applied migration whose file you
  edited. After editing, run `pnpm wt:db:reset` (wipes and rebuilds this
  worktree's branch DB from the current files + reseeds). The suite refuses to
  run while an applied migration has uncommitted edits.
- **CI is the merge gate.** It runs on GitHub's machines with a fresh stack
  carrying *your branch's* migrations, so a schema branch always gets an
  honest verdict there even when no local database can give one. Local suite
  runs are a convenience, not the safety net.

### One test run at a time

The mobile jest suite is ~500 tests across ~55 suites. Healthy, that is
**seconds**: about 6s locally and about 40s on a CI runner. **Two runs at once
starve each other into timeouts**, and a timed-out suite reports as `FAIL` with
a real-looking test name. Chasing those costs more than the run you were
impatient about.

`--maxWorkers=3` is what keeps a run from taking the whole machine. It used to
be `50%`, which reads like restraint and is not: this laptop has 10 logical
cores, so 50% *is* five workers, and three sessions asking for half a machine
each is fifteen workers fighting over ten cores. An absolute number is the only
kind a second session cannot out-vote. Raise it only for a run you know is
alone.

Those numbers are the point of the section, so keep them honest: a run measured
in minutes is the symptom, never the baseline. Quoting a starved figure as
normal is what teaches a reader to accept one.

- **Never start a second run while one is in flight**, including "just this one
  file to see the failure". The answer is already in the first run's output.
- **Don't pipe a gate through `tail` or `grep`** and throw the rest away. The
  failure detail is the whole reason you ran it. Let it print, or redirect the
  full output to a file you can read afterwards.
- **A suite that took 40s yesterday and 217s today timed out**, it did not
  break. Those are both measured runs of the same green suite, five minutes
  apart, and the only difference was a second run competing with it. Check what
  else is running before believing the failure.

## Verification matches the change

Checking costs the user's attention, which is the scarce thing here. Spend it in
proportion to what could plausibly break, and say which tier you used.

| The change is… | The proof is… |
| --- | --- |
| copy, a constant, a comment | the diff. Make the edit and say it is done |
| logic with nothing on screen | the tests. Name the ones that cover it |
| anything a user can see | one simulator pass, screenshots in the PR |

The gate (`pnpm turbo typecheck lint test`) belongs to the last two, and to the
moment before a PR opens. It is not a reflex after every edit: a four-word copy
change does not earn an app relaunch, a database reset and a full gate run.

Two things this does **not** license:

- **Skipping the simulator on something visual because tests pass.**
  `fireEvent.press` never hit-tests, so a pressable buried under a transform or
  an absolutely-positioned sibling passes every jest test and is dead to a real
  finger. Anything layering pressables gets one real tap.
- **Silence about what you skipped.** "Tests pass, not run on device" is a fine
  thing to write. Letting the reader assume otherwise is not.

Decide it twice: once from the issue, when `/start` picks whether to build a
simulator at all, and again from the finished diff, which is the first time the
real answer is knowable. `pnpm wt:setup --sim` upgrades a worktree that turned
out to need one.

## Every PR ends with a walkthrough artifact

A green CI run says the code does what its tests say. It does not say the
feature is worth having, and the person who has to decide that is reviewing on
a phone-sized screen with limited time. Steps they have to run themselves cost
more attention than they have, so **every PR that changes anything a user can
see ends with a link to a published walkthrough artifact** that shows the
change happening, in screenshots, before they decide whether to run anything.

The PR body carries the link and nothing else about it:

```markdown
## See it working

[Walkthrough: a member sees Members, not Manage](https://claude.ai/code/artifact/<id>)

Before and after on the simulator as a plain member, the admin view for
contrast, and what the shots cannot show.
```

**Start from `scripts/walkthrough/template.html`.** It is the page design, the
app's own palette, and a placeholder for every section, so a walkthrough is a
fill-in job rather than a design job. Designing a new page each time costs
fifteen minutes and gives every PR a slightly different-looking artifact, which
is worse than either extreme.

```bash
cp scripts/walkthrough/template.html /tmp/pla-61.html   # then fill it in
pnpm walkthrough /tmp/pla-61.html                       # → /tmp/pla-61.built.html
```

`pnpm walkthrough` turns each `__IMG:name__` token into `shots/name.png`,
downscaled and base64'd inline. That inlining is not a nicety: the artifact CSP
blocks every external host, so an ordinary `<img src>` publishes as a broken
image with no error anybody will see. Publish the `.built.html` with the
`Artifact` tool.

What the page has to contain:

- **Before and after, side by side**, for anything visual. The before shot is
  worth the extra minutes: `git checkout HEAD~1 -- <files>`, let fast refresh
  land, shoot, then restore in the same breath. Without it you have shown that
  the app works, not that the PR did anything.
- **One caption per shot**, saying what to look at. A reviewer should be able
  to read the page without the diff open.
- **The steps anyway**, at the bottom, for whoever does want to drive it: the
  exact `wt:new` / `wt:start --login` lines, the accounts, the taps. A path a
  real user can take beats a script. Signing in as a second account proves the
  trigger fires the way production does; deleting the row with the service role
  only proves the trigger exists. Do **not** write a per-feature seeding
  script: `pnpm db:seed:demo` plus taps in the app is the walkthrough. If the
  state you need is genuinely unreachable that way, say so and give the steps
  to reach it by hand.
- **What the walkthrough cannot show**, in its own section, so nobody reads
  "verified on device" as broader than it is. This matters as much as the
  screenshots.

Two more rules:

- **Say when there is nothing to see.** A refactor, a CI change or a migration
  with no UI needs no artifact. It writes `## See it working` → "Nothing
  user-visible; the proof is the N tests in `<file>`." Silence reads like an
  oversight.
- **Artifacts start private.** Publishing one shares nothing until the user
  chooses to. Hand over the link and let them decide.

### A PR body describes this PR, never the next one

**Work you did not do does not go in the PR body.** No "deliberately left
alone", no "follow-up", no "worth its own issue later". A PR body is read by
someone deciding whether to merge *this diff*, and a paragraph about a change
that is not in it costs them attention on a decision they were not asked to
make. Worse, it is where good findings go to die: nobody re-reads a merged PR,
so a note left there is a note lost.

When a pass turns something up, there is an order to try:

1. **Fix it here.** This is the default and it is not a close call. If it is
   the same kind of work the PR is already doing — a sixth call site of the
   component you just extracted, the same duplication one file further out —
   finish it. The diff growing is fine. One issue quietly becoming four is not.
2. **Raise it in the conversation, as a candidate Linear issue.** When it needs
   a decision the user has not made (a visual change to a screen this PR was
   not about, a schema change, a new dependency), or verifying it would cost
   more than the PR it is riding on, say so *to the user* and propose the issue:
   a title, a sentence of why, and what it would take. Filing it is their call.
3. **Nothing else.** In particular, not a line in the PR body instead of one of
   the two above.

The same rule governs the commit message: it explains the change it carries, not
the one after it.

#### Step 2 is narrower than it reads

Escalating is the comfortable option and it is the one that gets over-used, so
it needs a test rather than a judgment call:

> **Can you state the correct behaviour in one sentence nobody would argue
> with?** If yes, it is not a decision waiting on the user, it is work waiting
> on you.

"A link's own code beats words typed in front of it." "Backing out of a screen
you pushed returns where you were." "Demo data should look like real data."
Nobody argues with any of those. Write the sentence in the PR body, make the
change, and let the reviewer disagree with a diff instead of a question. Step 2
is for the sentence you *cannot* write: which of three placements is right,
whether a screen should look different, what a schema should hold.

Two things that are **not** grounds to escalate:

- **"It would need a copy change."** Copy that stops being true when behaviour
  changes is part of that behaviour change, not a separate decision. A button
  reading "Go to my plans" that now pops back is a bug you introduced, and
  fixing the label is finishing the job.
- **"It is a bug and this was a quality pass."** `/simplify` looks for quality
  and `/code-review` looks for bugs, and that boundary governs what to go
  looking for, never what to do with what you trip over. A bug found in code
  this PR already touches gets fixed in this PR.

The honest reason to escalate is that being wrong would waste work: it needs
verification you cannot do (a device pass, a database you do not own), or a
call that is the user's taste to make. "I found it late" and "it was not in
scope when I started" are not on that list.

## iOS Simulator

**Inside a worktree, `pnpm wt:start` does all of this for you** — it boots the
assigned simulator, starts Metro on the assigned port, and connects the app. The
manual steps below are for the **main checkout**.

**CRITICAL:** Always use the simulator specified in `apps/mobile/.env` (`IOS_SIMULATOR`). Never use a different simulator, even if:
- Another simulator is already booted
- The assigned simulator appears to be in use
- The assigned simulator is shut down (boot it first)

Read the `.env` file to get the simulator name, then use that exact simulator for all operations.

#### Building and Launching

**Always use `--no-bundler`** when building with Expo to prevent deep link issues that can launch the app on the wrong simulator:

```bash
# 1. Get the simulator UDID
UDID=$(xcrun simctl list devices | grep "$IOS_SIMULATOR (" | head -1 | grep -oE '[A-F0-9-]{36}')

# 2. Build and install (without launching via deep link)
cd apps/mobile && npx expo run:ios --device "$IOS_SIMULATOR" --no-bundler

# 3. Start Metro on the configured port (if not already running)
npx expo start --port $EXPO_PORT &

# 4. Launch the app with a deep link to the correct Metro port
xcrun simctl openurl "$UDID" "com.planazo.app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$EXPO_PORT"
```

**Why?**
- Expo's deep links can open on any booted simulator with the app installed, not the one you specified. Using `--no-bundler` and launching by UDID ensures the correct simulator.
- The Dev Client discovers all Metro bundlers on the network. Using `openurl` with the specific port URL forces it to connect to the correct one instead of showing a picker or auto-connecting to the wrong server.
- If `EXPO_PORT` is occupied by another project's Metro (other apps in ~/Solopreneur run their own), start Metro on a free port instead and put that port in the `openurl` URL — do not kill the other project's bundler.

#### Native Packages Require Rebuild

The `ios` folder is **gitignored** and not tracked in version control. When adding a package with native code, you must rebuild the iOS app:

```bash
cd apps/mobile && npx expo run:ios --device "$IOS_SIMULATOR" --no-bundler
```

**Packages that require native rebuild:**
- `expo-image-picker`, `expo-camera`, `expo-location`, `expo-notifications`
- Any `expo-*` package that accesses device hardware or OS APIs
- React Native packages with native modules (check if they have `ios/` or `android/` folders)

**Packages that DON'T require rebuild:**
- Pure JS packages: `lodash`, `date-fns`, `zustand`, `zod`
- Expo packages without native code: `expo-router`, `expo-linking`

If you see an error like `Cannot find native module 'ExponentXxx'`, it means a native rebuild is needed.
