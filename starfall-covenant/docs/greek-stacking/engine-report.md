# Formal Greek stacking C — independent actual-engine verification

## Result
True engine RED **10fail/6pass** before runtime correction; after A correction **16/16 new tests +13 existing Greek tests =29/29PASS**. Project typecheck exit0. Owned only `tests/greek-stacking-engine.test.ts` and this report/logs. No product/data/old-test/engine edits by this writer. All owned writes frozen after report.

## Five actual leader/helper cases
Actual cards c806,c807,c808,c809,c810 and actual l806–l810 records, level50, real st-4-2, fixed seed7727. Real startBattle→snapshot fixture→resumeBattle→successful submitMove; no fake resolveBoard, damage or leader evaluator.

For every actual card:
- Single leader no helper vs identical actual card passed as the helper argument. Runtime isHelper count explicitly0vs1.
- Static evaluator receives actual definitions/team and returns1vs2 matchedOrbSkyfall entries, enhancedSkyfall0.
- Authored 6×5 ordinary unenhanced board has exactly one first-cascade matching group, size3 or6 of the actual card attribute. Remaining types cycle through other orb types to avoid extra first matches. First group cardinality/type explicitly asserted; cleared slots3/6 exceed requested2/4, so no quota truncation confound.
- Actual successful move's first ResolveStep.after contains exactly:

| Same-color first match | Single leader | Same-color helper added |
|---|---:|---:|
|3|1 enhanced matching orb|2 enhanced matching orbs|
|6|2 enhanced matching orbs|4 enhanced matching orbs|

All enhanced orbs in that first refill equal those counts; no random enhancement chance supplies a competing explanation. Full input board remains unchanged. Serialized gameData remains unchanged after each test.

Actual evaluateLeaderTurn on the real returned groups/combo/team retains single2.5x and dual6.25x attack multipliers for every member. This confirms leader-rule multiplication, **not** guaranteed actual enemy damage or totalCombo; defense/attributes/cascades remain separate.

## Controls
- Actual c806 water leader +c807 fire helper on `wwwfff / hldhld / ldhldh / dhldhl / hldhld`: real first groups water3/fire3, one enhanced each, actual members receive2.5x each rather than same-color6.25x. Helper is a real runtime helper member.
- Each of all five same-card pairs casts actual mark skills from explicit readyCD fixture. Both casts succeed and both cooldowns become positive; exactly one markAttack buff remains with same attribute and multiplier1.4/dealtDamagefalse. Active marks refresh/replace, not multiply1.4² or become two marks. Ready-CD fixture is disclosed, not naturally charged gameplay.
- Existing `greek-mechanics.test.ts` also runs unchanged by this writer, including mark persistence/expiry, reference defenses and safety behaviors; runtime owner owns the explicitly corrected former nonstack expectation.

## Logs / commands
- `node node_modules/vitest/vitest.mjs run --no-cache tests/greek-stacking-engine.test.ts` before implementation: **10fail/6pass**, log13:47:03, `engine-initial.log`. Failures were the precise actual dual-count1vs2 and2vs4 mismatch, not fixture/type errors. Mixed-color and five marks were already correct first-green.
- `node node_modules/vitest/vitest.mjs run --no-cache tests/greek-stacking-engine.test.ts tests/greek-mechanics.test.ts`: **2files/29PASS**, log13:47:42, `engine-tests.log`.
- `node node_modules/typescript/bin/tsc --noEmit`: **exit0**, no diagnostics, `engine-typecheck.log`.

## Limits
One fixed seed and bounded authored boards per actual card, first-cascade production rather than promised infinite/total chains or balance claims. No historical Tower of Saviors behavior assertion. No full suite/build/Git/deploy/npx/install. No private workspace or other formal tree changed. Director integrates and parent alone publishes after complete formal validation.
