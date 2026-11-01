# Greek stacking D — persistence and protected boundaries

Only new tests/greek-stacking-resume.test.ts plus this report/logs written in isolated formal Greek worktree. No product/old-test/data/schema/PWA/private changes.

## Independent real-engine resume suffix
Actual st-1-1, seed30071, level1 fire Greek c807 leader plus actual c807 helper. An explicit board-only setup snapshot supplies a 6×5 board with one fire triple; no card/leader/enemy/HP/CD/stat tuning. Legal adjacent swaps: bottom row columns4→5, then row3 columns0→1. After constructing the live checkpoint, JSON.stringify/parse feeds real resumeBattle. Both branches execute identical actions independently.

Every returned action, full BattleSnapshot (including RNG), getResult and every Battle.events emission payload (cloned at emission, original emit still called) are compared exactly after each action. No normalization or event subset hides differences. Startup emission is checked separately: original startBattle emits battleStart/waveStart; each resume emits battleStart only, with exact state payload.

Non-vacuous first action: first cascade really clears3 fire; exactly2 newly enhanced fire orbs appear in its after-board; initial board had no enhanced orbs. RNG advances **56394968→2455855254**. The actual trace also defeats the first enemy and transitions wave. Second legal action has0 combo/no drops and preserves RNG while status progression continues; this is disclosed rather than claimed another forced-skyfall action. Full paired trace:
- turn1: combo1, one cascade, player phase, RNG advance;
- turn2: combo0, zero cascades, player phase, RNG unchanged;
- emitted suffix types: enemyDefeated, turnResolved, waveCleared, statusApplied, waveStart, turnResolved, statusExpired;
- both results remain null.

Singleton gameData serialization is unchanged by the test. This proves same-version resume determinism through actual corrected stacking, not historical replay across versions.

## Unchanged compatibility suites
Local focused batch ran original files without edits:
- save.test.ts:19 PASS (raw formal backups/schema/checksum/migrations)
- active-battle.test.ts:8 PASS
- promotion-save-compat.test.ts:3 PASS (old paid ticket resume/no second stamina, corrupt raw retention/recovery)
- promotion-boundary.test.ts:2 PASS (protected runtime/parser/PWA/build and456 baseline assets byte-exact; no experiment coupling)
- pwa-events.test.ts:13 PASS
- new Greek resume:1 PASS
Total **6 files / 46 PASS**, resume-green.log. Local TypeScript exit0, resume-typecheck.log. No full suite/build or device/service-worker activation claim.

## Initial evidence classification and limitations
Initial test mistakenly paired water c806 with a fire board; corrected to actual fire c807 after inspecting source card definitions. Second harness expectation incorrectly required boardChanged on a turn; actual engine emits turnResolved (boardChanged belongs to skill/enemy/status changes). Replaced that nonexistent-event assumption with positive combo in actual turnResolved, preserving complete event equality. Initial logs retained resume-initial.log and resume-event-harness.log. Correct engine integration first-green after these fixture corrections; no product defect or artificial RED claimed.

Existing saved schema/keys/exports remain unchanged and old Greek snapshots receive the newly corrected stacking after resume. No guarantee is made that future RNG consumption/outcomes match the old nonstacking implementation. No phone/manual play, optimality, total-combo guarantee, damage ranking or balance claim. Frozen after terminal checks.
