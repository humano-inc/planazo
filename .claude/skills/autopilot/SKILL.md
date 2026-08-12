---
name: autopilot
description: Drain Linear's Ready state without supervision — one looped agent takes the smallest unblocked issue from spec to merged main or a parked PR, tick after tick, while the user keeps speccing issues into Ready. Use when the user runs /autopilot, /autopilot sweep to file candidates, /autopilot ready 56 70 to spec-check and promote issues, or /loop /autopilot to run continuously.
argument-hint: "[sweep | ready <numbers> | status | stop]"
---

# /autopilot — one Ready issue, landed, then stop

The queue is a Linear state. **Ready** holds work the user has planned, scoped
and specced for unattended execution; moving an issue into Ready *is* the
approval. The user's half of the loop is keeping that state filled. This skill
is the other half: pick the smallest unblocked Ready issue, build it, prove it,
review it, merge it, record it, stop. `/loop /autopilot` keeps one agent
draining the state for as long as the user keeps feeding it.

**Every invocation ends at a merged commit, a parked PR, a recorded refusal, or
a quiet idle tick when nothing is Ready.** Never at a half-built worktree, and
never at two issues in one PR.

## Ground rules

- **Ready is the mandate.** Work only on issues in `Ready`. Never invent a
  target, never widen one, never fix the interesting thing you noticed next to
  it. If a tick finds something real and out of scope, it files a Linear issue
  in `Backlog` and carries on. That single rule is what the user bought when
  they approved a state instead of a PR.
- **One issue, one PR, one squash commit.** The user's rollback plan is
  `git revert <sha>`. A tick that lands two concerns in one commit takes that
  away.
- **Database work is spec-gated, and class D only.** Classes A–C never touch
  `supabase/`. A class D tick may, but only when its spec's Database section
  names the migration, the RLS/RPC surface, and the integration tests that
  prove it — a schema need the spec never named is a refusal, exactly as
  before. Two facts every DB tick carries: merged migrations are immutable
  (fix forward, never edit), and **merging deploys migrations to the
  production project**. That is acceptable while the app has no users; the
  deploy target is the thing to revisit before it has some.
- **Stop is a real outcome; idle is not stop.** Two consecutive refusals end
  the run — the spec pipeline is producing work the loop cannot safely do, and
  the user needs to see that, not have it worked around. An **empty Ready
  state just idles**: schedule a quiet wake-up and look again, because the
  user may be speccing the next issue right now.
- **Park is the escalation, not the default.** A tick merges on its own when
  the review pass is clean or its confirmed findings were fixed in scope. It
  parks — PR open, proof published, issue In Review — only when a confirmed
  finding cannot be fixed inside the issue's scope, or the spec carries a
  `park` tag because the user wanted eyes on it. A parked issue blocks its
  dependents and nothing else; the drain moves on to independent work.
- **Spend nothing on a reader who is not there.** A tick that merges itself is
  read by nobody, so work whose only product is something for a human to look
  at is time spent on an audience of zero. Proof that catches a regression
  stays, always. Proof shaped for review happens where review actually
  happens: a park, a refusal, the end-of-run summary. This outlives Phase 5 —
  apply it to every capture, every published page, every recap a tick is about
  to write for nobody.
- **Narrate each phase in one line**, so an unattended run reads back cleanly:
  `[PLA-104 · class A · tick 3] 12 exact radii swaps in components/plan · diff-only proof`

## The run state

- **Linear is the queue, whole and only.** No project, no queue file: the
  state machine is the run.
  - `Backlog` / `Todo` — the user's spec pipeline. Not yours to take.
  - `Ready` — specced and approved. Yours.
  - `In Progress` — this tick, exactly one issue at a time.
  - `In Review` — parked: PR open, waiting on the user.
  - `Done` — merged. `Canceled` — dead.
  - A refusal that better speccing could save goes **back to `Todo`** with the
    reason in a comment — that is the hand-off back to the user's pipeline.
  - **Chains are Linear "blocked by" relations**, declared at spec time. A
    Ready issue blocked by anything not `Done` is skipped, not taken.
- **`tmp/autopilot-run.json` is the session log.** Gitignored. Linear survives
  anything; this file just keeps the loop honest across compactions:

```json
{
  "mode": "continuous",
  "landed": ["PLA-104"],
  "parked": [{ "issue": "PLA-110", "pr": 97, "why": "park tag: copy is a taste call" }],
  "refused": [{ "issue": "PLA-109", "why": "schema need the spec never named" }],
  "consecutiveRefusals": 0
}
```

Read it first, write it last, every tick. Missing? Start it fresh and say so —
Linear is authoritative and nothing in this file is precious. If it carries a
`cap`, honor it (a bounded overnight run); by default there is none, because
the user meters the run by what they promote.

## The four classes of work

Each queued issue carries its class in the title prefix. The class decides the
proof, and the proof is the whole reason this work is safe to leave alone.

| Class | The change | The proof (AGENTS.md §11) |
| --- | --- | --- |
| **A · swap** | a hardcoded literal replaced by the token that already holds *exactly* that value | the diff. Pixel-identical by construction |
| **B · normalize** | a near-miss value moved to the nearest existing token | one simulator pass, one screenshot of the result (the before/after pair only on a park) |
| **C · extract** | logic lifted out of a component into `lib/` or `packages/shared`, with unit tests | the tests, named in the PR |
| **D · slice** | a spec-gated feature or refactor slice: multiple files, may add UI or (Database section only) schema | the spec's own Proof section, sized per §11, plus the review pass at high |

### Class A — swap, and the rule that keeps it honest

Replace a literal **only when it equals a token's value exactly**. `borderRadius:
999` → `radii.pill`. `padding: 16` → `spacing.lg`. `borderRadius: 14` → `radii.row`,
or `radii.photoTile` in a photo strip — both are 14, so the choice is about
naming and cannot move a pixel.

Never round in class A. `borderRadius: 17` is not `radii.input`, it is a class B
candidate or nothing.

**A value with no token, used five times or more, is a design decision, not a
chore.** `borderRadius: 22` appears eleven times: standardizing it means either
adding a token to the scale or moving eleven corners. File it as an issue
describing both options and move on. Do not pick one.

### Class B — normalize, and its hard edges

Allowed, because the user said a small visual change is acceptable and a bad one
gets reverted. Bounded, because "standardization" is what an unsupervised agent
calls a redesign.

- **One screen or one component per PR.** This is what keeps the proof at one
  screenshot instead of a walkthrough, and the rollback surgical.
- **A value may move at most 2px**, and never past a neighbouring token. 17 → 16
  yes. 22 → 24 no (see above). 6 → 8 yes, 6 → 16 no.
- **The screen must be reachable by a deep link** (`planazo://...`). If getting
  there needs a tap chain, downgrade the issue to class A or refuse it. Blind
  tap chains drift, and an unattended tick has nobody to notice.
- **Colours are never class B.** The palette carries measured contrast ratios in
  its comments (`accentText` exists because ember is 3.3:1). Nudging a colour to
  a neighbour is not standardization.

### Class C — extract

The repo's own template: one function, one purpose; logic that a jest test can
only reach by standing up the world moves to `lib/` or `packages/shared` and gets
thorough unit tests (happy path, edges, failure modes). No behaviour change. If
the extraction reveals a bug, **do not fix it here** — land the extraction with a
test pinning current behaviour, and file the bug.

### Class D — slice, and the spec gate that admits it

Decently sized work rides the same loop, but only behind a spec written with
the user in the room. A class D issue carries every section of
[spec-template.md](spec-template.md): the problem with evidence, an exhaustive
scope with named non-goals, decision rules for the forks the work will hit,
refusal triggers, and its proof. `/autopilot ready` rejects a D issue missing
any of them — a tick is not allowed to invent the user's decisions, so they
have to already be on the issue.

- **Every decision rule in the spec is a park that does not happen.** The spec
  is where the user's judgment gets spent; the tick executes it.
- UI only where a deep link reaches it — class B's rule, for class B's reason.
  Visual work proves itself per the spec's Proof section, at §11 sizing. A
  Proof section that names a walkthrough is a spec asking for the user's eyes,
  so it parks (Phase 5); everything else captures a result screenshot and
  merges.
- **Database work lives here and only here.** The spec's Database section
  names the migration, the RLS/RPC surface, and the integration tests; the
  worktree is created `--db`; the gate grows `pnpm test:integration`. No
  Database section, no schema change — mid-tick schema need is a refusal.
- Chains are declared as Linear `blocked by` relations at spec time, never
  discovered mid-run.
- A spec may carry a **`park` tag**: build it, prove it, open the PR, leave the
  merge to the user. That is for taste and product calls, where "correct" is
  not checkable. Everything else in class D merges itself once the review pass
  is clean.
- Budget honestly: A–C ticks have run 17–30 minutes; a D tick is plausibly one
  to two hours. Promote with the clock in mind, not just the count.

## Phase 1 — Pick up the run

1. Read `tmp/autopilot-run.json`. Missing? Start it fresh and say so.
2. **Stop now, before any setup, if** `consecutiveRefusals >= 2`, or the file
   carries a `cap` that `landed.length` has reached. Report the run summary
   (Phase 8) and call `ScheduleWakeup` with `stop: true`.
3. `git -C <primary checkout> pull` on main. Every tick starts from a main that
   already contains the previous tick's merge, which is why this loop never
   rebases and never conflicts with itself.
4. List the team's `Ready` issues and drop the blocked ones (any `blocked by`
   relation not `Done`). **None left?** That is an idle tick, not a stop:
   narrate `[idle] nothing Ready · N blocked behind <issue>`, `ScheduleWakeup`
   with `noop: true` and 1200–1800s, and end the invocation. The user fills
   the state; the loop looks again.
5. Take the smallest unblocked issue — class ascending A→D, then priority,
   then oldest — and move it to **In Progress**. Small first is deliberate:
   the run earns its trust on cheap ticks while the user specs the bigger
   slices.

## Phase 2 — Worktree

`pnpm wt:new fix|refactor/pla-XX-<slug>` from the primary checkout. **DB mode
comes from the spec** (AGENTS.md §9): `--db` when its Database section exists,
shared otherwise — a spec that leaves you guessing about schema is incomplete;
refuse it back to `Todo`. `--no-sim` for classes A and C, simulator for class
B, and for class D exactly when its spec's Proof section names a screenshot or
walkthrough. Bash timeout 600000. Then `EnterWorktree`.

The `wt` skill owns every refusal this can produce. A guard that fires is a
refusal (Phase 6), not something to route around.

## Phase 3 — Read before writing

Open the files the issue names and confirm its claims. An issue specced last
week can be stale: the literal may already be a token, the logic may already
have moved.

**If the issue's premise is gone, that is a success, not a failure.** Close it as
Done with a comment saying so, reclaim the worktree, and let the tick count as
neither landed nor refused. Then stop; the next tick takes the next issue.

**A premise that is wrong but leaves real work is corrected, not obeyed.** Test
the issue's claims before building on them; when one falls, do what the
corrected premise implies and record the correction in the PR body and on the
issue — what was claimed, what was found, how you know. The spec's scope still
bounds the work: a fallen premise never widens it.

## Phase 4 — Build it

Exactly what the issue says, at the class's rules. Then the gate, in the
worktree:

```bash
pnpm turbo typecheck lint test
pnpm knip
```

**A tick that touched `supabase/` adds `pnpm test:integration`**, run from this
worktree against its own branch DB. The suite refuses the wrong database and
unapplied migrations, and the fix is always in its message — the `wt` skill
interprets every guard. A tick that did *not* touch `supabase/` never runs it.

`knip` matters here specifically: a class C extraction that nothing imports yet,
or a token swap that orphans a local constant, is exactly what it catches and
what CI will fail on.

Two build rules the run's audit will hold a tick to (both were the audit's only
real findings on run 1):

- **No cast that erases inference** — `as any`, `as unknown as X`, or a
  `@ts-expect-error` silencing a type. If one is genuinely unavoidable, it
  appears in the PR body with its reason; an escape hatch nobody wrote down is
  how typed code quietly stops being typed.
- **A change to any pattern, filter, or matcher** (regex, glob, ignore list,
  lint selector) **is proved by its real set difference**, computed against the
  actual tree and pasted in the PR body — never by a representative example.
  The example you can imagine is not the file that breaks.

## Phase 5 — Prove it, by class

Capture what the tick needs to be safe and nothing past it. Two costs hide
inside "visual proof" and they are not the same size: booting a simulator and
driving it is the expensive one, and it earns its keep because it catches a
screen that renders blank whether or not anyone reads the result. Assembling a
page for someone to look at is the cheap one, and it is worth nothing at all
when the tick then merges itself. Split them.

**A and C**: nothing to capture, and **no simulator** — which is why Phase 2
built these worktrees `--no-sim`. The diff and the tests are the proof. A class
C spec that asks for a simulator pass has described class B or D work under the
wrong prefix: build what the spec says, then say so on the issue, so the next
promotion classes it right.

**B**: `pnpm wt:start --login` in the foreground, never piped through
`tail`/`head`. Confirm readiness by probe (`lsof -ti :$PLANAZO_METRO_PORT`,
`xcrun simctl list devices booted`), not by exit code. Then apply the change,
wait for fast refresh, deep-link to the screen, and screenshot **the result**.
One pass, one shot.

No stash, no before/after pair, no walkthrough on a tick that merges itself.
The shot proves the screen still renders and the value landed where the issue
said; the *comparison* is for a human eye, and a self-merging tick has none.
Name the trade rather than hiding it: a merged class B change leaves no
published picture of itself, and its rollback is the `git revert` that the
squash guarantees. Parking is what turns the pair back on (Phase 7).

**D**: whatever its spec's Proof section names — tests always, integration
tests by name when schema moved, a result screenshot when anything is visual,
captured the way B captures it. **A Proof section that names a walkthrough is
read as a `park` tag**: a change the user thought worth a walkthrough is a
change worth their eyes, so build it, prove it in full, and leave the merge to
them rather than publishing into an empty room.

The `simulator-driving` skill owns the two blockers that trap an unattended tick
(the Expo dev-menu sheet, the SpringBoard "Open in Planazo?" alert). If the
simulator stops responding, invoke it rather than improvising taps. If it is
still stuck after that, refuse — do not merge a class B PR blind.

## Phase 6 — Refuse, when refusing is right

Refuse and move on, never soldier through, when:

- the change needs schema the spec never named, or tests need a database the
  spec never planned for;
- a class B target needs a tap chain, or the simulator will not cooperate;
- the honest fix is a design decision (a new token, a moved cluster of eleven);
- the gate fails for a reason outside this issue (main was already red);
- the diff is drifting past the issue — two concerns, or a third file you did
  not expect.

To refuse: comment the reason on the issue, then route it — **back to `Todo`**
when a better spec could save it (that is the hand-off to the user's pipeline),
or **Canceled** when the idea itself is dead. `pnpm wt:rm <branch>` from the
primary checkout, increment `consecutiveRefusals`, write the run file, and
stop. **A refusal is a completed tick.** Do not immediately try another issue —
the counter exists to end a run whose incoming specs have stopped being safe.

## Phase 7 — Simplify, PR, review, then merge

**Classes C and D take the `simplify` pass first**, while the diff is still
cheap: invoke the `simplify` skill starting from what this branch changed. It
edits code, so it runs before the PR exists and before the body is written;
if it changes anything, re-run the Phase 4 gate. A no-op pass is a good
outcome, not a wasted one. Classes A and B skip it — their diffs are
mechanical by construction, and simplifying a token swap is noise.

```bash
gh pr create --title "<imperative>, matching the repo's convention (PLA-XX)" --body "..."
```

The body describes **this** PR and nothing after it (AGENTS.md §12): no
follow-ups, no "left alone", no future work. It ends with `## See it working`:

- **A**: name the swap and that it is value-identical, listing each literal and
  the token that already held it.
- **B**: the deep link, the simulator, the source tree, and what changed by how
  many pixels. The artifact link as well, but only on a park.
- **C**: the test file and the cases, named.
- **D**: the spec's Proof section, delivered item by item.

The body will be audited by fresh eyes, so write it to survive one: every count
comes from a command run in this session (recount, never remember), every named
file or example is one you verified exists, and a premise correction (Phase 3)
states what was claimed, what was found, and how you know.

**Then the review pass, before the merge.** Invoke the `code-review` skill on
this branch — **medium** for classes A–C, **high** for class D. The level is
deliberate: an unattended tick pays for a false positive twice, once
investigating it and once parking a chain over it, so confidence is worth more
than breadth here. Act only on findings the review confirms:

- confirmed and inside the issue's scope: fix it now, re-run the gate, push,
  and let the merge wait on the new head's CI run;
- confirmed and outside the scope: **park** (below) — never widen the diff to
  chase it;
- unconfirmed: drop it. A tick has no business half-trusting a maybe, and a
  finding that is real will surface again in the end-of-run audit.

Then invoke the **`merge`** skill with the PR number, **from inside the
worktree**. It owns the gate, the squash, the reap hook, and closing the issue.
Four things it does that this loop depends on:

- it waits for a CI run **for the current head SHA** — `main` has no branch
  protection here, so `gh pr merge` will happily merge a red or entirely
  unchecked commit, and this is the only thing standing in front of that;
- it merges with `--squash`, so the user's rollback is one `git revert`;
- it merges from the worktree, so the reap hook reclaims the worktree and
  simulator. Ten ticks that skip this leave ten worktrees behind;
- for a DB tick, it **watches the production migration deploy** after the
  merge. That watch is part of the tick, not optional: a migration that
  deploys red is this tick's mess, found now while the context to fix forward
  is still loaded.

If `/merge` stops at its gate, that is a refusal: Phase 6, with its reason.

**To park instead of merging**: this is the one path that ends with a reader,
so it is the one path that pays for a picture. When the change is visual, stash
it and screenshot the same deep link to get the **before**, pair it with Phase
5's result shot, build the page from `scripts/walkthrough/template.html`, run
`pnpm walkthrough`, and publish the `.built.html` with the `Artifact` tool.
Artifacts start private. (The worktree is still standing, which is what keeps
that before shot reachable this late.) Then leave the PR open with its proof
complete and a comment naming the confirmed finding or the spec's `park` tag;
move the issue to **In Review** with the same comment; append to `parked` in
the run file and reset `consecutiveRefusals` — a park found safe work, it just
found a decision riding along with it. The worktree stays standing: the user
lands the PR later with `/merge` from inside it, so the reap hook still fires.
Dependents of a parked issue stay blocked until the user merges or cancels it.

## Phase 8 — Record and hand back

1. Append to `landed` (or `parked`, per Phase 7), reset `consecutiveRefusals`
   to 0, write `tmp/autopilot-run.json`.
2. One line per tick, so the loop reads back as a list:
   `[PLA-104 · A · tick 3] merged #91 · 12 literals → radii/spacing · no visual change`
3. **Under `/loop`**: after a landed or parked tick, `ScheduleWakeup` with
   `noop: false` and a short delay (60–120s — the next tick's work is local,
   and nothing is being waited on). After an idle tick, `noop: true` and
   1200–1800s. If Phase 1's stop conditions are met, call it with `stop: true`
   and print the run summary: what landed, what is parked and what each park
   waits on, what was refused and where it went, what was filed for the user
   to decide.

## `/autopilot sweep` — feed the spec pipeline

Not part of a tick. Run whenever the user wants candidates.

1. Sweep for candidates of classes A–C. (A sweep cannot write a class D spec —
   those are authored with the user, spec-template.md.) The measurements that
   matter are cheap: `grep -rnE "borderRadius: [0-9]|padding[A-Za-z]*: [0-9]"`
   under `apps/mobile`, cross-referenced against `apps/mobile/theme/tokens.ts`;
   files near the line cap; components with branching logic and no `lib/`.
2. **Dedup against Linear and against known debt** — the `eslint-disable
   max-lines` pointers, the knip exclusions. A sweep that re-files the backlog
   wastes the run.
3. Rank by payoff, cut to 12–15, and **file the survivors in `Backlog`** with
   the class in the title prefix, the exact files and lines, and a `Work`
   section naming the change — written so a tick needs nothing from this
   conversation. Then stop. **A sweep never touches `Ready`**: promotion is
   the user's move, because promotion is the approval.

## `/autopilot ready <numbers>` — spec-check and promote

The user names issues to promote; the naming is the intent, but the gate still
runs. `/autopilot ready 56 70` means PLA-56 and PLA-70 — bare numbers get the
team prefix, full ids are accepted too.

1. Fetch every named issue first. An id that does not resolve, or an issue
   already `Done`/`Canceled`, is reported and skipped; it never blocks the
   others.
2. Read each issue and assign its class (A/B/C/D, §The four classes),
   prefixing the title if nothing has yet. An issue that fits no class —
   a design decision, a change with no bounded proof — is **rejected now**,
   with the reason commented, rather than burned as a mid-run refusal.
3. **A class D issue missing any [spec-template.md](spec-template.md) section
   is rejected the same way**, with the missing sections named: the template
   exists so the user's decisions are already on the issue, and a tick never
   writes them itself. An A–C issue whose `Work` section would not let a tick
   execute without this conversation gets it written now, from what the issue
   and the code say.
4. Declare the chains: where the promoted issues depend on each other or on
   open work, set the Linear `blocked by` relations now, never mid-run.
5. Move the survivors to **Ready** and report each with its class, its
   one-line change, and the expected clock (a D tick is an hour or two, not
   twenty minutes), plus the rejects and why. End with the command:
   `/loop /autopilot`.

## `/autopilot status` / `stop`

`status`: print the `Ready` list with blocked-flags, the issue in
`In Progress` if any, and the run file. No work. `stop`: `ScheduleWakeup` with
`stop: true` and print the Phase 8 summary.
