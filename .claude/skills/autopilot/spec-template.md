# Class D spec template

Every section below appears on the Linear issue, filled in, before
`/autopilot ready` promotes a class D issue. The tick executes decisions; it
never makes them. A section left thin is the park you get at 2am — every
decision rule written here is a stop the run does not have to make.

The specs behind run 1 (PLA-104 through PLA-108) are the working examples:
each deviation the run handled well traced back to a decision rule its issue
carried, and the one bullet it refused (PLA-106's `--maxWorkers`) was refusable
cleanly because the spec had named the conflict's shape in advance.

## Class and chain

`D · <title>` in the issue title. Dependencies are declared as Linear
**blocked by** relations on the issue — set now, never discovered mid-run; a
tick skips a Ready issue blocked by anything not Done. Add the **`park` tag**
if the finished PR should wait for the user's eyes instead of merging itself:
taste, product feel, anything where "correct" is not checkable by a review.

## Problem

What is wrong or missing, with `file:line` evidence. Premises stated here may
be wrong; the tick is instructed to test them and record corrections (SKILL.md
Phase 3), so write what you believe *and how you know it* — a premise whose
evidence is stated is a premise a tick can re-check.

## Scope

An exhaustive list. The list is the spec: a tick builds every item and nothing
else. Name the files it will touch where known, and say which items are the
point and which are riding along, so a partial refusal can save the right half.

## Out of scope

Named, not implied. The neighbouring improvement the tick will be tempted by
goes here, with "file it" as the instruction. Schema is in scope only when the
Database section below exists — either way, name the places this work brushes
against schema, so the tick recognizes where the spec's authority ends.

## Decision rules

The forks this work will plausibly hit, each with the call already made.
PLA-104's are the model: "declare a shape next to the query, never `as any`",
"suspect the generated type, not the guard", "files that stop typechecking are
in scope, not drift". Write the rule as an instruction a stranger could apply,
not a preference they must interpret.

## Refusal triggers

What turns this issue into a refusal instead of a worse PR: schema work
appearing, a needed tap chain, a design decision surfacing, a dependency that
turns out unmerged. Refusal re-files the issue with what was learned; a good
trigger list is what makes refusing cheap.

## Database (only when schema moves)

The single section that authorizes touching `supabase/` at all: without it, a
schema need mid-tick is a refusal. Name the migration(s) by intent, the
RLS/RPC surface that changes, and the integration tests that prove them. Its
presence is what makes the worktree `--db` and adds `pnpm test:integration`
to the gate. Two facts to spec around: merged migrations are immutable (fix
forward, never edit), and merging deploys them to the production project —
fine while there are no users, but spec destructive changes (drops, rewrites
of populated tables) as if there were some anyway.

## Proof

Per AGENTS.md §11, named concretely: which test files, which integration
tests when schema moves, which deep link, which screen gets a screenshot or a
walkthrough. The review pass (`code-review` at high) and the `simplify` pass
run regardless and are not this section's job; this section is what the tick
must produce on top of them.
