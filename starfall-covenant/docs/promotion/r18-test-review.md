# R18 → production regression port review (read-only)

## Decision summary
Selectively port general feature/safety regression tests, **not the experimental test directory wholesale**. Preserve production save compatibility tests and production storage/backup contract. Keep experimental guide/isolation/build-gate assertions out of the production test run. Existing main is not an implementation target; only the director-provided isolated promotion worktree may receive a later explicitly assigned change.

No repo file was edited, no tests/full suite/build/Git/deploy run by this reviewer. This report and scratch reference listings under /tmp are the only writes. This is a port plan, not a passing production regression result.

## Verified bases
Latest director-provided worktree: `/workspace/scratch/78a951d13ae1/starfall-production-promotion/starfall-covenant`, parent worktree HEAD reported `f247c1`, branch `codex/promote-r18-20261101`. Experimental candidate: `/workspace/scratch/78a951d13ae1/starfall-experiment-site` (director identifies R18).

Independently read/hash-compared latest worktree with original `/workspace/scratch/78a951d13ae1/encyclopedia-work/starfall-covenant`:
- src:230 files, tests:111 total files, data:20 files, assets:456 files; each relative path+SHA set identical.
- Baseline has98 root `.test.ts` files; experiment has194, i.e.96 added. Two existing test files differ: `save.test.ts`, `acquire-guide.test.ts`.
- All456 experimental asset paths and hashes equal latest production baseline. Both data sets have112 cards/15 archetypes.
- Data differences are exactly18 fields in3 JSON files, independently enumerated below. These observations are local file evidence, not a fresh remote revision attestation. Director must recheck remote movement before any merge.

## 1. General tests to port with corresponding approved implementation
These E-prefix names are historical checkpoint labels, not a reason to omit useful coverage:
- E01/E02: team-fit classification/presentation and conversion preview/skill dialog.
- E03 content/engine-fixed/prepare/view (exclude release gate file).
- E04 data-conversion/query/view/navigation; retain exact query/back/readonly and collection ownership distinctions.
- E05 active-copy/display/display-battle/engine-descriptions/tutorial-fit (exclude release gate).
- E07 departure/continue; E08 acquisition-team/defeat-recovery/new-player/pool-route/saved-battle/win-lifecycle; E09 action dialogs/lifecycle/retreat/stale skill.
- E10 sale/shop/summon/crossflow; E11 enhance/evolve/growth-app/growth-modes.
- E12 settings-lifecycle plus backup-restore/save-recovery **after production fixture adaptations below**; E13 warning.
- E14 expedition-login/ritual/session/team-picker; E15 oath/app/tutorial/app; E17 assistant/navigation/pause/practice.
- E18 chain engine/model/view and first two navigation cases (third guide-specific case excluded).
- E19 capability model/view/engine/navigation; E20 helper-selection/oath-helper/helper-resume (probe fixture adaptation).
- E21 berserk copy/engine/view; E22 archetype copy/engine/view (exclude release gates).
- E23 card-image-dom is general read-only DOM evidence. E23 resolution file mixes transferable image fallback/ordering checks with optional tool parity; split by case if tool is not ported.
- E24 active/Greek/oath saved-battle equivalence; E25 acquisition pure model/view/data/navigation.

Keep all actual safety assertions: same-task double actions, fade50ms, detached200ms, same-stage replacement, callback consumption, normal retry, storage payload/resource deltas, ownership/claim invariants. Adapt environment assumptions only; never make unsafe production behavior pass by deleting a safety assertion.

### Fixed audits are also transferable safety evidence
Port `audit/e13/{a-resource,b-team,c-navigation}.test.ts` and `audit/e16/{practice,pause,navigation,assistant}.test.ts`, together with their dedicated configs/typecheck configs or deliberately equivalent production-test placement. Seven files; currently repaired strict suites should pass, not `it.fails` or expected RED. The only explicit experiment API dependency found in these files is E16 assistant pref key (below).
Historical scope/manifest/README may be retained as review documentation, but must not imply production is universally safe or require an experimental release badge. Re-run separate audit configs explicitly; default test runner does not include them automatically.

## 2. Do NOT port unchanged
### Experimental environment / guide
- `tests/experiment-isolation.test.ts`
- `tests/experiment-crossflow.test.ts`
These require prefixed keys, tagged backups, rejection of production saves, no access to production keys, and permanent experiment badge. Every one is the wrong contract for production.
- `tests/e06-entry.test.ts`, `e06-guide.test.ts`, `e06-navigation.test.ts`, `e06-practice-app.test.ts`
- `tests/e12-review-guide.test.ts`
These test experiment-review route/entries/guide-copy/badge and tutorial quiet treatment for that experiment-only route. Do not create production experiment screens to satisfy them.
- `e18-chain-navigation.test.ts`: omit only the third case `guide appended E18 entry...`; preserve the first two real chain-info/quickview/back/unlock cases.

### Experimental release gate
Exclude these five files and their current CLI dependency from production acceptance:
`e03-release.test.ts`, `e05-release.test.ts`, `e18-chain-release.test.ts`, `e21-berserk-release.test.ts`, `e22-archetype-release.test.ts`.
Their checker `tools/verify-experiment-release.mjs` pins experimental hosting identity, prohibits unprefixed **production** storage, assumes experimental no-SW deployment and sibling original path. Blindly adapting these by relaxing guards is unsafe. Instead authorize a separately scoped promotion validator using exact18 copy logic but production hosting/storage/PWA requirements. No such tool is written in this task.

### Optional source-only tooling, not a gameplay dependency
`e20-source-manifest.test.ts` is generic tool-hardening evidence for verify-source-manifest, not gameplay and not inherently isolation-specific. `e23-card-budget-tool.test.ts`, `e23-card-budget-integrity.test.ts`, and tool-parity portions of `e23-card-image-resolution.test.ts` require card-asset-budget tool. Include only if director explicitly includes those read-only tools in promotion; otherwise keep evidence in experiment and omit dependent cases, retaining independent DOM/fallback tests. Do not carry experiment hosting/source publication pins or logs into product runtime.

## 3. Exact fixture adaptations identified
1. **Keep baseline `tests/save.test.ts` intact.** Experimental version changed raw-base64 export regex to STARFALL-EXPERIMENT tag, invalid-code reason to wrongEnvironment, and frozen v2/v3 imports to rejection plus direct parseSave. Production must continue testing frozen v2/v3 through actual importSaveCode, not bypass importer via parseSave. No need to port those changes.
2. `tests/acquire-guide.test.ts` two semantic changes ARE legitimate: gacha go now includes actual pool-standard ID; material source allowed kinds adds periodFirstClear. Port these two expectations with corresponding feature, not save.test experimental edits.
3. `tests/e12-backup-restore.test.ts`: production-key sentinel list currently includes actual SAVE_KEY and prefs/probe; using unchanged fixture in production corrupts its own target storage and incorrectly forbids legitimate accesses. Use explicit **experimental-prefixed** sentinel keys as inactive-neighbor storage, keep genuine production SAVE_KEY writes and reset/import assertions. Replace export-prefix expectation with original raw-base64+roundtrip contract. Retain exact reset remove/set, successful restore full ticket, canceled/stale callback zero writes, HP/board/CD/RNG/oath/drops and no repeated rewards.
4. `tests/e12-save-recovery.test.ts`: same sentinel inversion/removal issue; remove EXPERIMENT_EXPORT_PREFIX import. Replace the old raw-code-rejected scenario with a genuinely invalid/checksum-damaged code, or explicitly tagged experimental code rejected by normal production parser, while retaining successful **raw production** recovery. `good.slice(prefix.length)` must NOT remain a rejection test: good raw production code should succeed. Replace experiment-review route-leave target with existing collection/home/settings-away route and assert that actual hash. All corrupt-bytes-preserved/cancel/fade/replacement checks remain.
5. `tests/e20-helper-resume.test.ts`: replace experimentKey('__starfall_probe__') with production actual `__starfall_probe__`; continue asserting exactly its startup set1/remove then zero resume writes. Do not suppress all writes.
6. `audit/e16/assistant.test.ts`: pref key becomes actual `starfall-covenant.orb-assistant.request.v1`, no src/experiment import; preserve every current preference/snapshot/no-stale-save assertion.
7. `e04-navigation` already checks suffix __starfall_probe__; e10 crossflow/e11 growth/e20 oath-helper use endsWith('starfall.save'). Those work for both namespaces, but production promotion tests should prefer the actual exported SAVE_KEY for exact routing rather than rely only on suffixes. This is tightening, not a prerequisite to erase meaningful coverage.

Do not add a fake src/experiment compatibility shim in production merely to compile old tests. Explicitly eliminate environment-only imports, route assumptions and sentinel conflicts.

## 4. Mandatory production no-loss acceptance
Run in isolated fake browser storage only; never read/migrate a real user's localStorage during test automation.
- Original98 suites retained and baseline outcome recorded before port; updated acquire-guide assertions justified as above. No broad baseline replacement.
- Preserve production keys: SAVE_KEY='starfall.save', UI prefs='starfall.ui-prefs', assistant pref suffix without experiment prefix; debug/probe behavior reviewed separately. Existing production export remains plain base64. Do not require experiment tag or reject valid old backups.
- Frozen original v2/v3 export fixtures import through normal production API and migrate only documented fields. Original current-version serialize/import/export roundtrip remains valid.
- Seed a current save using untouched baseline serializer with representative inventory UIDs/levels/locks, all teams, activeTeam, currency/tokens, chapter/stage progress, collection seen/owned/claimed, gacha history/pity, quest counters/claims, current period reward keys, settings and active paid battle snapshot. Boot promoted real app at a controlled date, verify exact intended preservation; account legitimate period/regen bookkeeping explicitly, never blanket ignore writes.
- Normal real settings export → reset cancel → reset confirm → raw import → actual module/UI reload/home resume: complete ticket/helper/oaths/HP/board/CD/RNG/drops/stamina preserved and no duplicate resource reward. Default boot must not clear a valid save or open new-game flow unexpectedly.
- Corrupt checksum/raw bytes remain intact through warning dismissal, settings changes and invalid import; valid production backup recovers; old import/reset callbacks cannot overwrite newer progress.
- Reading codex, chain information, source capabilities and periodic acquisition does not grant inventory/collection milestones or claim period rewards. Weekly claimed sources remain playable but not re-awardable; lifetime clear is not current-period claim.
- No new production access to experimental-prefixed storage or migration from it without a separate approved migration feature. Reject experimental tagged code without mutating production save.

## 5. Exact data/asset/build acceptance
Independently observed permitted18 field set:
- data/archetypes.json: fixed.summary/howToPlay; chain.summary/howToPlay; berserk.summary/howToPlay; heart.summary/howToPlay; race.summary; skillcycle.summary/howToPlay (11).
- data/skills.json: s103/s110/s205/s305/s410.description (5).
- data/leader-skills.json: l205/l403.description (2).
Require approved verbatim old/new tuples, original unique records and whole-byte reconstruction; every other data byte unchanged. Keep baseline3 SHA pins as original-source authentication, not hashes updated to accept mutated baselines. Card112/archetype15 count alone is insufficient; verify IDs, rosters, rules, effects, cooldowns, rewards/unlocks unchanged.

All456 assets must keep relative paths/bytes/SHA identical to latest production baseline. No conversion, resizing or image-generation carried over. Preserve production hosting identity/config and existing PWA/SW/cache behavior unless separately reviewed; experimental no-SW rules are not production rules. No permanent experiment badge or experiment-only guide route/entry should appear in production bundle. Tooling/test assets are not a reason to copy experiment deployment config.

## 6. Sequencing / approval stop
1. Director pins latest remote+production worktree and confirms no baseline movement (local file equality proved here only).
2. Separate explicitly assigned port work in `starfall-production-promotion`, never main or frozen experiment source. Select files/hunks, no wholesale copy.
3. Production raw-save compatibility tests first, then related feature/safety tests, seven fixed audits, all baseline/general suites and typechecks. Director alone owns serial full/build/data+asset/production-identity gate.
4. Review product diff for experiment imports/labels/storage/tag/SW leakage and protected files, inspect final source manifest; stage isolated preview if authorized.
5. Merge/publication requires the user's/director's explicit production promotion process. This read-only review neither edits main nor authorizes deployment. Any remaining failure must be classified before acceptance; do not claim experiment-green is production-green.
