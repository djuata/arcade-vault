---
name: spec-impl-game
description: Implements an Approved game spec exactly like /spec-impl, then runs the skin-designer and mobile-porter subagents sequentially (never in parallel) on the new game so it ships with its skins spec and its mobile spec.
disable-model-invocation: true
argument-hint: <NN-slug-game>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(eza:*), Bash(bat:*)
---

# /spec-impl-game — Implementer of approved game specs + skins + mobile

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`eza specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`bat -pp specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Instructions

This command is `/spec-impl` for **game specs**, plus a post-implementation chain. Follow the phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phase 0 — Load /spec-impl as the base procedure

Read `.agents/skills/spec-impl/SKILL.md` with the Read tool. It is the **single source of truth** for Phases 1–4 (identify the spec, validate the state, create/switch the branch, implement step by step). Do not copy or reinterpret it: execute its Phases 1–4 exactly as written, using `$ARGUMENTS` as the received argument and the session context above.

Everything spec-impl says applies here (never commit automatically, pause after each step, stop on ambiguity, do not implement out-of-scope requests), with only two additions:

1. **Game guard** (below), checked right after spec-impl's Phase 1 locates the file.
2. **Closing override**: spec-impl's "When finishing the last step" message is **replaced** by Phase 5 and Phase 6 of this command.

---

### Game guard (between spec-impl's Phase 1 and Phase 2)

The located spec must be a game spec: `specs/NN-<slug>-game.md`. Extract `<slug>` from the file name (e.g. `10-croac-game.md` → `croac`).

If the file name does not match that pattern, stop and show:

```
❌ This spec is not a game spec (expected specs/NN-<slug>-game.md).
Use /spec-impl <spec> for non-game specs.
```

Do not touch git and do not launch any agent.

---

### Phase 5 — Skins and mobile, sequentially (automatic)

As soon as the last step of the implementation plan is completed, run this phase **without asking for confirmation**.

1. **Check the engine.** Read `lib/games/registry.ts`. If `<slug>` is not a key of `GAME_ENGINES`, stop: the implementation is incomplete and there is no canvas to put skins on. Tell the user and do not launch any agent.

2. **Launch `skin-designer` and WAIT for its result.** Use the Agent tool with `subagent_type: "skin-designer"` (foreground, not background). Prompt:

   ```
   Game id: <slug>
   Phase: A if specs/*-<slug>-skins.md does not exist (write the Draft spec and stop).
   Context: the game was just implemented from specs/NN-<slug>-game.md on branch
   <current branch>; the implementation is NOT committed yet — read the files from
   the working tree (lib/games/<slug>/, lib/games/registry.ts).
   Return: the path and number of the spec you wrote (or the audit result if it already exists).
   ```

3. **Only after skin-designer returns, launch `mobile-porter`.** Use the Agent tool with `subagent_type: "mobile-porter"` (foreground). Prompt:

   ```
   Target: /games/<slug> and /games/<slug>/play
   Phase: A if no mobile spec for this target exists (write the Draft spec and stop).
   Context: the game <slug> was just implemented from specs/NN-<slug>-game.md on branch
   <current branch>, uncommitted. skin-designer just took spec number <MM> (<path>),
   so your spec number must be higher than <MM>.
   If localhost:3000 does not respond, do the static audit and say so.
   Return: the path and number of the spec you wrote.
   ```

4. **NEVER run them in parallel.** Both agents compute their spec number as "highest in `specs/` + 1"; in parallel they would take the same number.

5. **Failures do not block.** If an agent fails or stops (missing id, server down, spec already Implemented), report it in one line and continue with the next step.

These agents only write specs (Phase A). This command does **not** implement skins or mobile changes.

---

### Phase 6 — Final report

Show:

```
✅ All steps of specs/NN-<slug>-game.md are implemented.

Post-implementation:
  🎨 skin-designer  → <path of skins spec> (Draft)   (← or the agent's result/failure)
  📱 mobile-porter  → <path of mobile spec> (Draft)  (← or the agent's result/failure)

Next steps:
  1. Verify the game spec's acceptance criteria one by one. If they pass, set it to
     "Implemented" and commit (feat: ... (spec NN) + docs: mark spec NN as implemented).
  2. Review the two Draft specs. Approve them manually, then re-invoke each agent
     for its Phase B (skin-designer <slug>, mobile-porter /games/<slug>).
```

Never commit on the user's behalf.

---

## Summary of expected behavior

```
/spec-impl-game 15-foo-game   (state: Approved)

  Phase 0  →  Reads .agents/skills/spec-impl/SKILL.md
  Phase 1  →  Finds specs/15-foo-game.md → game guard OK → slug "foo"
  Phase 2  →  "Approved" → ✅
  Phase 3  →  Branch spec-15-foo-game, summary
  Phase 4  →  Implements step by step with pauses
  Phase 5  →  foo in GAME_ENGINES → skin-designer (waits) → specs/16-foo-skins.md
              → mobile-porter (waits) → specs/17-foo-mobile.md
  Phase 6  →  Final report, no commit

/spec-impl-game 14   (specs/14-site-mobile-first.md)

  Phase 1  →  Game guard fails → suggests /spec-impl → stops
```
