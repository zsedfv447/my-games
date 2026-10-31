# Approved: unified encyclopedia and read-only quick view

User approved on 2026-10-31: unify the encyclopedia/archetypes entry, keep cards/archetypes/enemies tabs and old routes, make display portraits and recommended card names open an introduction, close back to original position, and distinguish first-acquisition rewards, acquisition-progress milestones and the existing opening gift. No new cards, economy/save changes or broad redesign. Root coordinates review/publication after implementation.

Quick view uses the existing dialog styling, but owns its Escape/focus/history behavior locally. Opening pushes a same-URL history entry; browser/Android Back closes it without triggering hash navigation or remounting the originating screen. In-app Back dismisses an active preview first. Repeated clicks reuse one preview. Explicit navigation consumes the preview marker before routing; stale Forward markers are normalized rather than producing an invisible overlay. No global confirmation/battle-dialog behavior changes.

Quick view is read-only (no rewards or owned actions), shows card/skills/CD/leader/roles and a full-encyclopedia link. Its close restores the originating focus and leaves scroll untouched. Existing team-slot replacement and selectable helper behavior stay intact. Shared tabs retain collection/archetypes/bestiary routes; archetype links target its section. Acquisition methods stay on existing full detail.

Verification: DOM plus Router/history integration, all 15 archetypes and missing portrait/name entrypoints, no seen/owned/claimed/currency mutation, old gift tests, full suite/build. Chromium remains blocked; no retry or claims of real-device/visual validation.

## Implementation detail

Only preview state uses the same-URL history marker. A single popstate listener is installed once to handle active previews and normalize stale Forward markers; per-preview keydown and route bindings are removed at close. Navigation requested during the asynchronous closing Back is deferred until that popstate completes. Explicit preview-to-route navigation replaces the preview entry (rather than adding a duplicate source entry).

Codex screens opt in to in-memory scroll preservation. Preview journeys can explicitly preserve their source even from team/prepare screens. Full card detail retains existing acquisition actions; returning from them restores its position. Targeted archetype sections scroll on first entry but do not override a restored position.

Reward engines and save format are unchanged. The four collection milestone quest names are updated only for clarity; IDs, counters, targets and rewards remain identical. The original 20-star-crystal opening gift remains visible and separate from browsing/first-acquisition rewards.
