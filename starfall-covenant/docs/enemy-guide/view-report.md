# Enemy guide — B view integration

## Scope
Only `src/ui/battle-fx/readability.ts`, `src/ui/battle-fx/battle-fx.css`, `src/ui/screens/battle.ts`, `tests/enemy-guide-view.test.ts`, and this view report/logs. No engine/data/save/global overlay or other worktrees changed by B. Local implementation only; no publication.

## Behavior
- Visible **情報／攻略** text and enemy-specific accessible label, retaining next-action preview. Original `.enemy` remains the animation/target-highlight wrapper but is noninteractive; portrait/name target button is independent of information/status buttons, eliminating nested controls.
- Entry owner fetches current `getState()` and checks session ownership, player phase, animation/assistant resolving guard, pause, wave, enemy identity/HP, and the exact connected current button. `getState()` clones state, so enemy identity is wave/index/ID rather than invalid object-reference equality.
- One current route-scoped info dialog. Replacement, new enemy rendering, intent refresh, skill opening/resolution, turn resolution, pause and view destruction close it. Reading/closing does not enable the board, resume, cast skills, alter targeting or persist anything.
- Uses A's actual `enemyGuide` sections and local battle skills, retaining existing current stats/next attack/ring/trigger history. Local keyboard handler only: focus Close initially; Tab/Shift+Tab cycle the scrollable labelled region and Close; Escape closes and restores the connected trigger. Listener removed on any close. No global dialog behavior changed.
- Scoped styles provide visible minimum-height information control, keyboard outline and scrollable content. No mobile/device/visual QA claim.

## Evidence
- `view-red.log`: 2 genuine RED cases against old code (undiscoverable icon and absent exported lifecycle-aware information presenter).
- `view-green.log`: final serial focused invocation listed below. Tests verify mounted entry/detached callback, actual model sections including permanent 20,000 absorption, state immutability, local Tab/Shift+Tab/Escape focus, route close and idempotent cleanup.
- `view-concurrent-timeout.log`: one final concurrent run had old E17 first-app boot exceed its existing 5,000 ms limit (25 passed/1 timeout); two earlier same-file runs passed all 26. Preserved rather than hidden. Final verification serializes workers, with no timeout or assertion relaxation. Startup contention is a hypothesis, not a browser/product diagnosis.
- Initial tsc found newly-unused renderIntent config argument; renamed `_config` while preserving signature. Test fixture was adjusted to actual `practiceSetup(mode)` / optional RNG factory API before final typecheck.
- D owns separate actual-app target/wave/busy/session/storage evidence; this report does not relabel the unit presenter tests as full-app verification.

Commands:
```
node node_modules/vitest/vitest.mjs run --no-cache --maxWorkers=1 --minWorkers=1 tests/enemy-guide-view.test.ts tests/battle-feedback.test.ts tests/e17-pause.test.ts tests/pause-retreat.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

## Review follow-up
Director requested removing duplicated stat rows already provided by the model. `view-duplicate-red.log` records 1 RED / 1 pass for each of HP/defense/interval/target label appearing exactly once. Removed only the redundant readability import/mapping; original attribute/next-action/history remain. Local region accessibility (tabindex, role/label, two-focus-target cycling) is explicitly asserted.

## Final status
Final source: focused **4 files / 26 tests passed**, local TypeScript **exit 0**, `git diff --check` clean. B's product/test/report writes are frozen for director integration. No full suite/build/commit/publish performed. Browser/device layout and touch gestures have not been visually verified.
