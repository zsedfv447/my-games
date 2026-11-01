# R18 → production UI promotion review (read-only)

## Baselines and decision boundary
- Local original repo HEAD: `204cbc3eb4b5d8945f63c59270d062d86eac322b`; project `encyclopedia-work/starfall-covenant` (reported original project tree 6425dc).
- Experiment HEAD: `b2f926d0c5c838f7a0ffac14f4b2c70a4ec2f561` (R18). Current dirty entries are documentation only (`docs/experiment/progress.md`, `r18-player-review-path.md`); no UI dirty entries observed.
- Updated by direct read of dedicated promotion root `starfall-production-promotion/starfall-covenant`: HEAD `f247c1ce4b81d00bb069c681703c808d6d588127`, tree `6425dc2aedd043d2f7e8fb934bf8c10e66f4dc0a`; exact tree matches local204cbc3 tree. UI recursive diff is empty, promotion working tree clean. Thus the candidate/mixed inventory applies to this verified baseline. No writes were made there. Parent/director obtained the remote baseline; this worker verified local materialization, not a separate remote fetch.
- No repository writes, Git mutation, build, tests, deployment or network operation in this review. Only this /tmp report written.

## Candidate allowlist (35 paths, all relative to src/ui)
These have no experiment guide/badge/namespace coupling in their observed diffs. They are candidates for three-way comparison onto confirmed current main, not unconditional whole-file overwrites:

```
acquire-guide.ts
acquire-view.ts
app.ts
battle-fx/pause.ts
battle-session.ts
chain-tactics.ts
components/card-picker.ts
components/chain-tactics.ts
components/conversion-filter.ts
components/defeat-guide.ts
components/fixed-tactics.ts
components/orb-assistant.ts
conversion-query.ts
fixed-tactics.ts
oath-stele.ts
practice-picker.ts
screens/abyss.ts
screens/archetypes.ts
screens/battle.ts
screens/cards.ts
screens/collection.ts
screens/enhance.ts
screens/evolve.ts
screens/expedition.ts
screens/login-bonus.ts
screens/prepare.ts
screens/shop.ts
screens/summon-ritual.ts
screens/summon.ts
screens/team.ts
skill-conversion-preview.ts
team-capabilities.ts
team-fit-presentation.ts
tutorial/battle-guide.ts
tutorial/controller.ts
```

Important grouping, not new feature proposals:
- Existing R18 display features: fixed/chain tactics models+components+archetypes insertion; conversion-query/filter+collection; skill-conversion-preview+battle insertion; team-fit-presentation/team-capabilities+team/tutorial consistency. If promotion scope excludes features rather than the existing R18 set, these groups must be explicitly omitted together, not half-copied.
- Acquisition source fixes require acquire-guide+acquire-view together (pool-ID forwarding and periodFirstClear additive union/view/material support).
- Battle guards require battle-session/prepare/home mixed hunk together; battle skill/retreat/continue/win guard changes retain current activeBattle ownership semantics. No engine change is implied by copying UI.
- `app.ts` is NOT experiment-only: its entire observed diff is the broken-save warning settled/current-problem guard, legitimate production safety repair.
- `tutorial/controller.ts` combines team-fit warning consistency with generation-scoped skip confirmation; both non-experiment. It requires presentTeamFit. `tutorial/battle-guide.ts` contains only destroyed/route-confirm guard.

## Mandatory manual mixed-hunk files (4)
1. `screens/home.ts`
   - TAKE disposed flag/onLeave + `maybeOfferResume(nav, () => !disposed)`.
   - EXCLUDE review button creation/data-experiment-review-entry and insertion into sanctuary.
2. `screens/settings.ts`
   - TAKE confirmOnScreen/DialogHandle import; showImport(isCurrent) return handle, closed/current guard, scope/onClose; askReset tri-state + isCurrent; render disposed/resetting/importDialog lifecycle; import replacement and reset pending/retry handlers.
   - KEEP production original export/import/reset/save explanatory strings and version footer.
   - EXCLUDE EXPERIMENT_* import, review CTA, experiment notice panel.
   - Critical mixed single hunk: askReset must use new confirmOnScreen but original production warning (`所有進度都會消失，而且無法復原。確定要重置嗎？`), never experiment-only reset promise. showImport similarly combines lifecycle change and isolated-save prose; separate them.
3. `components/shell.ts`
   - TAKE DialogHandle import, staminaDialog identity/close/consume, route scope/onClose guards.
   - EXCLUDE EXPERIMENT_* import and badge node in constructor. Keep original stage.append starfield/top/main/bottom.
4. `tutorial/flow.ts`
   - TAKE neutral teamFitLines copy (no guaranteed bonus/win claim).
   - EXCLUDE `experiment-review` QUIET_ROUTES entry; original production quiet routes remain.

## Exclude entire UI diffs / files (6)
- `screens/title.ts`: all changes only experiment guide button/import/placement. Preserve original once-start behavior.
- `screens/index.ts`: all changes only experiment-review import/registration.
- `screens/experiment-review.ts`: exclude whole new file; explicitly says independent experimental, production unpublished, incompatible saves. Do not silently relabel/promote as a new production guide.
- `state.ts`: only experimentKey prefs/probe and wrongEnvironment text; retain production storage/save namespace and errors.
- `stage-lookup.ts`: only debug key namespacing; preserve production debug key.
- `theme.css`: only experiment badge and global overlay top offset; exclude ALL additions. Copying offset without badge creates unjustified empty space; copying badge exposes wrong product identity.

## Non-UI isolation files to explicitly reject (cross-owner warning)
- `src/experiment.ts` new environment identity module.
- `src/save/save.ts` experiment save envelope/storage segregation: do not migrate into production; preserve production keys/import compatibility.
- `src/battle/assistant/preferences.ts` diff is only experimentKey wrapping existing preference key. Preserve production preferences.
- `src/pwa/register.ts` experiment disables all SW/update hooks; production must retain its working registration/update behavior.
- Root Vite/base/PWA/manifest/index/assets identity/package/dependencies/.openai, experiment docs/gates/tests must be reviewed separately, NOT copied as a repository overlay. Asset and 18 description-field changes belong to other approved-owner review; no new cards/pools/reward/date values authorized by this UI inventory.

## Promotion checks before writes/publication
1. Baseline check completed locally: full f247c1 SHA/tree above matches204cbc3 exactly. Stage only onto the dedicated promotion workspace after explicit write assignment; parent must recheck remote drift again before publishing.
2. Apply explicit manifest, manual four mixed paths; grep final production src for experimentKey, EXPERIMENT_, experiment-review, experiment-badge, isolated-save/production-unpublished claims. Absence is necessary but not sufficient: preserve original save/prefs/SW behavior by exact comparison/tests.
3. Keep dependency groups intact, run typecheck plus selected true-app/dialog/period/source/codex/tutorial regressions under production namespace. Existing experimental tests may assert isolated keys/guide entries; adapt harness only with precise production requirements rather than deleting assertions to force green.
4. Preserve current production data/cards including other-AI additions; no unrequested feature, character, resource or schema changes. Validate changed description field allowlist separately.
5. Verify production Pages base, SW update/version behavior and full integration before parent publishes. This read-only review did not run them and makes no current-main mergeability or live-deployment claim.
