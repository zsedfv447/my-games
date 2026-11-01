# Independent C: actual engine and guide evidence

PASS, owned tests/report only. Root starfall-enemy-guide/starfall-covenant. No product/data/old-test edits, full/build/Git/network/deployment.

## Actual fixtures and findings

Use real e0008 definition HP15000/DEF200/absorb20000. Neutral synthetic hits isolate actual applyHits arithmetic (ordinary amount includes DEF200; no guessed player damage). Post-defense15000 and25000 kill;30000 does10000, leaving5000;40000 does0. Two separate damage calls10000 then30000 preserve takenThisTurn and heal from5000 to15000. A50000 hit at5000HP heals10000. Sequence10000+10000+100000 kills on second hit; third single/all hit is skipped, never resurrecting a dead target.

Fixed15000, maximum-HP percentage damage, and explicit ignoreShield bypass absorption even with preexisting20000 counter; they do not advance that counter. ignoreDefense alone still absorbs. Fixed15000 under ordinary50% or ring50% reduction does7500; ordinary100% blocks it, while explicit ignoreShield bypasses. Thus fixed is not a universal shield bypass.

Actual startBattle/resumeBattle/useSkill fixture: original st-2-6 second wave copied as local one-wave stage, real adjacent e0006 plus e0008, seed13526, c307 level50, explicitly charged CD0 and target1. Actual initialized absorption is turns:null. Real s307 hits enemy1 for15000 fixed, leaves boiler0 and adjacent sentinel10000. Entire global gameData remains unchanged. This fixture does not recreate the screenshot's full party, levels, or RNG and does not grant any save/reward.

## Model paired controls

After A supplied enemyGuide, add real-state comparisons: threshold20000, cumulative/permanent/not-resurrection explanation, absorption-only versus other-shield caveat, original s307 description and CD0. Full state and battle snapshot (including RNG) unchanged by reading; invalid index empty.

For actual cooldown3, whole-team skillSeal2, and wood attributeSeal2: guidance reports each blocker; real useSkill rejects each; complete snapshot unchanged. Multiple absorption/shield50%/combo5 statuses remain independently described with duration. Removing or setting absorption turns0 excludes obsolete skill remedies even though triggered history still contains0. Missing threshold is explicitly unknown, not guessed20000. Removed/zero-status fixtures are model-only comparisons, not a claim the engine keeps expired statuses.

## Commands / observed results

- `node node_modules/vitest/vitest.mjs run --no-cache tests/enemy-guide-engine.test.ts`: initial9/9 PASS, log clock14:18:53 (`engine-initial.log`). These existing mechanics were correct-first-green; no manufactured bug RED.
- After model ready, `node node_modules/vitest/vitest.mjs run --no-cache tests/enemy-guide-engine.test.ts tests/battle-damage.test.ts tests/percent-damage.test.ts`: 3 files44/44 PASS (new12, existing16+16), log clock14:21:02 (`engine-tests.log`). Model checks also first-green, no missing-export run claimed.
- `node node_modules/typescript/bin/tsc --noEmit`: exit0, no diagnostics (`engine-typecheck.log`).

No mobile, screenshot rendering, real-player safe Combo count, guaranteed Greek skyfall, or full-app navigation claim; D owns independent app controls. All owned files frozen after this report, no running processes. Publication remains parent's responsibility.
