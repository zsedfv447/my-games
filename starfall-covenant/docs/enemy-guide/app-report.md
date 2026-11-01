# Live enemy guide D — true-app evidence

Only new tests/enemy-guide-app.test.ts and app report/logs owned. No product/old-test/data/engine/save/PWA/hosting/private edits, full suite/build/Git/install/publication.

## Actual battle fixture
Actual st-2-6, seed2606, real c305+c307 level70 team. Two real empty turns expire the initial wave's skill seal. Explicit isolated snapshot cooldown charging permits real c305 useSkill to defeat wave1 and naturally create wave2 e0006/e0008 with actual onStart absorption. Another explicit charged-CD checkpoint supports UI skill readiness and the later wave-advance control. No handcrafted enemy/status/HP or altered engine definitions. Existing beginActiveBattle/recordBattleSnapshot produce a valid persisted ticket; this is a test-only prepared checkpoint, not naturally earned player progression. Story checkpoints/settings are prepared before zero-write windows.

## Four cases
1. Visible 情報／攻略 accessible entry opens actual boiler dialog. Exact current rows: HP15,000/15,000, DEF200, next attack3 turns; active absorption permanent, threshold20,000 and cumulative wording; distinct already-triggered history; actual c307 定量 and CD0 skill reference. Opening/reading/Escape/close preserve complete battle snapshot (target/board/RNG included), complete save, every local/session storage mutation trace and engine skill/move call counts. Escape restores source focus. A deliberate independent target click selects enemy1 while board/RNG remain unchanged and no skill/storage action occurs. DOM contains no enclosing nested target button around the info button.
2. Actual settings route departure closes owned guide; detached old entry cannot reopen, mutate engine/save, write storage or navigate.
3. Actual Canvas pointer move calls real submitMove; its board drawing promise is deferred. Connected old info callback is refused while resolving. To observe actual completion rather than an early board CSS state, open existing pause, release drawing, await its retreat-enabled refresh from resolveTurn finally, then resume and read current living enemy's true HP. No stale dialog or read effects.
4. Real c305 skill via actual UI advances to wave3. After rendered current targets are present, old boiler info button is disconnected and cannot open stale content. Current enemy info opens with current name and no boiler identity; subsequent reading is zero-write/action.

## Harness and limitations
Real app/Router/state/session/engine and quest subscribers; only Canvas context/layout/pointer-capture and drawing playSteps/playRefill stubbed. No rule/model/engine-result mock. All eventful skill/move actions precede their own new readonly baseline; their legitimate save persists are not mislabeled zero-write.

Initial integration overlapped completed UI and returned2PASS/2harness errors: guide uses 累積/CD0 rather than guessed 累計/冷卻; busy follow-up incorrectly assumed board CSS enabled meant animation finished. Corrected to actual text/live enemy and exact pause finally marker, no fixed settling delay. Initial app-initial.log retained; no product RED claimed. A transient shared tsc snapshot caught B's unused config parameter while work was ongoing; B fixed it.

Final local focused test: **4/4 PASS**, app-green.log. Local project tsc: **exit0**, app-typecheck.log. These are DOM and deterministic engine tests, not image decoding, phone/controller/touch/visual QA or guaranteed strategy/kill evidence. Publication remains parent-owned. Frozen after terminal checks.
