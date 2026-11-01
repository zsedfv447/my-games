# Formal Greek leader stacking — scoped approved correction

## Authority and observed behavior
User explicitly asked whether two Greek leaders stack to produce more matching skyfall, and if not, to make them stack in formal. Parent answered verified current behavior: attack multipliers already multiply2.5×2.5=6.25, but board generation takes max of same-color matchedOrbSkyfall, so two leaders still produce1 forced enhanced orb per3 matched. Independent actual-five-card evidence confirms it. No assertion about an unavailable historical game version. This correction is authorized for formal, separate from private prototype/recap/art.

Worktree /workspace/scratch/78a951d13ae1/starfall-greek-production/starfall-covenant, base047bc11d6818e262dd91193f0de8a1fd3109c456. Original formal-helper worktree and private source immutable. Use local binaries/deps readonly; no installs/network/Git mutations by workers.

## Required behavior
For each cascade and each orb color, ADD valid matchedOrbSkyfall contributions: each floor(matchedCount/floor(effect.count))*floor(effect.spawn). Duplicate effects from leader/helper both contribute. Retain existing finite positive count/spawn validation and flooring; invalid entries contribute0, other colors never contribute to that color. Sum may be safely saturated to available cleared slots to avoid overflow/unbounded allocations. Preserve deterministic ORB_TYPES allocation order and total quota<=cleared slots, dropAndFill no-skyfall matching prevention, MAX_CASCADES50, sealedOrbs behavior, immutable input and same-seed determinism. No extra RNG calls when effect absent; single-effect ordinary behavior unchanged. Under configured normal dualGreek each3same-color contributes2; each6 contributes4 if slots permit. Spawn1+2 totals3. Mixed colors each contribute their own allocation.

Only gameplay product change src/battle/board.ts aggregation. src/battle/leader.ts one inaccurate comment updated, no evaluator logic. Data only five exact descriptions l806–l810 replacing substring `相同連動不疊加` with `隊長與助戰的連動產量相加`; all other bytes/fields/rules unchanged. Their attack2.5, count3/spawn1 stay exact. Existing matching nonstack test expectations must be corrected transparently and RED first. Existing active markAttack remains same-attribute replace/refresh and does not multiplicatively stack; enhancedSkyfall chance stillmax. No data/stats/skill/marks/enemies/stages/rewards/balance retune, no changes to caps to simulate unlimited chains.

## Evidence
A board unit RED→GREEN includes duplicate/mixed/spawn thresholds, malformed values/finite overflow, empty input/zero removed, quotas, noSkyfall and50cap, sealed-orb exclusions, no mutation.
B actual source-reading UI and exact5description contract, no ownership/save changes. All112cards unchanged, all leader rules byte-identical, actual91helper coverage retained.
C independent true-engine fiveGreekcards single vsdouble first-cascade counts plus attack2.5/6.25, helper participation, realmove/RNG, no fake resolver; existing mark/Greek regressions intact. Do not claim guaranteed totalcombo or damage ranking from forcedfirststep counts.
D independent JSONresume vs live suffix for dualGreek exactactions/snapshot/RNG/events, existing paidticket/export/PWA compatibility regressions. No migration/schema change; preexisting saved Greek battle uses new stacking once resumed, as intended mechanics correction, not historical re-simulation guarantee.

Full formal validation and protected boundary are director-owned; parent alone pushes main with expectedbase and monitorsCI/live. Actual mobile/controller QA not claimed. Private exactdata gate must not be weakened as part of this formal task; later private alignment requires deliberate separately-reviewed policy update.
