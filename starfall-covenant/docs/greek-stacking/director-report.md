# Formal Greek stacking — director release review

## Decision / authority
Ready for parent-controlled formal publication from expected main047bc11d6818e262dd91193f0de8a1fd3109c456. User explicitly asked to inspect whether two Greek leaders' orb generation stacks and, if not, make it stack. Parent answered the verified existing distinction: attack already2.5×2.5=6.25, but same-color forced enhanced-orb generation took maximum instead of sum. This correction addresses that specific failed condition, not a claim about an independently verified historical game version.

Isolated root /workspace/scratch/78a951d13ae1/starfall-greek-production/starfall-covenant. Prior formal-helper root and private R23 root remain clean/unchanged. No experiment assets, prototype, recap, namespace, guide or private hosting copied. Parent alone commits/pushes with expected base, verifies CI and live artifacts.

## Reviewed product changes
- src/battle/board.ts: per-cascade/per-orb valid matchedOrbSkyfall contributions add, saturating before multiplication can overflow. Existing positive finite count/spawn validation and flooring retained. Slot quota, deterministic color allocation order, drop/refill/random calls, noSkyfall nonmatching enforcement and MAX_CASCADES50 unchanged.
- src/battle/leader.ts: exactly one explanatory comment changed, evaluator logic byte-identical.
- data/leader-skills.json: exactly l806–l810 description substring `相同連動不疊加`→`隊長與助戰的連動產量相加`; reverse reconstructs entire old file bytes. All rules/numbers/other descriptions unchanged.
- Existing greek-mechanics test changed only old nonstack case title and two expectations; unrelated assertions intact. Four independent new test files.

Single valid effects and absent/empty-effect RNG behavior retain prior semantics. Same-color dual Greek now yields2 forced matching enhanced orbs for3 matched and4 for6 when slots permit. Mixed colors each contribute their own color. Normal2.5/6.25 attack multipliers, enhancedSkyfall chance-max and same-attribute active markAttack replacement/refresh are unchanged. No enemy/stage/reward tuning or relaxation of safety caps. Sealed-orb match exclusion is tested; existing leader-seal versus static effects semantics are outside this user-requested correction and are not claimed fixed.

## Independent evidence
A old/new board cases produced4 actual failures before correction (including old max-spread argument overflow on an oversized test list), then45 focusedpasses/typecheck. B six copy/UI failures then21 focusedpasses/typecheck; actual formal card detail/helper reading of fivecards is read-only with preseen/emptyownership fixture. C actual fivecards each3/6 same-color real submitMove single-vs-helper gave10RED/6controlsPASS before correction, then16new+13existing=29PASS. True attack and five active-mark refresh controls remain unchanged. D real dualfire c807 live/JSONresumed suffix compares all actions, fullsnapshot/RNG/result and every emitted event exactly, requiring2 forcedenhanced orbs and real RNG advance; actual wave transition occurs. Original backup/save/paidticket/PWA/protected-boundary tests unchanged:46 focusedpass/typecheck.

D's initial water-card/fire-board and nonexistent boardChanged-on-turn expectations were test harness mistakes, corrected transparently with full equality retained; not product RED. B/C/A genuine missing-copy/stacking RED distinguished from these mistakes. No safety assertion weakened to obtain final pass.

## Director integrated verification
Session93116 exit0, result collected2026-11-01 05:52UTC:
- **200 files /1528 tests passed**, original default full-suite configuration.
- Original E13 audit57 and E16 audit27 passed.
- Project and both audit TypeScript exit0, no diagnostics.
- Formal Pages build with PAGES_BASE=/my-games/starfall-covenant/ exit0.
- /tmp/verify-greek-production.py read-only gate PASS:473 protected files, exact456 original asset path/hash set,112cards, every other data file exact base, exact five description byte substitutions and exact leader comment, approved source-path allowlist, retained formal PWA/Pages output. No experimental runtime files.
- git diff --check exit0. No director full-suite failure/rerun.
Logs /tmp/greek-production-director-{tests,audit13,audit16,typecheck,build,gate}.log; detailed gate/dist manifest /tmp/greek-production-director-manifest.json. Installed local node tools only, no install/registry/network fetch.

## Compiled identity and freeze
- Dist compact-manifest SHA256 81949758b736287c19ced57f9e1cf936d31ffca6af37d73994a43c71c40ac9bb.
- assets/index-BPX8wk__.js:903555bytes,SHA256 605cf3208a80c13e1379d6870ca0d9c4bd61cc79d7a5ceee58df88ef55ae2fd5.
- index.html:1627bytes,SHA256 4434e47a56a058d53336939437f4725de7a250f1e4778fbeead48cd90c8fcfbc.
- sw.js:14786bytes,SHA256 667aa294431f5d2d99ae1bdfae6d1ed4cfe91537c4677bca28e53359ce12fa83.
- manifest.webmanifest:686bytes,SHA256 254cb479cdb6eed46d9d02c50a5144fa5564f1feab32bd55e30ce819482e1d50.
All writers frozen, final source manifest/pin generated after this report; director then stops writes. Parent validates exact source set/hash and compiled artifacts before publishing. This report is READY, not a claim that publication has already completed.

## Limits
This is an intentional stacking-strength change, not a general balance/optimality/guaranteed combo or infinite-loop promise. Old saved Greek battles load unchanged schema and use corrected behavior on subsequent turns; future RNG consumption may differ from the old nonstack algorithm, so no historical cross-version replay guarantee. No actual phone/browser visual/touch/SW-controller proof. Parent live verification remains separate from engine/DOM tests.
