# Planazo — agent instructions

Canonical for every agent (Claude Code, Codex, …). `CLAUDE.md` just points here.
Linear: fioris / Planazo / PLA — https://linear.app/fioris/team/PLA/all

## 1. A question is not an instruction

When the user asks a question — "did we run X?", "does this handle Y?", "how
hard would Z be?" — answer it and stop. A question is never permission to act
on its subject: "did we run the simplify pass?" is answered with *no*, not by
running the simplify pass.

Start work only when the user actually tells you to: an explicit request
("run it", "fix that", "add the column"), a slash command, or a plan they have
agreed. If the answer makes a next step obvious, name it and offer it; taking
it is the user's move, not yours.

## 2. Never use an em dash

Never use `—` in user-facing copy (app strings, toasts, landing/legal,
`store-assets/APP-STORE.md`). Split into two sentences, or use a colon, comma,
or parentheses. Leave hyphens, code comments, test names, and the empty-value
glyph (`{cap ?? '—'}`). Enforced by `pnpm turbo lint` (`eslint.config.mjs`);
App Store markdown is checked by eye.

## 3. A stated goal is not a proposal

A stated goal is a decision already made. Build it. Do not shrink it into an
optional step 2.

> **Am I about to tell the user something they already know, or ask them to
> re-decide something they already decided?**

If yes, cut it.

Tells to stop:

- "The thing I'd push hardest on…"
- "You may not even need…"
- "Resist doing X until Y proves X is necessary."

Still worth saying: a fact they cannot know without you; a conflict with
something already decided (named once, then do what they asked); a cheaper
path offered as an addition in one sentence, never as a gate.

When the user enumerates, the list is the spec.

## 4. Explain in fewer words

Lead with the answer. Add only the reasoning that changes what they do next,
then stop. Cut restating the question, previews, recaps, extra examples, and
caveats that change nothing. When in doubt, answer short and offer to go deeper.

## 5. Commit where you already are

If the work is on `main`, commit and push on `main`. "Commit that" / "push that"
means the checkout in front of them. Do not invent a branch or PR for it.

Branches are for worktrees / `/start`, decided at the *start* of work, never
retrofitted onto a finished change on main. Solo repo: the user's instruction
overrides any "never commit to main" habit.

## 6. One function, one purpose

A function does one thing. If the name needs an "and", split it.

Every function with logic gets thorough unit tests (happy path, edges, failure
modes). A rule the database also enforces, or that a second app would need,
lives in `packages/shared`; everything else lives in `apps/mobile/lib/`, which
is flat. There are no screen-local `lib/` directories, and adding one is not the
fix for a crowded screen. Glue with no branches does not earn a test; the moment
it grows one, it does.

A hook that has a file lives in `lib/useX.ts`, named for the hook. Hooks do not
live in component files: the import then drags a component into anything that
wants the behaviour, and it hides from anyone reading `lib/` to learn what the
app can already do.

### The data layer

A screen does not open a Supabase query. It calls a `lib/` hook that owns the
key, the select and the options, and the screen renders what comes back.
`usePlanDetail` + `planDerived`, and `useFeed` + `feedDerived`, are the pair to
copy: the hook fetches, a pure function derives, the screen wraps that in a
`useMemo` and draws it. The derivation is where the tests go, which is the whole
reason for the split.

- **A key or select read by two files becomes one exported factory** beside its
  hook. `groupManageQuery` is the model: a shared cache entry is only shared
  while both call sites spell the key and the select identically, and two
  hand-maintained copies drift in silence.
- **A failed write surfaces through `alertActionError`**, never a raw
  `error.message`. A postgres trigger message titled "Error" is not something a
  user can act on. Lint enforces this (PLA-105).
- **A hook wrapping one query spreads it** and adds its own names on top
  (`{ ...query, friends }`), so `isLoading`, `isError` and `refetch` reach the
  screen with react-query's own names. A hook merging several queries returns a
  named object instead. Never alias a react-query field under a new name: a
  caller reading `loading` on one hook and `isLoading` on the next has to learn
  each hook twice. A hook that computes a *different* answer may of course name
  it: `useMyGroups` returns `loading` because `!!user && isPending` is not
  `isPending`, and it says why on the line above.

A comment that states a count, or any census of the repo, is wrong the moment
someone changes the thing it counted, and it fails silently because nothing
tests a comment. State the rule and the reason instead. Two of these have
already had to be corrected: the eslint config claimed seven screens carried a
`max-lines` disable when none did, and CI claimed jest ran at "50%" of the cores
long after the script settled on a literal 3.

## 7. Forms take the keyboard from `FormScreen`

Every screen with a text input uses `components/ui/FormScreen`. No hand-rolled
`SafeAreaView > KeyboardAvoidingView > ScrollView`.

- Primary action goes in `footer`, never at the end of the scroll.
- Nothing else pads for the home indicator.
- No constant makes room for the keyboard (`paddingBottom: 140` and friends).
  `marginTop: 'auto'` for short-screen layout is fine.

Fresh checkout after adding the keyboard controller: native rebuild
(`npx expo run:ios --device "$IOS_SIMULATOR" --no-bundler`).

## 8. Blocking: the shield rule

Settled in PLA-44:

> A block erases you from the blocked person's life, not them from yours. The
> person you block stops seeing what you create, cannot find or contact you,
> and no longer attends your plans. You keep seeing them exactly as before. A
> block is never announced. It never touches what belongs to the group, and
> unblocking restores sight but never what it dissolved.

Load-bearing consequences:

- One `blocked_users` row is one arrow. No imposed symmetry.
- If you can see a plan, you see its full list and its real count.
- Blocking dissolves friendship, pending invites between the pair, and the
  blocked person's seats on the blocker's not-yet-past plans
  (`dissolve_block_ties()`). Past plans stay.
- Contact from the blocked person gets a success-shaped lie; contact *by* the
  blocker toward someone they blocked gets `you_blocked_them`.

Mute is a separate feature if it returns. Never bend this rule to get it.

## 9. Worktrees

Main checkout and worktrees are both first-class. Main is not managed by `wt:*`.
Worktrees live in `../planazo-worktrees/<slug>` with a Metro port, simulator, and
database mode in `.env.worktree`. Prefer `pnpm wt:new` / `wt:setup` / `wt:start`
/ `wt:list` / `wt:rm` over hand-rolled setup.

Inside a worktree:

- Read `.env.worktree` and `apps/mobile/.env`. Never assume main's.
- Never touch another worktree's simulator, Metro, or branch DB. Never kill a
  Metro you did not start.
- Do not run `supabase start` / `db reset` from a worktree (wipes main's stack).
- Shared DB mode **is** main's DB. Schema work needs `pnpm wt:setup --db` first.
- Rebuild native only when `app.json` or native deps change.

`--db` when the issue implies schema/RLS/RPC/trigger work; otherwise shared.
When ambiguous, choose shared and upgrade later.

## 10. Testing and databases

Your database is whatever this checkout's root `.env` says. Never export another
environment over it.

- Unit/component tests: no database. Run anywhere.
- Integration: `pnpm test:integration` from any checkout against that checkout's
  own DB. Suite refuses unknown DBs, shared-mode worktrees with new migrations,
  and unapplied migrations (fix is in the message).
- Merged migrations are immutable; fix forward. Edited-but-applied branch
  migrations need `pnpm wt:db:reset`.
- Deploy pushes migrations on merge to main. Never by hand to production.
- Never start a second jest run while one is in flight. Don't pipe gate output
  through `tail`/`grep`. A sudden jump from ~40s to minutes is starvation, not
  a broken suite. Keep `--maxWorkers=3`.
- Mobile jest runs two projects (PLA-106), split on directory so new files sort
  themselves. `apps/mobile/lib/__tests__/` is the **lib** project: a node
  environment and no RN setup file, which `pnpm test:fast` runs alone in about
  a second. Everything else (screens, components, stores) is the **ui**
  project, with the full `jest-expo` environment. `pnpm test` runs both and is
  still what CI runs. `renderHook` works in either, so a hook test under `lib/`
  is fine where it is; a test that *renders* belongs beside its component.

## 11. Verification matches the change

| The change is… | The proof is… |
| --- | --- |
| copy, a constant, a comment | the diff |
| logic with nothing on screen | the tests (name them) |
| a small visual change isolated to one screen | one simulator pass and a screenshot in the PR |
| a new flow, multiple screens, animation, or major redesign | one simulator pass and a published walkthrough |
| a rebase with no relevant change to the verified UI or its dependencies | the existing proof; no simulator rerun |
| a rebase or conflict resolution that affects the verified UI or runtime behaviour | one simulator smoke pass of the affected flow |
| a rebase or conflict resolution that changes the visible result | update the screenshot or walkthrough |
| native dependencies or app configuration | a native rebuild and simulator verification |

Relevant dependencies include shared UI, navigation, theme, data contracts,
feature flags, and native configuration. Use the changed paths and
`git range-diff` to judge whether rebased work is materially the same. A new
commit hash alone never invalidates proof.

`pnpm turbo typecheck lint test` for logic and visual changes and before a PR,
not after every four-word edit. Visual work gets its initial simulator pass as
required above. Rerun it after a rebase only when the table requires it. Say
what you skipped.

## 12. Every PR ends with proof

Every PR has `## See it working`. Non-visual PRs name the proof diff or tests.
Small visual PRs include a screenshot. New flows, multiple screens, animations,
and major redesigns link a published walkthrough with before/after, captions,
and anything the shots cannot show. Start walkthroughs from
`scripts/walkthrough/template.html`, build with `pnpm walkthrough`, and publish
the `.built.html`. Artifacts start private.

Visual proof records the source tree, simulator and device, required seed or
account state, deep link when available, and reproduction steps. Proof survives
a rebase when relevant behaviour has not changed. In `## See it working`, say
that relevant paths were unchanged, or that the affected flow passed a
post-rebase simulator smoke check. Regenerate a screenshot or walkthrough only
when the visible result changes.

### A PR body describes this PR, never the next one

No follow-ups, "left alone", or future work in the PR body. If a pass finds
something: fix it here when it is the same kind of work; otherwise raise a
candidate Linear issue in the conversation. Commit messages explain this
change only.

Escalate only when being wrong wastes work (verification you cannot do, or the
user's taste). "I found it late" is not a reason. If you can state the correct
behaviour in one sentence nobody would argue with, it is work waiting on you,
not a decision waiting on them.

## 13. iOS Simulator

Use the simulator in `apps/mobile/.env` (`IOS_SIMULATOR`). Inside a worktree,
`pnpm wt:start` boots it. On main, build with `--no-bundler` and launch by UDID
so Expo deep links do not hit the wrong booted sim. Rebuild when adding native
modules (`Cannot find native module '…'`). Do not kill another project's Metro;
pick a free `EXPO_PORT` instead.
