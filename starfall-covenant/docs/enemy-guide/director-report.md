# Enemy guide — director verified formal candidate

Base f3c15a38690431ba730af193218dd07da7c9b0e7 in isolated starfall-enemy-guide. User explicitly approved formal publication (parent retained contextual ASR reply) after implementation began; parent alone commits/publishes and checks live output.

## Cause and correction
Screenshot st-2-6 wave2 e0008 失控鍋爐 has HP15,000/DEF200/permanent per-enemy turn-accumulated absorption20,000. Real-engine tests prove it can die and cannot resurrect after death from later hits; excess qualifying damage can instead restore HP. Existing stage/defeat advice falsely described single-hit damage. Corrected those two strings; no enemy nerf or engine modification.

Visible keyboard-accessible 情報／攻略 replaces tiny info marker, reusing existing dialog. Independent target control removes nested buttons. Current statuses show thresholds/duration and conditional tactics, trigger history not confused with active duration. Absorber guidance includes reduced burst/across-turn attempts, skyfall/followup caveat, actual team direct-damage methods with original skill text/CD/seals. Fixed bypasses absorption but not every defense; no guaranteed kill/optimal path claim. No unsupported turn-budget snapshot/API added.

Owned dialog closes on route/destroy/wave/state redraw/turn/skill/pause; stale detached, old-wave, busy or invalid session callbacks cannot reopen old info. Read/close does not resume or enable board. Local Escape/Tab/focus and scroll region; no global overlay change. Independent true app tests prove target/board/RNG/full save/every storage write unchanged by reading.

## Review and final serial evidence
A model43focused, B view26focused, C independent mechanics44focused, D trueapp4focused; these overlapping sets are not summed. Initial feature RED logs and harness-only corrections retained. B one concurrent existing pause startup timeout was preserved; focused serial26 passed without timeout/assert relaxation. Director original default worker configuration full run passed once.

Director session69572 EXIT0, logs director-*.log:
- 204 files / 1554 default tests PASS.
- Existing E13 57 and E16 27 audit tests PASS.
- Project + both audit strict typechecks PASS.
- PAGES_BASE=/my-games/starfall-covenant/ local Vite build PASS (existing chunk-size advisory, not performance measurement).
- /tmp/verify-enemy-guide-production.py PASS: exact six UI source paths plus four new test files/docs; all data, src/battle engine and public files byte-identical to f3c15; 473 protected baseline files/456 original assets exact;112 cards; no experiment namespace or experiment-review screen.
- Independent final semantic/lifecycle review PASS, independent-review.md.

No Greek placement, quantities, card/enemy/reward data, save/schema, PWA or hosting changes. No phone visual/touch verification, guaranteed success, original-game parity or deployed-live claim. Parent receives frozen source manifest/pin and exact compiled hashes; source remains frozen until immutable handoff completed.
