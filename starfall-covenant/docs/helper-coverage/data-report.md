# Formal helper coverage C — independent data / engine contracts

## Result
`tests/helper-support-data.test.ts`: **12/12PASS**, project typecheck exit0. Owned tests/report/logs only; no product, data, engine, growth, save or schema edits. All owned writes frozen after this report. Formal root is the assigned `starfall-helper-production/starfall-covenant`, base5929d1ff.

## Evidence
- Independently enumerate actual112 cards by nonmaterial + present nonempty leader definition:91 eligible. Empty-inventory save still receives exactly those91 unique support:cardId entries, no material or extra card, all15 actual archetype tags represented. Read query preserves entire save and serialized gameData.
- Existing NPC historical-tier union exactly38 distinct cards; actual91 minus that union53 missing leaders. Fresh NPC roster still4. This is a verified baseline gap, not91 newly granted owned cards.
- All91 offers at0/9/18/44/45/63 cleared main stages compare directly to existing helperLevel/helperSkillLevel. Full save remains unchanged. No rarity/stat/CD rebalance.
- Null slot0 and unresolved slot0 card definition followed by c405 never promote that later card into same-leader/same-mechanic recommendation. Actual c405 in slot0 receives its own top offer when lineup has no conflict.
- Actual real-engine c405/l405 oracle: mixed c405+c206 with c405 helper gives damageReductions[] but attack multipliers[3.5,1,3.5]; full dragon c405+c107+c405 gives20% reduction; replacing helper with c206 removes it. Model leaves both choices selectable (problemnull), warns only partial composition failure, does not erase other rules. Real Battle/start and evaluateLeaderTurn used; no invented effects or modified engine.
- Actual c710 and c507 conditional leaders remain selectable and receive factual same-leader labels, not currently-active multiplier claims. Actual c710 lacks classicbeast tag, yet team c811+c710 can select c815 without compatibility warning because all are beasts. No tag-only rejection.
- Isolated synthetic copied card/leader IDs only for scalar light / array beast-or-god / light-or-water AND beast filters. Compare coverage N/M to actual engine matchesFilter over actual c811/c710/c806 roster. Unfiltered HP multiplier added as a control must not expand attack coverage. No shared cards/leaders mutated; no synthetic fixture enters catalog/save.
- Every91 card's existing npcForHelperCard result still equals original helper-tier mapping. c801 still maps npc-norse; c805 has no invented NPC. These tests do **not** assert all permanent choices have zero bond: existing38 associated cards preserve existing card-based bond behavior.
- Fixed borrowed stage and stage.noHelper both return empty catalog. Other underlying stage restrictions and oath behavior covered by A/D and original suite, not claimed newly end-to-end here.

## Execution history / honest RED
Initial stub model returned[]. First run had5fail/7pass; six curve loops and bond loop could pass without entries. Added explicit91-entry assertions before those loops rather than accept vacuous green. Complete revised suite then **12fail** against stub, preserved `data-red.log` (log13:11:31); original initial output retained `data-initial.log`. These are new-model absence failures, not existing engine failures. Actual c405 engine assertions were already correct before implementation.

After A model ready: `node node_modules/vitest/vitest.mjs run --no-cache tests/helper-support-data.test.ts` → **12/12PASS**, log13:12:05 (`data-tests.log`).
`node node_modules/typescript/bin/tsc --noEmit` → **exit0**, no diagnostics (`data-typecheck.log`). Earlier concurrent typecheck had only A/B in-progress missing adapter/OwnedCard setup diagnostics; notified owners, did not edit their files.

## Review note / limits
Current implementation additionally requires a nonblank leader description; all91 actual eligible definitions meet it. Future malformed/blank-description definition policy is not certified by actual-data coverage. Model does not simulate HP/combo activation; original skill text remains necessary. No optimality/damage ranking claim.

No full suite/build/Git/deploy/npx/install. Tests are pure model plus real engine oracle, not actual UI selection/return/stale controls or paid battle reload; separate owners/director cover those. Parent alone publishes after integrated verification. No private prototype/art/recap promoted by this writer.
