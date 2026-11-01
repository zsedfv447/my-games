# Live enemy guidance — Task A pure model and cumulative copy

Completed and frozen in isolated starfall-enemy-guide/starfall-covenant. Only enemy-info.ts, stage-intel.ts, defeat-advice.ts, tests/enemy-guide-model.test.ts and model reports/logs/hash changed by A. No data/engine/rewards/save/schema/PWA/hosting/Greek changes or other-worktree writes. No Git/full/build/install/deploy. Publishing remains parent decision.

## API / factual boundaries

Kept enemyStatRows unchanged. Added enemyGuide(state,index,skills Record by skillID) returning only `{sections:{title,lines}[]}`; invalid index empty. No DOM/global catalog/save/snapshot/current-budget API access. Model reads actual enemy HP/defense/countdown, live statuses and actual local members/skills. Zero/negative finite-turn entries excluded as expired; null is explicitly permanent and does not naturally disappear by waiting. Ability history is separately explained: 已觸發 does not mean expired. Unknown values/types/durations explicit rather than invented; known shield omitted-value default100 follows existing engine. Rotation uses actual turnsOnField-derived attribute.

Absorption explains per-enemy current-turn accumulated applicable post-defense/reduction damage, threshold and excess healing, not resurrection or single-hit cap. Fixed/percentMaxHp/explicit ignoreShield direct damage bypass that absorption branch; ignoreDefense alone does not. Fixed can still face ordinary/attribute/ring defenses. No safe Combo count, guaranteed kill or remaining current-turn budget claim.

Bounded ordinary-team guidance: avoid amplification bursts, reduce current-turn sources/try damage across turns, while Greek skyfall/follow-ups can add hits and fewer Combos are not guaranteed safe. Fixed-method users must check CD/seals. No solver, optimal path or enemy nerf.

Current combo/shield/attribute/ring values and durations are shown with appropriate counterplay. Ring broken state/remaining slots come from live ring parser; heart seal caveat explicitly prevents suggesting sealed hearts can break the heart slot. Other known statuses reuse existing descriptions. Current absorbing enemy optionally gets actual team skills containing at least one direct fixed/percent/ignoreShield damage effect; original full descriptions retained with position/name/CD and actual skill/attribute seals. Other segments separately judged; no claim whole skill bypasses every defense or is currently castable. Missing skill definitions not guessed.

stage-intel damageAbsorb copy now says 本回合累積超過 threshold converts applicable excess to healing. Defeat advice no longer recommends staying near an unknown per-hit budget; says cumulative per-turn, inspect original skills, other defenses separately.

## RED / GREEN evidence

- Typed empty API skeleton + six model/copy contracts: **5 RED /1 empty-invalid pass**, `model-red.log` (missing facts and old single-hit copy, not harness failure).
- Initial implementation: **6/6 pass**, `model-green.log`; surrounding status/outside/matchup focused first41 passed.
- Director bounded copy refinement tests: **2 RED /6 pass**, `model-review-red.log` (ordinary-team/permanent explanation and shield default/heart-seal caveat absent).
- Final focused `node node_modules/vitest/vitest.mjs run --no-cache tests/enemy-guide-model.test.ts tests/status-descriptions.test.ts tests/outside-battle.test.ts tests/matchup-reduction.test.ts`: **43/43 pass**, exit0, `model-focused.log`.
- Final `node node_modules/typescript/bin/tsc --noEmit`: **exit0**, `model-typecheck.log`. An initial in-flight other-owner unused config error was communicated; no other-owner file edited by A.

Tests use actual e0008 startup state and actual skills plus clearly synthetic status/skill combinations for projection branches; preserve full input state and skill map. They do not claim independent real-damage proof; C owns cumulative/fixed/ignoreDefense/ignoreShield mechanics controls, B/D own accessible true app/dialog lifecycle. No mobile visual, guaranteed battle outcome or publication claim. No running process at freeze.
