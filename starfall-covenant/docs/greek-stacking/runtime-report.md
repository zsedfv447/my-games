# Formal Greek stacking — Task A runtime

Completed and frozen in starfall-greek-production/starfall-covenant, baseline047bc11. Original formal-helper and private workspaces read-only/unchanged. Owned changes only board.ts aggregation, leader.ts exact comment, existing Greek test one case, new greek-stacking-board.test.ts and runtime docs/log/hash. No active mark/ATK/enhancedChance/data/save/PWA/deps/art changes. No full/build/Git mutation/install/network/deploy; parent owns publication.

## Runtime

For each existing ORB_TYPES entry and cascade, valid finite count/spawn >=1 retain prior flooring. Each effect contributes floor(matchedCount/floor(count))*floor(spawn); same-color duplicate effects now add. Accumulator is bounded by remaining cleared slots. Before multiplication, groups is compared with remaining/spawn: if it would fill/exceed remaining slots, saturate directly; otherwise multiplication remains below finite slot count. Early break when full avoids unnecessary scanning/arrays and removes Math.max spread argument-limit risk. No arithmetic path allocates from unbounded external spawn.

Existing per-color order, final quota check, forced orb injection, dropAndFill, RNG calls, no-skyfall matching prevention, sealed-orb match selection, and MAX_CASCADES50 untouched. Single contribution behavior remains equivalent; absent/empty effects add no RNG calls. Sealed-orb handling, not leaderSeal evaluation, is covered. No enhanced chance stacking or active mark stacking change.

leader.ts changes exactly approved one comment: `同色消除生成強化珠；各隊長與助戰的產量相加，補珠仍受當段空格上限限制。` Reverse replacement reconstructs baseline bytes. Existing greek-mechanics.test.ts changes only matching nonstack case title and expected duplicate1→2/spawn1+2 result2→3; reverse reconstructs baseline bytes. All other old Greek assertions retained.

## RED / GREEN

- Before runtime change, updated old case + new5 board tests: **4 failures /14 pass** (`runtime-red.log`). True failures: old duplicate expectation, new duplicate/floor case, mixed duplicate colors, long200000-effect spread RangeError at old Math.max. Not an import/harness failure. Existing invalid/cap/sealed/empty paths already passed; not claimed new fixes.
- After bounded sum: `node node_modules/vitest/vitest.mjs run --no-cache tests/greek-stacking-board.test.ts tests/greek-mechanics.test.ts tests/battle-board.test.ts tests/board-ops.test.ts` → **45/45 pass**, exit0 (`runtime-green.log`).
- `node node_modules/typescript/bin/tsc --noEmit` → **exit0** (`runtime-typecheck.log`). Final leader comment wording aligned to director after typecheck (comment-only).

New tests: duplicates3→2/6→4, spawn1+2→3, per-effect fractional flooring; independent mixedcolor contributions and saturated fire-before-water allocation; invalid zero/negative/sub1/NaN/±Infinity settings contribute zero, finite MAX_VALUE multiplication safely saturates, 200000 duplicate effects bounded;50-cascade cap/noSkyfall prevention; sealed fire never counted, empty/no-clear RNG unchanged, deterministic same-seed results and no input/effect mutation. First-cascade enhanced counts are forced-output evidence, not guaranteed total combos/damage ranking.

C independently tests real five Greek cards/attack2.5vs6.25/helper/marks; D independent resume/persistence. This report does not claim those runs or mobile/controller QA. Director owns full protected baseline/data boundaries and final serial validation. No running process at freeze.
