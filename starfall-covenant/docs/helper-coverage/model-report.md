# Formal helper coverage — Task A model/adapters

Completed and frozen in `starfall-helper-production/starfall-covenant` only, based on formal5929d1ff. Owned changes: new src/ui/helper-support.ts; src/ui/sortie.ts; src/ui/screens/prepare.ts; tests/helper-support.test.ts; this model report/log/hash. No helper screen edits, private prototype/recap/art imports, data/save/engine/economy/PWA/config/assets/deps/Git/publication changes. Parent owns final integration and formal release.

## Behavior

Pure leaderSupportRoster derives all91 existing non-material leader cards dynamically, unique support:cardId, no ownership/seen/NPC-unlock gate. Present leader description and nonempty effect rules required. Existing helperLevel/helperSkillLevel and same count of cleared main-stage definitions determine levels. Fixed-team/no-helper stages return []; other restrictions use unchanged helperProblem. No globals/storage/state writes.

Current party is read through active team slot0 UID→inventory→definition. Empty null positions remain distinct from unresolved UID/definition; no promotion of later members. Missing member data warns. Without valid current leader, all eligible entries sort by stable card ID after hard blocks, with no same-style fiction.

Lexicographic ranking: hard block, known composition/attack-target conflict, same card, same leaderSkill, shared actual condition/effect type, reciprocal explicitly targeted attack coverage, covered known members, stable ID. Tags are never ranking evidence. Actual scalar/array attribute AND race semantics are used. atkMultiplier only contributes attack target coverage; HP/RCV does not. General unfiltered attacks can describe coverage but are not a special reciprocal recommendation by themselves. Coverage is explicitly '(條件另判)' and includes an unknown-position denominator with an incompleteness caution when needed.

Both current leader and candidate teamAll rules check known current members plus candidate. Known mismatches warn that only some whole-team rules fail, not that all effects are disabled. Dynamic HP/combo/matches are never simulated. Shared types indicate similarity only; thresholds/other conditions remain in original full descriptions shown by UI owner. Soft conflicts never hide or disable offers; only stage.problem does.

supportToHelper returns original ChosenHelper shape with support ID in existing npcId field (in-memory choice only). ensureHelper's optional third argument refreshes an explicitly chosen valid support, otherwise falls back through original NPC behavior. Fresh choice remains first valid original NPC; explicit null remains null. prepare passes the complete nonblocked permanent catalog, not a visible/search subset. Existing noHelper oath override, borrowed party, departure/paidticket and persistence code are unchanged.

## TDD / verification

- New six contract tests with empty model skeleton + existing ensureHelper: **6 RED**, real missing catalog/ranking/retention assertions (`model-red.log`).
- Initial model + original helpers: **21/21 GREEN** (`model-green.log`).
- Initial tsc exposed test-only OwnedCard literals lacking required fields; corrected fixtures using complete existing OwnedCard shape, no product type cast weakening.
- Broader focused run (`model-focused.log`): **30 pass / 5 fail**. Model6/helpers15/bond7/E20 paid-ticket reload2 passed. E20 selection3/oath2 failed exact save equality because their old expected seen set contained NPC rows only; newly rendered permanent rows legitimately add seen IDs. Diff showed collection.seen additions, not grants/ownership/stamina loss. Reported to director/D; no legacy test edited by A, no full-suite-green claim. Independent owner handles exact permitted visibility delta under authorization.
- Final owned + baseline helpers/bond: `node node_modules/vitest/vitest.mjs run --no-cache tests/helper-support.test.ts tests/helpers.test.ts tests/helper-bond.test.ts` → **28/28 pass**, exit0 (`model-final.log`).
- Final `node node_modules/typescript/bin/tsc --noEmit` → **exit0** (`model-typecheck.log`). Local installed binaries only, no npx/install/full/build.

Own cases cover actual91/unique IDs/progress scaling/fullsave invariance; hard restrictions; synthetic actual-rule ranking and scalar-array-AND targets versus RCV/tags; null/missing slot0; actual c405 teamAll partial mismatch; permanent adapter/preservation/refresh/removal/defaultNPC/null compatibility. Synthetic rules are test fixtures, not additions to catalog. Independent owners verify actual engine and real app journey, exact seen effects and snapshots.

No mobile visual/touch/PWA rollout or publication claim. No running process at freeze. Full protected-source boundary and final serial validation belong to director.
