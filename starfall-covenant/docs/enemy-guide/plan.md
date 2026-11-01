# Live Enemy Guidance Implementation Plan
> For agentic workers: use subagent-driven development and TDD. No Git commits/publishing; parent owns release.
**Goal:** Explain the actual blocker and conditional counterplay without changing combat.
**Architecture:** Pure live-state guidance model, existing battle info dialog, independent engine/app evidence.
**Tech Stack:** TypeScript, native DOM, Vitest/happy-dom, existing battle engine.
**Spec:** docs/enemy-guide/spec.md

## Global constraints
Only this isolated f3c15 formal-derived worktree. Local installed bins. No data/engine/save/PWA/hosting edits, no other worktrees. Own files only. Focused tests/tsc and reports; director serial full/build/gate after all freeze.
## Review focus
- Permanent active vs already-triggered-but-expired: A model tests.
- Fixed bypass absorption but not every shield; ignoreDefense alone does not: C engine/model tests.
- Stale wave and route callbacks, animation: B lifecycle and D true app tests.
- Nested controls and target selection: B view and D true app.
- Skill readiness/CD/seals do not imply guaranteed hit/kill: A model and C independent controls.

## A — model and corrected copy (build_e00)
Own src/ui/enemy-info.ts, src/ui/stage-intel.ts, src/ui/defeat-advice.ts; tests/enemy-guide-model.test.ts; docs/enemy-guide/model-*.
- [ ] RED exact cumulative-copy and enemyGuide actual live-state contract.
- [ ] Implement spec API and bounded truthful guidance.
- [ ] Focused model/stage/defeat tests + local tsc, report/freeze.

## B — accessible existing dialog (prepare_approved_implementation)
Own src/ui/battle-fx/readability.ts, battle-fx.css, src/ui/screens/battle.ts (only info/target DOM and lifecycle integration); tests/enemy-guide-view.test.ts; docs/enemy-guide/view-*.
- [ ] RED visible labelled entry + dialog model sections + stale callback tests.
- [ ] Implement API use, live-state guard, no nested controls; close owned dialog on disposal/replacement.
- [ ] Focused existing readability/target/pause regressions + tsc, report/freeze.

## C — independent mechanics (review_original_fidelity)
Own tests/enemy-guide-engine.test.ts and docs/enemy-guide/engine-* only.
- [ ] Preserve observed true engine controls; add guide comparisons after API ready, no invented feature RED.
- [ ] Absorb threshold, cumulative hit order, fixed/ignoreShield/ignoreDefense, no resurrection, real c307 kill, multiple/expired/unknown guide states.
- [ ] Focused + tsc, report/freeze.

## D — true app (research_original_progression)
Own tests/enemy-guide-app.test.ts and docs/enemy-guide/app-* only.
- [ ] Actual st-2-6 wave2 fixture, true app/engine/Router, only drawing stub.
- [ ] Read/close/keyboard do not change target/board/RNG/save/storage; deliberate target selection still works.
- [ ] Stale route/wave/busy entry rejected, fresh current info correct; no skill execution while reading.
- [ ] Focused + tsc, report/freeze.
